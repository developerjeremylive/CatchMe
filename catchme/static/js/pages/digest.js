import { api, esc, fmtHM, fmtDate } from '../utils.js';

var digestDate = new Date();
var _dgFilter = 'all';
var _dgTimer = null;
var _dgSeq = 0;
var _dgSSE = null;
var _DG_COL = { session: '#34C759', app: '#5AC8FA', location: '#30B0C7', action: '#BF5AF2' };

function _dgRenderFilters() {
  var el = document.getElementById('dgFilters');
  if (!el) return;
  var html = '';
  ['all', 'session', 'app', 'location', 'action'].forEach(function(l) {
    var cls = l === _dgFilter ? ' active' : '';
    html += '<button class="dg-filter-btn' + cls + '" onclick="dgSetFilter(\'' + l + '\')">' + (l === 'all' ? 'All' : l.charAt(0).toUpperCase() + l.slice(1)) + '</button>';
  });
  el.innerHTML = html;
}

function _dgApplyFilter() {
  document.querySelectorAll('.dg-card').forEach(function(c) {
    c.style.display = _dgFilter === 'all' ? '' : c.dataset.kind === _dgFilter ? '' : 'none';
  });
}

function _dgBuildCard(it, i) {
  var col = _DG_COL[it.kind] || '#8E8E93';
  var indent = Math.min(it.depth || 0, 3) * 20;
  var delay = Math.min((i || 0) * 30, 600);
  return '<div class="dg-card dk-' + it.kind + '" data-kind="' + it.kind + '" data-nid="' + esc(it.node_id || '') + '" style="margin-left:' + indent + 'px;animation-delay:' + delay + 'ms"><div class="dg-card-head"><span class="dg-card-dot" style="background:' + col + '"></span><span class="dg-card-kind">' + it.kind + '</span><span class="dg-card-title" title="' + esc(it.title) + '">' + esc(it.title.length > 40 ? it.title.slice(0, 38) + '\u2026' : it.title) + '</span><span class="dg-card-time">' + fmtHM(it.start) + ' \u2013 ' + fmtHM(it.end) + '</span></div><div class="dg-card-summary">' + esc(it.summary) + '</div></div>';
}

function _dgRefresh() {
  var seq = ++_dgSeq;
  var d = new Date(digestDate);
  var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  api('/api/digest?date=' + ds).then(function(items) {
    if (seq !== _dgSeq) return;
    var body = document.getElementById('dgBody');
    if (!body) return;
    if (!items || !items.length) { body.innerHTML = '<div class="dg-empty">No summaries for this day yet.<br><span style="font-size:12px">Summaries are generated as you work.</span></div>'; return; }
    body.innerHTML = items.map(function(it, i) {
      return _dgBuildCard(it, i);
    }).join('');
    _dgApplyFilter();
  });
}

function _dgStartSSE() {
  _dgStopSSE();
  try {
    _dgSSE = new EventSource('/api/events/summaries');
    _dgSSE.onmessage = function(ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.type === 'connected') return;
        if (!data.node_id || !data.summary) return;
        _dgHandleUpdate(data);
      } catch (e) { /* ignore parse errors */ }
    };
    _dgSSE.onerror = function() {
      _dgStopSSE();
      setTimeout(_dgStartSSE, 5000);
    };
  } catch (e) { /* SSE not supported, rely on polling */ }
}

function _dgStopSSE() {
  if (_dgSSE) {
    _dgSSE.close();
    _dgSSE = null;
  }
}

function _dgHandleUpdate(data) {
  var body = document.getElementById('dgBody');
  if (!body) return;

  var emptyEl = body.querySelector('.dg-empty');
  if (emptyEl) emptyEl.remove();

  var existing = body.querySelector('.dg-card[data-nid="' + data.node_id + '"]');
  if (existing) {
    var sumEl = existing.querySelector('.dg-card-summary');
    if (sumEl) sumEl.textContent = data.summary;
    return;
  }

  var item = {
    kind: data.kind,
    node_id: data.node_id,
    title: data.title || '',
    summary: data.summary,
    start: data.start || 0,
    end: data.end || 0,
    depth: data.kind === 'action' ? 3 : data.kind === 'location' ? 2 : data.kind === 'app' ? 1 : 0
  };
  var html = _dgBuildCard(item, 0);

  var startTs = item.start;
  var cards = body.querySelectorAll('.dg-card');
  var inserted = false;
  for (var i = 0; i < cards.length; i++) {
    var cardStart = parseFloat(cards[i].querySelector('.dg-card-time')
      ? cards[i].dataset.start || '0' : '0');
    if (!inserted && startTs < cardStart) {
      cards[i].insertAdjacentHTML('beforebegin', html);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    body.insertAdjacentHTML('beforeend', html);
  }

  _dgApplyFilter();
}

var _dgTargetId = 'content';

export function renderDigest(targetId) {
  _dgTargetId = targetId || 'content';
  if (_dgTimer) { clearInterval(_dgTimer); _dgTimer = null; }
  _dgStopSSE();
  var content = document.getElementById(_dgTargetId);
  content.innerHTML = '<div class="page-enter"><div class="page-title">Digest</div><div class="page-subtitle">AI-generated summaries of your day</div><div class="controls-row"><div class="date-nav"><button class="date-btn" onclick="dgShiftDate(-1)">&lsaquo;</button><span class="date-label">' + fmtDate(digestDate) + '</span><button class="date-btn" onclick="dgShiftDate(1)">&rsaquo;</button></div></div><div class="dg-filters" id="dgFilters"></div><div id="dgBody"><div class="dg-empty">Loading\u2026</div></div></div>';
  _dgRenderFilters();
  _dgRefresh();
  _dgStartSSE();
  _dgTimer = setInterval(_dgRefresh, 60000);
}

export function dgShiftDate(d) {
  digestDate.setDate(digestDate.getDate() + d);
  renderDigest(_dgTargetId);
}

export function dgSetFilter(f) {
  _dgFilter = f;
  _dgRenderFilters();
  _dgApplyFilter();
}

export function _getDgTimer() { return _dgTimer; }
export function _clearDgTimer() {
  if (_dgTimer) { clearInterval(_dgTimer); _dgTimer = null; }
  _dgStopSSE();
}

window.renderDigest = renderDigest;
window.dgShiftDate = dgShiftDate;
window.dgSetFilter = dgSetFilter;
