import { api, esc, fmtTs, fmtHM, fmtDate, fmtDuration, openLightbox } from '../utils.js';

var fltData = null, fltTimer = null;
var actTab = 'window';
var fltDate = new Date();
var _actTargetId = 'content';

function fltFetch(cb) {
  var d0 = new Date(fltDate); d0.setHours(0, 0, 0, 0);
  var d1 = new Date(fltDate); d1.setHours(23, 59, 59, 999);
  api('/api/filtered?since=' + d0.getTime() / 1000 + '&until=' + d1.getTime() / 1000).then(function(data) { fltData = data; cb(data); });
}

function fltDateNavHTML() {
  return '<div class="date-nav"><button class="date-btn" onclick="fltShiftDate(-1)">&lsaquo;</button><span class="date-label">' + fmtDate(fltDate) + '</span><button class="date-btn" onclick="fltShiftDate(1)">&rsaquo;</button></div>';
}

function _refreshActivity() {
  var ct = document.getElementById(_actTargetId);
  var sy = ct ? ct.scrollTop : 0;
  fltFetch(function(data) {
    var el = document.getElementById('fltList');
    if (!el) return;
    if (actTab === 'window') _renderFltWindow(el, data);
    else if (actTab === 'keyboard') _renderFltKeyboard(el, data);
    else if (actTab === 'mouse') _renderFltMouse(el, data);
    else _renderFltTimeline(el, data);
    var ct2 = document.getElementById(_actTargetId);
    if (ct2) ct2.scrollTop = sy;
  });
}

function _renderFltWindow(el, data) {
  var wins = (data.windows || []).slice().reverse();
  if (!wins.length) { el.innerHTML = '<div class="empty">No window spans for this day</div>'; return; }
  el.innerHTML = wins.map(function(w) {
    var kbN = w.keyboard ? w.keyboard.length : 0, msN = w.mouse ? w.mouse.length : 0, briefs = w.briefs || [];
    var h = '<div class="flt-span"><div class="flt-span-head"><span class="flt-span-app">' + esc(w.app) + '</span><span class="flt-span-title">' + esc(w.title) + '</span><div class="flt-span-meta">' + (kbN ? '<span class="flt-badge flt-badge-kb">' + kbN + ' kb</span>' : '') + (msN ? '<span class="flt-badge flt-badge-ms">' + msN + ' mouse</span>' : '') + (briefs.length ? '<span class="flt-badge flt-badge-brief">' + briefs.length + ' brief</span>' : '') + '<span class="flt-badge flt-badge-dur">' + fmtDuration(w.dwell) + '</span></div></div><div class="flt-span-time">' + fmtTs(w.start) + ' \u2192 ' + fmtTs(w.end) + (w.url ? ' \u00b7 ' + esc(w.url.slice(0, 60)) : '') + (w.filepath ? ' \u00b7 ' + esc(w.filepath.split('/').pop()) : '') + '</div>';
    if (briefs.length) {
      h += '<button class="flt-briefs-toggle" onclick="toggleBriefs(this)"><span class="arrow">\u25B6</span> ' + briefs.length + ' transient window' + (briefs.length > 1 ? 's' : '') + '</button><div class="flt-briefs-wrap">';
      h += briefs.map(function(b) {
        var bKb = b.keyboard ? b.keyboard.length : 0, bMs = b.mouse ? b.mouse.length : 0;
        return '<div class="flt-brief"><span class="flt-brief-app">' + esc(b.app) + '</span><span class="flt-brief-title">' + esc(b.title) + '</span><div class="flt-brief-meta">' + (bKb ? '<span class="flt-badge-brief">' + bKb + ' kb</span>' : '') + (bMs ? '<span class="flt-badge-brief">' + bMs + ' ms</span>' : '') + '</div><span class="flt-brief-dur">' + fmtDuration(b.dwell) + ' \u00b7 ' + fmtTs(b.start) + '</span></div>';
      }).join('');
      h += '</div>';
    }
    return h + '</div>';
  }).join('');
}

function _renderFltKeyboard(el, data) {
  var wins = (data.windows || []).slice().reverse().filter(function(w) { return w.keyboard && w.keyboard.length; });
  if (!wins.length) { el.innerHTML = '<div class="empty">No keyboard activity for this day</div>'; return; }
  el.innerHTML = wins.map(function(w) {
    var h = '<div class="flt-group"><div class="flt-group-head"><span class="flt-group-app">' + esc(w.app) + '</span><span class="flt-group-title">' + esc(w.title) + '</span><span class="flt-group-ts">' + fmtTs(w.start) + ' \u2192 ' + fmtTs(w.end) + '</span></div>';
    h += w.keyboard.map(function(kc) {
      return '<div class="flt-cluster"><div class="flt-cluster-head"><span class="flt-cluster-ts">' + fmtTs(kc.start) + ' \u2192 ' + fmtTs(kc.end) + '</span><span class="flt-cluster-count">' + kc.count + ' events</span><span class="flt-cluster-type t-' + (kc.type || 'key') + '">' + esc(kc.type) + '</span></div><div class="flt-text">' + esc(kc.text) + '</div></div>';
    }).join('');
    return h + '</div>';
  }).join('');
}

function _renderFltMouse(el, data) {
  var wins = (data.windows || []).slice().reverse().filter(function(w) { return w.mouse && w.mouse.length; });
  if (!wins.length) { el.innerHTML = '<div class="empty">No mouse activity for this day</div>'; return; }
  el.innerHTML = wins.map(function(w) {
    var h = '<div class="flt-group"><div class="flt-group-head"><span class="flt-group-app">' + esc(w.app) + '</span><span class="flt-group-title">' + esc(w.title) + '</span><span class="flt-group-ts">' + fmtTs(w.start) + ' \u2192 ' + fmtTs(w.end) + '</span></div>';
    h += w.mouse.map(function(mc) {
      var aHTML = mc.actions.map(function(a) {
        return '<div class="flt-action-row"><span class="flt-action-ts">' + fmtTs(a.ts) + '</span><span class="flt-action-label">' + (a.button ? a.button + ' ' : '') + esc(a.action) + '</span><span class="flt-action-coord">(' + a.x + ', ' + a.y + ')</span></div>';
      }).join('');
      var iHTML = '';
      var pairs = mc.actions.filter(function(a) { return a.full || a.detail; });
      if (pairs.length) {
        iHTML = '<div class="flt-img-group">' + pairs.map(function(a) {
          var ph = '<div class="flt-img-pair">';
          if (a.full) ph += '<img class="full" src="/blobs/' + esc(a.full) + '" loading="lazy" onerror="this.parentNode.style.display=\'none\'" onclick="openLightbox(\'/blobs/' + esc(a.full) + '\')">';
          if (a.detail) ph += '<img class="detail" src="/blobs/' + esc(a.detail) + '" loading="lazy" onerror="this.style.display=\'none\'" onclick="openLightbox(\'/blobs/' + esc(a.detail) + '\')">';
          return ph + '</div>';
        }).join('') + '</div>';
      }
      return '<div class="flt-cluster"><div class="flt-cluster-head"><span class="flt-cluster-ts">' + fmtTs(mc.start) + ' \u2192 ' + fmtTs(mc.end) + '</span><span class="flt-cluster-count">' + mc.count + ' actions</span></div><div class="flt-actions">' + aHTML + '</div>' + iHTML + '</div>';
    }).join('');
    return h + '</div>';
  }).join('');
}

function _renderFltTimeline(el, data) {
  var wins = (data.windows || []).slice().reverse();
  if (!wins.length) { el.innerHTML = '<div class="empty">No window activity for this day</div>'; return; }
  el.innerHTML = wins.map(function(w) {
    var kbN = w.keyboard ? w.keyboard.length : 0, msN = w.mouse ? w.mouse.length : 0, clipN = w.clipboard ? w.clipboard.length : 0, briefN = w.briefs ? w.briefs.length : 0;
    var srcHTML = '';
    if (w.url) srcHTML = '<div class="ftl-src"><a href="' + esc(w.url) + '" target="_blank">\u{1F310} ' + esc(w.url.length > 80 ? w.url.slice(0, 80) + '\u2026' : w.url) + '</a></div>';
    else if (w.filepath) srcHTML = '<div class="ftl-src" title="' + esc(w.filepath) + '">\u{1F4C4} ' + esc(w.filepath) + '</div>';
    var tsText = fmtTs(w.start) + ' \u2192 ' + fmtTs(w.end);
    return '<div class="ftl-card"><div class="ftl-head" onclick="ftlToggle(this)"><span class="arrow">\u25B6</span><span class="ftl-app">' + esc(w.app) + '</span><span class="ftl-title">' + esc(w.title) + '</span><div class="ftl-meta">' + (kbN ? '<span class="flt-badge flt-badge-kb">' + kbN + ' kb</span>' : '') + (msN ? '<span class="flt-badge flt-badge-ms">' + msN + ' mouse</span>' : '') + (clipN ? '<span class="flt-badge" style="background:rgba(175,82,222,.1);color:#AF52DE">' + clipN + ' clip</span>' : '') + (briefN ? '<span class="flt-badge flt-badge-brief">' + briefN + ' brief</span>' : '') + '<span class="flt-badge flt-badge-dur">' + fmtDuration(w.dwell) + '</span></div></div><div class="ftl-time">' + tsText + '</div>' + srcHTML + '<div class="ftl-body">' + ftlBuildMiniTL(w) + ftlBuildDetails(w) + '</div></div>';
  }).join('');
}

function ftlBuildMiniTL(w) {
  var s = w.start, e = w.end;
  (w.briefs || []).forEach(function(b) { if (b.start < s) s = b.start; if (b.end > e) e = b.end; });
  var range = e - s;
  if (range <= 0) return '';
  function pct(ts) { return Math.max(0, Math.min(100, ((ts - s) / range) * 100)); }
  var step;
  if (range <= 60) step = 10;
  else if (range <= 300) step = 30;
  else if (range <= 900) step = 60;
  else if (range <= 3600) step = 300;
  else step = 600;
  var axL = '', t = Math.ceil(s / step) * step;
  while (t < e) { axL += '<span class="mtl-axis-label" style="left:' + pct(t) + '%">' + fmtHM(t) + '</span>'; t += step; }
  var tr = [
    { n: 'keyboard', c: 'var(--c-keyboard)', d: [] },
    { n: 'mouse', c: 'var(--c-mouse)', d: [] },
    { n: 'clipboard', c: 'var(--c-clipboard)', d: [] },
    { n: 'screen', c: 'var(--c-screen)', d: [] },
    { n: 'briefs', c: 'var(--c-idle)', b: [] }
  ];
  (w.keyboard || []).forEach(function(kc) { tr[0].d.push(kc.start); if (kc.end !== kc.start) tr[0].d.push(kc.end); });
  (w.mouse || []).forEach(function(mc) { (mc.actions || []).forEach(function(a) { tr[1].d.push(a.ts); }); });
  (w.clipboard || []).forEach(function(c) { tr[2].d.push(c.ts); });
  (w.screen || []).forEach(function(sc) { tr[3].d.push(sc.ts); });
  (w.briefs || []).forEach(function(b) { tr[4].b.push({ s: b.start, e: b.end, l: b.app + ' \u2014 ' + (b.title || '').slice(0, 30) }); });
  var h = '<div class="mtl"><div class="mtl-axis">' + axL + '</div>';
  tr.forEach(function(r) {
    h += '<div class="mtl-row"><div class="mtl-label"><span class="dot" style="background:' + r.c + '"></span>' + r.n + '</div><div class="mtl-bar">';
    if (r.d) r.d.forEach(function(ts) { h += '<div class="mtl-dot" style="left:' + pct(ts) + '%;background:' + r.c + '"></div>'; });
    if (r.b) r.b.forEach(function(bl) { var l = pct(bl.s), wi = Math.max(2, pct(bl.e) - l); h += '<div class="mtl-block" style="left:' + l + '%;width:' + wi + '%;background:' + r.c + '" title="' + esc(bl.l) + '"></div>'; });
    h += '</div></div>';
  });
  return h + '</div>';
}

function ftlBuildDetails(w) {
  var h = '<div class="ftl-details">';
  var kbL = w.keyboard || [];
  if (kbL.length) {
    h += '<div class="ftl-section"><div class="ftl-section-title"><span class="dot" style="background:var(--c-keyboard)"></span>Keyboard (' + kbL.length + ' clusters)</div>';
    kbL.forEach(function(kc) { if (kc.text) h += '<div class="ftl-kb-item"><span style="font-size:10px;color:var(--text-tertiary)">' + fmtTs(kc.start) + '</span> ' + esc(kc.text) + '</div>'; });
    h += '</div>';
  }
  var msL = w.mouse || [];
  if (msL.length) {
    var allI = [];
    msL.forEach(function(mc) { (mc.actions || []).forEach(function(a) { if (a.full || a.detail) allI.push(a); }); });
    if (allI.length) {
      h += '<div class="ftl-section"><div class="ftl-section-title"><span class="dot" style="background:var(--c-mouse)"></span>Screenshots (' + allI.length + ')</div><div class="flt-img-group">';
      allI.forEach(function(a) {
        h += '<div class="flt-img-pair">';
        if (a.full) h += '<img class="full" src="/blobs/' + esc(a.full) + '" loading="lazy" onerror="this.parentNode.style.display=\'none\'" onclick="openLightbox(\'/blobs/' + esc(a.full) + '\')">';
        if (a.detail) h += '<img class="detail" src="/blobs/' + esc(a.detail) + '" loading="lazy" onerror="this.style.display=\'none\'" onclick="openLightbox(\'/blobs/' + esc(a.detail) + '\')">';
        h += '</div>';
      });
      h += '</div></div>';
    }
  }
  var clips = w.clipboard || [];
  if (clips.length) {
    h += '<div class="ftl-section"><div class="ftl-section-title"><span class="dot" style="background:var(--c-clipboard)"></span>Clipboard (' + clips.length + ')</div>';
    clips.forEach(function(c) { h += '<div class="ftl-clip-ts">' + fmtTs(c.ts) + ' \u00b7 ' + esc(c.type) + '</div><div class="ftl-clip-item">' + esc(c.preview) + '</div>'; });
    h += '</div>';
  }
  var brs = w.briefs || [];
  if (brs.length) {
    h += '<div class="ftl-section"><div class="ftl-section-title"><span class="dot" style="background:var(--c-idle)"></span>Transient (' + brs.length + ')</div>';
    brs.forEach(function(b) { h += '<div class="flt-brief"><span class="flt-brief-app">' + esc(b.app) + '</span><span class="flt-brief-title">' + esc(b.title) + '</span><span class="flt-brief-dur">' + fmtDuration(b.dwell) + ' \u00b7 ' + fmtTs(b.start) + '</span></div>'; });
    h += '</div>';
  }
  return h + '</div>';
}

export function renderActivity(targetId) {
  _actTargetId = targetId || 'content';
  var content = document.getElementById(_actTargetId);
  content.innerHTML = '<div class="page-enter"><div class="page-title">Activity</div><div class="page-subtitle">Filtered and clustered view of your actions</div><div class="controls-row"><div class="tab-bar"><button class="tab-pill' + (actTab === 'window' ? ' active' : '') + '" onclick="setActTab(\'window\')">Window</button><button class="tab-pill' + (actTab === 'keyboard' ? ' active' : '') + '" onclick="setActTab(\'keyboard\')">Keyboard</button><button class="tab-pill' + (actTab === 'mouse' ? ' active' : '') + '" onclick="setActTab(\'mouse\')">Mouse</button><button class="tab-pill' + (actTab === 'timeline' ? ' active' : '') + '" onclick="setActTab(\'timeline\')">Timeline</button></div><div style="margin-left:auto">' + fltDateNavHTML() + '</div></div><div id="fltList"></div></div>';
  _refreshActivity();
  fltStartPoll(_refreshActivity);
}

export function setActTab(t) { actTab = t; renderActivity(_actTargetId); }

export function fltShiftDate(d) {
  fltDate.setDate(fltDate.getDate() + d);
  fltData = null;
  renderActivity(_actTargetId);
}

export function toggleBriefs(btn) {
  btn.classList.toggle('open');
  var w = btn.nextElementSibling;
  if (w) w.classList.toggle('open');
}

export function ftlToggle(el) { el.closest('.ftl-card').classList.toggle('open'); }

export function fltStartPoll(fn) { fltStopPoll(); fltTimer = setInterval(fn, 10000); }

export function fltStopPoll() { if (fltTimer) { clearInterval(fltTimer); fltTimer = null; } }

window.renderActivity = renderActivity;
window.setActTab = setActTab;
window.fltShiftDate = fltShiftDate;
window.toggleBriefs = toggleBriefs;
window.ftlToggle = ftlToggle;
window.fltStartPoll = fltStartPoll;
window.fltStopPoll = fltStopPoll;
