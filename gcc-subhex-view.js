// gcc-subhex-view.js v0.2.0 — 2026-04-28
// Subhex editor window. Opens for one parent hex at a time; main map
// stays at 30mi, untouched. Self-contained: own SVG, own paint palette,
// own name/notes inputs. ~25 cells per open — bounded, fast.
//
// Replaces v0.1.0's whole-map 6mi rescale (350K cells, SVG-killing). The
// scale toggle, viewport culling, mini-map, and applyTransform shim are
// all gone. Data layer (gcc-subhex-data, gcc-rng) is unchanged.
//
// Globals consumed: hexIdStr, getHexTerrain, TERRAIN, GCCSubhexData,
//   GCCSubhexView is wired by greyhawk-map.html init via the side panel
//   "Explore Subhexes" button (calls GCCSubhexView.open(col, row)).

(function(){
  'use strict';

  const SUB_DIM = 5;
  const VIEWBOX = 600;             // svg viewBox dimension
  const PARENT_R = 220;             // parent hex radius in svg coords
  const SUB_R = PARENT_R / SUB_DIM; // 44

  const state = {
    win: null,
    isOpen: false,
    parentCol: null,
    parentRow: null,
    parentId: null,
    parentTerrain: null,
    selectedQ: null,
    selectedR: null,
    paintTerrain: null,   // null = select-only mode; otherwise the armed terrain key (or '__erase')
    drag: null,
    dragOffset: { x: 0, y: 0 },
  };

  // ── Build window DOM ───────────────────────────────────────────────────
  function ensureWindow(){
    if (state.win) return state.win;
    const w = document.createElement('div');
    w.id = 'subhex-window';
    w.innerHTML = `
      <div class="sxw-header">
        <span class="sxw-title">Subhexes</span>
        <button class="sxw-close" title="Close">✕</button>
      </div>
      <div class="sxw-body">
        <svg id="sxw-svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" preserveAspectRatio="xMidYMid meet"></svg>
        <div class="sxw-detail">
          <div class="sxw-row"><label>Subhex</label><span class="sxw-readonly" id="sxw-coord">— select a cell</span></div>
          <div class="sxw-row"><label>Terrain</label><span class="sxw-readonly" id="sxw-terrain">—</span></div>
          <div class="sxw-row"><label>Name</label><input type="text" id="sxw-name" placeholder="(unnamed)" disabled></div>
          <div class="sxw-row"><label>Notes</label><textarea id="sxw-notes" placeholder="GM notes" disabled></textarea></div>
          <div class="sxw-source" id="sxw-source"></div>
        </div>
        <div class="sxw-palette" id="sxw-palette"></div>
        <div class="sxw-tools">
          <button class="sxw-tool-btn" id="sxw-clear">Clear override on selected</button>
          <span class="sxw-mode" id="sxw-mode">Mode: Select</span>
        </div>
      </div>
    `;
    document.body.appendChild(w);
    state.win = w;

    // Header dragging
    const head = w.querySelector('.sxw-header');
    head.addEventListener('mousedown', onDragStart);
    head.addEventListener('touchstart', onDragStart, { passive: false });
    w.querySelector('.sxw-close').addEventListener('click', close);

    // Detail-pane field handlers
    w.querySelector('#sxw-name').addEventListener('blur', persistFields);
    w.querySelector('#sxw-notes').addEventListener('blur', persistFields);

    // Clear-override
    w.querySelector('#sxw-clear').addEventListener('click', onClearOverride);

    // Build terrain palette
    buildPalette();

    // Restore last position
    try {
      const pos = JSON.parse(localStorage.getItem('gcc-subhex-window-pos') || 'null');
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)){
        w.style.left = pos.x + 'px';
        w.style.top  = pos.y + 'px';
      } else {
        w.style.right = '24px';
        w.style.top   = '160px';
      }
    } catch(e){
      w.style.right = '24px';
      w.style.top   = '160px';
    }
    return w;
  }

  function buildPalette(){
    const pal = state.win.querySelector('#sxw-palette');
    if (!pal || typeof TERRAIN === 'undefined') return;
    pal.innerHTML = '';
    // Terrain keys to surface in the palette. Order roughly mirrors the
    // existing Hex Editor Paint tab; water variants collapsed to a couple
    // of common picks (Phase A scope).
    const order = [
      'clear','plains','forest','hardwood','conifer','jungle',
      'hills','forest_hills','mountains','desert','barrens','swamp',
      'water_fresh','water_inland_sea','water_coastal','water_shallow','water_deep',
    ];
    for (const t of order){
      const meta = TERRAIN[t];
      if (!meta) continue;
      const b = document.createElement('button');
      b.className = 'sxw-swatch';
      b.dataset.terrain = t;
      b.title = meta.label || t;
      b.style.background = `rgb(${meta.rgb})`;
      b.addEventListener('click', () => onPaletteClick(t));
      pal.appendChild(b);
    }
    const erase = document.createElement('button');
    erase.className = 'sxw-swatch sxw-swatch-erase';
    erase.dataset.terrain = '__erase';
    erase.title = 'Erase override (revert to seed)';
    erase.textContent = '⌫';
    erase.addEventListener('click', () => onPaletteClick('__erase'));
    pal.appendChild(erase);
  }

  function onPaletteClick(t){
    state.paintTerrain = (state.paintTerrain === t) ? null : t;
    syncPaletteUI();
    syncModeLabel();
  }
  function syncPaletteUI(){
    if (!state.win) return;
    state.win.querySelectorAll('.sxw-swatch').forEach(b => {
      b.classList.toggle('armed', b.dataset.terrain === state.paintTerrain);
    });
  }
  function syncModeLabel(){
    const el = state.win?.querySelector('#sxw-mode');
    if (!el) return;
    if (!state.paintTerrain){
      el.textContent = 'Mode: Select';
    } else if (state.paintTerrain === '__erase'){
      el.textContent = 'Mode: Erase override';
    } else {
      const lbl = TERRAIN[state.paintTerrain]?.label || state.paintTerrain;
      el.textContent = `Mode: Paint · ${lbl}`;
    }
  }

  // ── Open / close ───────────────────────────────────────────────────────
  function open(col, row){
    ensureWindow();
    state.isOpen = true;
    state.parentCol = col;
    state.parentRow = row;
    state.parentId = (typeof hexIdStr === 'function') ? hexIdStr(col, row) : `${col}-${row}`;
    state.parentTerrain = (typeof getHexTerrain === 'function') ? getHexTerrain(col, row) : null;
    state.selectedQ = null;
    state.selectedR = null;
    state.paintTerrain = null;

    const lm = (typeof GCCLandmarks !== 'undefined') ? GCCLandmarks.getById(state.parentId) : null;
    const t = state.win.querySelector('.sxw-title');
    t.textContent = lm ? `${lm.name} · ${state.parentId}` : `Parent ${state.parentId}`;

    state.win.style.display = 'flex';
    rebuildSVG();
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
  }

  function close(){
    if (!state.win) return;
    state.win.style.display = 'none';
    state.isOpen = false;
    state.parentCol = state.parentRow = null;
    state.selectedQ = state.selectedR = null;
    state.paintTerrain = null;
  }

  function isOpen(){ return state.isOpen; }

  // ── SVG render ─────────────────────────────────────────────────────────
  function subhexCenter(q, r){
    const cx = VIEWBOX / 2;
    const cy = VIEWBOX / 2;
    const dq = q - 2, dr = r - 2;
    return {
      x: cx + SUB_R * 1.5 * dq,
      y: cy + SUB_R * Math.sqrt(3) * (dr + dq / 2),
    };
  }
  function subhexCorners(q, r){
    const c = subhexCenter(q, r);
    const out = new Array(6);
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      out[i] = [c.x + SUB_R * Math.cos(a), c.y + SUB_R * Math.sin(a)];
    }
    return out;
  }
  function parentCorners(){
    const cx = VIEWBOX / 2, cy = VIEWBOX / 2;
    const out = new Array(6);
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      out[i] = [cx + PARENT_R * Math.cos(a), cy + PARENT_R * Math.sin(a)];
    }
    return out;
  }

  function rebuildSVG(){
    const svg = state.win.querySelector('#sxw-svg');
    if (!svg) return;
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    // Parent hex outline (decorative)
    const pCorners = parentCorners();
    const pPts = pCorners.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const pOutline = document.createElementNS(ns, 'polygon');
    pOutline.setAttribute('points', pPts);
    pOutline.setAttribute('class', 'sxw-parent-outline');
    svg.appendChild(pOutline);

    // 25 subhexes
    for (let q = 0; q < SUB_DIM; q++){
      for (let r = 0; r < SUB_DIM; r++){
        const sub = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
        const corners = subhexCorners(q, r);
        const pts = corners.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', pts);
        let cls = 'sxw-cell';
        if (sub.source === 'authored') cls += ' authored';
        if (q === state.selectedQ && r === state.selectedR) cls += ' selected';
        poly.setAttribute('class', cls);
        poly.dataset.q = q;
        poly.dataset.r = r;
        poly.id = `sxw-cell-${q}-${r}`;
        if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
          poly.setAttribute('fill', `rgb(${TERRAIN[sub.terrain].rgb})`);
        } else {
          poly.setAttribute('fill', '#d8c890');
        }
        poly.addEventListener('click', onCellClick);
        svg.appendChild(poly);

        // Coord label (tiny, only on selected)
        if (q === state.selectedQ && r === state.selectedR){
          const c = subhexCenter(q, r);
          const tl = document.createElementNS(ns, 'text');
          tl.setAttribute('x', c.x);
          tl.setAttribute('y', c.y + 4);
          tl.setAttribute('text-anchor', 'middle');
          tl.setAttribute('class', 'sxw-cell-label');
          tl.textContent = `${q},${r}`;
          svg.appendChild(tl);
        }
      }
    }
  }

  function applyCellPaint(q, r){
    const el = document.getElementById(`sxw-cell-${q}-${r}`);
    if (!el) return;
    const sub = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
    if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
      el.setAttribute('fill', `rgb(${TERRAIN[sub.terrain].rgb})`);
    } else {
      el.setAttribute('fill', '#d8c890');
    }
    el.classList.toggle('authored', sub.source === 'authored');
  }

  // ── Cell click ─────────────────────────────────────────────────────────
  function onCellClick(ev){
    ev.stopPropagation();
    const q = +ev.currentTarget.dataset.q;
    const r = +ev.currentTarget.dataset.r;
    if (state.paintTerrain){
      // Paint mode — write override, repaint the cell, keep selection where it was.
      const terrain = state.paintTerrain === '__erase' ? null : state.paintTerrain;
      window.GCCSubhexData.setSubhexOverride(state.parentId, q, r, { terrain });
      applyCellPaint(q, r);
      // Refresh detail pane only if the painted cell IS the selected one.
      if (q === state.selectedQ && r === state.selectedR) syncDetailPanel();
      return;
    }
    selectCell(q, r);
  }

  function selectCell(q, r){
    if (state.selectedQ !== null && state.selectedR !== null){
      const prev = document.getElementById(`sxw-cell-${state.selectedQ}-${state.selectedR}`);
      if (prev) prev.classList.remove('selected');
    }
    state.selectedQ = q;
    state.selectedR = r;
    // Re-render to refresh the small coord label inside the cell.
    rebuildSVG();
    syncDetailPanel();
  }

  // ── Detail panel ───────────────────────────────────────────────────────
  function syncDetailPanel(){
    const w = state.win;
    if (!w) return;
    const coord  = w.querySelector('#sxw-coord');
    const terr   = w.querySelector('#sxw-terrain');
    const name   = w.querySelector('#sxw-name');
    const notes  = w.querySelector('#sxw-notes');
    const source = w.querySelector('#sxw-source');
    const clearB = w.querySelector('#sxw-clear');

    if (state.selectedQ === null){
      coord.textContent  = '— select a cell';
      terr.textContent   = '—';
      name.value = '';   name.disabled  = true;
      notes.value = '';  notes.disabled = true;
      source.textContent = '';
      clearB.disabled    = true;
      return;
    }
    const sub = window.GCCSubhexData.getSubhex(
      state.parentId, state.selectedQ, state.selectedR, state.parentTerrain
    );
    coord.textContent = `${state.parentId} · q${state.selectedQ}, r${state.selectedR}`;
    terr.textContent  = sub.terrain ? (TERRAIN[sub.terrain]?.label || sub.terrain) : '—';
    name.value  = sub.name  || '';  name.disabled  = false;
    notes.value = sub.notes || '';  notes.disabled = false;
    source.textContent = sub.source === 'authored' ? 'Authored override (localStorage)'
      : sub.source === 'canonical' ? 'Canonical Greyhawk feature'
      : 'Procedural — derived from world seed';
    clearB.disabled = (sub.source !== 'authored');
  }

  function persistFields(){
    if (state.selectedQ === null) return;
    const w = state.win;
    const name  = w.querySelector('#sxw-name').value.trim();
    const notes = w.querySelector('#sxw-notes').value;
    window.GCCSubhexData.setSubhexOverride(state.parentId, state.selectedQ, state.selectedR, { name, notes });
    applyCellPaint(state.selectedQ, state.selectedR);
    syncDetailPanel();
  }

  function onClearOverride(){
    if (state.selectedQ === null) return;
    window.GCCSubhexData.clearSubhex(state.parentId, state.selectedQ, state.selectedR);
    applyCellPaint(state.selectedQ, state.selectedR);
    syncDetailPanel();
  }

  // ── Drag handling (header only) ────────────────────────────────────────
  function onDragStart(ev){
    if (ev.target.closest('.sxw-close')) return;
    ev.preventDefault();
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const rect = state.win.getBoundingClientRect();
    state.drag = { startX: evt.clientX, startY: evt.clientY };
    state.dragOffset.x = evt.clientX - rect.left;
    state.dragOffset.y = evt.clientY - rect.top;
    state.win.style.right = 'auto';
    state.win.style.bottom = 'auto';
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend',  onDragEnd);
  }
  function onDragMove(ev){
    if (!state.drag) return;
    if (ev.preventDefault) ev.preventDefault();
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const x = evt.clientX - state.dragOffset.x;
    const y = evt.clientY - state.dragOffset.y;
    state.win.style.left = x + 'px';
    state.win.style.top  = y + 'px';
  }
  function onDragEnd(){
    if (!state.drag) return;
    state.drag = null;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend',  onDragEnd);
    // Persist position
    try {
      const rect = state.win.getBoundingClientRect();
      localStorage.setItem('gcc-subhex-window-pos', JSON.stringify({ x: rect.left, y: rect.top }));
    } catch(e){}
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.GCCSubhexView = { open, close, isOpen };
})();
