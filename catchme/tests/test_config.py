"""Tests for catchme.config — Config dataclass, path properties, ensure_dirs."""

from __future__ import annotations

from pathlib import Path

from catchme.config import Config


class TestConfigDefaults:
    def test_default_root_is_sibling_data(self):
        c = Config()
        assert c.root.name == "data"

    def test_properties_are_path_objects(self, cfg):
        assert isinstance(cfg.db_path, Path)
        assert isinstance(cfg.blob_dir, Path)
        assert isinstance(cfg.tree_dir, Path)
        assert isinstance(cfg.workspace_dir, Path)
        assert isinstance(cfg.config_path, Path)
        assert isinstance(cfg.usage_path, Path)
        assert isinstance(cfg.notify_path, Path)
        assert isinstance(cfg.monitor_history_path, Path)

    def test_db_path_under_root(self, cfg):
        assert cfg.db_path.parent == cfg.root
        assert cfg.db_path.name == "data.db"

    def test_paths_consistent(self, cfg):
        assert cfg.blob_dir == cfg.root / "blobs"
        assert cfg.tree_dir == cfg.root / "trees"
        assert cfg.workspace_dir == cfg.root / "workspace"
        assert cfg.config_path == cfg.root / "config.json"
        assert cfg.usage_path == cfg.root / "llm_usage.json"
        assert cfg.notify_path == cfg.root / "summary_updates.jsonl"


class TestConfigEnsureDirs:
    def test_directories_created(self, tmp_root):
        c = Config(root=tmp_root)
        assert not tmp_root.exists()
        c.ensure_dirs()
        assert tmp_root.is_dir()
        assert c.blob_dir.is_dir()
        assert c.tree_dir.is_dir()
        assert (c.workspace_dir / "pdf").is_dir()
        assert (c.workspace_dir / "html").is_dir()

    def test_ensure_dirs_idempotent(self, cfg):
        cfg.ensure_dirs()
        cfg.ensure_dirs()
        assert cfg.root.is_dir()


class TestConfigCustomRoot:
    def test_custom_root_propagates(self, tmp_path):
        custom = tmp_path / "my_data"
        c = Config(root=custom)
        assert c.db_path == custom / "data.db"
        assert c.blob_dir == custom / "blobs"


class TestConfigIntervals:
    def test_default_intervals_reasonable(self):
        c = Config()
        assert c.window_interval > 0
        assert c.clipboard_interval > 0
        assert c.idle_timeout > c.idle_interval
        assert c.batch_size > 0
        assert c.batch_timeout > 0

    def test_override_intervals(self, tmp_path):
        c = Config(root=tmp_path, window_interval=2.0, batch_size=50)
        assert c.window_interval == 2.0
        assert c.batch_size == 50
