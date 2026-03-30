"""OpenAI-compatible LLM client for catchme.

Wraps the ``openai`` Python package so any OpenAI-compatible endpoint works.
Configure four fields in ``services/config.json``::

    {
        "llm": {
            "provider": "openrouter",
            "api_key": "sk-or-...",
            "api_url": "https://openrouter.ai/api/v1",
            "model": "google/gemini-3-flash-preview"
        }
    }

If ``api_url`` is omitted, a default URL is looked up from the provider name.
See ``providers.py`` for the full list of supported providers.

Usage::

    from catchme.services.llm import LLM

    llm = LLM()                                  # reads config.json
    llm = LLM(model="gpt-4o", api_key="sk-...")  # explicit override

    answer = llm.complete([{"role": "user", "content": "Hi"}])
    answer = await llm.acomplete(messages)
"""

from __future__ import annotations

import base64
import json
import logging
import os
import tempfile
import threading
import time as _time
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_MIME_MAP = {
    "jpg": "jpeg",
    "jpeg": "jpeg",
    "png": "png",
    "webp": "webp",
    "gif": "gif",
}


def _get_usage_path() -> Path:
    from ..config import get_default_config

    return get_default_config().usage_path


def _load_llm_config() -> dict[str, Any]:
    from catchme.services import load_config

    return load_config().get("llm", {})


class _CallBudget:
    """Process-global LLM call counter. Thread-safe.

    ``max_calls = 0`` means unlimited.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._count = 0
        self._max = 0
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            cfg = _load_llm_config()
            self._max = int(cfg.get("max_calls", 0))
            self._loaded = True

    def acquire(self) -> bool:
        """Return True if a call is allowed; False if budget exhausted."""
        with self._lock:
            self._ensure_loaded()
            if self._max <= 0:
                self._count += 1
                return True
            if self._count >= self._max:
                return False
            self._count += 1
            return True

    @property
    def count(self) -> int:
        return self._count

    @property
    def remaining(self) -> int:
        with self._lock:
            self._ensure_loaded()
            if self._max <= 0:
                return -1
            return max(0, self._max - self._count)


_budget = _CallBudget()


class _TokenTracker:
    """Process-global token usage tracker. Thread-safe.

    Stores per-call records and persists to ``data/llm_usage.json`` so
    that the separate *web* process can read the statistics produced by
    the *awake* process.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._records: list[tuple[float, int, int]] = []
        self._prompt_total = 0
        self._completion_total = 0

    def record(self, prompt_tokens: int, completion_tokens: int) -> None:
        ts = _time.time()
        with self._lock:
            self._records.append((ts, prompt_tokens, completion_tokens))
            self._prompt_total += prompt_tokens
            self._completion_total += completion_tokens
        self._persist()

    @property
    def totals(self) -> dict[str, int]:
        return {
            "prompt": self._prompt_total,
            "completion": self._completion_total,
            "total": self._prompt_total + self._completion_total,
        }

    def history(self) -> list[tuple[float, int, int]]:
        """Return a copy of all (ts, prompt_tokens, completion_tokens) records."""
        with self._lock:
            return list(self._records)

    def _persist(self) -> None:
        """Atomically merge current session with all known data on disk."""
        try:
            path = _get_usage_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            with self._lock:
                my_history = [
                    {"ts": r[0], "prompt": r[1], "completion": r[2]} for r in self._records
                ]
            existing_history: list[dict] = []
            try:
                if path.is_file():
                    with open(path, encoding="utf-8") as f:
                        existing_history = json.load(f).get("history", [])
            except Exception:
                pass
            my_ts = {r["ts"] for r in my_history}
            merged = [r for r in existing_history if r["ts"] not in my_ts]
            merged.extend(my_history)
            merged.sort(key=lambda r: r["ts"])
            if len(merged) > 100000:
                merged = merged[-100000:]
            total_p = sum(r["prompt"] for r in merged)
            total_c = sum(r["completion"] for r in merged)
            data = {
                "call_count": len(merged),
                "tokens": {
                    "prompt": total_p,
                    "completion": total_c,
                    "total": total_p + total_c,
                },
                "history": merged,
            }
            fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp", prefix=".llm_usage_")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(data, f)
                os.replace(tmp, str(path))
            except BaseException:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
        except Exception:
            log.debug("failed to persist LLM usage", exc_info=True)


_token_tracker = _TokenTracker()


def load_usage_from_disk() -> dict[str, Any]:
    """Read persisted LLM usage (called by the web process).

    Returns a dict compatible with the ``/api/monitor`` response shape.
    Falls back to zeros if the file does not exist yet.
    """
    path = _get_usage_path()
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "call_count": 0,
            "tokens": {"prompt": 0, "completion": 0, "total": 0},
            "history": [],
        }


class LLMBudgetExhausted(Exception):
    """Raised when the process-wide LLM call budget is exhausted."""


class LLM:
    """Thin, lazy wrapper around the OpenAI chat-completions API.

    Reads ``provider``, ``api_key``, ``api_url``, ``model`` from
    ``config.json``.  Both sync and async clients are created on first use.
    """

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        api_url: str | None = None,
    ) -> None:
        cfg = _load_llm_config()

        self.model = model or cfg.get("model") or os.getenv("LLM_MODEL", "gpt-4o-mini")

        self._api_key = api_key or cfg.get("api_key") or os.getenv("OPENAI_API_KEY", "")

        url = api_url or cfg.get("api_url")
        if not url:
            from catchme.services.providers import get_default_api_url

            url = get_default_api_url(cfg.get("provider", "openai"))
        self._api_url = url or os.getenv("OPENAI_BASE_URL")

        self._client = None
        self._aclient = None

        log.info(
            "LLM: model=%s  provider=%s  api_url=%s",
            self.model,
            cfg.get("provider", "?"),
            self._api_url or "(default)",
        )

    # -- lazy clients ------------------------------------------------------

    @property
    def client(self):
        """Sync ``openai.OpenAI`` client (created on first access)."""
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(
                api_key=self._api_key,
                base_url=self._api_url,
            )
        return self._client

    @property
    def aclient(self):
        """Async ``openai.AsyncOpenAI`` client (created on first access)."""
        if self._aclient is None:
            from openai import AsyncOpenAI

            self._aclient = AsyncOpenAI(
                api_key=self._api_key,
                base_url=self._api_url,
            )
        return self._aclient

    # -- sync completions --------------------------------------------------

    @staticmethod
    def budget_remaining() -> int:
        """Number of LLM calls left (-1 = unlimited)."""
        return _budget.remaining

    @staticmethod
    def call_count() -> int:
        return _budget.count

    @staticmethod
    def token_totals() -> dict[str, int]:
        """Return ``{"prompt": N, "completion": N, "total": N}``."""
        return _token_tracker.totals

    @staticmethod
    def token_history() -> list[tuple[float, int, int]]:
        """Return list of ``(timestamp, prompt_tokens, completion_tokens)``."""
        return _token_tracker.history()

    def _check_budget(self) -> None:
        if not _budget.acquire():
            raise LLMBudgetExhausted(
                f"LLM call limit reached ({_budget.count} calls). "
                "Increase llm.max_calls in config.json or set to 0 for unlimited."
            )

    def complete(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs,
    ) -> str:
        """Blocking chat completion.  Returns the assistant's text."""
        self._check_budget()
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        if resp.usage:
            _token_tracker.record(
                resp.usage.prompt_tokens or 0,
                resp.usage.completion_tokens or 0,
            )
        return resp.choices[0].message.content or ""

    def stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs,
    ) -> Iterator[str]:
        """Streaming chat completion.  Yields content-delta strings."""
        self._check_budget()
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )
        for chunk in resp:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # -- async completions -------------------------------------------------

    async def acomplete(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs,
    ) -> str:
        """Async chat completion.  Returns the assistant's text."""
        self._check_budget()
        resp = await self.aclient.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        if resp.usage:
            _token_tracker.record(
                resp.usage.prompt_tokens or 0,
                resp.usage.completion_tokens or 0,
            )
        return resp.choices[0].message.content or ""

    async def astream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs,
    ) -> AsyncIterator[str]:
        """Async streaming chat completion.  Yields content-delta strings."""
        self._check_budget()
        resp = await self.aclient.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )
        async for chunk in resp:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # -- vision helpers ----------------------------------------------------

    def complete_with_vision(
        self,
        prompt: str,
        image_paths: list[str],
        detail: str = "auto",
        **kwargs,
    ) -> str:
        """Send images + text prompt through the vision API (sync).

        Budget is checked inside ``complete()``.
        """
        messages = [
            {
                "role": "user",
                "content": self._build_vision_content(
                    prompt,
                    image_paths,
                    detail,
                ),
            }
        ]
        return self.complete(messages, **kwargs)

    async def acomplete_with_vision(
        self,
        prompt: str,
        image_paths: list[str],
        detail: str = "auto",
        **kwargs,
    ) -> str:
        """Send images + text prompt through the vision API (async)."""
        messages = [
            {
                "role": "user",
                "content": self._build_vision_content(
                    prompt,
                    image_paths,
                    detail,
                ),
            }
        ]
        return await self.acomplete(messages, **kwargs)

    @staticmethod
    def _build_vision_content(
        prompt: str,
        image_paths: list[str],
        detail: str,
    ) -> list[dict]:
        content: list[dict] = []
        for p in image_paths:
            raw = Path(p).read_bytes()
            b64 = base64.b64encode(raw).decode()
            ext = Path(p).suffix.lstrip(".").lower()
            mime = _MIME_MAP.get(ext, "jpeg")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/{mime};base64,{b64}",
                        "detail": detail,
                    },
                }
            )
        content.append({"type": "text", "text": prompt})
        return content
