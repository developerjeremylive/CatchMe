import { renderTree, _cleanupTree } from './tree.js';
import { renderActivity, fltStopPoll } from './activity.js';
import { renderDigest, _clearDgTimer } from './digest.js';

var _expTab = 'tree';

function _cleanupCurrentTab() {
  if (_expTab === 'tree') _cleanupTree();
  if (_expTab === 'activity') fltStopPoll();
  if (_expTab === 'digest') _clearDgTimer();
}

export function renderExplorer() {
  var content = document.getElementById('content');
  content.innerHTML =
    '<div class="page-enter">' +
      '<div class="page-title">Explorer</div>' +
      '<div class="page-subtitle">Multi-dimensional view of your digital activity</div>' +
      '<div class="controls-row">' +
        '<div class="tab-bar">' +
          '<button class="tab-pill' + (_expTab === 'tree' ? ' active' : '') + '" onclick="exploreTab(\'tree\')">Tree</button>' +
          '<button class="tab-pill' + (_expTab === 'digest' ? ' active' : '') + '" onclick="exploreTab(\'digest\')">Digest</button>' +
          '<button class="tab-pill' + (_expTab === 'activity' ? ' active' : '') + '" onclick="exploreTab(\'activity\')">Activity</button>' +
        '</div>' +
      '</div>' +
      '<div id="explorerBody"></div>' +
    '</div>';

  _renderExpTab();
}

function _renderExpTab() {
  if (_expTab === 'tree') renderTree('explorerBody');
  else if (_expTab === 'digest') renderDigest('explorerBody');
  else renderActivity('explorerBody');
}

export function exploreTab(t) {
  _cleanupCurrentTab();
  _expTab = t;
  var content = document.getElementById('content');
  if (content) content.querySelectorAll('.tab-pill').forEach(function(b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === t);
  });
  _renderExpTab();
}

export function explorerCleanup() {
  _cleanupCurrentTab();
}

window.exploreTab = exploreTab;
