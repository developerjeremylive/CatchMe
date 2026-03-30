import { api, esc, fmtTs, fmtDuration } from '../utils.js';

var _monTimer = null;

function buildWindowSessions(events) {
  var sorted = events.slice().sort(function(a, b) { return a.ts - b.ts; });
  var sessions = [];
  for (var i = 0; i < sorted.length; i++) {
    var e = sorted[i], next = sorted[i + 1];
    sessions.push({
      app: e.data.app || '?', title: e.data.title || '',
      enter: e.ts, leave: next ? next.ts : e.ts,
      active: !next, duration: next ? next.ts - e.ts : 0,
      url: e.data.url || '', filepath: e.data.filepath || '',
      summary: e.data.summary || ''
    });
  }
  return sessions.reverse();
}

/* (no token chart — API does not provide token history) */

export function renderWindow(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Window</div><div class="page-subtitle" id="pgCount">\u2026</div><div id="list"></div></div>';
  api('/api/events?kind=window&limit=2000').then(function(events) {
    if (!events.length) { document.getElementById('list').innerHTML = '<div class="empty">No window events yet</div>'; return; }
    var sessions = buildWindowSessions(events);
    document.getElementById('pgCount').textContent = sessions.length + ' sessions';
    document.getElementById('list').innerHTML = sessions.map(function(s) {
      var extra = s.url || s.filepath || '';
      var durCls = s.active ? ' active' : (s.duration < 3 ? ' short' : '');
      var hs = s.summary && s.summary.indexOf('User is ') !== 0;
      return '<div class="win-card"><div class="win-row1"><span class="win-app">' + esc(s.app) + '</span><span class="win-title">' + esc(s.title.slice(0, 120)) + '</span><span class="win-dur' + durCls + '">' + (s.active ? 'Active' : fmtDuration(s.duration)) + '</span></div><div class="win-row2"><span class="win-ts">' + fmtTs(s.enter) + ' \u2192 ' + (s.active ? 'now' : fmtTs(s.leave)) + '</span>' + (extra ? '<span class="win-extra">' + esc(extra) + '</span>' : '') + '</div>' + (hs ? '<div class="win-summary">' + esc(s.summary) + '</div>' : '') + '</div>';
    }).join('');
  });
}

export function renderKeyboard(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Keyboard</div><div class="page-subtitle" id="pgCount">\u2026</div><div id="list"></div></div>';
  api('/api/events?kind=keyboard&limit=500').then(function(events) {
    document.getElementById('pgCount').textContent = events.length ? events.length + ' events' : '0';
    if (!events.length) { document.getElementById('list').innerHTML = '<div class="empty">No keyboard events yet</div>'; return; }
    document.getElementById('list').innerHTML = events.map(function(e) {
      var d = e.data;
      var mods = (d.modifiers || []).filter(Boolean).map(function(m) { return '<span class="mod-badge">' + esc(m) + '</span>'; }).join('');
      var key = d.key ? '<span class="key-badge">' + esc(d.key.slice(0, 30)) + '</span>' : '';
      var tt = d.type && d.type !== 'key' ? ' <span class="dim">' + esc(d.type) + '</span>' : '';
      return '<div class="ev-row"><span class="ev-ts">' + fmtTs(e.ts) + '</span><span class="ev-body">' + mods + key + tt + '</span></div>';
    }).join('');
  });
}

export function renderMouse(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Mouse</div><div class="page-subtitle" id="pgCount">\u2026</div><div id="list"></div></div>';
  api('/api/events?kind=mouse&limit=500').then(function(events) {
    document.getElementById('pgCount').textContent = events.length ? events.length + ' events' : '0';
    if (!events.length) { document.getElementById('list').innerHTML = '<div class="empty">No mouse events yet</div>'; return; }
    document.getElementById('list').innerHTML = events.map(function(e) {
      var d = e.data;
      return '<div class="ev-row"><span class="ev-ts">' + fmtTs(e.ts) + '</span><span class="ev-body">' + (d.button ? '<span class="key-badge">' + esc(d.button) + '</span> ' : '') + esc(d.action || '?') + ' <span class="dim">(' + d.x + ', ' + d.y + ')</span>' + (d.display ? ' <span class="dim">display ' + d.display + '</span>' : '') + '</span></div>';
    }).join('');
  });
}

export function renderClipboard(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Clipboard</div><div class="page-subtitle" id="pgCount">\u2026</div><div id="list"></div></div>';
  api('/api/events?kind=clipboard&limit=200').then(function(events) {
    document.getElementById('pgCount').textContent = events.length ? events.length + ' entries' : '0';
    if (!events.length) { document.getElementById('list').innerHTML = '<div class="empty">No clipboard events yet</div>'; return; }
    document.getElementById('list').innerHTML = events.map(function(e) {
      var d = e.data;
      return '<div class="clip-card"><div class="clip-card-head"><span class="clip-card-ts">' + fmtTs(e.ts) + '</span><span class="clip-card-type">' + esc(d.type || 'text') + '</span></div><div class="clip-card-body">' + esc((d.content || '').slice(0, 600)) + '</div></div>';
    }).join('');
  });
}

export function renderIdle(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Idle</div><div class="page-subtitle" id="pgCount">\u2026</div><div id="list"></div></div>';
  api('/api/events?kind=idle&limit=300').then(function(events) {
    document.getElementById('pgCount').textContent = events.length ? events.length + ' periods' : '0';
    if (!events.length) { document.getElementById('list').innerHTML = '<div class="empty">No idle events yet</div>'; return; }
    document.getElementById('list').innerHTML = events.map(function(e) {
      var d = e.data, st = d.status || 'unknown';
      if (d.start && d.end) return '<div class="idle-card"><div class="idle-row"><span class="ev-ts">' + fmtTs(d.start) + ' \u2192 ' + fmtTs(d.end) + '</span><span class="idle-badge s-' + st + '">' + esc(st) + '</span><span class="ev-body">' + (d.duration ? fmtDuration(d.duration) : '') + '</span></div></div>';
      return '<div class="idle-card"><div class="idle-row"><span class="ev-ts">' + fmtTs(e.ts) + '</span><span class="idle-badge s-' + st + '">' + esc(st) + '</span><span class="ev-body">' + (d.seconds ? ' idle for ' + fmtDuration(d.seconds) : '') + '</span></div></div>';
    }).join('');
  });
}

function _fmtK(n) { return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
function _fmtTime(ts) { var d = new Date(ts * 1000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function _fmtTimeFull(ts) { var d = new Date(ts * 1000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); }
function _fmtDateShort(ts) { var d = new Date(ts * 1000); return (d.getMonth() + 1) + '/' + d.getDate(); }
function _fmtDateLabel(ts) { var d = new Date(ts * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _fmtChartTime(ts, multiDay) { return multiDay ? _fmtDateShort(ts) + ' ' + _fmtTime(ts) : _fmtTime(ts); }

function _downsample(pts, maxPts) {
  if (!pts || pts.length <= maxPts) return pts;
  var result = [pts[0]];
  var step = (pts.length - 1) / (maxPts - 1);
  for (var i = 1; i < maxPts - 1; i++) result.push(pts[Math.round(i * step)]);
  result.push(pts[pts.length - 1]);
  return result;
}

function _perDayAgg(data, key) {
  var days = {};
  for (var i = 0; i < data.length; i++) {
    var dayStr = _fmtDateLabel(data[i].ts);
    if (!days[dayStr]) days[dayStr] = { peak: 0, last: 0, count: 0 };
    var v = data[i][key] || 0;
    if (v > days[dayStr].peak) days[dayStr].peak = v;
    days[dayStr].last = v;
    days[dayStr].count++;
  }
  return days;
}

/* ── Nice number rounding for axis ticks ── */
function _niceNum(v) {
  if (v <= 0) return 1;
  var exp = Math.floor(Math.log10(v));
  var frac = v / Math.pow(10, exp);
  var nice;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

/* ── Reusable interactive SVG line chart ── */
var _chartId = 0;
function _buildChart(cfg) {
  var id = 'chart' + (++_chartId);
  var wide = cfg.wide || false;
  var pts = _downsample(cfg.points, wide ? 800 : 500);
  if (!pts || pts.length < 2) return '<div class="mon-empty">Not enough data</div>';

  var W = wide ? 900 : 480;
  var H = wide ? 190 : 155;
  var PX = 52, PY = 18, PB = 24;
  var plotW = W - PX - 14, plotH = H - PY - PB;

  var lines = cfg.lines;
  var rawMax = 0;
  for (var i = 0; i < pts.length; i++) {
    for (var li = 0; li < lines.length; li++) {
      var v = pts[i][lines[li].key] || 0;
      if (v > rawMax) rawMax = v;
    }
  }
  var maxY = _niceNum(rawMax * 1.08) || 1;
  var minTs = pts[0].ts, maxTs = pts[pts.length - 1].ts, spanTs = maxTs - minTs || 1;
  var multiDay = spanTs > 86400;
  function sx(ts) { return PX + (ts - minTs) / spanTs * plotW; }
  function sy(v)  { return PY + plotH - (v / maxY) * plotH; }

  var gridLines = '';
  var ySteps = wide ? 5 : 4;
  for (var g = 0; g <= ySteps; g++) {
    var yv = maxY / ySteps * g, yy = sy(yv);
    gridLines += '<line x1="' + PX + '" y1="' + yy + '" x2="' + (PX + plotW) + '" y2="' + yy + '" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>';
    gridLines += '<text x="' + (PX - 7) + '" y="' + (yy + 3) + '" text-anchor="end" fill="var(--text-tertiary)" font-size="' + (wide ? '9' : '8') + '" font-family="var(--mono)">' + (cfg.fmtY ? cfg.fmtY(yv) : _fmtK(Math.round(yv))) + '</text>';
  }
  gridLines += '<line x1="' + PX + '" y1="' + (PY + plotH) + '" x2="' + (PX + plotW) + '" y2="' + (PY + plotH) + '" stroke="var(--border)" stroke-width="0.5"/>';

  var xLabels = '';
  var xSteps = Math.min(wide ? 8 : 4, pts.length);
  for (var xl = 0; xl < xSteps; xl++) {
    var xi = Math.round(xl / (xSteps - 1 || 1) * (pts.length - 1));
    xLabels += '<text x="' + sx(pts[xi].ts) + '" y="' + (H - 4) + '" text-anchor="middle" fill="var(--text-tertiary)" font-size="' + (wide ? '9' : '8') + '" font-family="var(--mono)">' + _fmtChartTime(pts[xi].ts, multiDay) + '</text>';
  }

  var paths = '';
  for (var pli = 0; pli < lines.length; pli++) {
    var ln = lines[pli], d = 'M';
    var areaD = 'M' + sx(pts[0].ts) + ',' + (PY + plotH) + ' L';
    for (var pi = 0; pi < pts.length; pi++) {
      var px = sx(pts[pi].ts), py = sy(pts[pi][ln.key] || 0);
      d += (pi ? ' L' : '') + px + ',' + py;
      areaD += px + ',' + py + ' ';
    }
    areaD += 'L' + sx(pts[pts.length - 1].ts) + ',' + (PY + plotH) + ' Z';
    if (pli === 0) paths += '<path d="' + areaD + '" fill="' + ln.color + '" opacity=".07"/>';
    paths += '<path d="' + d + '" fill="none" stroke="' + ln.color + '" stroke-width="' + (ln.dash ? '1.2' : '1.6') + '"' + (ln.dash ? ' stroke-dasharray="5,3"' : '') + ' opacity=".8"/>';
    var lastPt = pts[pts.length - 1];
    paths += '<circle cx="' + sx(lastPt.ts) + '" cy="' + sy(lastPt[ln.key] || 0) + '" r="3" fill="' + ln.color + '"/>';
  }

  var hitRects = '';
  for (var hi = 0; hi < pts.length; hi++) {
    var hx = sx(pts[hi].ts);
    var hw = plotW / pts.length;
    hitRects += '<rect class="mon-hit" x="' + (hx - hw/2) + '" y="' + PY + '" width="' + hw + '" height="' + plotH + '" data-i="' + hi + '" fill="transparent"/>';
  }

  var legend = '<div class="mon-legend">';
  for (var le = 0; le < lines.length; le++) {
    legend += '<span class="mon-legend-item"><span class="mon-legend-dot" style="background:' + lines[le].color + (lines[le].dash ? ';border:1px dashed ' + lines[le].color + ';background:transparent' : '') + '"></span>' + esc(lines[le].label) + '</span>';
  }
  legend += '</div>';

  var html = '<div class="mon-chart-wrap' + (wide ? ' mon-chart-wide' : '') + '" id="' + id + '">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mon-chart-svg" preserveAspectRatio="xMidYMid meet">' +
    gridLines + xLabels + paths +
    '<line class="mon-hover-line" x1="0" y1="' + PY + '" x2="0" y2="' + (PY + plotH) + '" stroke="var(--text-tertiary)" stroke-width="0.7" opacity="0"/>' +
    hitRects +
    '</svg>' +
    '<div class="mon-tooltip" style="display:none"></div>' +
    legend + '</div>';

  setTimeout(function() {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    var svg = wrap.querySelector('.mon-chart-svg');
    var tip = wrap.querySelector('.mon-tooltip');
    var hLine = svg.querySelector('.mon-hover-line');
    var hits = svg.querySelectorAll('.mon-hit');

    function show(e) {
      var idx = parseInt(e.target.getAttribute('data-i'));
      var pt = pts[idx];
      if (!pt) return;
      var x = sx(pt.ts);
      hLine.setAttribute('x1', x); hLine.setAttribute('x2', x); hLine.setAttribute('opacity', '0.4');
      var tipHtml = '<div class="mon-tip-time">' + (multiDay ? _fmtDateLabel(pt.ts) + ' ' : '') + _fmtTimeFull(pt.ts) + '</div>';
      for (var tl = 0; tl < lines.length; tl++) {
        var val = pt[lines[tl].key] || 0;
        tipHtml += '<div class="mon-tip-row"><span class="mon-legend-dot" style="background:' + lines[tl].color + '"></span>' + lines[tl].label + ': <strong>' + (cfg.fmtY ? cfg.fmtY(val) : _fmtK(Math.round(val))) + '</strong></div>';
      }
      tip.innerHTML = tipHtml;
      tip.style.display = 'block';
      var rect = svg.getBoundingClientRect();
      var pxRatio = rect.width / W;
      var tipLeft = (x * pxRatio);
      if (tipLeft > rect.width * 0.65) tipLeft -= tip.offsetWidth + 8;
      else tipLeft += 8;
      tip.style.left = tipLeft + 'px';
      tip.style.top = (PY * pxRatio) + 'px';
    }
    function hide() {
      hLine.setAttribute('opacity', '0');
      tip.style.display = 'none';
    }
    hits.forEach(function(r) { r.addEventListener('mouseenter', show); r.addEventListener('mouseleave', hide); });
  }, 50);

  return html;
}

function _buildPerCallTable(history) {
  if (!history || !history.length) return '';
  var recent = history.slice(-20).reverse();
  var rows = recent.map(function(r) {
    return '<tr><td class="mon-td-time">' + _fmtTimeFull(r.ts) + '</td>' +
      '<td class="mon-td-num">' + _fmtK(r.prompt) + '</td>' +
      '<td class="mon-td-num" style="color:#A372D4">' + _fmtK(r.completion) + '</td>' +
      '<td class="mon-td-num mon-td-bold">' + _fmtK(r.prompt + r.completion) + '</td></tr>';
  }).join('');
  return '<div class="mon-sec">Recent Calls' + (history.length > 20 ? ' (last 20 of ' + history.length + ')' : ' (' + history.length + ')') + '</div>' +
    '<div class="mon-table-wrap"><table class="mon-table"><thead><tr>' +
    '<th style="text-align:left">Time</th><th>Input</th><th style="color:#A372D4">Output</th><th style="color:var(--accent)">Total</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ── Monitor page ── */
var _monHistory = [];

export function renderMonitor(targetId) {
  if (_monTimer) { clearInterval(_monTimer); _monTimer = null; }
  var content = document.getElementById(targetId || 'content');
  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="page-title">Monitor</div>' +
      '<div class="page-subtitle">Runtime resource usage — persistent history</div>' +
      '<div id="monBody"></div>' +
    '</div>';

  api('/api/monitor/history').then(function(hist) {
    _monHistory = hist || [];
    _refreshMonitor();
  }).catch(function() { _refreshMonitor(); });

  _monTimer = setInterval(function() {
    api('/api/monitor').then(function(m) {
      var snap = { ts: m.ts, disk_mb: m.disk.total_mb, db_mb: m.disk.db_size_mb, blobs_mb: m.disk.blobs_size_mb, trees_mb: m.disk.trees_size_mb, rss_mb: m.memory.rss_mb, events_total: m.events.total };
      if (!_monHistory.length || m.ts - _monHistory[_monHistory.length - 1].ts >= 10) {
        _monHistory.push(snap);
      } else {
        _monHistory[_monHistory.length - 1] = snap;
      }
      _refreshMonitor(m);
    });
  }, 10000);
}

function _refreshMonitor(live) {
  var fetchLive = live ? Promise.resolve(live) : api('/api/monitor');
  fetchLive.then(function(m) {
    var d = m.disk, mem = m.memory, ev = m.events, llm = m.llm;
    var tokens = llm.tokens || {};
    var history = llm.token_history || [];
    var bk = d.blobs_breakdown || {};
    var bkHtml = '';
    Object.keys(bk).forEach(function(k) { bkHtml += '<div class="mon-row"><span>' + esc(k) + '</span><span>' + bk[k].toFixed(1) + ' MB</span></div>'; });

    var cumPts = [];
    var cum = 0, cumC = 0;
    for (var i = 0; i < history.length; i++) {
      cum += history[i].prompt + history[i].completion;
      cumC += history[i].completion;
      cumPts.push({ ts: history[i].ts, total: cum, output: cumC });
    }

    var body = document.getElementById('monBody');
    if (!body) return;

    var procHtml = '';
    var procs = mem.processes || [];
    for (var pi = 0; pi < procs.length; pi++) {
      procHtml += '<div class="mon-row"><span>catchme ' + esc(procs[pi].label) + ' <span style="color:var(--text-tertiary);font-size:9px">PID ' + procs[pi].pid + '</span></span><span>' + procs[pi].rss_mb.toFixed(1) + ' MB</span></div>';
    }

    var ramDayHtml = '';
    if (_monHistory.length > 0) {
      var ramDays = _perDayAgg(_monHistory, 'rss_mb');
      var rdKeys = Object.keys(ramDays).sort();
      for (var rdi = 0; rdi < rdKeys.length; rdi++) {
        ramDayHtml += '<div class="mon-row"><span>' + rdKeys[rdi] + '</span><span>' + ramDays[rdKeys[rdi]].peak.toFixed(1) + ' MB</span></div>';
      }
    }

    var llmDayHtml = '';
    if (history.length > 0) {
      var llmDays = {};
      for (var ldi = 0; ldi < history.length; ldi++) {
        var ldKey = _fmtDateLabel(history[ldi].ts);
        if (!llmDays[ldKey]) llmDays[ldKey] = { calls: 0, tokens: 0 };
        llmDays[ldKey].calls++;
        llmDays[ldKey].tokens += history[ldi].prompt + history[ldi].completion;
      }
      var ldKeys = Object.keys(llmDays).sort();
      for (var ldj = 0; ldj < ldKeys.length; ldj++) {
        var ld = llmDays[ldKeys[ldj]];
        llmDayHtml += '<div class="mon-row"><span>' + ldKeys[ldj] + '</span><span>' + ld.calls + ' calls &middot; ' + _fmtK(ld.tokens) + '</span></div>';
      }
    }

    var diskPerDay = '';
    if (_monHistory.length > 0) {
      var dDays = _perDayAgg(_monHistory, 'disk_mb');
      var ddKeys = Object.keys(dDays).sort();
      for (var ddi = 0; ddi < ddKeys.length; ddi++) {
        diskPerDay += '<div class="mon-row"><span>' + ddKeys[ddi] + '</span><span>' + dDays[ddKeys[ddi]].last.toFixed(1) + ' MB</span></div>';
      }
    }

    body.innerHTML =
      '<div class="mon-grid-2">' +
        '<div class="mon-card">' +
          '<div class="mon-title">Disk &amp; Data</div>' +
          '<div class="mon-big">' + d.total_mb.toFixed(1) + ' <span class="mon-unit">MB</span></div>' +
          '<div class="mon-detail-rows">' +
            '<div class="mon-row"><span>Database</span><span>' + d.db_size_mb.toFixed(1) + ' MB</span></div>' +
            '<div class="mon-row"><span>Blobs</span><span>' + d.blobs_size_mb.toFixed(1) + ' MB</span></div>' +
            '<div class="mon-row"><span>Trees</span><span>' + d.trees_size_mb.toFixed(2) + ' MB</span></div>' +
            '<div class="mon-row"><span>Events</span><span>' + ev.total.toLocaleString() + '</span></div>' +
          '</div>' +
          (bkHtml ? '<div class="mon-sub-detail">' + bkHtml + '</div>' : '') +
          (diskPerDay && ddKeys.length > 1 ? '<div class="mon-sub-detail">' + diskPerDay + '</div>' : '') +
          (_monHistory.length >= 2 ? _buildChart({
            points: _monHistory,
            lines: [
              { key: 'disk_mb', label: 'Total', color: 'var(--accent)' },
              { key: 'db_mb', label: 'DB', color: '#FF9500', dash: true },
              { key: 'blobs_mb', label: 'Blobs', color: '#A372D4', dash: true }
            ],
            fmtY: function(v) { return v.toFixed(1) + ' MB'; }
          }) : '') +
        '</div>' +

        '<div class="mon-card">' +
          '<div class="mon-title">RAM Usage</div>' +
          '<div class="mon-big">' + mem.rss_mb.toFixed(1) + ' <span class="mon-unit">MB</span></div>' +
          '<div class="mon-detail-rows">' + procHtml + '</div>' +
          (ramDayHtml ? '<div class="mon-sub-detail">' + ramDayHtml + '</div>' : '') +
          (_monHistory.length >= 2 ? _buildChart({
            points: _monHistory,
            lines: [{ key: 'rss_mb', label: 'Total RAM', color: '#FF2D55' }],
            fmtY: function(v) { return v.toFixed(1) + ' MB'; }
          }) : '<div class="mon-empty">Collecting data\u2026</div>') +
        '</div>' +
      '</div>' +

      '<div class="mon-card">' +
        '<div class="mon-title">LLM Usage</div>' +
        '<div class="mon-stat-grid">' +
          '<div class="mon-stat"><div class="mon-stat-val">' + llm.call_count + '</div><div class="mon-stat-lbl">Calls</div></div>' +
          '<div class="mon-stat"><div class="mon-stat-val" style="color:var(--accent)">' + _fmtK(tokens.prompt || 0) + '</div><div class="mon-stat-lbl">Input</div></div>' +
          '<div class="mon-stat"><div class="mon-stat-val" style="color:#A372D4">' + _fmtK(tokens.completion || 0) + '</div><div class="mon-stat-lbl">Output</div></div>' +
          '<div class="mon-stat"><div class="mon-stat-val">' + _fmtK(tokens.total || 0) + '</div><div class="mon-stat-lbl">Total</div></div>' +
        '</div>' +
        '<div class="mon-detail-rows">' +
          '<div class="mon-row"><span>Budget remaining</span><span>' + (llm.budget_remaining < 0 ? '\u221e unlimited' : llm.budget_remaining + ' calls') + '</span></div>' +
          (tokens.total > 0 ? '<div class="mon-row"><span>Avg tokens / call</span><span>' + (llm.call_count ? Math.round(tokens.total / llm.call_count) : 0) + '</span></div>' : '') +
        '</div>' +
        (llmDayHtml ? '<div class="mon-sub-detail">' + llmDayHtml + '</div>' : '') +
        (cumPts.length >= 2 ? '<div class="mon-sec">Token Usage Over Time</div>' + _buildChart({
          points: cumPts,
          wide: true,
          lines: [
            { key: 'total', label: 'Total', color: 'var(--accent)' },
            { key: 'output', label: 'Output', color: '#A372D4', dash: true }
          ]
        }) : '') +
        _buildPerCallTable(history) +
      '</div>';
  }).catch(function() {
    var body = document.getElementById('monBody');
    if (body) body.innerHTML = '<div class="mon-empty">Failed to load monitor data</div>';
  });
}

export function _getMonTimer() { return _monTimer; }
export function _clearMonTimer() { if (_monTimer) { clearInterval(_monTimer); _monTimer = null; } }

window.renderWindow = renderWindow;
window.renderKeyboard = renderKeyboard;
window.renderMouse = renderMouse;
window.renderClipboard = renderClipboard;
window.renderIdle = renderIdle;
window.renderMonitor = renderMonitor;
