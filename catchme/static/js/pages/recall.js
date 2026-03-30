import { api, esc, fmtHM } from '../utils.js';
import { renderMemory } from './memory.js';
import { renderContext } from './context.js';

var _recallTab = 'replay';
var _nodeCache = null;
var _searchTimer = null;

var _KIND_COL = {
  day: '#4B7BE5', session: '#50B87A', app: '#6CB4D9',
  location: '#5BA3B5', action: '#A372D4', span: '#D4933A'
};

function _flattenNodes(node, out) {
  if (!node) return;
  out.push(node);
  var ch = node.children || [];
  for (var i = 0; i < ch.length; i++) _flattenNodes(ch[i], out);
}

function _loadNodeCache() {
  if (_nodeCache) return Promise.resolve(_nodeCache);
  var now = new Date();
  var d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  var d1 = new Date(now); d1.setHours(23, 59, 59, 999);
  return api('/api/tree?mode=time&since=' + d0.getTime() / 1000 + '&until=' + d1.getTime() / 1000).then(function(data) {
    var nodes = [];
    if (data && data.tree) _flattenNodes(data.tree, nodes);
    _nodeCache = nodes;
    return nodes;
  });
}

function _searchNodes(q) {
  var ql = q.toLowerCase();
  var keywords = ql.split(/\s+/).filter(Boolean);
  return _loadNodeCache().then(function(nodes) {
    var results = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var haystack = ((n.summary || '') + ' ' + (n.evidence || '') + ' ' + (n.title || '')).toLowerCase();
      var allMatch = true;
      for (var k = 0; k < keywords.length; k++) {
        if (haystack.indexOf(keywords[k]) === -1) { allMatch = false; break; }
      }
      if (allMatch && (n.summary || n.evidence)) results.push(n);
    }
    return results.slice(0, 20);
  });
}

export function renderRecall() {
  _nodeCache = null;
  var content = document.getElementById('content');
  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="recall-search-wrap">' +
        '<input class="recall-search" id="recallSearch" type="text" placeholder="Search node summaries\u2026" autocomplete="off">' +
      '</div>' +
      '<div id="recallSearchResults" class="recall-results"></div>' +
      '<div class="controls-row">' +
        '<div class="tab-bar">' +
          '<button class="tab-pill' + (_recallTab === 'replay' ? ' active' : '') + '" onclick="recallTab(\'replay\')">Replay</button>' +
          '<button class="tab-pill' + (_recallTab === 'resources' ? ' active' : '') + '" onclick="recallTab(\'resources\')">Resources</button>' +
        '</div>' +
      '</div>' +
      '<div id="recallBody"></div>' +
    '</div>';

  _loadNodeCache();

  document.getElementById('recallSearch').addEventListener('input', function() {
    var q = this.value.trim();
    var rEl = document.getElementById('recallSearchResults');
    if (!q) { rEl.innerHTML = ''; rEl.style.display = 'none'; return; }
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function() {
      _searchNodes(q).then(function(nodes) {
        if (!nodes.length) { rEl.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-tertiary);font-size:13px">No matching summaries</div>'; rEl.style.display = ''; return; }
        rEl.style.display = '';
        rEl.innerHTML = nodes.map(function(n) {
          var col = _KIND_COL[n.kind] || '#8E8E93';
          var sum = (n.summary || '').slice(0, 120);
          if ((n.summary || '').length > 120) sum += '\u2026';
          var time = (n.start && n.end) ? fmtHM(n.start) + ' \u2013 ' + fmtHM(n.end) : '';
          return '<div class="sr-item"><div class="sr-icon" style="background:' + col + '">' + (n.kind || '?').charAt(0).toUpperCase() + '</div><div style="flex:1;min-width:0"><div class="sr-title">' + esc(n.title || n.kind) + '</div><div class="sr-sub">' + esc(sum) + '</div></div><div style="font-size:10px;color:var(--text-tertiary);font-family:var(--mono);flex-shrink:0">' + time + '</div></div>';
        }).join('');
      });
    }, 150);
  });

  _renderRecallTab();
}

function _renderRecallTab() {
  if (_recallTab === 'replay') renderMemory('recallBody');
  else renderContext('recallBody');
}

export function recallTab(t) {
  _recallTab = t;
  var content = document.getElementById('content');
  if (content) content.querySelectorAll('.tab-pill').forEach(function(b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === t);
  });
  _renderRecallTab();
}

window.recallTab = recallTab;
