"""All recorders. Import what you need or use ALL."""

import sys

from .clipboard import ClipboardRecorder
from .idle import IdleRecorder
from .keyboard import KeyboardRecorder
from .mouse import MouseRecorder
from .window import WindowRecorder

if sys.platform == "darwin":
    from .notification import NotificationRecorder

    ALL = [
        WindowRecorder,
        KeyboardRecorder,
        MouseRecorder,
        ClipboardRecorder,
        IdleRecorder,
        NotificationRecorder,
    ]
else:
    ALL = [WindowRecorder, KeyboardRecorder, MouseRecorder, ClipboardRecorder, IdleRecorder]
