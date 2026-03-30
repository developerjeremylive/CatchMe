import { api, esc, blobUrl, fmtTs, fmtHM, fmtCount, KIND_COL, openLightbox } from '../utils.js';
import { renderTimeline } from './timeline.js';

export function groupBy15(events) {
  var sorted = events.slice().sort(function(a, b) { return a.ts - b.ts; });
  var groups = [], cur = null;
  sorted.forEach(function(e) {
    var slot = Math.floor(e.ts / 900) * 900;
    if (!cur || cur.slot !== slot) { cur = { slot: slot, events: [] }; groups.push(cur); }
    cur.events.push(e);
  });
  return groups.reverse();
}

export function renderMemGroup(g) {
  var t0 = fmtHM(g.slot), t1 = fmtHM(g.slot + 900);
  var wins = g.events.filter(function(e) { return e.kind === 'window'; });
  var shots = g.events.filter(function(e) { return (e.kind === 'mouse' || e.kind === 'screen') && e.blob; });
  var h = '<div class="mem-group"><div class="mem-time-header">' + t0 + ' \u2014 ' + t1 + '</div>';
  wins.forEach(function(w) {
    var d = w.data, icon = d.url ? '\u{1F310}' : (d.filepath ? '\u{1F4C4}' : '\u{1F5A5}'), sub = d.url || d.filepath || d.title || '';
    h += '<div class="mem-card"><div class="mem-card-head"><div class="mem-card-icon" style="background:var(--c-window)">' + icon + '</div><span class="mem-card-app">' + esc(d.app || '') + '</span><span class="mem-card-sub">' + esc(sub) + '</span><span class="mem-card-ts">' + fmtTs(w.ts) + '</span></div>';
    if (d.summary) h += '<div class="mem-card-body">' + esc(d.summary) + '</div>';
    h += '</div>';
  });
  if (shots.length) {
    h += '<div class="shot-strip">';
    shots.forEach(function(s) {
      var src = blobUrl(s.blob);
      if (!src) return;
      h += '<div class="shot-thumb" onclick="openLightbox(\'' + src + '\')"><img src="' + src + '" loading="lazy"><span class="shot-ts">' + fmtTs(s.ts) + '</span></div>';
    });
    h += '</div>';
  }
  return h + '</div>';
}

export function renderToday() {
  var content = document.getElementById('content');
  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="page-title">Today</div>' +
      '<div class="page-subtitle">Your digital footprint at a glance</div>' +
      '<div class="stats-grid" id="statsGrid"></div>' +
      '<div id="homeTimeline" style="margin-bottom:20px"></div>' +
      '<div class="home-chat-card" onclick="nav(\'chat\')">' +
        '<div class="home-chat-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>' +
        '<div class="home-chat-text"><div class="home-chat-title">Ask your memory</div><div class="home-chat-sub">Chat with AI to retrieve anything from your activity history</div></div>' +
        '<svg class="home-chat-arrow" viewBox="0 0 18 18"><path d="M7 4l5 5-5 5"/></svg>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:16px;font-weight:600">Recent Activity</span></div>' +
      '<div id="recentFeed"></div>' +
    '</div>';
  api('/api/stats').then(function(stats) {
    var g = document.getElementById('statsGrid');
    if (!stats.length) { g.innerHTML = '<div class="empty">No data yet</div>'; return; }
    g.innerHTML = stats.map(function(s) {
      var c = KIND_COL[s.kind] || '#8E8E93';
      return '<div class="stat-card" style="--stat-color:' + c + '"><div class="stat-label">' + esc(s.kind) + '</div><div class="stat-val">' + fmtCount(s.count) + '</div><div class="stat-sub">last ' + fmtTs(s.last) + '</div></div>';
    }).join('');
  });
  renderTimeline('homeTimeline');
  api('/api/events?limit=80').then(function(events) {
    var f = document.getElementById('recentFeed');
    if (!events.length) { f.innerHTML = '<div class="empty">No recent events</div>'; return; }
    f.innerHTML = groupBy15(events).map(renderMemGroup).join('');
    f.querySelectorAll('.shot-strip').forEach(function(strip) {
      strip.addEventListener('wheel', function(e) {
        if (strip.scrollWidth <= strip.clientWidth) return;
        var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (dx === 0) return;
        e.preventDefault();
        strip.scrollLeft += dx;
      }, { passive: false });
    });
  });
}

window.renderToday = renderToday;
