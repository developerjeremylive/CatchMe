import { esc, showToast } from '../utils.js';

/* ── State ── */
var _busy = false;
var _controller = null;
var _chatEl = null;
var _chatMode = 'panel'; // 'panel' or 'main'

function _ensureChatEl() {
  if (_chatEl) return _chatEl;
  _chatEl = document.createElement('div');
  _chatEl.className = 'chat-wrap';
  _chatEl.innerHTML =
    '<div class="chat-mode-bar">' +
      '<button class="chat-mode-btn" id="chatModeBtn" onclick="moveChatMode()"></button>' +
    '</div>' +
    '<div class="chat-messages" id="chatMessages">' +
      _emptyState() +
    '</div>' +
    '<div class="chat-input-bar">' +
      '<div class="chat-input-wrap">' +
        '<textarea class="chat-input" id="chatInput" rows="1" placeholder="Ask anything about your memory\u2026"></textarea>' +
        '<button class="chat-send-btn" id="chatSend" title="Send">' +
          '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

  _chatEl.querySelector('#chatInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _submit(); }
  });
  _chatEl.querySelector('#chatInput').addEventListener('input', _autoResize);
  _chatEl.querySelector('#chatSend').addEventListener('click', _submit);
  return _chatEl;
}

function _updateModeBtn() {
  var btn = document.getElementById('chatModeBtn');
  if (!btn) return;
  if (_chatMode === 'panel') {
    btn.innerHTML = '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M3 3h12v12H3z" stroke="currentColor" fill="none" stroke-width="1.4" rx="2"/><path d="M9 3v12" stroke="currentColor" stroke-width="1.4"/></svg><span>Pop out</span>';
    btn.title = 'Move chat to main area';
  } else {
    btn.innerHTML = '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M3 3h12v12H3z" stroke="currentColor" fill="none" stroke-width="1.4" rx="2"/><path d="M12 3v12" stroke="currentColor" stroke-width="1.4"/></svg><span>Dock to sidebar</span>';
    btn.title = 'Move chat to sidebar panel';
  }
}

/* ── Place chat into the sidebar panel ── */
export function renderChat() {
  var el = _ensureChatEl();
  var target = document.getElementById('chatPanelContent');
  if (!target) return;
  target.innerHTML = '';
  target.appendChild(el);
  _chatMode = 'panel';
  _updateModeBtn();
}

/* ── Place chat into #content (main page) ── */
export function renderChatMain() {
  var content = document.getElementById('content');
  if (!content) return;
  var el = _ensureChatEl();
  content.innerHTML =
    '<div class="page-enter chat-page">' +
      '<div class="page-title">Chat</div>' +
      '<div class="page-subtitle">Ask questions about your activity history</div>' +
      '<div id="chatMainHost" class="chat-main-host"></div>' +
    '</div>';
  document.getElementById('chatMainHost').appendChild(el);
  content.style.paddingBottom = '0';
  _chatMode = 'main';
  _updateModeBtn();
  var panel = document.getElementById('chatPanel');
  if (panel) panel.classList.remove('open');
}

/* ── Toggle between panel and main ── */
export function moveChatMode() {
  if (_chatMode === 'panel') {
    if (window.nav) window.nav('chat');
  } else {
    renderChat();
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.add('open');
  }
}
window.moveChatMode = moveChatMode;

export function toggleChatPanel() {
  var panel = document.getElementById('chatPanel');
  if (!panel) return;
  if (_chatMode === 'main') {
    renderChat();
  }
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    var input = document.getElementById('chatInput');
    if (input) setTimeout(function() { input.focus(); }, 200);
  }
}
window.toggleChatPanel = toggleChatPanel;

function _emptyState() {
  return '<div class="chat-empty">' +
    '<div class="chat-empty-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>' +
    '<div class="chat-empty-title">Memory Retrieval</div>' +
    '<div class="chat-empty-sub">Ask a question and the AI will navigate your activity tree to find relevant information — no vector search, pure reasoning.</div>' +
  '</div>';
}

function _autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
}

/* ── Submit ── */
function _submit() {
  if (_busy) return;
  var input = document.getElementById('chatInput');
  var query = (input.value || '').trim();
  if (!query) return;

  var msgs = document.getElementById('chatMessages');
  if (msgs.querySelector('.chat-empty')) msgs.innerHTML = '';

  _appendUser(msgs, query);
  input.value = '';
  input.style.height = 'auto';
  _setDisabled(true);
  _streamQuery(msgs, query);
}

function _setDisabled(v) {
  _busy = v;
  var btn = document.getElementById('chatSend');
  var input = document.getElementById('chatInput');
  if (btn) btn.disabled = v;
  if (input) input.disabled = v;
}

/* ── User bubble ── */
function _appendUser(container, text) {
  var d = document.createElement('div');
  d.className = 'chat-user';
  d.textContent = text;
  container.appendChild(d);
  _scrollBottom(container);
}

/* ── Stream retrieval ── */
function _streamQuery(container, query) {
  var block = document.createElement('div');
  block.className = 'chat-assistant';

  var trace = document.createElement('div');
  trace.className = 'chat-trace';
  block.appendChild(trace);

  var thinking = _makeThinking();
  block.appendChild(thinking);

  container.appendChild(block);
  _scrollBottom(container);

  _controller = new AbortController();

  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query }),
    signal: _controller.signal,
  }).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          _onDone(block, thinking);
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf('data: ') === 0) {
            try {
              var step = JSON.parse(line.slice(6));
              _renderStep(trace, block, step, thinking);
              _scrollBottom(container);
            } catch (e) { /* skip malformed */ }
          }
        }
        return pump();
      });
    }
    return pump();
  }).catch(function(err) {
    if (err.name !== 'AbortError') {
      showToast('Chat error: ' + err.message, 'warn');
    }
    _onDone(block, thinking);
  });
}

function _onDone(block, thinking) {
  if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
  _setDisabled(false);
  _controller = null;
  var input = document.getElementById('chatInput');
  if (input) input.focus();
}

/* ── Thinking indicator ── */
function _makeThinking() {
  var d = document.createElement('div');
  d.className = 'chat-thinking';
  d.innerHTML = '<div class="chat-thinking-bar"></div><span>Searching memory\u2026</span>';
  return d;
}

/* ── Render a step ── */
function _renderStep(trace, block, step, thinking) {
  if (step.type === 'time_filter') {
    _renderTimeFilter(trace, step);
    var label0 = thinking.querySelector('span:last-child');
    if (label0) label0.textContent = 'Filtering by time\u2026';
  } else if (step.type === 'browse') {
    _renderBrowse(trace, step);
    var label = thinking.querySelector('span:last-child');
    if (label) label.textContent = 'Exploring ' + _levelLabel(step.level) + '\u2026';
  } else if (step.type === 'read') {
    _renderRead(trace, step);
    var label2 = thinking.querySelector('span:last-child');
    if (label2) label2.textContent = 'Evaluating ' + step.nodes.length + ' node' + (step.nodes.length > 1 ? 's' : '') + '\u2026';
  } else if (step.type === 'inspect') {
    _renderInspect(trace, step);
    var label3 = thinking.querySelector('span:last-child');
    if (label3) label3.textContent = 'Examining screenshot\u2026';
  } else if (step.type === 'answer') {
    if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
    _renderAnswer(block, step);
  } else if (step.type === 'error') {
    if (thinking && thinking.parentNode) thinking.parentNode.removeChild(thinking);
    _renderError(block, step);
  }
}

function _levelLabel(kind) {
  var m = { day: 'days', session: 'sessions', app: 'apps', location: 'locations', action: 'actions', raw_keyboard: 'keyboard data', raw_mouse: 'mouse clusters', raw_file: 'file content', raw_url: 'web page' };
  return m[kind] || kind;
}

/* ── Time-filter step card ── */
function _renderTimeFilter(trace, step) {
  var card = document.createElement('div');
  card.className = 'trace-step';

  var parts = [];
  if (step.dates && step.dates.length) {
    parts.push(step.dates.join(', '));
  }
  if (step.start_hour != null || step.end_hour != null) {
    var sh = step.start_hour != null ? (step.start_hour < 10 ? '0' : '') + step.start_hour + ':00' : '00:00';
    var eh = step.end_hour != null ? (step.end_hour < 10 ? '0' : '') + step.end_hour + ':00' : '24:00';
    parts.push(sh + ' \u2013 ' + eh);
  }
  var summary = parts.length ? parts.join('  ') : 'Time detected';

  card.innerHTML =
    '<div class="trace-step-header">' +
      '<div class="trace-step-icon time-filter">' + _clockIcon() + '</div>' +
      '<span class="trace-step-label">Time filter</span>' +
      '<span class="trace-step-meta">' + esc(summary) + '</span>' +
      '<svg class="trace-step-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</div>' +
    '<div class="trace-step-body">' +
      (step.reasoning ? '<div class="trace-reasoning">' + esc(step.reasoning) + '</div>' : '') +
    '</div>';

  card.querySelector('.trace-step-header').addEventListener('click', function() {
    card.classList.toggle('open');
  });

  trace.appendChild(card);
}

/* ── Browse step card ── */
function _renderBrowse(trace, step) {
  var card = document.createElement('div');
  card.className = 'trace-step';

  var selectedIds = {};
  (step.selected || []).forEach(function(n) { selectedIds[n.node_id] = true; });
  var selCount = step.selected ? step.selected.length : 0;
  var totalCount = step.candidates ? step.candidates.length : 0;

  card.innerHTML =
    '<div class="trace-step-header">' +
      '<div class="trace-step-icon browse">' + _browseIcon() + '</div>' +
      '<span class="trace-step-label">Browsing ' + _levelLabel(step.level) + '</span>' +
      '<span class="trace-step-meta">' + selCount + ' / ' + totalCount + ' selected</span>' +
      '<svg class="trace-step-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</div>' +
    '<div class="trace-step-body">' +
      '<div class="trace-nodes">' +
        (step.candidates || []).map(function(n) {
          var sel = selectedIds[n.node_id];
          return '<div class="trace-pill' + (sel ? ' selected' : '') + '" title="' + esc(n.summary_preview || '') + '">' +
            (sel ? '<span class="trace-pill-icon">\u2713</span>' : '') +
            esc(_truncate(n.title, 40)) +
          '</div>';
        }).join('') +
      '</div>' +
      (step.reasoning ? '<div class="trace-reasoning">' + esc(step.reasoning) + '</div>' : '') +
    '</div>';

  card.querySelector('.trace-step-header').addEventListener('click', function() {
    card.classList.toggle('open');
  });

  trace.appendChild(card);
}

/* ── Read step card ── */
function _renderRead(trace, step) {
  var card = document.createElement('div');
  card.className = 'trace-step';

  var usefulCount = 0;
  (step.nodes || []).forEach(function(n) { if (n.useful) usefulCount++; });

  var nodesHtml = (step.nodes || []).map(function(n) {
    var cls = n.useful ? ' useful' : ' not-useful';
    var icon = n.useful ? '\u2713' : '\u2717';
    return '<div class="trace-pill' + cls + '">' +
      '<span class="trace-pill-icon">' + icon + '</span>' +
      esc(_truncate(n.title, 40)) +
    '</div>' +
    (n.extract ? '<div class="trace-extract">' + esc(n.extract) + '</div>' : '');
  }).join('');

  var actionLabel = step.action === 'deeper' ? 'Drilling deeper' :
                    step.action === 'siblings' ? 'Exploring more' : 'Ready to answer';

  card.innerHTML =
    '<div class="trace-step-header">' +
      '<div class="trace-step-icon read">' + _readIcon() + '</div>' +
      '<span class="trace-step-label">' + usefulCount + ' useful of ' + (step.nodes || []).length + ' read</span>' +
      '<span class="trace-step-meta">' + actionLabel + '</span>' +
      '<svg class="trace-step-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</div>' +
    '<div class="trace-step-body">' +
      '<div class="trace-nodes">' + nodesHtml + '</div>' +
      (step.reasoning ? '<div class="trace-reasoning">' + esc(step.reasoning) + '</div>' : '') +
    '</div>';

  card.querySelector('.trace-step-header').addEventListener('click', function() {
    card.classList.toggle('open');
  });

  trace.appendChild(card);
}

/* ── Inspect step card (screenshot) ── */
function _renderInspect(trace, step) {
  var card = document.createElement('div');
  card.className = 'trace-step';

  var usefulCls = step.useful ? ' useful' : ' not-useful';
  var usefulIcon = step.useful ? '\u2713' : '\u2717';

  card.innerHTML =
    '<div class="trace-step-header">' +
      '<div class="trace-step-icon inspect">' + _inspectIcon() + '</div>' +
      '<span class="trace-step-label">Inspecting screenshot</span>' +
      '<span class="trace-step-meta">' + (step.useful ? 'Useful' : 'Not useful') + '</span>' +
      '<svg class="trace-step-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '</div>' +
    '<div class="trace-step-body">' +
      '<div class="trace-inspect-row">' +
        (step.image_url ? '<img class="trace-inspect-img" src="' + esc(step.image_url) + '" alt="screenshot" loading="lazy">' : '') +
        '<div class="trace-inspect-info">' +
          '<div class="trace-pill' + usefulCls + '"><span class="trace-pill-icon">' + usefulIcon + '</span>' + esc(_truncate(step.title, 50)) + '</div>' +
          (step.extract ? '<div class="trace-extract">' + esc(step.extract) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (step.reasoning ? '<div class="trace-reasoning">' + esc(step.reasoning) + '</div>' : '') +
    '</div>';

  card.querySelector('.trace-step-header').addEventListener('click', function() {
    card.classList.toggle('open');
  });

  if (step.image_url) {
    var img = card.querySelector('.trace-inspect-img');
    if (img) {
      img.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.openLightbox) window.openLightbox(step.image_url);
      });
    }
  }

  trace.appendChild(card);
}

/* ── Answer block ── */
function _renderAnswer(block, step) {
  var div = document.createElement('div');
  div.className = 'chat-answer';
  div.innerHTML = _renderMarkdown(step.content || '');

  if (step.sources && step.sources.length) {
    div.innerHTML += '<div class="chat-sources">' +
      '<div class="chat-sources-label">Sources</div>' +
      step.sources.map(function(s) {
        return '<span class="chat-source-tag">' + esc(s) + '</span>';
      }).join('') +
    '</div>';
  }
  block.appendChild(div);
}

/* ── Error block ── */
function _renderError(block, step) {
  var div = document.createElement('div');
  div.className = 'chat-answer';
  div.style.borderColor = 'var(--c-mouse)';
  div.textContent = step.message || 'An error occurred.';
  block.appendChild(div);
}

/* ── Helpers ── */

function _truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '\u2026' : s;
}

function _scrollBottom(el) {
  requestAnimationFrame(function() { el.scrollTop = el.scrollHeight; });
}

function _clockIcon() {
  return '<svg viewBox="0 0 16 16" width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 1.5"/></svg>';
}

function _browseIcon() {
  return '<svg viewBox="0 0 16 16" width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><circle cx="6.5" cy="6.5" r="4"/><path d="M10 10l3.5 3.5"/></svg>';
}

function _readIcon() {
  return '<svg viewBox="0 0 16 16" width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M2 3h4l2 2h6v8H2z"/></svg>';
}

function _inspectIcon() {
  return '<svg viewBox="0 0 16 16" width="12" height="12" style="stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><rect x="2" y="2" width="12" height="10" rx="1"/><circle cx="6" cy="7" r="2"/><path d="M14 12l-3-3"/></svg>';
}

function _renderMarkdown(text) {
  if (!text) return '';

  var codeBlocks = [];
  var src = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    var idx = codeBlocks.length;
    codeBlocks.push('<pre class="chat-code"><code>' + esc(code.trim()) + '</code></pre>');
    return '\x00CB' + idx + '\x00';
  });

  src = esc(src);

  src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  src = src.replace(/`([^`]+)`/g, '<code>$1</code>');

  var lines = src.split('\n');
  var tokens = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];

    var cbm = ln.match(/^\x00CB(\d+)\x00$/);
    if (cbm) { tokens.push({ type: 'code', html: codeBlocks[parseInt(cbm[1])] }); continue; }

    var hm = ln.match(/^(#{1,4})\s+(.*)/);
    if (hm) { tokens.push({ type: 'heading', level: hm[1].length, text: hm[2] }); continue; }

    var ulm = ln.match(/^(\s*)[\-\*]\s+(.*)/);
    if (ulm) { tokens.push({ type: 'ul', indent: ulm[1].length, text: ulm[2] }); continue; }

    var olm = ln.match(/^(\s*)\d+[\.\)]\s+(.*)/);
    if (olm) { tokens.push({ type: 'ol', indent: olm[1].length, text: olm[2] }); continue; }

    if (ln.trim() === '') { tokens.push({ type: 'blank' }); continue; }

    if (/^\|.+\|/.test(ln.trim())) {
      tokens.push({ type: 'table_row', raw: ln.trim() });
      continue;
    }

    if (tokens.length && (tokens[tokens.length-1].type === 'ul' || tokens[tokens.length-1].type === 'ol') && /^\s{2,}/.test(ln)) {
      tokens[tokens.length-1].text += ' ' + ln.trim();
      continue;
    }

    tokens.push({ type: 'text', text: ln });
  }

  var html = '';
  var idx = 0;
  while (idx < tokens.length) {
    var t = tokens[idx];

    if (t.type === 'code') { html += t.html; idx++; continue; }

    if (t.type === 'heading') {
      var tag = t.level <= 2 ? 'h3' : 'h4';
      html += '<' + tag + ' class="chat-heading">' + t.text + '</' + tag + '>';
      idx++; continue;
    }

    if (t.type === 'ul' || t.type === 'ol') {
      var listTag = t.type === 'ol' ? 'ol' : 'ul';
      html += _buildNestedList(tokens, idx, listTag);
      while (idx < tokens.length && (tokens[idx].type === 'ul' || tokens[idx].type === 'ol')) idx++;
      continue;
    }

    if (t.type === 'table_row') {
      var rows = [];
      while (idx < tokens.length && tokens[idx].type === 'table_row') {
        rows.push(tokens[idx].raw);
        idx++;
      }
      html += _buildTable(rows);
      continue;
    }

    if (t.type === 'blank') { idx++; continue; }

    var para = [];
    while (idx < tokens.length && tokens[idx].type === 'text') {
      para.push(tokens[idx].text);
      idx++;
    }
    html += '<p>' + para.join('<br>') + '</p>';
  }

  return html;
}

function _buildNestedList(tokens, start, defaultTag) {
  var items = [];
  var i = start;
  while (i < tokens.length && (tokens[i].type === 'ul' || tokens[i].type === 'ol')) {
    items.push(tokens[i]);
    i++;
  }
  if (!items.length) return '';

  var baseIndent = items[0].indent || 0;
  var tagStack = [defaultTag];
  var html = '<' + defaultTag + '>';
  var prevDepth = 0;
  var firstItem = true;

  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var depth = Math.floor(((item.indent || 0) - baseIndent) / 2);
    var tag = item.type === 'ol' ? 'ol' : 'ul';

    if (depth > prevDepth) {
      for (var d = prevDepth; d < depth; d++) {
        html += '<' + tag + '>';
        tagStack.push(tag);
      }
    } else if (depth < prevDepth) {
      html += '</li>';
      for (var d2 = prevDepth; d2 > depth; d2--) {
        html += '</' + tagStack.pop() + '></li>';
      }
    } else if (!firstItem) {
      html += '</li>';
    }

    html += '<li>' + item.text;
    prevDepth = depth;
    firstItem = false;
  }

  html += '</li>';
  while (tagStack.length > 1) {
    html += '</' + tagStack.pop() + '></li>';
  }
  html += '</' + tagStack.pop() + '>';
  return html;
}

function _buildTable(rows) {
  if (rows.length < 1) return '';

  function parseCells(row) {
    var parts = row.split('|');
    if (parts[0].trim() === '') parts.shift();
    if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.map(function(c) { return c.trim(); });
  }

  var headers = parseCells(rows[0]);
  var startBody = 1;
  var aligns = [];

  if (rows.length > 1 && /^[\|\s\-:]+$/.test(rows[1])) {
    var sepCells = parseCells(rows[1]);
    for (var s = 0; s < sepCells.length; s++) {
      var sc = sepCells[s];
      if (/^:-+:$/.test(sc)) aligns.push('center');
      else if (/^-+:$/.test(sc)) aligns.push('right');
      else aligns.push('');
    }
    startBody = 2;
  }

  var html = '<table class="chat-table"><thead><tr>';
  for (var h = 0; h < headers.length; h++) {
    var ha = aligns[h] ? ' style="text-align:' + aligns[h] + '"' : '';
    html += '<th' + ha + '>' + headers[h] + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var r = startBody; r < rows.length; r++) {
    var cells = parseCells(rows[r]);
    html += '<tr>';
    for (var c = 0; c < headers.length; c++) {
      var ca = aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '';
      html += '<td' + ca + '>' + (cells[c] || '') + '</td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}
