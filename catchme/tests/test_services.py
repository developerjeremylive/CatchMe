"""Tests for catchme.services — load_config, save_config, defaults merging."""

from __future__ import annotations

import json
from unittest import mock

import catchme.services as svc


class TestLoadConfig:
    def test_returns_all_sections(self, cfg):
        with mock.patch.object(svc, "_get_config_path", return_value=cfg.config_path):
            svc._cached_config = None
            result = svc.load_config(path=cfg.config_path, reload=True)
        assert "web" in result
        assert "llm" in result
        assert "filter" in result
        assert "summarize" in result
        assert "retrieve" in result

    def test_defaults_applied(self, cfg):
        with mock.patch.object(svc, "_get_config_path", return_value=cfg.config_path):
            svc._cached_config = None
            result = svc.load_config(path=cfg.config_path, reload=True)
        assert result["web"]["host"] == "127.0.0.1"
        assert result["web"]["port"] == 8765
        assert result["llm"]["model"] == "gpt-4o-mini"
        assert result["filter"]["window_min_dwell"] == 3.0

    def test_file_overrides_defaults(self, cfg):
        cfg.config_path.write_text(
            json.dumps(
                {
                    "llm": {"model": "gpt-4o", "api_key": "sk-test"},
                }
            ),
            encoding="utf-8",
        )
        svc._cached_config = None
        result = svc.load_config(path=cfg.config_path, reload=True)
        assert result["llm"]["model"] == "gpt-4o"
        assert result["llm"]["api_key"] == "sk-test"
        assert result["llm"]["provider"] == "openai"  # default kept

    def test_caching(self, cfg):
        svc._cached_config = None
        r1 = svc.load_config(path=cfg.config_path, reload=True)
        r2 = svc.load_config(path=cfg.config_path)
        assert r1 is r2

    def test_reload_rereads(self, cfg):
        cfg.config_path.write_text(json.dumps({"llm": {"model": "gpt-3.5"}}), encoding="utf-8")
        svc._cached_config = None
        r1 = svc.load_config(path=cfg.config_path, reload=True)
        assert r1["llm"]["model"] == "gpt-3.5"

        cfg.config_path.write_text(json.dumps({"llm": {"model": "gpt-4o"}}), encoding="utf-8")
        r2 = svc.load_config(path=cfg.config_path, reload=True)
        assert r2["llm"]["model"] == "gpt-4o"

    def test_bad_json_falls_back(self, cfg):
        cfg.config_path.write_text("not valid json{{{", encoding="utf-8")
        svc._cached_config = None
        result = svc.load_config(path=cfg.config_path, reload=True)
        assert result["llm"]["model"] == "gpt-4o-mini"  # default


class TestSaveConfig:
    def test_save_creates_file(self, cfg):
        assert not cfg.config_path.exists()
        data = {"llm": {"model": "test"}, "web": {"port": 9999}}
        svc.save_config(data, path=cfg.config_path)
        assert cfg.config_path.exists()
        written = json.loads(cfg.config_path.read_text(encoding="utf-8"))
        assert written["web"]["port"] == 9999

    def test_save_overwrites(self, cfg):
        svc.save_config({"llm": {"model": "v1"}}, path=cfg.config_path)
        svc.save_config({"llm": {"model": "v2"}}, path=cfg.config_path)
        written = json.loads(cfg.config_path.read_text(encoding="utf-8"))
        assert written["llm"]["model"] == "v2"

    def test_save_updates_cache(self, cfg):
        data = {"llm": {"model": "cached"}}
        svc.save_config(data, path=cfg.config_path)
        assert svc._cached_config == data


class TestLegacyMigration:
    def test_base_url_migrated_to_api_url(self):
        cfg = {"llm": {"base_url": "https://custom.api/v1"}}
        svc._migrate_legacy_llm(cfg)
        assert cfg["llm"].get("api_url") == "https://custom.api/v1"
        assert "base_url" not in cfg["llm"]

    def test_api_url_takes_precedence(self):
        cfg = {"llm": {"base_url": "https://old/v1", "api_url": "https://new/v1"}}
        svc._migrate_legacy_llm(cfg)
        assert cfg["llm"]["api_url"] == "https://new/v1"
        assert "base_url" not in cfg["llm"]

    def test_no_llm_section_is_noop(self):
        cfg = {"web": {"port": 8000}}
        svc._migrate_legacy_llm(cfg)
        assert "llm" not in cfg
