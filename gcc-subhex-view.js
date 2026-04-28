// gcc-subhex-view.js v0.7.0 — 2026-04-28
// Subhex editor window. Opens for one parent hex at a time; main map
// stays at 30mi, untouched. Self-contained: own SVG, own paint palette,
// own name/notes inputs.
//
// v0.7: feature cells. A cell can host one feature (castle, ruin,
// tower, village, camp, cache, shrine, lair, grave, landmark) which
// renders as a haloed glyph over the terrain icon. The detail panel
// gains a Hosts row with kind picker, feature name, and library link.
// The palette gains a second strip of feature glyphs that arm the
// same paint flow as terrain swatches — click-to-place or drag to
// brush a feature across multiple cells.
//
// v0.6: tightened SVG viewBox to flat-top hex proportions (610×530,
// not 660×660), eliminating ~70 units of vertical padding around the
// parent hex. Compacted the chrome below the SVG. Hover and selected
// strokes thickened so they read clearly at the smaller cell scale.
//
// v0.5: window is now resizable (CSS resize:both, native grip in
// bottom-right). Default width dropped 700 → 540. Persist size +
// position together via localStorage 'gcc-subhex-window-pos'. Cells
// scale with window width because the SVG uses viewBox + aspect-ratio.
//
// v0.4: bumped to 91-cell radius-5 hex-of-hexes (~3mi cells) with
// terrain icons stamped per cell and brush-drag painting. Window
// width grew to 700px to keep cells legible. Selection is now a delta
// update (toggle .selected) rather than a full SVG rebuild — at 91
// cells the rebuild lag was visible.
//
// v0.3: switched 25-cell 5×5 rhombus to 19-cell hex-of-hexes (1+6+12).
// The rhombus had visible asymmetric tilt — six cells protruded outside
// the parent silhouette. Hex-of-hexes is 6-fold symmetric and the six
// ring-2 corner cells touch parent boundary tangent. Same SUB_R.
//
// v0.2: Replaced v0.1's whole-map 6mi rescale (350K cells, SVG-killing).
// The main map stays at 30mi; subhexes scoped to a single parent at a
// time, ~91 SVG groups per open. Data layer (gcc-subhex-data, gcc-rng)
// unchanged across v0.2/v0.3/v0.4 except the SUBHEX_DIM bump in v0.4.
//
// Globals consumed: hexIdStr, getHexTerrain, TERRAIN, GCCSubhexData,
//   GCCSubhexIcons, GCCSubhexView is wired by greyhawk-map.html init
//   via the side panel "Explore Sub-Map" button (calls
//   GCCSubhexView.open(col, row)).

(function(){
  'use strict';

  const SUB_DIM = 11;
  const SUB_CENTER = 5;             // (SUB_DIM - 1) / 2
  // Flat-top parent hex: corners at ±PARENT_R horizontally, edges at
  // ±PARENT_R · √3/2 vertically (≈ ±260 for R=300). VIEWBOX is sized
  // tightly around this with ~5 unit margin on each side; non-square
  // because flat-top hexes are wider than tall.
  const PARENT_R = 300;             // parent hex radius in svg coords
  const VIEWBOX_W = 610;
  const VIEWBOX_H = 530;
  // For radius-N hex-of-hexes inscribed in a flat-top parent hex,
  // outermost cell corner sits at SUB_R · √(3N²+3N+1) from center.
  // For N=5 that is SUB_R · √91 ≈ 9.54·SUB_R; parent edge midpoints
  // are at PARENT_R · √3/2 ≈ 0.866·PARENT_R. Tangent at SUB_R ≈ 27.2;
  // 26 leaves a small visual margin without crowding cells.
  const SUB_R = 26;

  const state = {
    win: null,
    isOpen: false,
    parentCol: null,
    parentRow: null,
    parentId: null,
    parentTerrain: null,
    selectedQ: null,
    selectedR: null,
    // armed controls what click/drag paints. null = select mode.
    // Otherwise: { type: 'terrain'|'feature'|'erase', value?: kind }
    armed: null,
    drag: null,
    dragOffset: { x: 0, y: 0 },
    brushing: false,
    brushedThisDrag: null, // Set<string> of "q_r" keys painted in current drag, or null
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
        <svg id="sxw-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" preserveAspectRatio="xMidYMid meet"></svg>
        <div class="sxw-detail">
          <div class="sxw-row"><label>Subhex</label><span class="sxw-readonly" id="sxw-coord">— select a cell</span></div>
          <div class="sxw-row"><label>Terrain</label><span class="sxw-readonly" id="sxw-terrain">—</span></div>
          <div class="sxw-row"><label>Name</label><input type="text" id="sxw-name" placeholder="(unnamed)" disabled></div>
          <div class="sxw-row"><label>Notes</label><textarea id="sxw-notes" placeholder="GM notes" disabled></textarea></div>
          <div class="sxw-row sxw-row-feature">
            <label>Hosts</label>
            <div class="sxw-feature-fields">
              <select id="sxw-feature-kind" disabled>
                <option value="">— none —</option>
              </select>
              <input type="text" id="sxw-feature-name" placeholder="Feature name (e.g. Maure Castle)" disabled>
              <input type="text" id="sxw-feature-libid" placeholder="Library entity ID (optional)" disabled>
            </div>
          </div>
          <div class="sxw-source" id="sxw-source"></div>
        </div>
        <div class="sxw-palette" id="sxw-palette"></div>
        <div class="sxw-feature-palette" id="sxw-feature-palette"></div>
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
    w.querySelector('#sxw-feature-kind').addEventListener('change', persistFeature);
    w.querySelector('#sxw-feature-name').addEventListener('blur', persistFeature);
    w.querySelector('#sxw-feature-libid').addEventListener('blur', persistFeature);

    // Clear-override
    w.querySelector('#sxw-clear').addEventListener('click', onClearOverride);

    // Build terrain + feature palettes and feature kind select
    buildPalette();
    buildFeaturePalette();
    buildFeatureKindSelect();

    // Restore last position and size
    try {
      const pos = JSON.parse(localStorage.getItem('gcc-subhex-window-pos') || 'null');
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)){
        w.style.left = pos.x + 'px';
        w.style.top  = pos.y + 'px';
      } else {
        w.style.right = '24px';
        w.style.top   = '160px';
      }
      if (pos && Number.isFinite(pos.w) && pos.w >= 380){ w.style.width  = pos.w + 'px'; }
      if (pos && Number.isFinite(pos.h) && pos.h >= 420){ w.style.height = pos.h + 'px'; }
    } catch(e){
      w.style.right = '24px';
      w.style.top   = '160px';
    }

    // Watch for user-driven resize via the native grip; persist when it
    // settles. Debounce so we don't write on every pixel.
    if (typeof ResizeObserver !== 'undefined'){
      let t = null;
      const ro = new ResizeObserver(() => {
        if (t) clearTimeout(t);
        t = setTimeout(persistWindowRect, 200);
      });
      ro.observe(w);
    }
    return w;
  }

  function persistWindowRect(){
    if (!state.win) return;
    try {
      const rect = state.win.getBoundingClientRect();
      const prev = JSON.parse(localStorage.getItem('gcc-subhex-window-pos') || '{}');
      const next = {
        x: Number.isFinite(prev.x) ? prev.x : rect.left,
        y: Number.isFinite(prev.y) ? prev.y : rect.top,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      };
      // Only update x/y if the window is positioned with explicit left/top
      // (i.e. the user has dragged it at least once). Otherwise it's still
      // pinned right:24px and we shouldn't lock in the resolved coordinates.
      const usingLeftTop = state.win.style.left && state.win.style.top
                           && state.win.style.right === 'auto';
      if (usingLeftTop){ next.x = rect.left; next.y = rect.top; }
      localStorage.setItem('gcc-subhex-window-pos', JSON.stringify(next));
    } catch(e){}
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
      b.dataset.armKey = `terrain:${t}`;
      b.title = meta.label || t;
      b.style.background = `rgb(${meta.rgb})`;
      b.addEventListener('click', () => armPalette({ type: 'terrain', value: t }));
      pal.appendChild(b);
    }
    const erase = document.createElement('button');
    erase.className = 'sxw-swatch sxw-swatch-erase';
    erase.dataset.armKey = 'erase:';
    erase.title = 'Erase override (revert to seed)';
    erase.textContent = '⌫';
    erase.addEventListener('click', () => armPalette({ type: 'erase' }));
    pal.appendChild(erase);
  }

  function buildFeaturePalette(){
    const pal = state.win.querySelector('#sxw-feature-palette');
    if (!pal || !window.GCCSubhexIcons) return;
    pal.innerHTML = '';
    // Mini-SVG for each feature kind so the palette uses the same glyph
    // the cell will eventually paint. Halo is left off in the palette
    // to keep buttons compact.
    const NS = 'http://www.w3.org/2000/svg';
    for (const kind of window.GCCSubhexIcons.FEATURE_KINDS){
      const b = document.createElement('button');
      b.className = 'sxw-feature-btn';
      b.dataset.armKey = `feature:${kind}`;
      b.title = `Place feature: ${kind}`;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      // Render glyph at center 12,12 with subR 14 (so glyph s=7).
      window.GCCSubhexIcons.appendFeature(svg, kind, 12, 12, 14);
      b.appendChild(svg);
      b.addEventListener('click', () => armPalette({ type: 'feature', value: kind }));
      pal.appendChild(b);
    }
    const clearBtn = document.createElement('button');
    clearBtn.className = 'sxw-feature-btn sxw-feature-btn-clear';
    clearBtn.dataset.armKey = 'feature-erase:';
    clearBtn.title = 'Clear feature on click';
    clearBtn.textContent = '⌫';
    clearBtn.addEventListener('click', () => armPalette({ type: 'feature-erase' }));
    pal.appendChild(clearBtn);
  }

  function buildFeatureKindSelect(){
    const sel = state.win.querySelector('#sxw-feature-kind');
    if (!sel || !window.GCCSubhexData) return;
    // Keep the empty "— none —" option and append all feature kinds.
    for (const kind of window.GCCSubhexData.FEATURE_KINDS){
      const opt = document.createElement('option');
      opt.value = kind;
      opt.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
      sel.appendChild(opt);
    }
  }

  function armKey(armed){
    if (!armed) return null;
    if (armed.type === 'erase') return 'erase:';
    if (armed.type === 'feature-erase') return 'feature-erase:';
    return `${armed.type}:${armed.value}`;
  }

  function armPalette(next){
    const cur = armKey(state.armed);
    const nxt = armKey(next);
    state.armed = (cur === nxt) ? null : next;
    syncPaletteUI();
    syncModeLabel();
  }

  function syncPaletteUI(){
    if (!state.win) return;
    const cur = armKey(state.armed);
    state.win.querySelectorAll('.sxw-swatch, .sxw-feature-btn').forEach(b => {
      b.classList.toggle('armed', b.dataset.armKey === cur);
    });
  }

  function syncModeLabel(){
    const el = state.win?.querySelector('#sxw-mode');
    if (!el) return;
    const a = state.armed;
    if (!a){
      el.textContent = 'Mode: Select';
    } else if (a.type === 'erase'){
      el.textContent = 'Mode: Erase override · drag to brush';
    } else if (a.type === 'feature-erase'){
      el.textContent = 'Mode: Clear feature · click cells';
    } else if (a.type === 'feature'){
      el.textContent = `Mode: Place feature · ${a.value} · drag to brush`;
    } else {
      const lbl = TERRAIN[a.value]?.label || a.value;
      el.textContent = `Mode: Paint · ${lbl} · drag to brush`;
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
    state.armed = null;

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
    state.armed = null;
    if (state.brushing){
      state.brushing = false;
      state.brushedThisDrag = null;
      window.removeEventListener('mouseup', onBrushEnd);
    }
  }

  function isOpen(){ return state.isOpen; }

  // ── SVG render ─────────────────────────────────────────────────────────
  function subhexCenter(q, r){
    const cx = VIEWBOX_W / 2;
    const cy = VIEWBOX_H / 2;
    const dq = q - SUB_CENTER, dr = r - SUB_CENTER;
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
    const cx = VIEWBOX_W / 2, cy = VIEWBOX_H / 2;
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

    // 91 subhexes (radius-5 hex-of-hexes, 6-fold symmetric)
    const cells = window.GCCSubhexData.validCells();
    for (const { q, r } of cells){
      const sub = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
      const c = subhexCenter(q, r);
      const corners = subhexCorners(q, r);
      const pts = corners.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'sxw-cell-group');
      group.id = `sxw-cell-${q}-${r}`;
      group.dataset.q = q;
      group.dataset.r = r;

      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts);
      let cls = 'sxw-cell';
      if (sub.source === 'authored') cls += ' authored';
      if (q === state.selectedQ && r === state.selectedR) cls += ' selected';
      poly.setAttribute('class', cls);
      if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
        poly.setAttribute('fill', `rgb(${TERRAIN[sub.terrain].rgb})`);
      } else {
        poly.setAttribute('fill', '#d8c890');
      }
      group.appendChild(poly);

      if (window.GCCSubhexIcons){
        const terrainG = document.createElementNS(ns, 'g');
        terrainG.setAttribute('class', 'sxw-terrain-layer');
        window.GCCSubhexIcons.append(terrainG, sub.terrain, c.x, c.y, SUB_R, q, r);
        group.appendChild(terrainG);

        if (sub.feature && sub.feature.kind){
          const featG = document.createElementNS(ns, 'g');
          featG.setAttribute('class', 'sxw-feature-layer');
          window.GCCSubhexIcons.appendFeature(featG, sub.feature.kind, c.x, c.y, SUB_R);
          group.appendChild(featG);
        }
      }

      group.addEventListener('mousedown', onCellMouseDown);
      group.addEventListener('mouseenter', onCellMouseEnter);
      group.addEventListener('click', onCellClick);
      svg.appendChild(group);
    }
  }

  function applyCellPaint(q, r){
    const group = document.getElementById(`sxw-cell-${q}-${r}`);
    if (!group) return;
    const sub = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
    const poly = group.querySelector('.sxw-cell');
    if (!poly) return;
    if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
      poly.setAttribute('fill', `rgb(${TERRAIN[sub.terrain].rgb})`);
    } else {
      poly.setAttribute('fill', '#d8c890');
    }
    poly.classList.toggle('authored', sub.source === 'authored');
    // Replace both icon layers — terrain or feature may have changed.
    group.querySelectorAll('.sxw-terrain-layer, .sxw-feature-layer').forEach(n => n.remove());
    if (window.GCCSubhexIcons){
      const ns = 'http://www.w3.org/2000/svg';
      const c = subhexCenter(q, r);
      const terrainG = document.createElementNS(ns, 'g');
      terrainG.setAttribute('class', 'sxw-terrain-layer');
      window.GCCSubhexIcons.append(terrainG, sub.terrain, c.x, c.y, SUB_R, q, r);
      group.appendChild(terrainG);
      if (sub.feature && sub.feature.kind){
        const featG = document.createElementNS(ns, 'g');
        featG.setAttribute('class', 'sxw-feature-layer');
        window.GCCSubhexIcons.appendFeature(featG, sub.feature.kind, c.x, c.y, SUB_R);
        group.appendChild(featG);
      }
    }
  }

  // ── Cell event handlers ────────────────────────────────────────────────
  // mousedown starts brush in paint mode; click selects in idle mode.
  // Click also fires after mousedown — guard against double-fire.
  function onCellMouseDown(ev){
    if (ev.button !== undefined && ev.button !== 0) return;
    if (!state.armed) return;              // not painting → leave to click handler for select
    ev.preventDefault();
    ev.stopPropagation();
    const q = +ev.currentTarget.dataset.q;
    const r = +ev.currentTarget.dataset.r;
    state.brushing = true;
    state.brushedThisDrag = new Set();
    paintCell(q, r);
    window.addEventListener('mouseup', onBrushEnd);
  }

  function onCellMouseEnter(ev){
    // Move the hovered cell's group to the end of its parent so its
    // stroke paints on top of all neighbors at shared edges. The
    // previously-hovered cell stays where it was — its stroke reverts
    // to default and the slight reordering is invisible to the user.
    const g = ev.currentTarget;
    const parent = g.parentNode;
    if (parent && parent.lastChild !== g) parent.appendChild(g);
    if (!state.brushing) return;
    const q = +g.dataset.q;
    const r = +g.dataset.r;
    paintCell(q, r);
  }

  function onBrushEnd(){
    state.brushing = false;
    state.brushedThisDrag = null;
    window.removeEventListener('mouseup', onBrushEnd);
  }

  function paintCell(q, r){
    const key = `${q}_${r}`;
    if (state.brushedThisDrag && state.brushedThisDrag.has(key)) return;
    if (state.brushedThisDrag) state.brushedThisDrag.add(key);
    const a = state.armed;
    if (!a) return;
    if (a.type === 'erase'){
      window.GCCSubhexData.setSubhexOverride(state.parentId, q, r, { terrain: null });
    } else if (a.type === 'terrain'){
      window.GCCSubhexData.setSubhexOverride(state.parentId, q, r, { terrain: a.value });
    } else if (a.type === 'feature'){
      // Painting a feature preserves prior name/libraryId if same kind,
      // otherwise starts a fresh feature.
      const existing = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
      const prior = existing && existing.feature;
      const next = (prior && prior.kind === a.value)
        ? prior
        : { kind: a.value };
      window.GCCSubhexData.setSubhexFeature(state.parentId, q, r, next);
    } else if (a.type === 'feature-erase'){
      window.GCCSubhexData.clearSubhexFeature(state.parentId, q, r);
    }
    applyCellPaint(q, r);
    if (q === state.selectedQ && r === state.selectedR) syncDetailPanel();
  }

  function onCellClick(ev){
    ev.stopPropagation();
    if (state.armed) return;               // paint click already handled by mousedown
    const q = +ev.currentTarget.dataset.q;
    const r = +ev.currentTarget.dataset.r;
    selectCell(q, r);
  }

  function selectCell(q, r){
    if (state.selectedQ !== null && state.selectedR !== null){
      const prev = document.getElementById(`sxw-cell-${state.selectedQ}-${state.selectedR}`);
      const prevPoly = prev?.querySelector('.sxw-cell');
      if (prevPoly) prevPoly.classList.remove('selected');
    }
    state.selectedQ = q;
    state.selectedR = r;
    const group = document.getElementById(`sxw-cell-${q}-${r}`);
    const poly  = group?.querySelector('.sxw-cell');
    if (poly) poly.classList.add('selected');
    // Bring the selected cell to the front so its thick stroke and
    // drop-shadow glow paint over neighbors at shared edges.
    if (group && group.parentNode && group.parentNode.lastChild !== group){
      group.parentNode.appendChild(group);
    }
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
    const fkind  = w.querySelector('#sxw-feature-kind');
    const fname  = w.querySelector('#sxw-feature-name');
    const flib   = w.querySelector('#sxw-feature-libid');
    const source = w.querySelector('#sxw-source');
    const clearB = w.querySelector('#sxw-clear');

    if (state.selectedQ === null){
      coord.textContent  = '— select a cell';
      terr.textContent   = '—';
      name.value = '';   name.disabled  = true;
      notes.value = '';  notes.disabled = true;
      fkind.value = '';  fkind.disabled = true;
      fname.value = '';  fname.disabled = true;
      flib.value  = '';  flib.disabled  = true;
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
    const f = sub.feature || null;
    fkind.value = f ? (f.kind || '') : '';
    fkind.disabled = false;
    // Name + libraryId only enabled when a feature kind is set.
    fname.value = f ? (f.name || '') : '';
    fname.disabled = !f;
    flib.value  = f ? (f.libraryId || '') : '';
    flib.disabled = !f;
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

  function persistFeature(){
    if (state.selectedQ === null) return;
    const w = state.win;
    const kind = w.querySelector('#sxw-feature-kind').value;
    if (!kind){
      window.GCCSubhexData.clearSubhexFeature(state.parentId, state.selectedQ, state.selectedR);
    } else {
      const fname = w.querySelector('#sxw-feature-name').value.trim();
      const flib  = w.querySelector('#sxw-feature-libid').value.trim();
      window.GCCSubhexData.setSubhexFeature(state.parentId, state.selectedQ, state.selectedR, {
        kind,
        name: fname || undefined,
        libraryId: flib || undefined,
      });
    }
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
    persistWindowRect();
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.GCCSubhexView = { open, close, isOpen };
})();
