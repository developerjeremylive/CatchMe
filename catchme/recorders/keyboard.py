"""Keyboard recorder — platform dispatcher.

macOS:   CGEventTap + Accessibility API  (keyboard_macos.py)
Windows: pynput + UI Automation          (keyboard_windows.py)
"""

import sys

if sys.platform == "darwin":
    from .keyboard_macos import KeyboardRecorder
elif sys.platform == "win32":
    from .keyboard_windows import KeyboardRecorder
else:
    from ..recorder import Emit

    class KeyboardRecorder:  # type: ignore[no-redef]
        kind = "keyboard"

        def start(self, emit: Emit) -> None:
            pass

        def stop(self) -> None:
            pass


__all__ = ["KeyboardRecorder"]
