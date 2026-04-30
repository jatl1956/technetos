/* =========================================================
   Technetos Multiplayer — Student
   Module: TA toolbar buttons + resizer IIFE
   ========================================================= */

/* === TA TOOLBAR FUNCTIONS === */
function toggleDropdown(id) {
  const dd = document.getElementById(id);
  // Close all other dropdowns
  document.querySelectorAll('.ta-dropdown').forEach(d => { if (d.id !== id) d.style.display = 'none'; });
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
// Close dropdowns when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('.ta-btn') && !e.target.closest('.ta-dropdown')) {
    document.querySelectorAll('.ta-dropdown').forEach(d => d.style.display = 'none');
  }
});

function addTA(type, params) {
  document.querySelectorAll('.ta-dropdown').forEach(d => d.style.display = 'none');
  TAEngine.addIndicator(type, params);
  updateTAButtons();
  showToast(TAEngine._getLabel({ type, params }) + ' added', 'info');
}

function startDraw(type) {
  document.querySelectorAll('.ta-dropdown').forEach(d => d.style.display = 'none');
  TAEngine.startDrawing(type);
  const status = document.getElementById('draw-status');
  const labels = { horzline: 'Click on chart to place horizontal line', trendline: 'Click 2 points for trend line', horzray: 'Click on chart to place horizontal ray' };
  status.textContent = labels[type] || 'Click on chart...';
  status.style.display = 'inline';
  // Escape key cancels
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      TAEngine.cancelDrawing();
      status.style.display = 'none';
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  // Auto-hide status after drawing completes
  const checkDone = setInterval(() => {
    if (!TAEngine.drawingMode) {
      status.style.display = 'none';
      clearInterval(checkDone);
      document.removeEventListener('keydown', escHandler);
    }
  }, 200);
}

function updateTAButtons() {
  const hasItems = TAEngine.indicators.length > 0 || TAEngine.drawings.length > 0;
  document.getElementById('btn-active-ta').style.display = hasItems ? 'inline-block' : 'none';
  document.getElementById('btn-clear-ta').style.display = hasItems ? 'inline-block' : 'none';
}

function showActiveTA() {
  const inds = TAEngine.getActiveIndicators();
  const draws = TAEngine.getActiveDrawings();
  if (inds.length === 0 && draws.length === 0) { showToast('No active studies', 'info'); return; }

  let html = '<div class="ta-modal-overlay" id="ta-modal-overlay" onclick="if(event.target===this)this.remove()">';
  html += '<div class="ta-modal">';
  html += '<h3>ACTIVE STUDIES</h3>';
  for (const i of inds) {
    html += '<div class="ta-modal-item"><span>' + i.label + '</span><button onclick="removeTA(\'' + i.id + '\')">&times;</button></div>';
  }
  for (const d of draws) {
    html += '<div class="ta-modal-item"><span>' + d.label + '</span><button onclick="removeDraw(\'' + d.id + '\')">&times;</button></div>';
  }
  html += '<div style="margin-top:12px;text-align:right;"><button class="ta-btn" onclick="document.getElementById(\'ta-modal-overlay\').remove()">Close</button></div>';
  html += '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

function removeTA(id) {
  TAEngine.removeIndicator(id);
  updateTAButtons();
  const modal = document.getElementById('ta-modal-overlay');
  if (modal) modal.remove();
  showActiveTA();  // refresh
}

function removeDraw(id) {
  TAEngine.removeDrawing(id);
  updateTAButtons();
  const modal = document.getElementById('ta-modal-overlay');
  if (modal) modal.remove();
  if (TAEngine.drawings.length > 0 || TAEngine.indicators.length > 0) showActiveTA();
}

function clearAllTA() {
  TAEngine.clearAll();
  updateTAButtons();
  showToast('All studies cleared', 'info');
}

/* === RESIZER (from original) === */
(function initResizers() {
  const vDiv = document.getElementById('v-divider');
  if (vDiv) {
    let startX, startW;
    vDiv.addEventListener('mousedown', e => {
      startX = e.clientX;
      startW = document.querySelector('.left-panel')?.offsetWidth || 340;
      document.body.classList.add('resizing');
      const onMove = ev => {
        const newW = Math.min(500, Math.max(240, startW + ev.clientX - startX));
        document.querySelector('.main-layout').style.gridTemplateColumns = newW + 'px 4px 1fr';
      };
      const onUp = () => {
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
})();
