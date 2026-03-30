import { api, esc, fmtTs, fmtHM, fmtDuration, KIND_COL, TRACKS } from '../utils.js';

var tlSpan = 3600, tlSince = 0, tlUntil = 0, tlReady = false, tlCache = {};
var defaultZooms = [{ l: '5m', s: 300 }, { l: '15m', s: 900 }, { l: '1h', s: 3600 }, { l: '4h', s: 14400 }, { l: '24h', s: 86400 }];
var tlZooms = JSON.parse(localStorage.getItem('catchme-zooms') || 'null') || defaultZooms.slice();
var tlWheelTimer = null, zeEditIdx = -2;
var _tlRafPending = false;
var _tlTargetId = 'content';
var _tlRenderedSince = 0, _tlRenderedRange = 0;
var _tlTrackBars = [];

function saveZooms() { localStorage.setItem('catchme-zooms', JSON.stringify(tlZooms)); }

function buildTimeAxis(since, until, range) {
  var step;
  if (range <= 600) step = 60;
  else if (range <= 1800) step = 300;
  else if (range <= 7200) step = 900;
  else if (range <= 28800) step = 3600;
  else step = 7200;
  var labels = '', t = Math.ceil(since / step) * step;
  while (t < until) {
    var pct = ((t - since) / range) * 100;
    var lbl = range <= 1800 ? new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : fmtHM(t);
    labels += '<span class="tl-axis-label" style="left:' + pct + '%">' + lbl + '</span>';
    t += step;
  }
  return '<div class="tl-track tl-axis-row"><div class="tl-track-label"></div><div class="tl-track-bar tl-axis" style="background:transparent">' + labels + '</div></div>';
}

function summarizeEvent(kind, d) {
  if (kind === 'window') return (d.app || '?') + ' \u2014 ' + (d.title || '').slice(0, 80);
  if (kind === 'keyboard') { var m = (d.modifiers || []).filter(Boolean).join('+'); return (m ? m + '+' : '') + (d.key || '?'); }
  if (kind === 'mouse') return (d.button ? d.button + ' ' : '') + (d.action || '?') + ' (' + d.x + ',' + d.y + ')';
  if (kind === 'clipboard') return (d.content || '').slice(0, 60);
  if (kind === 'screen') return d.description || 'screenshot';
  if (kind === 'idle') { var s = d.status || '?'; if (d.duration) s += ' ' + fmtDuration(d.duration); return s; }
  return JSON.stringify(d).slice(0, 80);
}

function _fmtRange(ts) {
  return new Date(ts * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function _tlBuildTracksHTML(since, range) {
  var tracks = tlCache;
  return TRACKS.map(function(kind) {
    var evts = tracks[kind] || [], c = KIND_COL[kind] || '#8E8E93';
    var items = evts.map(function(e, i) {
      var left = Math.max(0, Math.min(100, ((e.ts - since) / range) * 100));
      var tipAttrs = ' data-kind="' + kind + '" data-idx="' + i + '"';
      if (kind === 'idle' && e.data && e.data.status === 'active') return '';
      if (kind === 'idle' && e.data && e.data.duration > 0) {
        var barStart = e.data.start || (e.ts - e.data.duration);
        var barEnd = e.data.end || e.ts;
        var barLeft = Math.max(0, Math.min(100, ((barStart - since) / range) * 100));
        var barRight = Math.max(0, Math.min(100, ((barEnd - since) / range) * 100));
        var w = Math.max(barRight - barLeft, 0.3);
        return '<div class="tl-bar" style="left:' + barLeft + '%;width:' + w + '%;background:' + c + '"' + tipAttrs + '></div>';
      }
      return '<div class="tl-dot" style="left:' + left + '%;background:' + c + '"' + tipAttrs + '></div>';
    }).join('');
    return '<div class="tl-track"><div class="tl-track-label"><span class="dot" style="background:' + c + '"></span>' + kind + '</div><div class="tl-track-bar">' + items + '</div></div>';
  }).join('');
}

function _tlRedrawCached() {
  _tlRafPending = false;
  var body = document.getElementById('tlBody');
  if (!body || !tlCache) return;
  var range = tlUntil - tlSince;
  _tlRenderedSince = tlSince;
  _tlRenderedRange = range;
  var rangeEl = document.getElementById('tlRange');
  if (rangeEl) rangeEl.textContent = _fmtRange(tlSince) + ' \u2014 ' + _fmtRange(tlUntil);
  var tracks = tlCache;
  if (!Object.keys(tracks).length) { body.innerHTML = '<div class="empty" style="border:none;margin:0">No events in this range</div>'; _tlTrackBars = []; return; }
  var axisHTML = buildTimeAxis(tlSince, tlUntil, range);
  var trackHTML = _tlBuildTracksHTML(tlSince, range);
  body.innerHTML = axisHTML + trackHTML + '<div class="tl-scroll-hint">Scroll to pan \u00b7 Arrow keys move</div>';
  _tlTrackBars = body.querySelectorAll('.tl-track-bar');
}

function _tlPanVisual() {
  _tlRafPending = false;
  if (!_tlRenderedRange) return;
  var offsetPct = ((_tlRenderedSince - tlSince) / _tlRenderedRange) * 100;
  for (var i = 0; i < _tlTrackBars.length; i++) _tlTrackBars[i].style.transform = 'translateX(' + offsetPct + '%)';
  var rangeEl = document.getElementById('tlRange');
  if (rangeEl) rangeEl.textContent = _fmtRange(tlSince) + ' \u2014 ' + _fmtRange(tlUntil);
}

function handleTlWheel(e) {
  e.preventDefault();
  var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  var shift = (delta / 500) * (tlSpan * 0.15);
  tlSince += shift; tlUntil += shift;
  if (!_tlRafPending) { _tlRafPending = true; requestAnimationFrame(_tlPanVisual); }
  if (tlWheelTimer) clearTimeout(tlWheelTimer);
  tlWheelTimer = setTimeout(function() {
    api('/api/timeline?since=' + tlSince + '&until=' + tlUntil + '&limit=5000').then(function(resp) {
      tlCache = resp.tracks || {};
      _tlRedrawCached();
    });
  }, 400);
}

function _tlHandleTip(e) {
  var el = e.target.closest('[data-kind]');
  if (!el) { hideTlTip(); return; }
  if (e.type === 'mouseleave' || e.type === 'mouseout') { hideTlTip(); return; }
  showTlTip(e, el.dataset.kind, parseInt(el.dataset.idx));
}

export function renderTimeline(targetId) {
  _tlTargetId = targetId || 'content';
  if (!tlReady) { var now = Date.now() / 1000; tlUntil = now; tlSince = now - tlSpan; tlReady = true; }
  var zoomHTML = tlZooms.map(function(z, i) {
    var a = Math.abs(tlSpan - z.s) < z.s * 0.1;
    return '<button class="tl-zoom-btn' + (a ? ' active' : '') + '" onclick="tlZoom(' + z.s + ')" ondblclick="openZoomEditor(' + i + ',event)">' + esc(z.l) + '<span class="zb-x" onclick="deleteZoom(' + i + ',event)">&times;</span></button>';
  }).join('');
  zoomHTML += '<button class="tl-zoom-add" onclick="openZoomEditor(-1,event)" title="Add zoom level">+</button>';
  var content = document.getElementById(_tlTargetId);
  var isEmbedded = _tlTargetId !== 'content';
  var headerHTML = isEmbedded ? '' : '<div class="page-title">Timeline</div><div class="page-subtitle">Temporal view of all events</div>';
  content.innerHTML = '<div class="' + (isEmbedded ? '' : 'page-enter') + '">' + headerHTML + '<div class="controls-row" style="position:relative"><div class="date-nav"><button class="date-btn" onclick="tlShift(-1)">&lsaquo;</button><span class="date-label" id="tlRange">' + _fmtRange(tlSince) + ' \u2014 ' + _fmtRange(tlUntil) + '</span><button class="date-btn" onclick="tlShift(1)">&rsaquo;</button></div><div class="tl-zoom-group" id="tlZoomGroup">' + zoomHTML + '</div></div><div class="tl-container" id="tlBody"></div></div>';
  var body = document.getElementById('tlBody');
  body.addEventListener('wheel', handleTlWheel, { passive: false });
  body.addEventListener('mouseover', _tlHandleTip);
  body.addEventListener('mouseout', _tlHandleTip);
  api('/api/timeline?since=' + tlSince + '&until=' + tlUntil + '&limit=5000').then(function(resp) {
    tlCache = resp.tracks || {};
    _tlRedrawCached();
  });
}

export function showTlTip(evt, kind, idx) {
  var evts = (tlCache[kind] || []);
  if (idx >= evts.length) return;
  var e = evts[idx];
  document.getElementById('ttTime').textContent = fmtTs(e.ts);
  document.getElementById('ttKind').textContent = kind;
  document.getElementById('ttDetail').innerHTML = esc(summarizeEvent(kind, e.data));

  var imgHtml = '';
  var d = e.data || {};
  if (d.full || d.detail) {
    imgHtml = '<div class="tt-imgs">';
    if (d.full) imgHtml += '<img src="/blobs/' + esc(d.full.replace(/^.*blobs\//, '')) + '" class="tt-img">';
    if (d.detail) imgHtml += '<img src="/blobs/' + esc(d.detail.replace(/^.*blobs\//, '')) + '" class="tt-img">';
    imgHtml += '</div>';
  }
  if (e.blob) {
    imgHtml = '<div class="tt-imgs"><img src="/blobs/' + esc(e.blob.replace(/^.*blobs\//, '')) + '" class="tt-img"></div>';
  }
  document.getElementById('ttDetail').innerHTML += imgHtml;

  var tip = document.getElementById('tlTooltip');
  tip.style.display = 'block';
  var r = evt.target.getBoundingClientRect();
  var tipH = imgHtml ? 160 : 70;
  var tx = r.left + 10, ty = r.top - tipH;
  if (ty < 8) ty = r.bottom + 8;
  if (tx + 320 > window.innerWidth) tx = window.innerWidth - 330;
  tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
}

export function hideTlTip() { document.getElementById('tlTooltip').style.display = 'none'; }

export function tlShift(dir) {
  var half = tlSpan / 2;
  tlSince += dir * half; tlUntil += dir * half;
  renderTimeline(_tlTargetId);
}

export function tlZoom(sec) {
  var c = (tlSince + tlUntil) / 2;
  tlSpan = sec; tlSince = c - sec / 2; tlUntil = c + sec / 2;
  renderTimeline(_tlTargetId);
}

export function openZoomEditor(idx, evt) {
  if (evt) evt.stopPropagation();
  zeEditIdx = idx;
  var ex = idx >= 0 ? tlZooms[idx] : null;
  var dv = ex ? ex.s : 1800;
  var dl = ex ? ex.l : '';
  var unit = 3600, val = dv;
  if (dv % 3600 === 0) { unit = 3600; val = dv / 3600; }
  else if (dv % 60 === 0) { unit = 60; val = dv / 60; }
  else { unit = 1; val = dv; }
  var old = document.getElementById('zeOverlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.className = 'ze-overlay'; overlay.id = 'zeOverlay';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeZoomEditor(); });
  var title = idx >= 0 ? 'Edit Zoom Level' : 'Add Zoom Level';
  var delBtn = idx >= 0 ? '<button class="ze-btn ze-btn-del" onclick="deleteZoom(' + idx + ',null);closeZoomEditor()">Delete</button>' : '';
  overlay.innerHTML = '<div class="ze-panel" id="zePanel"><div class="ze-title">' + title + '</div><div class="ze-row"><label>Label</label><input type="text" id="zeLabel" value="' + esc(dl) + '" placeholder="e.g. 30m"></div><div class="ze-row"><label>Time</label><input type="number" id="zeValue" min="1" value="' + val + '"><select id="zeUnit"><option value="1"' + (unit === 1 ? ' selected' : '') + '>sec</option><option value="60"' + (unit === 60 ? ' selected' : '') + '>min</option><option value="3600"' + (unit === 3600 ? ' selected' : '') + '>hr</option></select></div><div class="ze-actions">' + delBtn + '<button class="ze-btn ze-btn-cancel" onclick="closeZoomEditor()">Cancel</button><button class="ze-btn ze-btn-save" onclick="saveZoomEdit()">Save</button></div></div>';
  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('zeLabel').focus(); }, 50);
}

export function closeZoomEditor() {
  var o = document.getElementById('zeOverlay');
  if (o) o.remove();
  zeEditIdx = -2;
}

export function saveZoomEdit() {
  var label = document.getElementById('zeLabel').value.trim();
  var val = parseInt(document.getElementById('zeValue').value);
  var unit = parseInt(document.getElementById('zeUnit').value);
  if (!label || !val || isNaN(val)) return;
  var secs = val * unit;
  if (zeEditIdx >= 0) tlZooms[zeEditIdx] = { l: label, s: secs };
  else tlZooms.push({ l: label, s: secs });
  tlZooms.sort(function(a, b) { return a.s - b.s; });
  saveZooms();
  closeZoomEditor();
  renderTimeline(_tlTargetId);
}

export function deleteZoom(idx, evt) {
  if (evt) evt.stopPropagation();
  if (tlZooms.length <= 1) return;
  tlZooms.splice(idx, 1);
  saveZooms();
  closeZoomEditor();
  renderTimeline(_tlTargetId);
}

window.renderTimeline = renderTimeline;
window.tlShift = tlShift;
window.tlZoom = tlZoom;
window.openZoomEditor = openZoomEditor;
window.closeZoomEditor = closeZoomEditor;
window.saveZoomEdit = saveZoomEdit;
window.deleteZoom = deleteZoom;
window.showTlTip = showTlTip;
window.hideTlTip = hideTlTip;
