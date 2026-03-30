/* ══════════════════════════════════════════════════════════════
   tree.js  –  Elegant circle-node Activity Tree (ES module)
   ══════════════════════════════════════════════════════════════ */

import { api, esc, fmtTs, fmtHM, fmtDate, fmtDuration, showToast, openLightbox } from '../utils.js';

/* ── State ── */
var treeDate  = new Date();
var treeMode  = 'time';
var _tvNodeMap     = {};
var _tvExpandState = {};
var _tvSelectedNid = null;
var _tvDefaultDepth = 2;
var _treeSSE = null;
var _treeTargetId = 'content';

/* ── Layout constants ── */
var NODE_D    = { day: 88, session: 68, app: 54, location: 44, action: 36, span: 36 };
var LEAF_D    = 20;
var NODE_GAP  = 22;
var TREE_PAD  = 50;

function _levelH(d) { var h = [380, 300, 230, 170, 140]; return h[Math.min(d, h.length - 1)]; }

/* ── Pan / Zoom state ── */
var _pan  = { x: 0, y: 0 };
var _zoom = 1;
var _drag = null;
var _interactionBound = false;
var _currentInner = null;
var _lastOffX = 0, _lastOffY = 0;

/* ── Helpers ── */
function _fitCanvasHeight() {
  var cv = document.getElementById('tvCanvas');
  if (!cv) return;
  var rect = cv.getBoundingClientRect();
  var h = window.innerHeight - rect.top - 12;
  cv.style.height = Math.max(300, h) + 'px';
}

function _isLeaf(n) { return !n.children || n.children.length === 0; }
function _nodeDiam(n) { return _isLeaf(n) ? LEAF_D : (NODE_D[n.kind] || 22); }

var _kindHexMap = {
  day: '#4B7BE5', session: '#50B87A', app: '#6CB4D9',
  location: '#5BA3B5', action: '#A372D4', span: '#D4933A'
};

/* ══════════════════════ Public API ══════════════════════ */

function renderTree(targetId) {
  _treeTargetId = targetId || 'content';
  var content = document.getElementById(_treeTargetId);
  if (!content) return;

  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="controls-row" style="margin-bottom:10px">' +
        '<div class="date-nav" style="margin-bottom:0">' +
          '<button class="date-btn" onclick="treeShiftDate(-1)">&lsaquo;</button>' +
          '<span class="date-label">' + fmtDate(treeDate) + '</span>' +
          '<button class="date-btn" onclick="treeShiftDate(1)">&rsaquo;</button>' +
        '</div>' +
        '<div class="date-nav" id="tvSessionNav" style="display:none;margin-bottom:0">' +
          '<button class="date-btn" onclick="tvShiftSession(-1)">&lsaquo;</button>' +
          '<span class="date-label" id="tvSessionLabel" style="min-width:130px;text-align:center">Session</span>' +
          '<button class="date-btn" onclick="tvShiftSession(1)">&rsaquo;</button>' +
          '<button class="date-btn" onclick="tvLocateSession()" title="Locate session" style="margin-left:2px;width:auto;padding:0 8px;font-size:12px;font-weight:600;color:var(--accent)">&#x2316; Locate</button>' +
        '</div>' +
        '<div class="tab-bar">' +
          '<button class="tab-pill' + (treeMode === 'time' ? ' active' : '') + '" onclick="tvSetMode(\'time\')">By Time</button>' +
          '<button class="tab-pill' + (treeMode === 'app' ? ' active' : '') + '" onclick="tvSetMode(\'app\')">By App</button>' +
        '</div>' +
      '</div>' +
      '<div class="tree-canvas-wrap" id="tvCanvas" style="cursor:grab;overflow:hidden">' +
        '<div class="empty" style="border:none;margin:0;background:transparent">Loading\u2026</div>' +
      '</div>' +
    '</div>';

  _pan = { x: 0, y: 0 };
  _zoom = 1;
  _interactionBound = false;
  _fitCanvasHeight();
  _refreshTree();
  _treeStartSSE();
}

function treeShiftDate(d) {
  treeDate.setDate(treeDate.getDate() + d);
  renderTree(_treeTargetId);
}

function tvSetMode(m) {
  treeMode = m;
  renderTree(_treeTargetId);
}

/* ── Session navigation ── */
var _sessions = [];
var _sessionIdx = 0;

function _updateSessionNav() {
  var nav = document.getElementById('tvSessionNav');
  var lbl = document.getElementById('tvSessionLabel');
  if (!nav) return;
  if (treeMode !== 'time' || _sessions.length === 0) {
    nav.style.display = 'none';
    return;
  }
  nav.style.display = '';
  if (_sessionIdx < 0) _sessionIdx = 0;
  if (_sessionIdx >= _sessions.length) _sessionIdx = _sessions.length - 1;
  var s = _sessions[_sessionIdx];
  if (lbl) lbl.textContent = fmtHM(s.start) + ' \u2013 ' + fmtHM(s.end);
}

function _collectSessions() {
  _sessions = [];
  var keys = Object.keys(_tvNodeMap);
  for (var i = 0; i < keys.length; i++) {
    if (_tvNodeMap[keys[i]].kind === 'session') _sessions.push(_tvNodeMap[keys[i]]);
  }
  _sessions.sort(function(a, b) { return a.start - b.start; });
  _sessionIdx = 0;
}

function tvShiftSession(d) {
  _sessionIdx += d;
  _updateSessionNav();
}

function tvLocateSession() {
  if (!_sessions.length) return;
  var s = _sessions[_sessionIdx];
  if (!s || s._cx === undefined) return;
  var canvas = document.getElementById('tvCanvas');
  if (!canvas) return;
  var canvasW = canvas.offsetWidth;
  var canvasH = parseInt(canvas.style.height) || 700;
  _pan.x = canvasW / 2 - (s._cx + _lastOffX) * _zoom;
  _pan.y = canvasH / 3 - (s._cy + _lastOffY) * _zoom;
  var ci = _getInner();
  if (ci) _applyTransform(ci);
}

function closeTreeDetail() {
  var sheet = document.getElementById('treeDetail');
  if (sheet) sheet.classList.remove('open');
  _tvSelectedNid = null;
  var nodes = document.querySelectorAll('.tv-node.selected');
  for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('selected');
}

function _cleanupTree() {
  _treeStopSSE();
}

function toggleEvidence(id, btn) {
  var el = document.getElementById(id);
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : '';
  var arrow = btn.querySelector('.td-evidence-arrow');
  if (arrow) arrow.textContent = open ? '\u25B6' : '\u25BC';
}

/* ── SSE for real-time summary updates ── */

function _treeStartSSE() {
  _treeStopSSE();
  try {
    _treeSSE = new EventSource('/api/events/summaries');
    _treeSSE.onmessage = function(ev) {
      try {
        var data = JSON.parse(ev.data);
        if (data.type === 'connected') return;
        if (!data.node_id || !data.summary) return;
        _treeHandleUpdate(data);
      } catch (e) { /* ignore */ }
    };
    _treeSSE.onerror = function() {
      _treeStopSSE();
      setTimeout(_treeStartSSE, 5000);
    };
  } catch (e) { /* SSE not supported */ }
}

function _treeStopSSE() {
  if (_treeSSE) {
    _treeSSE.close();
    _treeSSE = null;
  }
}

function _treeHandleUpdate(data) {
  var node = _tvNodeMap[data.node_id];
  if (!node) return;

  node.summary = data.summary;
  if (data.evidence) node.evidence = data.evidence;

  var el = document.querySelector('.tv-node[data-nid="' + data.node_id + '"]');
  if (el && !el.classList.contains('tv-has-summary')) {
    el.classList.add('tv-has-summary');
  }

  if (_tvSelectedNid === data.node_id) {
    _showTreeDetail(node);
  }
}

/* ── Expose to window ── */
window.renderTree      = renderTree;
window.treeShiftDate   = treeShiftDate;
window.tvSetMode       = tvSetMode;
window.tvShiftSession  = tvShiftSession;
window.tvLocateSession = tvLocateSession;
window.closeTreeDetail = closeTreeDetail;
window.toggleEvidence  = toggleEvidence;

export { renderTree, treeShiftDate, tvSetMode, closeTreeDetail, toggleEvidence, _cleanupTree };

/* ══════════════════════ Data Fetch ══════════════════════ */

function _refreshTree() {
  var d0 = new Date(treeDate); d0.setHours(0, 0, 0, 0);
  var d1 = new Date(treeDate); d1.setHours(23, 59, 59, 999);

  api('/api/tree?mode=' + treeMode +
      '&since=' + d0.getTime() / 1000 +
      '&until=' + d1.getTime() / 1000)
    .then(function (data) {
      var canvas = document.getElementById('tvCanvas');
      if (!canvas) return;

      var prevExpand = _tvExpandState;
      _tvNodeMap = {};

      if (!data || !data.tree) {
        _tvExpandState = {};
        canvas.innerHTML = '<div class="empty" style="border:none;margin:0;background:transparent">No activity data for this day</div>';
        return;
      }

      _tvIndex(data.tree);

      _tvExpandState = {};
      _tvInitExpand(data.tree, 0);

      _collectSessions();
      _updateSessionNav();

      _treeRender(canvas);
    });
}

/* ══════════════════════ Tree Index / Expand ══════════════════════ */

function _tvIndex(n) {
  _tvNodeMap[n.node_id] = n;
  var ch = n.children || [];
  for (var i = 0; i < ch.length; i++) _tvIndex(ch[i]);
}

function _tvInitExpand(n, d) {
  _tvExpandState[n.node_id] = true;
  var ch = n.children || [];
  for (var i = 0; i < ch.length; i++) _tvInitExpand(ch[i], d + 1);
}

function _tvIsExpanded(nid) { return _tvExpandState[nid] === true; }

function _tvVisibleChildren(n) {
  if (!n.children || !n.children.length) return [];
  if (!_tvIsExpanded(n.node_id)) return [];
  return n.children;
}

/* ══════════════════════ Subtext Logic ══════════════════════ */

function _tvSubText(n) {
  var k = n.kind, ctx = n.context || {}, ch = n.children || [];
  if (k === 'day')      return ch.length + (treeMode === 'app' ? ' apps' : ' sessions');
  if (k === 'session')  return fmtHM(n.start) + ' \u2013 ' + fmtHM(n.end);
  if (k === 'app')      return ch.length + ' locations';
  if (k === 'location') return ch.length + ' actions';
  if (k === 'span')     return fmtDuration(n.end - n.start);
  if (k === 'action')   return (ctx.count || '') + ' events';
  return '';
}

/* ══════════════════════ Layout Algorithm ══════════════════════ */

function _computeWidth(n) {
  var ch = _tvVisibleChildren(n);
  var d  = _nodeDiam(n);

  if (!ch.length) {
    n._w = d + NODE_GAP;
    return;
  }

  var total = 0;
  for (var i = 0; i < ch.length; i++) {
    _computeWidth(ch[i]);
    total += ch[i]._w;
  }
  n._w = Math.max(total, d + NODE_GAP);
}

function _assignPos(n, depth, x) {
  var ch = _tvVisibleChildren(n);

  n._depth = depth;
  var cy = TREE_PAD;
  for (var d = 0; d < depth; d++) cy += _levelH(d);
  n._cy = cy;

  if (!ch.length) {
    n._cx = x + n._w / 2;
    return;
  }

  var cx = x;
  for (var i = 0; i < ch.length; i++) {
    _assignPos(ch[i], depth + 1, cx);
    cx += ch[i]._w;
  }

  var firstChild = ch[0];
  var lastChild  = ch[ch.length - 1];
  n._cx = (firstChild._cx + lastChild._cx) / 2;
}

function _treeBounds(n) {
  var r = _nodeDiam(n) / 2;
  var labelExtra = _isLeaf(n) ? 6 : 20;
  var b = {
    minX: n._cx - r - 4,
    maxX: n._cx + r + 4,
    minY: n._cy - r - 4,
    maxY: n._cy + r + labelExtra
  };
  var ch = _tvVisibleChildren(n);
  for (var i = 0; i < ch.length; i++) {
    var cb = _treeBounds(ch[i]);
    if (cb.minX < b.minX) b.minX = cb.minX;
    if (cb.maxX > b.maxX) b.maxX = cb.maxX;
    if (cb.minY < b.minY) b.minY = cb.minY;
    if (cb.maxY > b.maxY) b.maxY = cb.maxY;
  }
  return b;
}

/* ══════════════════════ Render ══════════════════════ */

function _treeRender(canvas) {
  _hideTreeTip();
  if (!canvas) canvas = document.getElementById('tvCanvas');
  if (!canvas) return;

  var rootId = null;
  var keys = Object.keys(_tvNodeMap);
  for (var i = 0; i < keys.length; i++) {
    if (_tvNodeMap[keys[i]].kind === 'day') { rootId = keys[i]; break; }
  }
  if (!rootId) {
    canvas.innerHTML = '<div class="empty" style="border:none;margin:0;background:transparent">No tree root found</div>';
    return;
  }

  var root = _tvNodeMap[rootId];
  _computeWidth(root);
  _assignPos(root, 0, 0);

  var b   = _treeBounds(root);
  var pad = TREE_PAD;
  var totalW = b.maxX - b.minX + pad * 2;
  var totalH = b.maxY - b.minY + pad * 2;
  var offX = -b.minX + pad;
  var offY = -b.minY + pad;
  _lastOffX = offX;
  _lastOffY = offY;

  var canvasH = canvas.offsetHeight || (window.innerHeight - 180);

  var inner = document.createElement('div');
  inner.className = 'tree-canvas-inner';
  inner.style.cssText = 'position:relative;width:' + totalW + 'px;height:' + totalH + 'px;' +
                         'transform-origin:0 0;will-change:transform;';

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', totalW);
  svg.setAttribute('height', totalH);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';

  _buildEdges(svg, root, offX, offY);
  inner.appendChild(svg);
  _buildNodes(inner, root, offX, offY, 1);

  canvas.innerHTML = '';
  canvas.appendChild(inner);

  if (_pan.x === 0 && _pan.y === 0 && _zoom === 1) {
    var canvasW = canvas.offsetWidth || canvas.parentElement.offsetWidth || 800;
    var viewH = canvasH;
    var padV = 24;
    var scaleH = (viewH - padV * 2) / totalH;
    var scaleW = (canvasW - 20) / totalW;
    _zoom = Math.min(1, scaleH, scaleW);
    _pan.x = (canvasW - totalW * _zoom) / 2;
    _pan.y = (viewH - totalH * _zoom) / 2;
  }

  _applyTransform(inner);

  if (!_interactionBound) {
    _setupInteraction(canvas, inner);
    _interactionBound = true;
  } else {
    _currentInner = inner;
  }
}

/* ── SVG Edges ── */

function _buildEdges(svg, n, offX, offY) {
  var ch = _tvVisibleChildren(n);
  var pr = _nodeDiam(n) / 2;
  var px = n._cx + offX;
  var py = n._cy + offY + pr;

  for (var i = 0; i < ch.length; i++) {
    var c  = ch[i];
    var cr = _nodeDiam(c) / 2;
    var cx = c._cx + offX;
    var cy = c._cy + offY - cr;

    var gap = cy - py;
    var cp = Math.max(gap * 0.45, 15);

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
      'M' + px + ',' + py +
      ' C' + px + ',' + (py + cp) +
      ' ' + cx + ',' + (cy - cp) +
      ' ' + cx + ',' + cy
    );
    path.classList.add('tv-edge');
    svg.appendChild(path);

    _buildEdges(svg, c, offX, offY);
  }
}

/* ── Circle Nodes ── */

function _buildNodes(container, n, offX, offY, siblingCount) {
  var d    = _nodeDiam(n);
  var leaf = _isLeaf(n);
  var ch   = n.children || [];
  var isExp = _tvIsExpanded(n.node_id);
  var isCollapsed = ch.length > 0 && !isExp;
  var hasSummary  = !!n.summary;
  var selected    = n.node_id === _tvSelectedNid;
  var dense       = (siblingCount || 0) > 5;

  var el = document.createElement('div');
  el.className = 'tv-node tv-k-' + n.kind +
                 (leaf ? ' tv-leaf' : '') +
                 (dense ? ' tv-dense' : '') +
                 (hasSummary ? ' tv-has-summary' : '') +
                 (selected ? ' selected' : '');
  el.dataset.nid = n.node_id;
  el.dataset.depth = n._depth;
  el.style.cssText =
    'left:' + (n._cx + offX) + 'px;' +
    'top:'  + (n._cy + offY) + 'px;' +
    '--depth:' + n._depth + ';';

  var circleHtml = '<div class="tv-circle" style="width:' + d + 'px;height:' + d + 'px">';
  if (!leaf && n.kind !== 'day' && n.kind !== 'session') {
    circleHtml += '<span class="tv-initial">' + esc(n.title.charAt(0)) + '</span>';
  }
  if (isCollapsed) circleHtml += '<span class="tv-badge">' + ch.length + '</span>';
  if (hasSummary && !leaf) circleHtml += '<div class="tv-sum-dot"></div>';
  circleHtml += '</div>';

  var label = n.title;
  var maxLen = leaf ? 10 : 14;
  if (label.length > maxLen) label = label.slice(0, maxLen - 1) + '\u2026';
  var labelHtml = '<div class="tv-node-label">' + esc(label) + '</div>';

  var previewHtml = '';
  if (hasSummary && !leaf && !dense && (n.kind === 'session' || n.kind === 'app' || n.kind === 'location')) {
    var prev = n.summary.length > 50 ? n.summary.slice(0, 48) + '\u2026' : n.summary;
    previewHtml = '<div class="tv-summary-preview">' + esc(prev) + '</div>';
  }

  el.innerHTML = circleHtml + labelHtml + previewHtml;
  container.appendChild(el);

  var visCh = _tvVisibleChildren(n);
  for (var i = 0; i < visCh.length; i++) {
    _buildNodes(container, visCh[i], offX, offY, visCh.length);
  }
}

/* ══════════════════════ Pan / Zoom ══════════════════════ */

function _applyTransform(inner) {
  inner.style.transform =
    'translate(' + _pan.x + 'px,' + _pan.y + 'px) scale(' + _zoom + ')';
}

function _getInner() {
  return _currentInner || document.querySelector('.tree-canvas-inner');
}

function _setupInteraction(canvas, inner) {
  _currentInner = inner;

  canvas.addEventListener('mousedown', function (e) {
    if (e.target.closest('.tv-node')) return;
    _drag = { sx: e.clientX, sy: e.clientY, px: _pan.x, py: _pan.y };
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', function (e) {
    if (!_drag) return;
    _pan.x = _drag.px + (e.clientX - _drag.sx);
    _pan.y = _drag.py + (e.clientY - _drag.sy);
    var ci = _getInner();
    if (ci) _applyTransform(ci);
  });

  window.addEventListener('mouseup', function () {
    if (_drag) { _drag = null; canvas.style.cursor = 'grab'; }
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 0.95 : 1.05;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    var newZoom = Math.max(0.15, Math.min(3, _zoom * factor));
    var ratio = newZoom / _zoom;

    _pan.x = mx - ratio * (mx - _pan.x);
    _pan.y = my - ratio * (my - _pan.y);
    _zoom = newZoom;

    var ci = _getInner();
    if (ci) _applyTransform(ci);
  }, { passive: false });

  canvas.addEventListener('click', function (e) {
    var node = e.target.closest('.tv-node');
    if (!node) return;
    e.stopPropagation();
    _onNodeClick(node.dataset.nid);
  });

  var _tipNid = null;
  canvas.addEventListener('mouseover', function (e) {
    var node = e.target.closest('.tv-node');
    if (node && node.dataset.nid !== _tipNid) {
      _tipNid = node.dataset.nid;
      _showTreeTip(e, _tipNid);
    }
  });
  canvas.addEventListener('mouseout', function (e) {
    var node = e.target.closest('.tv-node');
    var rel  = e.relatedTarget ? e.relatedTarget.closest('.tv-node') : null;
    if (node && node !== rel) {
      _tipNid = null;
      _hideTreeTip();
    }
  });
}

/* ══════════════════════ Click Handler ══════════════════════ */

function _onNodeClick(nid) {
  var n = _tvNodeMap[nid];
  if (!n) return;

  if (_tvSelectedNid === nid) {
    closeTreeDetail();
    return;
  }

  _tvSelectedNid = nid;

  var nodes = document.querySelectorAll('.tv-node.selected');
  for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('selected');
  var el = document.querySelector('.tv-node[data-nid="' + nid + '"]');
  if (el) el.classList.add('selected');

  _showTreeDetail(n);
}

/* ══════════════════════ Tooltip ══════════════════════ */

function _showTreeTip(evt, nid) {
  var n = _tvNodeMap[nid];
  if (!n) return;

  var tip = document.getElementById('treeTip');
  if (!tip) return;

  var col = _kindHexMap[n.kind] || '#8E8E93';
  var ch = n.children || [];
  var ctx = n.context || {};

  var dotEl     = document.getElementById('treeTipDot');
  var kindEl    = document.getElementById('treeTipKind');
  var titleEl   = document.getElementById('treeTipTitle');
  var metaEl    = document.getElementById('treeTipMeta');
  var summaryEl = document.getElementById('treeTipSummary');
  var childEl   = document.getElementById('treeTipChildren');

  if (dotEl) dotEl.style.background = col;
  if (kindEl) {
    kindEl.textContent = n.kind;
    kindEl.style.color = col;
    kindEl.style.background = col + '18';
  }
  if (titleEl) titleEl.textContent = n.title;

  if (metaEl) {
    var metaItems = [];
    var timeRange = fmtHM(n.start) + ' \u2013 ' + fmtHM(n.end);
    var dur = n.end - n.start;
    metaItems.push('<span class="tree-tt-meta-item">' + timeRange + (dur > 0 ? ' (' + fmtDuration(dur) + ')' : '') + '</span>');
    if (ch.length) {
      metaItems.push('<span class="tree-tt-meta-item">' + ch.length + ' child</span>');
    }
    if (ctx.span_count) {
      metaItems.push('<span class="tree-tt-meta-item">' + ctx.span_count + ' span</span>');
    }
    metaEl.innerHTML = metaItems.join('<span style="color:var(--border-hover)"> \u00b7 </span>');
  }

  if (summaryEl) {
    if (n.summary) {
      summaryEl.textContent = n.summary.slice(0, 200) + (n.summary.length > 200 ? '\u2026' : '');
      summaryEl.style.display = '';
    } else {
      summaryEl.style.display = 'none';
    }
  }

  if (childEl) {
    if (ch.length && ch.length <= 8) {
      var chHtml = '';
      for (var i = 0; i < Math.min(5, ch.length); i++) {
        var c = ch[i];
        var cc = _kindHexMap[c.kind] || '#8E8E93';
        var ct = c.title;
        if (ct.length > 30) ct = ct.slice(0, 28) + '\u2026';
        chHtml += '<div class="tree-tt-child-row"><span class="tree-tt-child-dot" style="background:' + cc + '"></span><span class="tree-tt-child-name">' + esc(ct) + '</span></div>';
      }
      if (ch.length > 5) {
        chHtml += '<div style="font-size:9px;color:var(--text-tertiary);padding-top:2px">+ ' + (ch.length - 5) + ' more</div>';
      }
      childEl.innerHTML = chHtml;
      childEl.style.display = '';
    } else {
      childEl.style.display = 'none';
    }
  }

  tip.classList.add('visible');
  _positionTip(tip, evt);
}

function _positionTip(tip, evt) {
  var TIP_W = 280;
  var node = evt.target.closest('.tv-node');
  if (!node) return;

  var cr = node.getBoundingClientRect();
  var vw = window.innerWidth;
  var vh = window.innerHeight;

  tip.style.left = '0px';
  tip.style.top = '0px';
  var tipH = tip.offsetHeight || 160;

  var tx, ty;
  var rightSpace = vw - cr.right;
  var leftSpace = cr.left;

  if (rightSpace >= TIP_W + 12) {
    tx = cr.right + 10;
  } else if (leftSpace >= TIP_W + 12) {
    tx = cr.left - TIP_W - 10;
  } else {
    tx = Math.max(8, Math.min(vw - TIP_W - 8, cr.left + cr.width / 2 - TIP_W / 2));
  }

  ty = cr.top + cr.height / 2 - tipH / 2;
  if (ty < 8) ty = 8;
  if (ty + tipH > vh - 8) ty = vh - tipH - 8;

  if (rightSpace < TIP_W + 12 && leftSpace < TIP_W + 12) {
    ty = cr.bottom + 10;
    if (ty + tipH > vh - 8) ty = cr.top - tipH - 10;
  }

  tip.style.left = Math.round(tx) + 'px';
  tip.style.top  = Math.round(ty) + 'px';
}

function _hideTreeTip() {
  var tip = document.getElementById('treeTip');
  if (tip) tip.classList.remove('visible');
}

/* ══════════════════════ Detail Sheet ══════════════════════ */

function _showTreeDetail(n) {
  var sheet = document.getElementById('treeDetail');
  if (!sheet) return;

  var k = n.kind;
  var col = _kindHexColor(k);

  var dot  = document.getElementById('tdDot');
  var kind = document.getElementById('tdKind');
  var titl = document.getElementById('tdTitle');
  var body = document.getElementById('tdBody');

  if (dot)  dot.style.background = col;
  if (kind) {
    kind.textContent     = k;
    kind.style.background = col + '18';
    kind.style.color      = col;
  }
  if (titl) titl.textContent = n.title;
  if (body) body.innerHTML   = _tvDetailBody(n);

  sheet.classList.add('open');
}

function _kindHexColor(k) {
  return _kindHexMap[k] || '#8E8E93';
}

/* ── Detail Body ── */

function _tvDetailBody(n) {
  var k   = n.kind;
  var ctx = n.context || {};
  var ch  = n.children || [];
  var h   = '';

  if (n.summary) {
    h += '<div class="td-summary">' +
           '<div class="td-summary-lbl">\u2728 AI Summary</div>' +
           '<div class="td-summary-txt">' + esc(n.summary) + '</div>' +
         '</div>';
    if (n.evidence) {
      var eid = 'evi_' + (n.node_id || '').replace(/[^a-zA-Z0-9_]/g, '_');
      h += '<div class="td-evidence-wrap">' +
             '<button class="td-evidence-toggle" onclick="toggleEvidence(\'' + eid + '\', this)">' +
               '<span class="td-evidence-arrow">\u25B6</span> Evidence &amp; Details' +
             '</button>' +
             '<div class="td-evidence-body" id="' + eid + '" style="display:none">' +
               '<div class="td-evidence-txt">' + esc(n.evidence) + '</div>' +
             '</div>' +
           '</div>';
    }
  }

  if (ch.length) {
    var sumCount = 0;
    for (var ci = 0; ci < ch.length; ci++) { if (ch[ci].summary) sumCount++; }
    h += '<div class="td-sec">Children (' + sumCount + '/' + ch.length + ' summarized)</div>' +
         '<div class="td-tags">';
    for (var j = 0; j < ch.length; j++) {
      var c   = ch[j];
      var ct  = c.title;
      if (ct.length > 30) ct = ct.slice(0, 28) + '\u2026';
      var dot = c.summary ? '\u2713 ' : '';
      h += '<span class="td-tag">' + dot + esc(ct) + '</span>';
    }
    h += '</div>';
  }

  if (ctx.mouse_summaries && ctx.mouse_summaries.length) {
    h += '<div class="td-sec">Mouse Observations (' + ctx.mouse_summaries.length + ')</div>';
    for (var m = 0; m < ctx.mouse_summaries.length; m++) {
      var ms = ctx.mouse_summaries[m];
      var msEvi = '';
      if (ms.evidence) {
        var meid = 'mevi_' + m + '_' + (n.node_id || '').replace(/[^a-zA-Z0-9_]/g, '_');
        msEvi =
          '<div class="td-evidence-wrap td-evidence-inline">' +
            '<button class="td-evidence-toggle" onclick="toggleEvidence(\'' + meid + '\', this)">' +
              '<span class="td-evidence-arrow">\u25B6</span> Details' +
            '</button>' +
            '<div class="td-evidence-body" id="' + meid + '" style="display:none">' +
              '<div class="td-evidence-txt">' + esc(ms.evidence) + '</div>' +
            '</div>' +
          '</div>';
      }
      h += '<div class="td-mouse-sum">' +
             '<span class="td-mouse-sum-ts">' + fmtTs(ms.start) + ' \u2192 ' + fmtTs(ms.end) + '</span>' +
             '<div class="td-mouse-sum-txt">' + esc(ms.summary) + '</div>' +
             msEvi +
           '</div>';
    }
  }

  h += '<div class="td-row"><span class="td-lbl">Time</span>' +
       '<span class="td-val">' + fmtTs(n.start) + ' \u2192 ' + fmtTs(n.end) +
       ' (' + fmtDuration(n.end - n.start) + ')</span></div>';

  if (k === 'day') {
    h += '<div class="td-row"><span class="td-lbl">' +
         (treeMode === 'app' ? 'Apps' : 'Sessions') +
         '</span><span class="td-val">' + ch.length + '</span></div>';
  }

  if (k === 'session') {
    if (ctx.apps && ctx.apps.length) {
      h += '<div class="td-row"><span class="td-lbl">Apps</span><div class="td-val"><div class="td-tags">';
      for (var a = 0; a < ctx.apps.length; a++) h += '<span class="td-tag">' + esc(ctx.apps[a]) + '</span>';
      h += '</div></div></div>';
    }
    if (ctx.urls && ctx.urls.length) {
      h += '<div class="td-row"><span class="td-lbl">URLs</span><div class="td-val"><div class="td-tags">';
      for (var u = 0; u < ctx.urls.length; u++) {
        var url = ctx.urls[u];
        var urlDisp = url.length > 50 ? url.slice(0, 47) + '\u2026' : url;
        h += '<span class="td-tag"><a href="' + esc(url) + '" target="_blank" title="' + esc(url) + '">' + esc(urlDisp) + '</a></span>';
      }
      h += '</div></div></div>';
    }
    if (ctx.files && ctx.files.length) {
      h += '<div class="td-row"><span class="td-lbl">Files</span><div class="td-val"><div class="td-tags">';
      for (var f = 0; f < ctx.files.length; f++) {
        h += '<span class="td-tag" title="' + esc(ctx.files[f]) + '">' + esc(ctx.files[f].split('/').pop()) + '</span>';
      }
      h += '</div></div></div>';
    }
    h += '<div class="td-row"><span class="td-lbl">Spans</span><span class="td-val">' + (ctx.span_count || ch.length) + '</span></div>';
    if (ctx.total_dwell) h += '<div class="td-row"><span class="td-lbl">Active</span><span class="td-val">' + fmtDuration(ctx.total_dwell) + '</span></div>';
  }

  if (k === 'app') {
    h += '<div class="td-row"><span class="td-lbl">Locations</span><span class="td-val">' + ch.length + '</span></div>';
    h += '<div class="td-row"><span class="td-lbl">Spans</span><span class="td-val">' + (ctx.span_count || 0) + '</span></div>';
    if (ctx.total_dwell) h += '<div class="td-row"><span class="td-lbl">Active</span><span class="td-val">' + fmtDuration(ctx.total_dwell) + '</span></div>';
  }

  if (k === 'location') {
    var fl = ctx.full_location || '';
    if (fl.indexOf('://') > -1) {
      h += '<div class="td-row"><span class="td-lbl">URL</span><span class="td-val"><a href="' + esc(fl) + '" target="_blank" style="color:var(--accent);text-decoration:none">' + esc(fl) + '</a></span></div>';
    } else if (fl.indexOf('/') > -1) {
      h += '<div class="td-row"><span class="td-lbl">File</span><span class="td-val" style="font-family:var(--mono);font-size:12px">' + esc(fl) + '</span></div>';
    } else {
      h += '<div class="td-row"><span class="td-lbl">Title</span><span class="td-val">' + esc(fl) + '</span></div>';
    }
    h += '<div class="td-row"><span class="td-lbl">Visits</span><span class="td-val">' + (ctx.span_count || 0) + '</span></div>';
    if (ctx.total_dwell) h += '<div class="td-row"><span class="td-lbl">Active</span><span class="td-val">' + fmtDuration(ctx.total_dwell) + '</span></div>';
    if (ch.length) h += '<div class="td-row"><span class="td-lbl">Actions</span><span class="td-val">' + ch.length + '</span></div>';
  }

  if (k === 'span') {
    h += '<div class="td-row"><span class="td-lbl">App</span><span class="td-val">' + esc(ctx.app || '') + '</span></div>';
    if (ctx.url) h += '<div class="td-row"><span class="td-lbl">URL</span><span class="td-val"><a href="' + esc(ctx.url) + '" target="_blank" style="color:var(--accent);text-decoration:none">' + esc(ctx.url) + '</a></span></div>';
    if (ctx.filepath) h += '<div class="td-row"><span class="td-lbl">File</span><span class="td-val" style="font-family:var(--mono);font-size:12px">' + esc(ctx.filepath) + '</span></div>';
    if (ch.length) h += '<div class="td-row"><span class="td-lbl">Actions</span><span class="td-val">' + ch.length + '</span></div>';
  }

  if (k === 'action') {
    if (ctx.app) h += '<div class="td-row"><span class="td-lbl">App</span><span class="td-val">' + esc(ctx.app) + '</span></div>';
    if (ctx.location) h += '<div class="td-row"><span class="td-lbl">Location</span><span class="td-val">' + esc(ctx.location) + '</span></div>';

    if (ctx.text) {
      h += '<div class="td-sec">Typed Text</div><div class="td-code">' + esc(ctx.text) + '</div>';
    }
    if (ctx.shortcuts && ctx.shortcuts.length) {
      h += '<div class="td-sec">Shortcuts</div><div style="margin-bottom:8px">';
      for (var s = 0; s < ctx.shortcuts.length; s++) h += '<span class="td-kbd">' + esc(ctx.shortcuts[s]) + '</span>';
      h += '</div>';
    }
    if (ctx.mouse_summaries && ctx.mouse_summaries.length) {
      h += '<div class="td-sec">Mouse Activity</div>';
      for (var ms2 = 0; ms2 < ctx.mouse_summaries.length; ms2++) {
        h += '<div style="padding:3px 0;font-size:12px;color:var(--text-secondary)">' +
             '<span style="font-family:var(--mono);font-size:10px;color:var(--text-tertiary)">' + fmtTs(ctx.mouse_summaries[ms2].start) + '</span> ' +
             esc(ctx.mouse_summaries[ms2].summary) + '</div>';
      }
    }
    if (ctx.mouse_actions && ctx.mouse_actions.length) {
      h += '<div class="td-sec">Mouse (' + ctx.mouse_actions.length + ')</div>';
      var mLimit = Math.min(20, ctx.mouse_actions.length);
      for (var ma = 0; ma < mLimit; ma++) {
        var act = ctx.mouse_actions[ma];
        h += '<div class="td-mouse-row"><span>' + fmtTs(act.ts) + ' ' + esc(act.action) + '</span>' +
             '<span class="td-mouse-coord">(' + act.x + ', ' + act.y + ')</span></div>';
      }
      if (ctx.mouse_actions.length > 20) h += '<div style="color:var(--text-tertiary);font-size:10px;margin-top:2px">+ ' + (ctx.mouse_actions.length - 20) + ' more</div>';
    }
    if (ctx.clipboard && ctx.clipboard.length) {
      h += '<div class="td-sec">Clipboard</div>';
      for (var cl = 0; cl < ctx.clipboard.length; cl++) {
        h += '<div class="td-clip-item">' + esc(ctx.clipboard[cl].preview) + '</div>';
      }
    }

    var imgs = [];
    if (ctx.mouse_actions) {
      for (var mi = 0; mi < ctx.mouse_actions.length; mi++) {
        if (ctx.mouse_actions[mi].detail) imgs.push(ctx.mouse_actions[mi].detail);
        else if (ctx.mouse_actions[mi].full) imgs.push(ctx.mouse_actions[mi].full);
      }
    }
    if (imgs.length) {
      h += '<div class="td-imgs">';
      var imgLimit = Math.min(12, imgs.length);
      for (var ii = 0; ii < imgLimit; ii++) {
        h += '<img src="/blobs/' + esc(imgs[ii]) + '" loading="lazy" onerror="this.style.display=\'none\'" onclick="openLightbox(\'/blobs/' + esc(imgs[ii]) + '\')">';
      }
      h += '</div>';
    }
  }

  return h;
}
