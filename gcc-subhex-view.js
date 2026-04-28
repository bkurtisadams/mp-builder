// gcc-subhex-view.js v0.1.0 — 2026-04-28
// Subhex visual layer + scale toggle + mini-map + info panel.
// Phase A: terrain paint + name/notes editing at 6mi. Landmarks (B),
// 1mi tier (C), generator port (D), and graycloak-adnd consumer wiring
// (F) live in later phases.
//
// Globals consumed: HEX_R, GRID_COLS, GRID_ROWS, cal, colStep, rowStep,
//   hexCenter, hexCornersDisplay, mapToStage, screenToMap,
//   hexIdStr, getHexTerrain, TERRAIN, state, applyTransform,
//   GCCTerrain, GCCSubhexData, GCCRng, makeDraggable.
// Globals produced: window.GCCSubhexView (public API used by hex-edit
//   and the topbar scale toggle).

(function(){
  'use strict';

  const SUB_DIM = 5;
  const SUB_R = 4;          // HEX_R / SUB_DIM = 20 / 5
  const SUB_RS = SUB_R * Math.sqrt(3);
  const SUB_CS = SUB_R * 1.5;
  const ZOOM_AUTO_MIN = 2.5; // auto-zoom floor when entering 6mi

  const view = {
    activeScale: 30,
    selectedSub: null,        // { col, row, q, r }
    miniMap: { dock: 'tr', dragging: false },
    cullCache: { renderedKey: null },
  };

  // ── Geometry ────────────────────────────────────────────────────────────
  function subhexCenter(col, row, q, r){
    const p = hexCenter(col, row);
    const dq = q - 2, dr = r - 2;
    return {
      x: p.x + SUB_CS * dq,
      y: p.y + SUB_RS * (dr + dq / 2),
    };
  }
  function subhexCorners(col, row, q, r){
    const c = subhexCenter(col, row, q, r);
    const out = new Array(6);
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      out[i] = [c.x + SUB_R * Math.cos(a), c.y + SUB_R * Math.sin(a)];
    }
    return out;
  }
  function mapToSubhex(mx, my){
    // Closest parent first — same as mapToHex but skip the bestDist guard
    // because the click might land in a corner-spillover subhex outside
    // its parent silhouette. Then sweep that parent + 6 neighbors' 25
    // subhexes each for nearest by squared distance.
    const cs = colStep(), rs = rowStep();
    const estCol = Math.round((mx - cal.offsetX) / cs);
    const cands = [];
    for (let dc = -1; dc <= 1; dc++){
      const c = estCol + dc;
      if (c < 0 || c >= GRID_COLS) continue;
      const estRow = Math.round((my - cal.offsetY - (c % 2 === 1 ? rs * .5 : 0)) / rs);
      for (let dr = -1; dr <= 1; dr++){
        const r = estRow + dr;
        if (r < 0 || r >= GRID_ROWS) continue;
        cands.push({ col: c, row: r });
      }
    }
    let best = null, bestD = Infinity;
    for (const p of cands){
      for (let q = 0; q < SUB_DIM; q++){
        for (let r = 0; r < SUB_DIM; r++){
          const sc = subhexCenter(p.col, p.row, q, r);
          const d = (mx - sc.x) * (mx - sc.x) + (my - sc.y) * (my - sc.y);
          if (d < bestD){ bestD = d; best = { col: p.col, row: p.row, q, r }; }
        }
      }
    }
    if (bestD > SUB_R * SUB_R * 1.5) return null;
    return best;
  }

  // ── Visible parent culling ──────────────────────────────────────────────
  function getVisibleParentRange(){
    const wrap = document.getElementById('map-wrap');
    if (!wrap) return null;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const stageL = -state.panX / state.zoom;
    const stageT = -state.panY / state.zoom;
    const stageR = (w  - state.panX) / state.zoom;
    const stageB = (h - state.panY) / state.zoom;
    // Pad by one parent hex so partial cells at edges still render.
    const PAD = HEX_R * 2;
    const mapL = stageL + (window.stageBounds?.minX || 0) - PAD;
    const mapR = stageR + (window.stageBounds?.minX || 0) + PAD;
    const mapT = stageT + (window.stageBounds?.minY || 0) - PAD;
    const mapB = stageB + (window.stageBounds?.minY || 0) + PAD;
    const cs = colStep(), rs = rowStep();
    const cMin = Math.max(0, Math.floor((mapL - cal.offsetX) / cs));
    const cMax = Math.min(GRID_COLS - 1, Math.ceil((mapR - cal.offsetX) / cs));
    const rMin = Math.max(0, Math.floor((mapT - cal.offsetY) / rs));
    const rMax = Math.min(GRID_ROWS - 1, Math.ceil((mapB - cal.offsetY) / rs));
    return { cMin, cMax, rMin, rMax };
  }

  // ── Subhex SVG layer ────────────────────────────────────────────────────
  function ensureSubhexLayer(){
    const svg = document.getElementById('hex-svg');
    if (!svg) return null;
    let layer = document.getElementById('subhex-cells');
    if (!layer){
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.id = 'subhex-cells';
      svg.appendChild(layer);
    }
    let outlines = document.getElementById('parent-outlines-faint');
    if (!outlines){
      outlines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      outlines.id = 'parent-outlines-faint';
      svg.insertBefore(outlines, layer);
    }
    return { layer, outlines };
  }
  function clearSubhexLayer(){
    const l = document.getElementById('subhex-cells');
    const o = document.getElementById('parent-outlines-faint');
    if (l) l.innerHTML = '';
    if (o) o.innerHTML = '';
    view.cullCache.renderedKey = null;
  }
  function rebuildSubhexLayer(){
    if (view.activeScale !== 6) return;
    const range = getVisibleParentRange();
    if (!range) return;
    const key = `${range.cMin}-${range.cMax}-${range.rMin}-${range.rMax}`;
    if (key === view.cullCache.renderedKey) return;
    view.cullCache.renderedKey = key;

    const groups = ensureSubhexLayer();
    if (!groups) return;
    const { layer, outlines } = groups;
    layer.innerHTML = '';
    outlines.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    for (let c = range.cMin; c <= range.cMax; c++){
      for (let r = range.rMin; r <= range.rMax; r++){
        // Faint parent outline
        const corners = hexCornersDisplay(c, r).map(([x, y]) => mapToStage(x, y));
        const oPts = corners.map(s => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
        const op = document.createElementNS(ns, 'polygon');
        op.setAttribute('points', oPts);
        op.setAttribute('class', 'parent-outline-faint');
        outlines.appendChild(op);

        const parentTerrain = (typeof getHexTerrain === 'function')
          ? getHexTerrain(c, r) : null;
        const parentId = hexIdStr(c, r);

        for (let q = 0; q < SUB_DIM; q++){
          for (let rr = 0; rr < SUB_DIM; rr++){
            const sub = window.GCCSubhexData.getSubhex(parentId, q, rr, parentTerrain);
            const subCorners = subhexCorners(c, r, q, rr).map(([x, y]) => mapToStage(x, y));
            const pts = subCorners.map(s => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
            const poly = document.createElementNS(ns, 'polygon');
            poly.setAttribute('points', pts);
            let cls = 'subhex-cell';
            if (sub.source === 'authored') cls += ' authored';
            if (view.selectedSub
                && view.selectedSub.col === c && view.selectedSub.row === r
                && view.selectedSub.q === q && view.selectedSub.r === rr) cls += ' selected';
            poly.setAttribute('class', cls);
            poly.dataset.col = c; poly.dataset.row = r;
            poly.dataset.q = q;  poly.dataset.r = rr;
            poly.id = `subhex-${c}-${r}-${q}-${rr}`;
            const trgb = sub.terrain && TERRAIN[sub.terrain]?.rgb;
            if (trgb){
              poly.style.setProperty('--hex-paint-rgb', trgb);
              poly.dataset.paint = '1';
            }
            layer.appendChild(poly);
          }
        }
      }
    }
  }

  // ── Mini-map ────────────────────────────────────────────────────────────
  function ensureMiniMap(){
    let mm = document.getElementById('mini-map');
    if (mm) return mm;
    mm = document.createElement('div');
    mm.id = 'mini-map';
    mm.className = 'docked-' + view.miniMap.dock;
    mm.innerHTML = `
      <div class="mini-map-handle">
        <span class="mm-label">Overworld · 30 mi</span>
        <span class="mm-dock">
          <button class="mini-map-dock-btn" data-dock="tl" title="Dock top-left">↖</button>
          <button class="mini-map-dock-btn" data-dock="tr" title="Dock top-right">↗</button>
          <button class="mini-map-dock-btn" data-dock="bl" title="Dock bottom-left">↙</button>
          <button class="mini-map-dock-btn" data-dock="br" title="Dock bottom-right">↘</button>
        </span>
      </div>
      <div class="mini-map-svg-wrap">
        <svg id="mini-map-svg" viewBox="0 0 200 142" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
    `;
    document.body.appendChild(mm);

    // Dock buttons
    mm.querySelectorAll('.mini-map-dock-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = b.dataset.dock;
        // Drag may have set inline top/left — clear them so dock CSS applies.
        mm.style.top = ''; mm.style.left = ''; mm.style.right = ''; mm.style.bottom = '';
        mm.classList.remove('docked-tl', 'docked-tr', 'docked-bl', 'docked-br');
        mm.classList.add('docked-' + d);
        view.miniMap.dock = d;
        try { localStorage.setItem('gcc-minimap-dock', d); } catch(e){}
      });
    });

    // Dragging via the handle. Falls back to plain mousemove if
    // window.makeDraggable isn't around, which keeps us decoupled.
    const handle = mm.querySelector('.mini-map-handle');
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mini-map-dock-btn')) return;
      e.preventDefault();
      const rect = mm.getBoundingClientRect();
      view.miniMap.dragging = { offX: e.clientX - rect.left, offY: e.clientY - rect.top };
      mm.classList.remove('docked-tl', 'docked-tr', 'docked-bl', 'docked-br');
      mm.style.right = 'auto'; mm.style.bottom = 'auto';
    });
    window.addEventListener('mousemove', (e) => {
      if (!view.miniMap.dragging) return;
      mm.style.left = (e.clientX - view.miniMap.dragging.offX) + 'px';
      mm.style.top  = (e.clientY - view.miniMap.dragging.offY) + 'px';
    });
    window.addEventListener('mouseup', () => { view.miniMap.dragging = false; });

    // Restore last dock
    try {
      const d = localStorage.getItem('gcc-minimap-dock');
      if (d && ['tl', 'tr', 'bl', 'br'].includes(d)){
        mm.classList.remove('docked-tl', 'docked-tr', 'docked-bl', 'docked-br');
        mm.classList.add('docked-' + d);
        view.miniMap.dock = d;
      }
    } catch(e){}

    // Click on mini-map recenters main viewport
    const mmsvg = mm.querySelector('#mini-map-svg');
    mmsvg.addEventListener('click', (e) => {
      const rect = mmsvg.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top)  / rect.height;
      const mapX = fx * window.MAP_W;
      const mapY = fy * window.MAP_H;
      const wrap = document.getElementById('map-wrap');
      const stage = mapToStage(mapX, mapY);
      state.panX = wrap.clientWidth  / 2 - stage.x * state.zoom;
      state.panY = wrap.clientHeight / 2 - stage.y * state.zoom;
      if (typeof window.clampPan === 'function') window.clampPan();
      applyTransform();
      rebuildSubhexLayer();
      updateMiniMap();
    });

    return mm;
  }
  function updateMiniMap(){
    const mm = ensureMiniMap();
    const svg = mm.querySelector('#mini-map-svg');
    const ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    // Background outline of the map
    const W = window.MAP_W || 4360, H = window.MAP_H || 3378;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('x', 0); bg.setAttribute('y', 0);
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('fill', '#d8c890'); bg.setAttribute('stroke', '#5a4a30');
    bg.setAttribute('stroke-width', 6);
    svg.appendChild(bg);
    // Region tint by sampling current parent terrain palette every 6 cols/rows.
    if (typeof getHexTerrain === 'function'){
      const STEP_C = 4, STEP_R = 4;
      for (let c = 0; c < GRID_COLS; c += STEP_C){
        for (let r = 0; r < GRID_ROWS; r += STEP_R){
          const t = getHexTerrain(c, r);
          if (!t || !TERRAIN[t]?.rgb) continue;
          const p = hexCenter(c, r);
          const tile = document.createElementNS(ns, 'rect');
          tile.setAttribute('x', p.x - HEX_R * STEP_C);
          tile.setAttribute('y', p.y - HEX_R * STEP_R);
          tile.setAttribute('width',  HEX_R * STEP_C * 2);
          tile.setAttribute('height', HEX_R * STEP_R * 2);
          tile.setAttribute('fill', `rgba(${TERRAIN[t].rgb}, 0.55)`);
          tile.setAttribute('stroke', 'none');
          svg.appendChild(tile);
        }
      }
    }
    // Viewport rect
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      const stageL = -state.panX / state.zoom;
      const stageT = -state.panY / state.zoom;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const minX = window.stageBounds?.minX || 0;
      const minY = window.stageBounds?.minY || 0;
      const vx = stageL + minX;
      const vy = stageT + minY;
      const vw = w / state.zoom;
      const vh = h / state.zoom;
      const vp = document.createElementNS(ns, 'rect');
      vp.setAttribute('class', 'minimap-viewport-rect');
      vp.setAttribute('x', vx); vp.setAttribute('y', vy);
      vp.setAttribute('width', vw); vp.setAttribute('height', vh);
      svg.appendChild(vp);
    }
    // Label updated for current scale
    const label = mm.querySelector('.mm-label');
    if (label) label.textContent = view.activeScale === 6 ? 'Overworld · 6 mi' : 'Overworld · 30 mi';
  }

  // ── Subhex info panel (separate from main side panel) ───────────────────
  function ensureInfoPanel(){
    let p = document.getElementById('subhex-panel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'subhex-panel';
    p.innerHTML = `
      <div class="subhex-panel-header">
        <span class="sp-title">Subhex</span>
        <button class="sp-close" title="Close">✕</button>
      </div>
      <div class="subhex-panel-body">
        <div class="sp-row"><label>Parent · subhex</label><div class="sp-readonly" id="sp-coord">—</div></div>
        <div class="sp-row"><label>Terrain</label><div class="sp-readonly" id="sp-terrain">—</div></div>
        <div class="sp-row"><label>Name</label><input type="text" id="sp-name" placeholder="(unnamed)"></div>
        <div class="sp-row"><label>Notes</label><textarea id="sp-notes" placeholder="GM notes"></textarea></div>
        <div class="sp-source" id="sp-source"></div>
      </div>
    `;
    document.body.appendChild(p);
    p.querySelector('.sp-close').addEventListener('click', () => { p.style.display = 'none'; });
    p.querySelector('#sp-name').addEventListener('blur', () => persistInfoFields());
    p.querySelector('#sp-notes').addEventListener('blur', () => persistInfoFields());
    // Drag via header
    const head = p.querySelector('.subhex-panel-header');
    let dragging = false, off = { x: 0, y: 0 };
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sp-close')) return;
      e.preventDefault();
      const rect = p.getBoundingClientRect();
      dragging = true; off.x = e.clientX - rect.left; off.y = e.clientY - rect.top;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      p.style.left = (e.clientX - off.x) + 'px';
      p.style.top  = (e.clientY - off.y) + 'px';
      p.style.right = 'auto'; p.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    return p;
  }
  function showInfoPanel(col, row, q, r){
    const p = ensureInfoPanel();
    const parentId = hexIdStr(col, row);
    const parentTerrain = (typeof getHexTerrain === 'function') ? getHexTerrain(col, row) : null;
    const sub = window.GCCSubhexData.getSubhex(parentId, q, r, parentTerrain);
    p.dataset.col = col; p.dataset.row = row; p.dataset.q = q; p.dataset.r = r;
    p.querySelector('#sp-coord').textContent = `${parentId} · q${q}, r${r}`;
    p.querySelector('#sp-terrain').textContent = sub.terrain ? (TERRAIN[sub.terrain]?.label || sub.terrain) : '—';
    p.querySelector('#sp-name').value  = sub.name  || '';
    p.querySelector('#sp-notes').value = sub.notes || '';
    p.querySelector('#sp-source').textContent = sub.source === 'authored' ? 'Authored override (Phase A: localStorage)'
      : sub.source === 'canonical' ? 'Canonical Greyhawk feature'
      : 'Procedural — derived from world seed';
    p.style.display = 'block';
    // Default position if first open
    if (!p.style.left){
      p.style.left = (window.innerWidth - 320) + 'px';
      p.style.top  = '170px';
    }
  }
  function persistInfoFields(){
    const p = document.getElementById('subhex-panel');
    if (!p || p.style.display === 'none') return;
    const col = +p.dataset.col, row = +p.dataset.row;
    const q = +p.dataset.q, r = +p.dataset.r;
    const parentId = hexIdStr(col, row);
    const name  = p.querySelector('#sp-name').value.trim();
    const notes = p.querySelector('#sp-notes').value;
    window.GCCSubhexData.setSubhexOverride(parentId, q, r, { name, notes });
    // Refresh source label + the rendered subhex (in case authored stroke
    // appears).
    showInfoPanel(col, row, q, r);
    rebuildSubhexLayer();
  }

  // ── Click handling ──────────────────────────────────────────────────────
  function onSubhexLayerClick(ev){
    if (view.activeScale !== 6) return;
    // If hex editor is active, paint/landmarks dispatch their own click.
    if (window.GCCHexEdit && window.GCCHexEdit.isActive && window.GCCHexEdit.isActive()) return;
    const t = ev.target;
    if (!t || t.tagName !== 'polygon' || !t.classList.contains('subhex-cell')) return;
    const col = +t.dataset.col, row = +t.dataset.row;
    const q = +t.dataset.q, r = +t.dataset.r;
    selectSubhex(col, row, q, r);
    showInfoPanel(col, row, q, r);
    ev.stopPropagation();
  }
  function selectSubhex(col, row, q, r){
    if (view.selectedSub){
      const prev = document.getElementById(
        `subhex-${view.selectedSub.col}-${view.selectedSub.row}-${view.selectedSub.q}-${view.selectedSub.r}`);
      if (prev) prev.classList.remove('selected');
    }
    view.selectedSub = { col, row, q, r };
    const cur = document.getElementById(`subhex-${col}-${row}-${q}-${r}`);
    if (cur) cur.classList.add('selected');
  }

  // Per-cell update — used by hex-edit.js paintAt at high frequency to avoid
  // a full layer rebuild during drag-paint. Reads the live subhex state from
  // GCCSubhexData so terrain override + authored stroke both update in place.
  function applyPaintToSubCell(col, row, q, r){
    const el = document.getElementById(`subhex-${col}-${row}-${q}-${r}`);
    if (!el) return;
    const parentId = hexIdStr(col, row);
    const parentTerrain = (typeof getHexTerrain === 'function') ? getHexTerrain(col, row) : null;
    const sub = window.GCCSubhexData.getSubhex(parentId, q, r, parentTerrain);
    if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
      el.style.setProperty('--hex-paint-rgb', TERRAIN[sub.terrain].rgb);
      el.dataset.paint = '1';
    } else {
      el.style.removeProperty('--hex-paint-rgb');
      delete el.dataset.paint;
    }
    el.classList.toggle('authored', sub.source === 'authored');
  }

  // ── Scale toggle ────────────────────────────────────────────────────────
  function setActiveScale(scale){
    if (scale !== 30 && scale !== 6) return;
    if (scale === view.activeScale) return;
    const prev = view.activeScale;
    view.activeScale = scale;
    if (scale === 6){
      document.body.classList.add('subhex-active');
      // Auto-zoom so subhexes land at usable size. Caller may have any
      // zoom; clamp result to the existing 0.15..5 doZoom range so wheel
      // zoom from this point continues to work without jumping.
      state.zoom = Math.min(5, Math.max(state.zoom * 5, ZOOM_AUTO_MIN));
    } else {
      document.body.classList.remove('subhex-active');
      state.zoom = Math.max(0.15, state.zoom / 5);
      clearSubhexLayer();
      const p = document.getElementById('subhex-panel'); if (p) p.style.display = 'none';
      view.selectedSub = null;
    }
    if (typeof window.clampPan === 'function') window.clampPan();
    applyTransform();
    rebuildSubhexLayer();
    updateMiniMap();
    syncToggleButtons();
    const label = document.getElementById('mode-label');
    if (label) label.textContent = `OVERWORLD · ${scale} MI/HEX`;
  }
  function syncToggleButtons(){
    const b30 = document.getElementById('btn-scale-30');
    const b6  = document.getElementById('btn-scale-6');
    if (b30) b30.classList.toggle('scale-active', view.activeScale === 30);
    if (b6)  b6 .classList.toggle('scale-active', view.activeScale === 6);
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init(){
    // Wire scale toggle buttons
    const b30 = document.getElementById('btn-scale-30');
    const b6  = document.getElementById('btn-scale-6');
    if (b30) b30.addEventListener('click', () => setActiveScale(30));
    if (b6)  b6 .addEventListener('click', () => setActiveScale(6));
    syncToggleButtons();

    // Click delegation on hex-svg for subhex cells
    const svg = document.getElementById('hex-svg');
    if (svg) svg.addEventListener('click', onSubhexLayerClick, true);

    // Pan/zoom hook — re-cull on transform change. We don't have an
    // event for this so we wrap applyTransform.
    if (typeof window.applyTransform === 'function' && !window.__subhexAppliedTransformWrap){
      const orig = window.applyTransform;
      window.applyTransform = function(){
        orig.apply(this, arguments);
        if (view.activeScale === 6){
          rebuildSubhexLayer();
          updateMiniMap();
        }
      };
      window.__subhexAppliedTransformWrap = true;
    }

    // Pre-build the mini-map but keep hidden until 6mi.
    ensureMiniMap();

    // Cross-module change events from gcc-subhex-data (override writes
    // from the info panel, hex-edit paint, future Firestore sync).
    // Coalesces bursts via rAF so drag-paint at 60fps doesn't thrash.
    let _rebuildPending = false;
    window.addEventListener('gcc-subhex-changed', () => {
      if (_rebuildPending || view.activeScale !== 6) return;
      _rebuildPending = true;
      requestAnimationFrame(() => {
        _rebuildPending = false;
        view.cullCache.renderedKey = null;
        rebuildSubhexLayer();
      });
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────
  window.GCCSubhexView = {
    init,
    setActiveScale,
    getActiveScale: () => view.activeScale,
    rebuildLayer: rebuildSubhexLayer,
    refreshMiniMap: updateMiniMap,
    mapToSubhex,
    subhexCenter, subhexCorners,
    showInfoPanel,
    selectSubhex,
    applyPaintToSubCell,
    SUB_DIM, SUB_R,
  };
})();
