import { renderMonitor, renderWindow, renderKeyboard, renderMouse, renderClipboard, renderIdle, _clearMonTimer } from './recorders.js';

var _sysTab = 'monitor';

function _cleanupCurrentTab() {
  if (_sysTab === 'monitor') _clearMonTimer();
}

export function renderSystem() {
  var content = document.getElementById('content');
  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="controls-row">' +
        '<div class="tab-bar">' +
          '<button class="tab-pill' + (_sysTab === 'monitor' ? ' active' : '') + '" onclick="systemTab(\'monitor\')">Monitor</button>' +
          '<button class="tab-pill' + (_sysTab === 'window' ? ' active' : '') + '" onclick="systemTab(\'window\')">Window</button>' +
          '<button class="tab-pill' + (_sysTab === 'keyboard' ? ' active' : '') + '" onclick="systemTab(\'keyboard\')">Keyboard</button>' +
          '<button class="tab-pill' + (_sysTab === 'mouse' ? ' active' : '') + '" onclick="systemTab(\'mouse\')">Mouse</button>' +
          '<button class="tab-pill' + (_sysTab === 'clipboard' ? ' active' : '') + '" onclick="systemTab(\'clipboard\')">Clipboard</button>' +
          '<button class="tab-pill' + (_sysTab === 'idle' ? ' active' : '') + '" onclick="systemTab(\'idle\')">Idle</button>' +
        '</div>' +
      '</div>' +
      '<div id="systemBody"></div>' +
    '</div>';

  _renderSysTab();
}

var _sysRenderers = {
  monitor: renderMonitor,
  window: renderWindow,
  keyboard: renderKeyboard,
  mouse: renderMouse,
  clipboard: renderClipboard,
  idle: renderIdle
};

function _renderSysTab() {
  var fn = _sysRenderers[_sysTab];
  if (fn) fn('systemBody');
}

export function systemTab(t) {
  _cleanupCurrentTab();
  _sysTab = t;
  var content = document.getElementById('content');
  if (content) content.querySelectorAll('.tab-pill').forEach(function(b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === t);
  });
  _renderSysTab();
}

export function systemCleanup() {
  _cleanupCurrentTab();
}

window.systemTab = systemTab;
