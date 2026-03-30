"""Tests for catchme.engine — Engine emitter, batch write, pause/resume."""

from __future__ import annotations

import threading
import time
from unittest import mock

from catchme.config import Config
from catchme.engine import Engine
from catchme.recorder import PollingRecorder


class _FakeRecorder(PollingRecorder):
    """Emits a single event per poll cycle."""

    kind = "fake"
    interval = 0.05

    def __init__(self):
        super().__init__()
        self.poll_count = 0

    def poll(self, emit):
        self.poll_count += 1
        emit({"seq": self.poll_count})


class TestEngineBasics:
    def test_emitter_queues_event(self, cfg, store):
        engine = Engine(cfg, store, [])
        emitter = engine._make_emitter("test_kind")

        with mock.patch.object(engine._organizer, "on_event"):
            emitter({"hello": "world"}, "")

        event = engine._queue.get(timeout=1)
        assert event.kind == "test_kind"
        assert event.data["hello"] == "world"

    def test_emitter_skips_when_paused(self, cfg, store):
        engine = Engine(cfg, store, [])
        engine.pause()
        emitter = engine._make_emitter("test_kind")

        with mock.patch.object(engine._organizer, "on_event"):
            emitter({"should": "skip"}, "")

        assert engine._queue.empty()

    def test_pause_and_resume(self, cfg, store):
        engine = Engine(cfg, store, [])
        assert not engine.paused
        engine.pause()
        assert engine.paused
        engine.resume()
        assert not engine.paused


class TestEngineOnEventCallback:
    def test_on_event_called(self, cfg, store):
        engine = Engine(cfg, store, [])
        received = []
        engine.on_event = lambda ev: received.append(ev)
        emitter = engine._make_emitter("cb_test")

        with mock.patch.object(engine._organizer, "on_event"):
            emitter({"n": 1})

        assert len(received) == 1
        assert received[0].kind == "cb_test"

    def test_on_event_exception_swallowed(self, cfg, store):
        engine = Engine(cfg, store, [])
        engine.on_event = mock.Mock(side_effect=RuntimeError("boom"))
        emitter = engine._make_emitter("err_test")

        with mock.patch.object(engine._organizer, "on_event"):
            emitter({"n": 1})

        assert not engine._queue.empty()


class TestEngineFlush:
    def test_flush_writes_remaining(self, cfg, store):
        engine = Engine(cfg, store, [])

        with mock.patch.object(engine._organizer, "on_event"):
            emitter = engine._make_emitter("flush_kind")
            for i in range(5):
                emitter({"i": i})

        engine._flush()
        assert store.count() == 5


class TestEngineBatchWrite:
    def test_write_loop_persists_events(self, cfg, store):
        cfg_fast = Config(
            root=cfg.root,
            batch_size=10,
            batch_timeout=0.1,
        )
        engine = Engine(cfg_fast, store, [])

        with (
            mock.patch.object(engine._organizer, "on_event"),
            mock.patch.object(engine._organizer, "run"),
        ):
            engine._stop.clear()
            writer = threading.Thread(target=engine._write_loop, daemon=True)
            writer.start()

            emitter = engine._make_emitter("batch_kind")
            for i in range(15):
                emitter({"i": i})

            time.sleep(0.5)
            engine._stop.set()
            writer.join(timeout=2)

        assert store.count() >= 15


class TestEngineWithFakeRecorder:
    def test_recorder_integration(self, cfg, store):
        rec = _FakeRecorder()
        engine = Engine(cfg, store, [rec])

        with mock.patch.object(engine._organizer, "run"):
            engine.start()
            time.sleep(0.3)
            engine.stop()

        assert rec.poll_count > 0
        assert store.count() > 0
