import { api, esc, fmtTs, fmtDuration } from '../utils.js';

export function renderContext(targetId) {
  var content = document.getElementById(targetId || 'content');
  content.innerHTML = '<div class="page-enter"><div class="page-title">Context</div><div class="page-subtitle">URLs and files you\'ve been working with</div><div id="ctxBody"></div></div>';
  api('/api/events?kind=window&limit=2000').then(function(events) {
    if (!events.length) { document.getElementById('ctxBody').innerHTML = '<div class="empty">No window data yet</div>'; return; }
    var sorted = events.slice().sort(function(a, b) { return a.ts - b.ts; }), urls = {}, files = {};
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i], d = e.data, next = sorted[i + 1], dur = next ? next.ts - e.ts : 0;
      if (d.url && d.url.indexOf('localhost') === -1 && d.url.indexOf('127.0.0.1') === -1) {
        var u = d.url;
        if (!urls[u]) urls[u] = { url: u, app: d.app || '', title: d.title || '', visits: 0, totalDur: 0, lastTs: 0, summary: '' };
        urls[u].visits++; urls[u].totalDur += dur;
        if (e.ts > urls[u].lastTs) { urls[u].lastTs = e.ts; urls[u].title = d.title || urls[u].title; urls[u].summary = d.summary || urls[u].summary; }
      }
      if (d.filepath) {
        var fp = d.filepath;
        if (!files[fp]) files[fp] = { filepath: fp, app: d.app || '', title: d.title || '', visits: 0, totalDur: 0, lastTs: 0, summary: '' };
        files[fp].visits++; files[fp].totalDur += dur;
        if (e.ts > files[fp].lastTs) { files[fp].lastTs = e.ts; files[fp].title = d.title || files[fp].title; files[fp].summary = d.summary || files[fp].summary; }
      }
    }
    var ul = Object.values(urls).sort(function(a, b) { return b.lastTs - a.lastTs; });
    var fl = Object.values(files).sort(function(a, b) { return b.lastTs - a.lastTs; });
    var h = '';
    if (ul.length) {
      h += '<div class="ctx-section"><div class="ctx-section-title">\u{1F310} Web Pages (' + ul.length + ')</div>';
      h += ul.map(function(u) {
        var hs = u.summary && u.summary.indexOf('User is ') !== 0;
        return '<div class="ctx-card"><div class="ctx-row1"><a class="ctx-link" href="' + esc(u.url) + '" target="_blank" title="' + esc(u.url) + '">' + esc(u.url) + '</a><div class="ctx-meta"><span class="ctx-tag visits">' + u.visits + 'x</span><span class="ctx-tag dur">' + fmtDuration(u.totalDur) + '</span></div></div><div class="ctx-row2"><span class="ctx-app">' + esc(u.app) + '</span><span class="ctx-title">' + esc(u.title) + '</span><span class="ctx-time">' + fmtTs(u.lastTs) + '</span></div>' + (hs ? '<div class="ctx-summary">' + esc(u.summary) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    if (fl.length) {
      h += '<div class="ctx-section"><div class="ctx-section-title">\u{1F4C4} Files (' + fl.length + ')</div>';
      h += fl.map(function(f) {
        var name = f.filepath.split('/').pop();
        var dir = f.filepath.slice(0, f.filepath.length - name.length - 1);
        var hs = f.summary && f.summary.indexOf('User is ') !== 0 && f.summary.indexOf('User opened ') !== 0;
        return '<div class="ctx-card"><div class="ctx-row1"><span class="ctx-link" title="' + esc(f.filepath) + '">' + esc(name) + '</span><div class="ctx-meta"><span class="ctx-tag visits">' + f.visits + 'x</span><span class="ctx-tag dur">' + fmtDuration(f.totalDur) + '</span></div></div><div class="ctx-row2"><span class="ctx-app">' + esc(f.app) + '</span><span class="ctx-title" title="' + esc(f.filepath) + '">' + esc(dir) + '</span><span class="ctx-time">' + fmtTs(f.lastTs) + '</span></div>' + (hs ? '<div class="ctx-summary">' + esc(f.summary) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    if (!ul.length && !fl.length) h = '<div class="empty">No URLs or files discovered yet.</div>';
    document.getElementById('ctxBody').innerHTML = h;
  });
}

window.renderContext = renderContext;
