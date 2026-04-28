// gcc-subhex-view.js v0.9.0 — 2026-04-28
// Subhex editor window. Opens for one parent hex at a time; main map
// stays at 30mi, untouched. Self-contained: own SVG, own paint palette,
// own name/notes inputs.
//
// v0.9: paths. River / road / trail chains traverse cell sequences in
// a single parent. Authoring is auto-routed click-cell mode: with a
// path armed, each click on a neighbor of the current end-cell extends
// the chain. Rendered as a polyline through cell centers via shared-
// edge midpoints, styled by kind. Cells can belong to multiple paths
// (a road and a river crossing the same cell — bridges/fords are v1.0).
//
// v0.8: named region grouping. Adjacent same-terrain cells can be
// grouped under a region with a shared name; the name renders centered
// on the cell-set centroid in the SVG. New "Region" tool button arms
// region-assign mode, with a contextual region picker. The detail
// panel gains a Region row alongside Hosts.
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
        <span class="sxw-coord-bar" id="sxw-coord-bar"></span>
        <span class="sxw-header-btns">
          <button class="sxw-reset-pos" title="Reset window position and size">↺</button>
          <button class="sxw-close" title="Close">✕</button>
        </span>
      </div>
      <div class="sxw-body">
        <svg id="sxw-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" preserveAspectRatio="xMidYMid meet"></svg>
        <div class="sxw-detail">
          <div class="sxw-row sxw-row-inline">
            <label>Cell</label>
            <span class="sxw-readonly" id="sxw-coord">— select a cell</span>
            <span class="sxw-sep">·</span>
            <span class="sxw-readonly" id="sxw-terrain">—</span>
          </div>
          <div class="sxw-row sxw-row-inline">
            <label>Name</label>
            <input type="text" id="sxw-name" placeholder="(unnamed)" disabled>
          </div>
          <div class="sxw-row sxw-row-inline">
            <label>Notes</label>
            <textarea id="sxw-notes" placeholder="GM notes" disabled></textarea>
          </div>
          <div class="sxw-row sxw-row-inline sxw-row-feature">
            <label>Hosts</label>
            <select id="sxw-feature-kind" disabled>
              <option value="">— none —</option>
            </select>
            <input type="text" id="sxw-feature-name" placeholder="Feature name" disabled>
            <input type="text" id="sxw-feature-libid" placeholder="Library ID" disabled>
          </div>
          <div class="sxw-row sxw-row-inline sxw-row-region">
            <label>Region</label>
            <select id="sxw-region-pick" disabled>
              <option value="">— none —</option>
            </select>
            <input type="text" id="sxw-region-name" placeholder="Region name" disabled>
          </div>
          <div class="sxw-row sxw-row-inline sxw-row-paths">
            <label>Paths</label>
            <span class="sxw-readonly" id="sxw-paths-list">—</span>
          </div>
          <div class="sxw-source" id="sxw-source"></div>
        </div>
        <div class="sxw-palette-strip">
          <div class="sxw-palette" id="sxw-palette"></div>
          <div class="sxw-feature-palette" id="sxw-feature-palette"></div>
        </div>
        <div class="sxw-tools">
          <button class="sxw-tool-btn" id="sxw-region-tool">Region…</button>
          <select class="sxw-region-armed" id="sxw-region-armed" style="display:none;">
            <option value="">— pick a region to assign —</option>
            <option value="__new__">+ New region from selected cell's terrain…</option>
          </select>
          <button class="sxw-tool-btn" id="sxw-path-tool">Path…</button>
          <select class="sxw-path-armed" id="sxw-path-armed" style="display:none;"></select>
          <button class="sxw-tool-btn" id="sxw-clear">Clear override</button>
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
    w.querySelector('.sxw-reset-pos').addEventListener('click', resetWindowPos);

    // Detail-pane field handlers
    w.querySelector('#sxw-name').addEventListener('blur', persistFields);
    w.querySelector('#sxw-notes').addEventListener('blur', persistFields);
    w.querySelector('#sxw-feature-kind').addEventListener('change', persistFeature);
    w.querySelector('#sxw-feature-name').addEventListener('blur', persistFeature);
    w.querySelector('#sxw-feature-libid').addEventListener('blur', persistFeature);
    w.querySelector('#sxw-region-pick').addEventListener('change', onRegionPickChange);
    w.querySelector('#sxw-region-name').addEventListener('blur', onRegionRename);

    // Clear-override
    w.querySelector('#sxw-clear').addEventListener('click', onClearOverride);

    // Region tool
    w.querySelector('#sxw-region-tool').addEventListener('click', onRegionToolClick);
    w.querySelector('#sxw-region-armed').addEventListener('change', onRegionArmedChange);

    // Path tool
    w.querySelector('#sxw-path-tool').addEventListener('click', onPathToolClick);
    w.querySelector('#sxw-path-armed').addEventListener('change', onPathArmedChange);

    // Build terrain + feature palettes and feature kind select
    buildPalette();
    buildFeaturePalette();
    buildFeatureKindSelect();

    // Restore last position and size
    let restoredFromStorage = false;
    try {
      const pos = JSON.parse(localStorage.getItem('gcc-subhex-window-pos') || 'null');
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)){
        w.style.left = pos.x + 'px';
        w.style.top  = pos.y + 'px';
        w.style.right = 'auto';
        restoredFromStorage = true;
      } else {
        w.style.right = '24px';
        w.style.top   = '160px';
      }
      if (pos && Number.isFinite(pos.w) && pos.w >= 380){ w.style.width  = pos.w + 'px'; }
      if (pos && Number.isFinite(pos.h) && pos.h >= 320){ w.style.height = pos.h + 'px'; }
    } catch(e){
      w.style.right = '24px';
      w.style.top   = '160px';
    }
    // If we restored from storage, sanity-check the position is on
    // screen. We need a synchronous getBoundingClientRect, which means
    // the element must be in the DOM and rendered. To avoid flashing,
    // briefly render with visibility:hidden, measure, clamp, then
    // remove the visibility override.
    if (restoredFromStorage){
      const prevDisplay = w.style.display;
      const prevVis = w.style.visibility;
      w.style.visibility = 'hidden';
      w.style.display = 'flex';
      const rect = w.getBoundingClientRect();
      const { x, y } = clampWindowPos(rect.left, rect.top);
      if (x !== rect.left || y !== rect.top){
        w.style.left = x + 'px';
        w.style.top  = y + 'px';
      }
      w.style.display = prevDisplay;
      w.style.visibility = prevVis;
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

    // If the browser viewport shrinks while the window is open, the
    // window can end up off-screen. Re-clamp on viewport resize.
    let viewportT = null;
    window.addEventListener('resize', () => {
      if (!state.isOpen) return;
      if (viewportT) clearTimeout(viewportT);
      viewportT = setTimeout(() => {
        if (!state.win || !state.win.style.left || !state.win.style.top) return;
        const cur = state.win.getBoundingClientRect();
        const { x, y } = clampWindowPos(cur.left, cur.top);
        if (x !== cur.left || y !== cur.top){
          state.win.style.left = x + 'px';
          state.win.style.top  = y + 'px';
          state.win.style.right = 'auto';
          persistWindowRect();
        }
      }, 150);
    });

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

  // Hard reset window position + size. Useful if the window is stuck
  // off-screen from a stale localStorage entry, or if the user just
  // wants to start fresh.
  function resetWindowPos(){
    if (!state.win) return;
    try { localStorage.removeItem('gcc-subhex-window-pos'); } catch(e){}
    state.win.style.left = '';
    state.win.style.top  = '';
    state.win.style.width  = '';
    state.win.style.height = '';
    state.win.style.right = '24px';
    state.win.style.top   = '160px';
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
    // Arming a terrain or feature paint tool dismisses any active
    // region-tool dropdown.
    if (state.armed){
      const sel = state.win?.querySelector('#sxw-region-armed');
      if (sel){ sel.style.display = 'none'; }
      const psel = state.win?.querySelector('#sxw-path-armed');
      if (psel){ psel.style.display = 'none'; }
    }
    syncPaletteUI();
    syncModeLabel();
  }

  function syncPaletteUI(){
    if (!state.win) return;
    const cur = armKey(state.armed);
    state.win.querySelectorAll('.sxw-swatch, .sxw-feature-btn').forEach(b => {
      b.classList.toggle('armed', b.dataset.armKey === cur);
    });
    const regionTool = state.win.querySelector('#sxw-region-tool');
    if (regionTool){
      const isRegion = state.armed && (state.armed.type === 'region' || state.armed.type === 'region-erase');
      regionTool.classList.toggle('armed', !!isRegion);
    }
    const pathTool = state.win.querySelector('#sxw-path-tool');
    if (pathTool){
      const isPath = state.armed && state.armed.type === 'path';
      pathTool.classList.toggle('armed', !!isPath);
    }
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
    } else if (a.type === 'region'){
      const region = window.GCCSubhexData.getRegion(state.parentId, a.value);
      const rname = region ? region.name : '(unknown)';
      el.textContent = `Mode: Assign to region · ${rname} · drag to brush`;
    } else if (a.type === 'region-erase'){
      el.textContent = 'Mode: Remove from region · click cells';
    } else if (a.type === 'path'){
      const path = window.GCCSubhexPaths?.getPath(state.parentId, a.value);
      const pname = path ? path.name : '(unknown)';
      const len = path ? path.cells.length : 0;
      el.textContent = `Mode: Extend path · ${pname} · ${len} cell${len===1?'':'s'} · click neighbor to extend`;
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
    t.textContent = lm ? lm.name : 'Subhexes';
    const cb = state.win.querySelector('#sxw-coord-bar');
    if (cb) cb.textContent = state.parentId;

    state.win.style.display = 'flex';
    // Always clamp position against the current viewport. Stored
    // coords may be off-screen if the user resized their browser
    // smaller, and the right:24px default with a wide stored width
    // can also push the left edge off the visible area.
    const cur = state.win.getBoundingClientRect();
    const { x, y } = clampWindowPos(cur.left, cur.top);
    if (x !== cur.left || y !== cur.top){
      state.win.style.left = x + 'px';
      state.win.style.top  = y + 'px';
      state.win.style.right = 'auto';
    }
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
    // Hide the region-armed picker so it isn't lingering when reopened
    // for a different parent.
    const sel = state.win.querySelector('#sxw-region-armed');
    if (sel){ sel.style.display = 'none'; sel.value = ''; }
    const psel = state.win.querySelector('#sxw-path-armed');
    if (psel){ psel.style.display = 'none'; psel.value = ''; }
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

    renderPaths(svg);
    renderRegionLabels(svg);
  }

  // Render every path in this parent as a polyline through cell
  // centers via shared-edge midpoints. For adjacent hexes the midpoint
  // of (centerA, centerB) is exactly the midpoint of their shared edge,
  // so the polyline naturally hugs cell boundaries. Paths render under
  // region labels but over cell fills + terrain icons.
  function renderPaths(svg){
    if (!window.GCCSubhexPaths) return;
    svg.querySelectorAll('.sxw-paths-layer').forEach(n => n.remove());
    const paths = window.GCCSubhexPaths.listPaths(state.parentId);
    if (!paths.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-paths-layer');
    for (const p of paths){
      if (!p.cells || p.cells.length < 1) continue;
      const pts = pathPolylinePoints(p.cells);
      if (pts.length < 2){
        // Length-1 path: render a small dot at the cell center to show
        // the start has been placed. Author can still extend it.
        const c = subhexCenter(p.cells[0].q, p.cells[0].r);
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', c.x);
        dot.setAttribute('cy', c.y);
        dot.setAttribute('r', 3);
        dot.setAttribute('class', `sxw-path-dot sxw-path-${p.kind}`);
        dot.dataset.pathId = p.id;
        layer.appendChild(dot);
        continue;
      }
      const poly = document.createElementNS(ns, 'polyline');
      poly.setAttribute('points', pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
      poly.setAttribute('class', `sxw-path sxw-path-${p.kind}`);
      poly.setAttribute('fill', 'none');
      poly.dataset.pathId = p.id;
      // Highlight the armed path so the GM sees what they're extending.
      if (state.armed && state.armed.type === 'path' && state.armed.value === p.id){
        poly.classList.add('armed');
      }
      layer.appendChild(poly);
    }
    svg.appendChild(layer);
  }

  // Convert a cell sequence to polyline waypoints. For length 1, returns
  // [center] (caller renders a dot instead). For length 2+: [center_first,
  // sharedMid_0to1, sharedMid_1to2, ..., center_last].
  function pathPolylinePoints(cells){
    if (!cells || !cells.length) return [];
    if (cells.length === 1){
      const c = subhexCenter(cells[0].q, cells[0].r);
      return [[c.x, c.y]];
    }
    const pts = [];
    const first = subhexCenter(cells[0].q, cells[0].r);
    pts.push([first.x, first.y]);
    for (let i = 0; i < cells.length - 1; i++){
      const a = subhexCenter(cells[i].q, cells[i].r);
      const b = subhexCenter(cells[i+1].q, cells[i+1].r);
      pts.push([(a.x + b.x) / 2, (a.y + b.y) / 2]);
    }
    const last = subhexCenter(cells[cells.length-1].q, cells[cells.length-1].r);
    pts.push([last.x, last.y]);
    return pts;
  }

  // Drop a centered text label on each region with ≥3 members. Centroid
  // is the average of member subhex centers. Labels render after cells
  // (so they paint on top of fills + terrain icons) but before features
  // (handled separately — region label and feature glyph in the same
  // cell would collide visually, but in practice features are rare per
  // cell and the label sits at the centroid which is usually empty).
  function renderRegionLabels(svg){
    if (!window.GCCSubhexData) return;
    // Remove any pre-existing region labels (in case rebuildSVG is
    // called as part of a refresh rather than a fresh open).
    svg.querySelectorAll('.sxw-region-label-layer').forEach(n => n.remove());
    const regions = window.GCCSubhexData.listRegions(state.parentId);
    if (!regions.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-region-label-layer');
    for (const region of regions){
      const members = window.GCCSubhexData.regionMembers(state.parentId, region.id);
      if (members.length < 3) continue;
      let sx = 0, sy = 0;
      for (const { q, r } of members){
        const c = subhexCenter(q, r);
        sx += c.x; sy += c.y;
      }
      const cx = sx / members.length;
      const cy = sy / members.length;
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', cx);
      text.setAttribute('y', cy);
      text.setAttribute('class', 'sxw-region-label');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = region.name;
      layer.appendChild(text);
    }
    svg.appendChild(layer);
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
    // Path mode is click-only — no brush. Other modes brush on drag.
    if (state.armed.type !== 'path'){
      state.brushing = true;
      state.brushedThisDrag = new Set();
    }
    paintCell(q, r);
    if (state.brushing) window.addEventListener('mouseup', onBrushEnd);
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
      const existing = window.GCCSubhexData.getSubhex(state.parentId, q, r, state.parentTerrain);
      const prior = existing && existing.feature;
      const next = (prior && prior.kind === a.value)
        ? prior
        : { kind: a.value };
      window.GCCSubhexData.setSubhexFeature(state.parentId, q, r, next);
    } else if (a.type === 'feature-erase'){
      window.GCCSubhexData.clearSubhexFeature(state.parentId, q, r);
    } else if (a.type === 'region'){
      window.GCCSubhexData.assignCellToRegion(state.parentId, q, r, a.value, state.parentTerrain);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg) renderRegionLabels(svg);
    } else if (a.type === 'region-erase'){
      window.GCCSubhexData.unassignCellFromRegion(state.parentId, q, r);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg) renderRegionLabels(svg);
    } else if (a.type === 'path'){
      // Click-only — never brushed (skip if this came from a drag).
      if (state.brushing) return;
      const ok = window.GCCSubhexPaths.appendCell(state.parentId, a.value, q, r);
      if (ok){
        const svg = state.win?.querySelector('#sxw-svg');
        if (svg) renderPaths(svg);
        syncModeLabel();
      }
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
    const rpick  = w.querySelector('#sxw-region-pick');
    const rname  = w.querySelector('#sxw-region-name');
    const plist  = w.querySelector('#sxw-paths-list');
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
      rebuildRegionPickOptions(rpick, '', null, null);
      rpick.disabled = true;
      rname.value = '';  rname.disabled = true;
      if (plist) plist.textContent = '—';
      source.textContent = '';
      clearB.disabled    = true;
      return;
    }
    const sub = window.GCCSubhexData.getSubhex(
      state.parentId, state.selectedQ, state.selectedR, state.parentTerrain
    );
    coord.textContent = `q${state.selectedQ}, r${state.selectedR}`;
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
    // Region picker — list only regions whose locked terrain matches
    // the cell's effective terrain (joining a mismatch is silently
    // refused by the data layer; surfacing only valid options is more
    // honest).
    rebuildRegionPickOptions(rpick, sub.terrain, sub.regionId, state.parentId);
    rpick.disabled = false;
    const region = sub.regionId ? window.GCCSubhexData.getRegion(state.parentId, sub.regionId) : null;
    rname.value = region ? region.name : '';
    rname.disabled = !region;
    // Paths row — read-only summary of paths through this cell.
    if (plist){
      const cellPaths = window.GCCSubhexPaths
        ? window.GCCSubhexPaths.pathsAtCell(state.parentId, state.selectedQ, state.selectedR)
        : [];
      plist.textContent = cellPaths.length
        ? cellPaths.map(p => `${p.name} (${p.kind})`).join(', ')
        : '—';
    }
    source.textContent = sub.source === 'authored' ? 'Authored override (localStorage)'
      : sub.source === 'canonical' ? 'Canonical Greyhawk feature'
      : 'Procedural — derived from world seed';
    clearB.disabled = (sub.source !== 'authored');
  }

  // Build the region <select> options for the detail panel. terrain =
  // the cell's effective terrain (used to filter eligible regions).
  // selectedRegionId = the cell's current regionId. parentId = parent
  // hex id (or null in the empty-selection state).
  function rebuildRegionPickOptions(sel, terrain, selectedRegionId, parentId){
    if (!sel) return;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— none —';
    sel.appendChild(noneOpt);
    if (parentId && terrain){
      const regions = window.GCCSubhexData.listRegions(parentId)
        .filter(r => r.terrain === terrain);
      for (const r of regions){
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        sel.appendChild(opt);
      }
    }
    if (parentId && terrain){
      const newOpt = document.createElement('option');
      newOpt.value = '__new__';
      newOpt.textContent = `+ New ${terrain} region…`;
      sel.appendChild(newOpt);
    }
    sel.value = selectedRegionId || '';
  }

  function onRegionPickChange(ev){
    if (state.selectedQ === null) return;
    const val = ev.target.value;
    if (val === '__new__'){
      const sub = window.GCCSubhexData.getSubhex(
        state.parentId, state.selectedQ, state.selectedR, state.parentTerrain
      );
      if (!sub || !sub.terrain){
        ev.target.value = sub?.regionId || '';
        return;
      }
      const name = (typeof prompt === 'function') ? prompt('New region name:') : null;
      if (!name){
        ev.target.value = sub.regionId || '';
        return;
      }
      const region = window.GCCSubhexData.createRegion(state.parentId, name, sub.terrain);
      if (region){
        window.GCCSubhexData.assignCellToRegion(
          state.parentId, state.selectedQ, state.selectedR, region.id, state.parentTerrain
        );
        // Auto-arm region mode for the new region so the GM can keep
        // adding cells to it.
        state.armed = { type: 'region', value: region.id };
        showRegionArmedPicker(true, region.id);
        syncPaletteUI();
        syncModeLabel();
      }
    } else if (val === ''){
      window.GCCSubhexData.unassignCellFromRegion(state.parentId, state.selectedQ, state.selectedR);
    } else {
      window.GCCSubhexData.assignCellToRegion(
        state.parentId, state.selectedQ, state.selectedR, val, state.parentTerrain
      );
    }
    applyCellPaint(state.selectedQ, state.selectedR);
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderRegionLabels(svg);
    syncDetailPanel();
  }

  function onRegionRename(ev){
    if (state.selectedQ === null) return;
    const sub = window.GCCSubhexData.getSubhex(
      state.parentId, state.selectedQ, state.selectedR, state.parentTerrain
    );
    if (!sub || !sub.regionId) return;
    const newName = ev.target.value.trim();
    if (!newName) return;
    window.GCCSubhexData.renameRegion(state.parentId, sub.regionId, newName);
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderRegionLabels(svg);
    // Refresh the picker dropdowns since names changed.
    syncDetailPanel();
    rebuildRegionArmedPicker();
  }

  // ── Region tool (toolbar) ──────────────────────────────────────────────
  function onRegionToolClick(){
    // If region mode is already active, toggle it off.
    if (state.armed && (state.armed.type === 'region' || state.armed.type === 'region-erase')){
      state.armed = null;
      showRegionArmedPicker(false);
      syncPaletteUI();
      syncModeLabel();
      return;
    }
    // Dismiss path picker if it was open.
    const psel = state.win?.querySelector('#sxw-path-armed');
    if (psel) psel.style.display = 'none';
    // Otherwise, open the contextual armed-region picker.
    rebuildRegionArmedPicker();
    showRegionArmedPicker(true);
  }

  function showRegionArmedPicker(visible, presetValue){
    const sel = state.win?.querySelector('#sxw-region-armed');
    if (!sel) return;
    sel.style.display = visible ? '' : 'none';
    if (visible && presetValue !== undefined){
      sel.value = presetValue;
    } else if (visible && !sel.value){
      // Default to the first existing region if any, else leave blank.
      const regions = window.GCCSubhexData.listRegions(state.parentId);
      if (regions.length){ sel.value = regions[0].id; }
    }
  }

  function rebuildRegionArmedPicker(){
    const sel = state.win?.querySelector('#sxw-region-armed');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— pick a region to assign —';
    sel.appendChild(noneOpt);
    const regions = window.GCCSubhexData.listRegions(state.parentId);
    for (const r of regions){
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.terrain})`;
      sel.appendChild(opt);
    }
    const eraseOpt = document.createElement('option');
    eraseOpt.value = '__erase__';
    eraseOpt.textContent = '⌫ Remove from region (click cells)';
    sel.appendChild(eraseOpt);
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New region from selected cell\'s terrain…';
    sel.appendChild(newOpt);
    if (prev) sel.value = prev;
  }

  function onRegionArmedChange(ev){
    const val = ev.target.value;
    if (val === '__erase__'){
      state.armed = { type: 'region-erase' };
    } else if (val === '__new__'){
      // Need a selected cell with a terrain to create a region from.
      if (state.selectedQ === null){
        if (typeof alert === 'function') alert('Select a cell first to use its terrain for the new region.');
        ev.target.value = '';
        return;
      }
      const sub = window.GCCSubhexData.getSubhex(
        state.parentId, state.selectedQ, state.selectedR, state.parentTerrain
      );
      if (!sub || !sub.terrain){
        ev.target.value = '';
        return;
      }
      const name = (typeof prompt === 'function') ? prompt('New region name:') : null;
      if (!name){ ev.target.value = ''; return; }
      const region = window.GCCSubhexData.createRegion(state.parentId, name, sub.terrain);
      if (region){
        window.GCCSubhexData.assignCellToRegion(
          state.parentId, state.selectedQ, state.selectedR, region.id, state.parentTerrain
        );
        applyCellPaint(state.selectedQ, state.selectedR);
        rebuildRegionArmedPicker();
        ev.target.value = region.id;
        state.armed = { type: 'region', value: region.id };
      } else {
        ev.target.value = '';
        return;
      }
    } else if (val){
      state.armed = { type: 'region', value: val };
    } else {
      state.armed = null;
    }
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderRegionLabels(svg);
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
  }

  // ── Path tool (toolbar) ────────────────────────────────────────────────
  function onPathToolClick(){
    if (state.armed && state.armed.type === 'path'){
      state.armed = null;
      showPathArmedPicker(false);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg) renderPaths(svg);
      syncPaletteUI();
      syncModeLabel();
      return;
    }
    // Dismiss region picker if it was open.
    const rsel = state.win?.querySelector('#sxw-region-armed');
    if (rsel) rsel.style.display = 'none';
    rebuildPathArmedPicker();
    showPathArmedPicker(true);
  }

  function showPathArmedPicker(visible, presetValue){
    const sel = state.win?.querySelector('#sxw-path-armed');
    if (!sel) return;
    sel.style.display = visible ? '' : 'none';
    if (visible && presetValue !== undefined){
      sel.value = presetValue;
    }
  }

  function rebuildPathArmedPicker(){
    const sel = state.win?.querySelector('#sxw-path-armed');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— pick a path to extend —';
    sel.appendChild(noneOpt);
    const paths = window.GCCSubhexPaths.listPaths(state.parentId);
    for (const p of paths){
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.kind} · ${p.cells.length} cells)`;
      sel.appendChild(opt);
    }
    for (const kind of window.GCCSubhexPaths.PATH_KINDS){
      const opt = document.createElement('option');
      opt.value = `__new__:${kind}`;
      opt.textContent = `+ New ${kind}…`;
      sel.appendChild(opt);
    }
    const undoOpt = document.createElement('option');
    undoOpt.value = '__pop__';
    undoOpt.textContent = '↶ Undo last cell on armed path';
    sel.appendChild(undoOpt);
    const delOpt = document.createElement('option');
    delOpt.value = '__delete__';
    delOpt.textContent = '⌫ Delete a path…';
    sel.appendChild(delOpt);
    if (prev) sel.value = prev;
  }

  function onPathArmedChange(ev){
    const val = ev.target.value;
    if (val.startsWith('__new__:')){
      const kind = val.slice('__new__:'.length);
      const name = (typeof prompt === 'function') ? prompt(`New ${kind} name:`) : null;
      if (!name){ ev.target.value = ''; return; }
      const path = window.GCCSubhexPaths.createPath(state.parentId, kind, name);
      if (!path){ ev.target.value = ''; return; }
      rebuildPathArmedPicker();
      ev.target.value = path.id;
      state.armed = { type: 'path', value: path.id };
    } else if (val === '__pop__'){
      if (state.armed && state.armed.type === 'path'){
        window.GCCSubhexPaths.popCell(state.parentId, state.armed.value);
        rebuildPathArmedPicker();
        ev.target.value = state.armed.value;
        const svg = state.win?.querySelector('#sxw-svg');
        if (svg) renderPaths(svg);
      } else {
        ev.target.value = '';
      }
    } else if (val === '__delete__'){
      const paths = window.GCCSubhexPaths.listPaths(state.parentId);
      if (!paths.length){ ev.target.value = ''; return; }
      const names = paths.map((p, i) => `${i+1}. ${p.name} (${p.kind})`).join('\n');
      const choice = (typeof prompt === 'function')
        ? prompt(`Delete which path? Enter number 1–${paths.length}:\n\n${names}`)
        : null;
      const n = parseInt(choice, 10);
      if (Number.isFinite(n) && n >= 1 && n <= paths.length){
        const target = paths[n - 1];
        window.GCCSubhexPaths.deletePath(state.parentId, target.id);
        if (state.armed && state.armed.type === 'path' && state.armed.value === target.id){
          state.armed = null;
        }
        rebuildPathArmedPicker();
        ev.target.value = (state.armed && state.armed.type === 'path') ? state.armed.value : '';
        const svg = state.win?.querySelector('#sxw-svg');
        if (svg) renderPaths(svg);
      } else {
        ev.target.value = (state.armed && state.armed.type === 'path') ? state.armed.value : '';
      }
    } else if (val){
      state.armed = { type: 'path', value: val };
    } else {
      state.armed = null;
    }
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderPaths(svg);
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
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
    if (ev.target.closest('.sxw-reset-pos')) return;
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
  // Clamp window position so the entire header bar is always inside
  // the viewport (top-edge ≥ 0) and at least a useful slice of the
  // window remains horizontally on-screen. Apply to (x, y) candidates
  // before assigning to style.left/top.
  function clampWindowPos(x, y){
    if (!state.win) return { x, y };
    const KEEPVIS_X = 80;          // horizontal: how much of the window must stay on screen
    const HEADER_PAD = 4;          // small top inset so the header isn't flush against the very edge
    const rect = state.win.getBoundingClientRect();
    const w = rect.width || 540;
    const h = rect.height || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Horizontal: the window's left can be at most vw - KEEPVIS_X (so
    // the leftmost KEEPVIS_X is still visible from the right side) and
    // at least KEEPVIS_X - w (so the rightmost KEEPVIS_X is visible
    // from the left side).
    if (x > vw - KEEPVIS_X) x = vw - KEEPVIS_X;
    if (x < KEEPVIS_X - w)  x = KEEPVIS_X - w;
    // Vertical: header must be fully on-screen. Top must be ≥ 0 (with
    // a small pad). Bottom of header must be < vh — we approximate
    // header height as 32px (matches CSS).
    const HEADER_H = 32;
    if (y < HEADER_PAD) y = HEADER_PAD;
    if (y > vh - HEADER_H) y = vh - HEADER_H;
    return { x, y };
  }

  function onDragMove(ev){
    if (!state.drag) return;
    if (ev.preventDefault) ev.preventDefault();
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const raw = {
      x: evt.clientX - state.dragOffset.x,
      y: evt.clientY - state.dragOffset.y,
    };
    const { x, y } = clampWindowPos(raw.x, raw.y);
    state.win.style.left = x + 'px';
    state.win.style.top  = y + 'px';
    state.win.style.right = 'auto';
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
