/**
 * CatchMe background service worker — WebSocket bridge between
 * browser extension and catchme Python backend.
 */

const WS_URL = "ws://127.0.0.1:8766/ws/extension";
const RECONNECT_DELAY = 5000;

let ws = null;
let lastUrl = "";

function connect() {
  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => console.log("[CatchMe] Connected to backend");
    ws.onclose = () => {
      ws = null;
      setTimeout(connect, RECONNECT_DELAY);
    };
    ws.onerror = () => {
      ws?.close();
    };
  } catch (_) {
    setTimeout(connect, RECONNECT_DELAY);
  }
}

function sendToBackend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

async function extractFromTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "extract" });
    if (response && response.url && response.url !== lastUrl) {
      lastUrl = response.url;
      sendToBackend({
        type: "page_content",
        ts: Date.now() / 1000,
        ...response,
      });
    }
  } catch (_) {
    // Content script not loaded yet
  }
}

// Extract on tab activation
chrome.tabs.onActivated.addListener(async (info) => {
  extractFromTab(info.tabId);
});

// Extract on navigation complete
chrome.webNavigation?.onCompleted?.addListener((details) => {
  if (details.frameId === 0) {
    extractFromTab(details.tabId);
  }
});

// Extract on tab URL change
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === "complete" && tab.active) {
    extractFromTab(tabId);
  }
});

connect();
