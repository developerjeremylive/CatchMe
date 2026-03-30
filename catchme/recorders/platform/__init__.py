"""Cross-platform window APIs — auto-selects the right backend."""

import sys

if sys.platform == "darwin":
    from .macos import get_active_window, get_browser_url, get_document_path
elif sys.platform == "win32":
    from .windows import get_active_window, get_browser_url, get_document_path
else:

    def get_active_window() -> dict:
        return {}

    def get_browser_url(app_name: str, pid: int) -> str:
        return ""

    def get_document_path(pid: int, title_hint: str) -> str:
        return ""


__all__ = ["get_active_window", "get_browser_url", "get_document_path"]
