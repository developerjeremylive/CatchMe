import { api, fmtDate } from '../utils.js';
import { groupBy15, renderMemGroup } from './today.js';

var memDate = new Date();
var _memTargetId = 'content';

export function renderMemory(targetId) {
  _memTargetId = targetId || 'content';
  var d0 = new Date(memDate); d0.setHours(0, 0, 0, 0);
  var d1 = new Date(memDate); d1.setHours(23, 59, 59, 999);
  var content = document.getElementById(_memTargetId);
  content.innerHTML = '<div class="page-enter"><div class="page-title">Memory</div><div class="page-subtitle">Day-by-day recall</div><div class="date-nav"><button class="date-btn" onclick="shiftMemDate(-1)">&lsaquo;</button><span class="date-label">' + fmtDate(memDate) + '</span><button class="date-btn" onclick="shiftMemDate(1)">&rsaquo;</button></div><div id="feed"></div></div>';
  api('/api/events?since=' + d0.getTime() / 1000 + '&until=' + d1.getTime() / 1000 + '&limit=2000').then(function(events) {
    var f = document.getElementById('feed');
    if (!events.length) { f.innerHTML = '<div class="empty">No memories for this day</div>'; return; }
    f.innerHTML = groupBy15(events).map(renderMemGroup).join('');
  });
}

export function shiftMemDate(d) {
  memDate.setDate(memDate.getDate() + d);
  renderMemory(_memTargetId);
}

window.renderMemory = renderMemory;
window.shiftMemDate = shiftMemDate;
