"""Paths, intervals, and defaults. One place for all knobs."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Config:
    root: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "data")

    # Recorder intervals (seconds)
    window_interval: float = 1.0
    clipboard_interval: float = 1.0
    idle_interval: float = 5.0
    idle_timeout: float = 300.0
    scroll_session_timeout: float = 1.5

    # Engine
    batch_size: int = 100
    batch_timeout: float = 1.0

    # Pipelines
    pipeline_poll_interval: float = 5.0
    pipeline_batch_window: float = 60.0
    extension_ws_port: int = 8766

    @property
    def db_path(self) -> Path:
        return self.root / "data.db"

    @property
    def blob_dir(self) -> Path:
        return self.root / "blobs"

    @property
    def tree_dir(self) -> Path:
        return self.root / "trees"

    @property
    def workspace_dir(self) -> Path:
        return self.root / "workspace"

    @property
    def config_path(self) -> Path:
        return self.root / "config.json"

    @property
    def usage_path(self) -> Path:
        return self.root / "llm_usage.json"

    @property
    def notify_path(self) -> Path:
        return self.root / "summary_updates.jsonl"

    @property
    def monitor_history_path(self) -> Path:
        return self.root / "monitor_history.json"

    def ensure_dirs(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        self.blob_dir.mkdir(parents=True, exist_ok=True)
        self.tree_dir.mkdir(parents=True, exist_ok=True)
        (self.workspace_dir / "pdf").mkdir(parents=True, exist_ok=True)
        (self.workspace_dir / "html").mkdir(parents=True, exist_ok=True)


_default: Config | None = None


def get_default_config() -> Config:
    """Return a lazily-initialized default Config singleton."""
    global _default
    if _default is None:
        _default = Config()
        _default.ensure_dirs()
    return _default
