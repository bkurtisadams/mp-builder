// gcc-subhex-view.js v2.5.1 — 2026-04-30
// v2.5.1: parent-path markers now follow authored subhex paths.
// When the GM has drawn a subhex road/river matching a parent
// segment, the corresponding parent-path marker sits on the cell
// where the authored path actually crosses the parent boundary,
// rather than on the geometric edge midpoint. The midpoint
// behaviour still applies as a fallback when nothing is authored.
// Helper: authoredBoundaryCellForSegment(seg, edge, owned).
// v2.5.0: feature notes. The detail panel grows a notes textarea for
// the selected cell's feature, populated from feature.notes and
// persisted on blur. Crossings (bridge/ford/ferry/crossroads) are
// where this is most useful, but it works for any feature kind.
// v2.4.8: don't fire the crossing × badge for river-meets-river
// confluences. The detector now skips cells where every path is
// kind 'river' or 'stream' — those aren't crossings, they're
// geography (the Ery merging into the Selintan, etc.). Previously
// such cells got a badge offering only "Landmark" or "Dismiss",
// which created click noise without a useful action. The badge
// remains for any cell where at least one road or track meets a
// river (real bridges/fords/ferries).
// v2.4.7: armed-path ghost marker. When a path is armed but has no
// cells in the current parent (because it was authored in a neighbor
// parent and hasn't crossed the boundary yet), a pulsing dot appears
// on this parent's boundary subhex that's axially adjacent to the
// path's last-authored cell. Click that dot's cell to continue the
// path. The path section header also gains a "last in X4-NN" hint
// when the path's last cell is owned by a different parent — gives
// the GM textual orientation alongside the visual ghost.
// v2.4.6: workflow improvement for authoring across multiple parents.
// The editor now auto-switches when the GM clicks a different parent
// on the main map (provided the editor is already open). New
// currentParent() export lets the main map check whether a click
// would actually be a switch (vs. clicking the already-open parent
// pointlessly). Hookup is in greyhawk-map.html's onHexClick handler;
// it skips the auto-switch in journey-planning and move modes so
// those workflows aren't disrupted.
// v2.4.5: bug fix for the path picker not appearing when the GM
// clicks the Path tool. The path section was being shown correctly
// (display:flex), but the picker dropdown inside the section had a
// stale inline display:none left over from close() / earlier code
// paths that managed the picker individually before v2.4.3 moved it
// into a section. showPathArmedPicker now explicitly sets the
// picker's inline display alongside the section's, so the picker
// becomes visible regardless of any leftover state.
// v2.4.4: path-append rejection no longer fails silently. When a
// click on a cell while a path is armed couldn't extend the path
// (the cell isn't axially adjacent to the path's last cell), the
// mode label flashes "Not adjacent to path's last cell (QX, RY)"
// so the GM knows their click was received and why it didn't
// produce a stamp. Also includes the last cell's coordinates in
// the flash so they can compare against where they're trying to
// click.
// v2.4.3: path controls promoted to their own labeled section. The
// path picker, four action buttons (Undo / Rename / Delete / Done),
// and help text now live in a #sxw-path-section block between the
// palette strip and the tools row. Section header shows the armed
// path's name + kind + cell count: "PATH · Selintan (river · 7
// cells)". Section is hidden until Path tool is opened or a path is
// armed via a marker click. Tools row is now back to its original
// short shape: Region… / Path… / Clear override / Mode line.
// v2.4.2: path editing made discoverable. Once a path is armed
// (selected from the picker, click-to-author from a marker, or new
// path created), four action buttons appear in the tools row:
// ↶ Undo last (popCell), ✎ Rename, ⌫ Delete (in danger color),
// ✓ Done (disarm). A help line under the row explains the click
// behavior: extend by clicking neighbors, truncate by clicking
// own cells. The previous "↶ Undo last" and "⌫ Delete a path…"
// items in the dropdown are removed since they're now real
// buttons. New helpers: syncPathActionButtons,
// onPathUndoClick / onPathRenameClick / onPathDeleteClick /
// onPathDoneClick.
// v2.4.1: two small UX fixes for feature/path erase confusion.
// 1) Feature-erase tool now flashes "No feature here" in the mode
//    label when the clicked cell has no feature to clear. The cell's
//    path stamp is easily mistaken for a feature glyph; the feedback
//    confirms the click was received but there was nothing to erase.
// 2) Clicking a cell that's already on the armed path now truncates
//    the path before that cell instead of trying (and silently
//    failing) to append. This is the natural inverse of authoring:
//    re-click a cell to remove it (and everything after it).
// v2.4.0: auto-detected path crossings. Any owned subhex that sits
// on 2+ subhex paths gets a small "×" badge in its upper-right
// corner. Clicking the badge pops a kind picker — Bridge / Ford /
// Ferry for road-on-river crossings, Crossroads for road-on-road,
// Landmark (named "Confluence of …") for river-on-river, plus a
// Dismiss option to suppress the badge for that exact path-pair.
// Picking a kind writes the feature (with auto-generated name like
// "Bridge over Selintan") and the badge clears. Persistence: the
// dismiss set lives in localStorage 'gcc-subhex-crossings-dismissed'.
// Detection runs at render time, so the badges always reflect
// current state — adding/removing a path or feature updates the
// badge layer immediately.
// v2.3.0: parent-path markers are now click-to-author. Clicking a
// marker creates (or arms) a subhex path of matching kind, pre-fills
// the parent path's name, anchors the first cell at the boundary
// subhex, and highlights the segment's other-end marker as the
// authoring destination. The destination marker pulses; both
// markers pick up the .authored class once a subhex path connects
// them. This eliminates the manual "Path… → New river → name it →
// click first cell" setup that the GM used to do for every river /
// road / track passing through a parent.
// v2.2.0: split into two independent windows. Map window holds the
// SVG + zoom controls; controls window holds the detail panel,
// palette strip, and tools row. Both are draggable and resizable
// independently. Controls window auto-opens beside the map and
// auto-closes with it. Position/size for both persist separately
// in localStorage ('gcc-subhex-window-pos' for map, '-controls-pos'
// for controls). Reset (↺) on either window clears that window's
// persisted state. Sharing field IDs between windows is impossible,
// so the controls window keeps the original IDs (sxw-name, sxw-notes,
// etc.) and the map window has only its own (sxw-svg, sxw-coord-bar).
// A new findEl(id) helper looks up fields in either window.
// v2.1.0: parent-level paths (rivers, roads, tracks from gcc-paths.js)
// surface as colored dots on boundary subhexes — blue for rivers,
// brown for roads, tan for tracks. Each dot offsets ~50% toward the
// parent edge it crosses, so the GM sees at a glance which side of
// the parent the path heads to. Hover tooltip shows path name and
// neighbor parent label. Read-only — does not author subhex paths,
// just shows the connection from the parent layer.
// v2.0.1: fragments no longer clipped to parent silhouette. They
// render their full hex polygons extending beyond the parent
// boundary so the GM can see exactly which cells span between
// neighbor parents. ClipPath defs removed (unused).
// Subhex editor window. Opens for one parent hex at a time; main map
// stays at 30mi, untouched. Self-contained: own SVG, own paint palette,
// own name/notes inputs.
//
// v2.0: rebuilt on global axial coordinates. Cells now identified by
// world (Q, R) instead of per-parent (q, r). Each parent owns ~100
// subhexes determined by Voronoi (ownedByParent). Cells whose centers
// are in neighbor parents but whose hex polygons overlap this parent
// silhouette are rendered as "fragments" — faded, clipped to the
// parent polygon, but still clickable. Selecting a fragment shows
// "Owned by F4-96" hint and its data is read/written from the
// neighbor's perspective. Regions are now global (can span parents)
// and labels render in any parent containing ≥1 member, centered on
// the centroid of all members across all parents.
//
// v1.1: zoom. The SVG now lives in a scrollable wrap and can be
// scaled independently of the dialog size via +/- buttons in the
// SVG corner or Ctrl+wheel anchored on cursor. Detail panel,
// palettes, and tools row stay at fixed size — only the map zooms.
// Zoom level persists alongside window position/size.
//
// v1.0: clamp drag, compact chrome, recovery affordance.
//
// v0.7: feature cells. A cell can host one feature (castle, ruin,
// tower, village, camp, cache, shrine, lair, grave, landmark) which
// renders as a haloed glyph over the terrain icon. The detail panel
// gains a Hosts row with kind picker, feature name, and library link.
// The palette gains a second strip of feature glyphs that arm the
// same paint flow as terrain swatches — click-to-place or drag to
// brush a feature across multiple cells.
//
// Globals consumed: hexIdStr, getHexTerrain, TERRAIN, GCCSubhexData,
//   GCCSubhexIcons, GCCSubhexPaths. Wired by greyhawk-map.html init
//   via the side panel "Explore Sub-Map" button (calls
//   GCCSubhexView.open(col, row)).

(function(){
  'use strict';

  // Display scale: with HEX_R/SUB_R = 10:1 in data, we render at 10:1
  // visually to match v1.1's appearance and let gcc-subhex-icons.js
  // (with its hardcoded stroke widths) work unchanged.
  const SUB_R = 26;
  const PARENT_R = 260;
  const VIEWBOX_W = 660;
  const VIEWBOX_H = 580;
  const SQRT3 = Math.sqrt(3);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4.0;
  const ZOOM_STEP = 1.15;
  const ZOOM_DEFAULT = 1.0;

  const state = {
    win: null,
    ctrl: null,
    isOpen: false,
    parentCol: null,
    parentRow: null,
    parentId: null,
    parentTerrain: null,
    parentQ: null,             // axial center subhex of this parent
    parentR: null,
    selectedQ: null,           // global axial of selected cell
    selectedR: null,
    // armed controls what click/drag paints. null = select mode.
    armed: null,
    drag: null,
    dragOffset: { x: 0, y: 0 },
    ctrlDrag: null,
    ctrlDragOffset: { x: 0, y: 0 },
    brushing: false,
    brushedThisDrag: null,     // Set<string> of "Q_R" keys painted in current drag
    zoom: ZOOM_DEFAULT,
    // When the GM clicks a parent-path marker to start authoring, we
    // remember which segment they're working on. The pair-end marker
    // gets the .destination class so the GM can see where to draw to.
    // Cleared when the path tool is disarmed or a different segment
    // is started.
    markerHighlight: null,     // null | { segIndex, edge }
    _flashTimer: null,         // mode-label flash dismiss timer id
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
        <div class="sxw-svg-wrap" id="sxw-svg-wrap">
          <svg id="sxw-svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" preserveAspectRatio="xMidYMid meet"></svg>
          <div class="sxw-zoom-controls">
            <button class="sxw-zoom-btn" id="sxw-zoom-out" title="Zoom out">−</button>
            <button class="sxw-zoom-btn" id="sxw-zoom-reset" title="Reset zoom (1:1)">⟲</button>
            <button class="sxw-zoom-btn" id="sxw-zoom-in" title="Zoom in">+</button>
            <span class="sxw-zoom-pct" id="sxw-zoom-pct">100%</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(w);
    state.win = w;

    const head = w.querySelector('.sxw-header');
    head.addEventListener('mousedown', onDragStart);
    head.addEventListener('touchstart', onDragStart, { passive: false });
    w.querySelector('.sxw-close').addEventListener('click', close);
    w.querySelector('.sxw-reset-pos').addEventListener('click', resetWindowPos);

    w.querySelector('#sxw-zoom-in').addEventListener('click', () => zoomBy(ZOOM_STEP));
    w.querySelector('#sxw-zoom-out').addEventListener('click', () => zoomBy(1 / ZOOM_STEP));
    w.querySelector('#sxw-zoom-reset').addEventListener('click', () => setZoom(ZOOM_DEFAULT));
    w.querySelector('#sxw-svg-wrap').addEventListener('wheel', onSvgWheel, { passive: false });

    ensureControlsWindow();
    buildPalette();
    buildFeaturePalette();
    buildFeatureKindSelect();

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
      if (pos && Number.isFinite(pos.zoom)){
        state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pos.zoom));
      }
    } catch(e){
      w.style.right = '24px';
      w.style.top   = '160px';
    }
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

    if (typeof ResizeObserver !== 'undefined'){
      let t = null;
      const ro = new ResizeObserver(() => {
        if (t) clearTimeout(t);
        t = setTimeout(persistWindowRect, 200);
      });
      ro.observe(w);
    }

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
        zoom: state.zoom,
      };
      const usingLeftTop = state.win.style.left && state.win.style.top
                           && state.win.style.right === 'auto';
      if (usingLeftTop){ next.x = rect.left; next.y = rect.top; }
      localStorage.setItem('gcc-subhex-window-pos', JSON.stringify(next));
    } catch(e){}
  }

  function resetWindowPos(){
    if (!state.win) return;
    try { localStorage.removeItem('gcc-subhex-window-pos'); } catch(e){}
    state.win.style.left = '';
    state.win.style.top  = '';
    state.win.style.width  = '';
    state.win.style.height = '';
    state.win.style.right = '24px';
    state.win.style.top   = '160px';
    state.zoom = ZOOM_DEFAULT;
    applyZoom();
    if (state.ctrl){
      try { localStorage.removeItem('gcc-subhex-controls-pos'); } catch(e){}
      state.ctrl.style.left = '';
      state.ctrl.style.top  = '';
      state.ctrl.style.width  = '';
      state.ctrl.style.height = '';
      positionControlsBesideMap();
    }
  }

  // ── Controls window ─────────────────────────────────────────────────────
  // Detail panel + palettes + tools live here. Independent dragging /
  // resizing / position persistence. Auto-opened when the map opens
  // and auto-closed when the map closes.
  function ensureControlsWindow(){
    if (state.ctrl) return state.ctrl;
    const c = document.createElement('div');
    c.id = 'subhex-controls-window';
    c.innerHTML = `
      <div class="sxw-header sxw-ctrl-header">
        <span class="sxw-title">Controls</span>
        <span class="sxw-coord-bar" id="sxw-ctrl-coord-bar"></span>
        <span class="sxw-header-btns">
          <button class="sxw-reset-pos" title="Reset controls window position">↺</button>
        </span>
      </div>
      <div class="sxw-body sxw-ctrl-body">
        <div class="sxw-detail">
          <div class="sxw-row sxw-row-inline">
            <label>Cell</label>
            <span class="sxw-readonly" id="sxw-coord">— select a cell</span>
            <span class="sxw-sep">·</span>
            <span class="sxw-readonly" id="sxw-terrain">—</span>
            <span class="sxw-sep" id="sxw-owner-sep" style="display:none;">·</span>
            <span class="sxw-readonly sxw-owner-hint" id="sxw-owner" style="display:none;"></span>
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
          <div class="sxw-row sxw-row-inline sxw-row-feature-notes">
            <label>Feature notes</label>
            <textarea id="sxw-feature-notes" placeholder="Notes for this feature (toll, condition, lore…)" disabled></textarea>
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
        <div class="sxw-path-section" id="sxw-path-section" style="display:none;">
          <div class="sxw-section-head" id="sxw-path-section-head">PATH</div>
          <select class="sxw-path-armed sxw-path-armed-block" id="sxw-path-armed"></select>
          <div class="sxw-path-actions">
            <button class="sxw-tool-btn sxw-path-action" id="sxw-path-undo" title="Remove the last cell of the armed path">↶ Undo</button>
            <button class="sxw-tool-btn sxw-path-action" id="sxw-path-rename" title="Rename the armed path">✎ Rename</button>
            <button class="sxw-tool-btn sxw-path-action sxw-tool-btn-danger" id="sxw-path-delete" title="Delete the armed path">⌫ Delete</button>
            <button class="sxw-tool-btn sxw-path-action sxw-tool-btn-armed" id="sxw-path-done" title="Stop editing this path">✓ Done</button>
          </div>
          <div class="sxw-path-help" id="sxw-path-help">
            Click a neighboring cell to extend · click a cell already on this path to remove it (and everything after)
          </div>
        </div>
        <div class="sxw-tools">
          <button class="sxw-tool-btn" id="sxw-region-tool">Region…</button>
          <select class="sxw-region-armed" id="sxw-region-armed" style="display:none;">
            <option value="">— pick a region to assign —</option>
            <option value="__new__">+ New region from selected cell's terrain…</option>
          </select>
          <button class="sxw-tool-btn" id="sxw-path-tool">Path…</button>
          <button class="sxw-tool-btn" id="sxw-clear">Clear override</button>
          <span class="sxw-mode" id="sxw-mode">Mode: Select</span>
        </div>
      </div>
    `;
    document.body.appendChild(c);
    state.ctrl = c;

    const head = c.querySelector('.sxw-ctrl-header');
    head.addEventListener('mousedown', onCtrlDragStart);
    head.addEventListener('touchstart', onCtrlDragStart, { passive: false });
    c.querySelector('.sxw-reset-pos').addEventListener('click', resetCtrlPos);

    c.querySelector('#sxw-name').addEventListener('blur', persistFields);
    c.querySelector('#sxw-notes').addEventListener('blur', persistFields);
    c.querySelector('#sxw-feature-kind').addEventListener('change', persistFeature);
    c.querySelector('#sxw-feature-name').addEventListener('blur', persistFeature);
    c.querySelector('#sxw-feature-libid').addEventListener('blur', persistFeature);
    c.querySelector('#sxw-feature-notes').addEventListener('blur', persistFeature);
    c.querySelector('#sxw-region-pick').addEventListener('change', onRegionPickChange);
    c.querySelector('#sxw-region-name').addEventListener('blur', onRegionRename);
    c.querySelector('#sxw-clear').addEventListener('click', onClearOverride);
    c.querySelector('#sxw-region-tool').addEventListener('click', onRegionToolClick);
    c.querySelector('#sxw-region-armed').addEventListener('change', onRegionArmedChange);
    c.querySelector('#sxw-path-tool').addEventListener('click', onPathToolClick);
    c.querySelector('#sxw-path-armed').addEventListener('change', onPathArmedChange);
    c.querySelector('#sxw-path-undo').addEventListener('click', onPathUndoClick);
    c.querySelector('#sxw-path-rename').addEventListener('click', onPathRenameClick);
    c.querySelector('#sxw-path-delete').addEventListener('click', onPathDeleteClick);
    c.querySelector('#sxw-path-done').addEventListener('click', onPathDoneClick);

    try {
      const pos = JSON.parse(localStorage.getItem('gcc-subhex-controls-pos') || 'null');
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)){
        c.style.left = pos.x + 'px';
        c.style.top  = pos.y + 'px';
      }
      if (pos && Number.isFinite(pos.w) && pos.w >= 320){ c.style.width  = pos.w + 'px'; }
      if (pos && Number.isFinite(pos.h) && pos.h >= 280){ c.style.height = pos.h + 'px'; }
    } catch(e){}

    if (typeof ResizeObserver !== 'undefined'){
      let t = null;
      const ro = new ResizeObserver(() => {
        if (t) clearTimeout(t);
        t = setTimeout(persistCtrlRect, 200);
      });
      ro.observe(c);
    }

    return c;
  }

  function persistCtrlRect(){
    if (!state.ctrl) return;
    try {
      const rect = state.ctrl.getBoundingClientRect();
      const next = {
        x: rect.left, y: rect.top,
        w: Math.round(rect.width), h: Math.round(rect.height),
      };
      localStorage.setItem('gcc-subhex-controls-pos', JSON.stringify(next));
    } catch(e){}
  }

  function resetCtrlPos(){
    if (!state.ctrl) return;
    try { localStorage.removeItem('gcc-subhex-controls-pos'); } catch(e){}
    state.ctrl.style.left = '';
    state.ctrl.style.top  = '';
    state.ctrl.style.width  = '';
    state.ctrl.style.height = '';
    positionControlsBesideMap();
  }

  // Auto-position the controls window beside the map. Prefer the right
  // side; if there's not enough room, flip left; if neither fits, stack
  // below. Only used when the user has no persisted position yet.
  function positionControlsBesideMap(){
    if (!state.win || !state.ctrl) return;
    const hasPersisted = !!localStorage.getItem('gcc-subhex-controls-pos');
    if (hasPersisted) return;
    const map = state.win.getBoundingClientRect();
    // Force the controls to be measurable.
    const wasHidden = state.ctrl.style.display === 'none';
    if (wasHidden) state.ctrl.style.display = 'flex';
    const ctrl = state.ctrl.getBoundingClientRect();
    const cw = ctrl.width || 420;
    const ch = ctrl.height || 480;
    const gap = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = map.right + gap;
    let y = map.top;
    if (x + cw > vw - 10){
      x = map.left - cw - gap;
      if (x < 10){
        // Stack below the map
        x = map.left;
        y = map.bottom + gap;
        if (y + ch > vh - 10) y = Math.max(10, vh - ch - 10);
      }
    }
    if (y + ch > vh - 10) y = Math.max(10, vh - ch - 10);
    if (y < 10) y = 10;
    state.ctrl.style.left = x + 'px';
    state.ctrl.style.top  = y + 'px';
    state.ctrl.style.right = 'auto';
    if (wasHidden) state.ctrl.style.display = 'none';
  }

  function onCtrlDragStart(ev){
    if (ev.target.closest('.sxw-reset-pos')) return;
    ev.preventDefault();
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const rect = state.ctrl.getBoundingClientRect();
    state.ctrlDrag = { startX: evt.clientX, startY: evt.clientY };
    state.ctrlDragOffset = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    state.ctrl.style.right = 'auto';
    state.ctrl.style.bottom = 'auto';
    window.addEventListener('mousemove', onCtrlDragMove);
    window.addEventListener('mouseup', onCtrlDragEnd);
    window.addEventListener('touchmove', onCtrlDragMove, { passive: false });
    window.addEventListener('touchend',  onCtrlDragEnd);
  }
  function onCtrlDragMove(ev){
    if (!state.ctrlDrag) return;
    if (ev.preventDefault) ev.preventDefault();
    const evt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const raw = {
      x: evt.clientX - state.ctrlDragOffset.x,
      y: evt.clientY - state.ctrlDragOffset.y,
    };
    const { x, y } = clampCtrlPos(raw.x, raw.y);
    state.ctrl.style.left = x + 'px';
    state.ctrl.style.top  = y + 'px';
    state.ctrl.style.right = 'auto';
  }
  function onCtrlDragEnd(){
    if (!state.ctrlDrag) return;
    state.ctrlDrag = null;
    window.removeEventListener('mousemove', onCtrlDragMove);
    window.removeEventListener('mouseup', onCtrlDragEnd);
    window.removeEventListener('touchmove', onCtrlDragMove);
    window.removeEventListener('touchend',  onCtrlDragEnd);
    persistCtrlRect();
  }
  function clampCtrlPos(x, y){
    if (!state.ctrl) return { x, y };
    const KEEPVIS_X = 80;
    const HEADER_PAD = 4;
    const rect = state.ctrl.getBoundingClientRect();
    const w = rect.width || 420, h = rect.height || 480;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (x > vw - KEEPVIS_X) x = vw - KEEPVIS_X;
    if (x < KEEPVIS_X - w)  x = KEEPVIS_X - w;
    const HEADER_H = 32;
    if (y < HEADER_PAD) y = HEADER_PAD;
    if (y > vh - HEADER_H) y = vh - HEADER_H;
    return { x, y };
  }

  // Find an element by id, looking in both windows. Most field IDs now
  // live in the controls window; map-owned IDs (#sxw-svg, #sxw-svg-wrap,
  // #sxw-zoom-pct, #sxw-coord-bar) still live in the map window.
  function findEl(id){
    return state.win?.querySelector('#' + id) || state.ctrl?.querySelector('#' + id) || null;
  }

  // ── Zoom ───────────────────────────────────────────────────────────────
  function setZoom(newZoom, anchor){
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    if (z === state.zoom) return;
    const wrap = state.win?.querySelector('#sxw-svg-wrap');
    const svg  = state.win?.querySelector('#sxw-svg');
    if (!wrap || !svg) return;

    let scrollAdjust = null;
    if (anchor){
      const wrapRect = wrap.getBoundingClientRect();
      const localX = anchor.x - wrapRect.left + wrap.scrollLeft;
      const localY = anchor.y - wrapRect.top  + wrap.scrollTop;
      const ratio = z / state.zoom;
      scrollAdjust = {
        sl: localX * ratio - (anchor.x - wrapRect.left),
        st: localY * ratio - (anchor.y - wrapRect.top),
      };
    }

    state.zoom = z;
    applyZoom();
    if (scrollAdjust){
      wrap.scrollLeft = Math.max(0, scrollAdjust.sl);
      wrap.scrollTop  = Math.max(0, scrollAdjust.st);
    }
    persistWindowRect();
  }

  function zoomBy(factor){
    setZoom(state.zoom * factor);
  }

  function applyZoom(){
    const svg = state.win?.querySelector('#sxw-svg');
    const pct = state.win?.querySelector('#sxw-zoom-pct');
    if (svg){
      svg.style.width = `${state.zoom * 100}%`;
      svg.style.height = 'auto';
    }
    if (pct){
      pct.textContent = `${Math.round(state.zoom * 100)}%`;
    }
  }

  function onSvgWheel(ev){
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? ZOOM_STEP : (1 / ZOOM_STEP);
    setZoom(state.zoom * factor, { x: ev.clientX, y: ev.clientY });
  }

  function buildPalette(){
    const pal = findEl('sxw-palette');
    if (!pal || typeof TERRAIN === 'undefined') return;
    pal.innerHTML = '';
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
    const pal = findEl('sxw-feature-palette');
    if (!pal || !window.GCCSubhexIcons) return;
    pal.innerHTML = '';
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
    const sel = findEl('sxw-feature-kind');
    if (!sel || !window.GCCSubhexData) return;
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
    if (state.armed){
      const sel = findEl('sxw-region-armed');
      if (sel){ sel.style.display = 'none'; }
      const psel = findEl('sxw-path-armed');
      if (psel){ psel.style.display = 'none'; }
    }
    syncPaletteUI();
    syncModeLabel();
  }

  function syncPaletteUI(){
    if (!state.win) return;
    const cur = armKey(state.armed);
    state.ctrl.querySelectorAll('.sxw-swatch, .sxw-feature-btn').forEach(b => {
      b.classList.toggle('armed', b.dataset.armKey === cur);
    });
    const regionTool = findEl('sxw-region-tool');
    if (regionTool){
      const isRegion = state.armed && (state.armed.type === 'region' || state.armed.type === 'region-erase');
      regionTool.classList.toggle('armed', !!isRegion);
    }
    const pathTool = findEl('sxw-path-tool');
    if (pathTool){
      const isPath = state.armed && state.armed.type === 'path';
      pathTool.classList.toggle('armed', !!isPath);
    }
  }

  function syncModeLabel(){
    const el = findEl('sxw-mode');
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
      const region = window.GCCSubhexData.getRegion(a.value);
      const rname = region ? region.name : '(unknown)';
      el.textContent = `Mode: Assign to region · ${rname} · drag to brush`;
    } else if (a.type === 'region-erase'){
      el.textContent = 'Mode: Remove from region · click cells';
    } else if (a.type === 'path'){
      const path = window.GCCSubhexPaths?.getPath(a.value);
      const pname = path ? path.name : '(unknown)';
      const len = path ? path.cells.length : 0;
      el.textContent = `Mode: Extend path · ${pname} · ${len} cell${len===1?'':'s'} · click neighbor to extend, click own cell to truncate`;
    } else {
      const lbl = TERRAIN[a.value]?.label || a.value;
      el.textContent = `Mode: Paint · ${lbl} · drag to brush`;
    }
  }

  // Show a transient message in the mode label, then restore the
  // armed-state label after a short delay. Used to give feedback when
  // a click was received but no work was done (e.g. feature-erase on
  // a cell that has no feature).
  function flashMode(msg){
    const el = findEl('sxw-mode');
    if (!el) return;
    if (state._flashTimer) clearTimeout(state._flashTimer);
    el.textContent = `Mode: ${msg}`;
    el.classList.add('sxw-mode-flash');
    state._flashTimer = setTimeout(() => {
      el.classList.remove('sxw-mode-flash');
      syncModeLabel();
      state._flashTimer = null;
    }, 1600);
  }

  // ── Open / close ───────────────────────────────────────────────────────
  function open(col, row){
    ensureWindow();
    state.isOpen = true;
    state.parentCol = col;
    state.parentRow = row;
    state.parentId = (typeof hexIdStr === 'function') ? hexIdStr(col, row) : `${col}-${row}`;
    state.parentTerrain = (typeof getHexTerrain === 'function') ? getHexTerrain(col, row) : null;
    const center = window.GCCSubhexData.parentCenterAxial(col, row);
    state.parentQ = center.Q;
    state.parentR = center.R;
    state.selectedQ = null;
    state.selectedR = null;
    state.armed = null;
    state.markerHighlight = null;

    const lm = (typeof GCCLandmarks !== 'undefined') ? GCCLandmarks.getById(state.parentId) : null;
    const t = state.win.querySelector('.sxw-title');
    t.textContent = lm ? lm.name : 'Subhexes';
    const cb = state.win.querySelector('#sxw-coord-bar');
    if (cb) cb.textContent = state.parentId;
    const ctrlTitle = state.ctrl?.querySelector('.sxw-title');
    if (ctrlTitle) ctrlTitle.textContent = lm ? lm.name : 'Controls';
    const ctrlCb = state.ctrl?.querySelector('#sxw-ctrl-coord-bar');
    if (ctrlCb) ctrlCb.textContent = state.parentId;

    state.win.style.display = 'flex';
    const cur = state.win.getBoundingClientRect();
    const { x, y } = clampWindowPos(cur.left, cur.top);
    if (x !== cur.left || y !== cur.top){
      state.win.style.left = x + 'px';
      state.win.style.top  = y + 'px';
      state.win.style.right = 'auto';
    }
    if (state.ctrl){
      state.ctrl.style.display = 'flex';
      positionControlsBesideMap();
      const ctrlCur = state.ctrl.getBoundingClientRect();
      const cClamp = clampCtrlPos(ctrlCur.left, ctrlCur.top);
      if (cClamp.x !== ctrlCur.left || cClamp.y !== ctrlCur.top){
        state.ctrl.style.left = cClamp.x + 'px';
        state.ctrl.style.top  = cClamp.y + 'px';
        state.ctrl.style.right = 'auto';
      }
    }
    rebuildSVG();
    applyZoom();
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
    syncPathActionButtons();
  }

  function close(){
    if (!state.win) return;
    state.win.style.display = 'none';
    if (state.ctrl) state.ctrl.style.display = 'none';
    state.isOpen = false;
    state.parentCol = state.parentRow = null;
    state.parentQ = state.parentR = null;
    state.selectedQ = state.selectedR = null;
    state.armed = null;
    state.markerHighlight = null;
    if (state.brushing){
      state.brushing = false;
      state.brushedThisDrag = null;
      window.removeEventListener('mouseup', onBrushEnd);
    }
    const sel = findEl('sxw-region-armed');
    if (sel){ sel.style.display = 'none'; sel.value = ''; }
    const psel = findEl('sxw-path-armed');
    if (psel){ psel.style.display = 'none'; psel.value = ''; }
    syncPathActionButtons();
  }

  function isOpen(){ return state.isOpen; }
  function currentParent(){
    if (!state.isOpen) return null;
    return { col: state.parentCol, row: state.parentRow };
  }

  // ── Geometry: axial (Q, R) → viewport (x, y) ──────────────────────────
  // Map a global axial cell to viewport coords for the current parent
  // window. The parent's center subhex sits at the viewBox center.
  function cellViewport(Q, R){
    const dq = Q - state.parentQ;
    const dr = R - state.parentR;
    return {
      x: VIEWBOX_W / 2 + 1.5 * SUB_R * dq,
      y: VIEWBOX_H / 2 + SQRT3 * SUB_R * (dr + dq / 2),
    };
  }
  function cellCorners(Q, R){
    const c = cellViewport(Q, R);
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

  function cellDomId(Q, R){ return `sxw-cell-${Q}_${R}`; }

  // Build a single cell <g> and append to layer. fragmentInfo, when
  // provided, marks this as a fragment cell (owned by a different
  // parent) — class .fragment is added and dataset.owner records the
  // owning parent id for hint display.
  function buildCellGroup(Q, R, layer, fragmentInfo){
    const ns = 'http://www.w3.org/2000/svg';
    const sub = window.GCCSubhexData.getSubhex(Q, R, fragmentInfo
      ? (typeof getHexTerrain === 'function' ? getHexTerrain(fragmentInfo.ownerCol, fragmentInfo.ownerRow) : state.parentTerrain)
      : state.parentTerrain);
    const c = cellViewport(Q, R);
    const corners = cellCorners(Q, R);
    const pts = corners.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'sxw-cell-group' + (fragmentInfo ? ' sxw-cell-group-fragment' : ''));
    group.id = cellDomId(Q, R);
    group.dataset.q = Q;
    group.dataset.r = R;
    if (fragmentInfo){
      group.dataset.fragment = '1';
      group.dataset.ownerCol = fragmentInfo.ownerCol;
      group.dataset.ownerRow = fragmentInfo.ownerRow;
    }

    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', pts);
    let cls = 'sxw-cell';
    if (fragmentInfo) cls += ' fragment';
    if (sub.source === 'authored') cls += ' authored';
    if (Q === state.selectedQ && R === state.selectedR) cls += ' selected';
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
      window.GCCSubhexIcons.append(terrainG, sub.terrain, c.x, c.y, SUB_R, Q, R);
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
    layer.appendChild(group);
  }

  function rebuildSVG(){
    const svg = state.win.querySelector('#sxw-svg');
    if (!svg) return;
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    const pCorners = parentCorners();
    const pPts = pCorners.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    // Fragment layer: cells whose centers are in neighbor parents but
    // whose hexes overlap this parent silhouette. Drawn first so owned
    // cells paint over them at any seam. Not clipped — fragments
    // render their full hex shape extending beyond the parent boundary
    // so the GM can see exactly how they bridge into neighbor parents.
    const fragLayer = document.createElementNS(ns, 'g');
    fragLayer.setAttribute('class', 'sxw-fragment-layer');
    const fragments = window.GCCSubhexData.fragmentsForParent(state.parentCol, state.parentRow);
    for (const f of fragments){
      buildCellGroup(f.Q, f.R, fragLayer, { ownerCol: f.ownerCol, ownerRow: f.ownerRow });
    }
    svg.appendChild(fragLayer);

    // Owned cells (~100 per parent).
    const ownedLayer = document.createElementNS(ns, 'g');
    ownedLayer.setAttribute('class', 'sxw-owned-layer');
    const owned = window.GCCSubhexData.ownedByParent(state.parentCol, state.parentRow);
    for (const { Q, R } of owned){
      buildCellGroup(Q, R, ownedLayer, null);
    }
    svg.appendChild(ownedLayer);

    // Parent hex outline, painted on top.
    const pOutline = document.createElementNS(ns, 'polygon');
    pOutline.setAttribute('points', pPts);
    pOutline.setAttribute('class', 'sxw-parent-outline');
    svg.appendChild(pOutline);

    renderPaths(svg);
    renderRegionLabels(svg);
    renderParentPathMarkers(svg);
    renderCrossings(svg);
  }

  // Render small colored dots on boundary subhexes where a 30-mile
  // parent-level path (river/road/track) crosses into a neighbor
  // parent. Markers sit ~50% offset from cell center toward the parent
  // edge, so the GM can see at a glance which side of this parent the
  // path heads to. Native SVG <title> child carries the path name +
  // neighbor parent label as a hover tooltip.
  function renderParentPathMarkers(svg){
    if (!window.GCCPaths) return;
    svg.querySelectorAll('.sxw-parent-path-markers').forEach(n => n.remove());
    const segments = window.GCCPaths.segmentsAt(state.parentCol, state.parentRow);
    if (!segments || !segments.length) return;
    const owned = window.GCCSubhexData.ownedByParent(state.parentCol, state.parentRow);
    if (!owned.length) return;

    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-parent-path-markers');

    for (let segIndex = 0; segIndex < segments.length; segIndex++){
      const seg = segments[segIndex];
      const color = pathMarkerColor(seg);
      if (!color) continue;
      // entryEdge and exitEdge each get their own marker (open ends are
      // -1 — path source/mouth/terminus, no boundary crossing there).
      for (const edgeKey of ['entryEdge', 'exitEdge']){
        const edge = seg[edgeKey];
        if (typeof edge !== 'number' || edge < 0 || edge > 5) continue;
        placeMarker(layer, seg, edge, owned, color, segIndex);
      }
    }
    svg.appendChild(layer);
  }

  function pathMarkerColor(seg){
    if (seg.kind === 'river') return '#378ADD';
    if (seg.kind === 'road')  return '#8b5a2b';
    if (seg.kind === 'track') return '#c8a06f';
    return null;
  }

  function edgeMidpoint(edge){
    const cx = VIEWBOX_W / 2, cy = VIEWBOX_H / 2;
    const a1 = (Math.PI / 180) * (60 * ((edge + 4) % 6));
    const a2 = (Math.PI / 180) * (60 * ((edge + 5) % 6));
    return {
      x: cx + PARENT_R * (Math.cos(a1) + Math.cos(a2)) / 2,
      y: cy + PARENT_R * (Math.sin(a1) + Math.sin(a2)) / 2,
    };
  }

  // Find the owned subhex closest to the midpoint of a given parent
  // edge. The marker for that edge sits on this cell; the click-to-
  // author destination check uses it to detect when an authored path
  // has reached the boundary.
  function boundaryCellForEdge(edge, owned){
    const mid = edgeMidpoint(edge);
    let best = null, bestD = Infinity;
    for (const cell of owned){
      const v = cellViewport(cell.Q, cell.R);
      const dx = v.x - mid.x, dy = v.y - mid.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD){ bestD = d2; best = cell; }
    }
    return best;
  }

  // Authored-aware boundary cell: when the GM has drawn a subhex path
  // matching this parent segment that actually crosses the parent
  // edge, return the cell on this side of that crossing — so the
  // parent-path marker visually sits where the authored road/river
  // meets the boundary, instead of on the geometric midpoint.
  // Returns null if no matching authored crossing exists; callers
  // fall back to boundaryCellForEdge(...).
  function authoredBoundaryCellForSegment(seg, edge, owned){
    if (!window.GCCSubhexPaths || !seg.name) return null;
    if (!window.GCCSubhexData) return null;
    if (typeof window.GCCPaths?.neighborAcross !== 'function') return null;
    const nbParent = window.GCCPaths.neighborAcross(state.parentCol, state.parentRow, edge);
    if (!nbParent) return null;
    const D = window.GCCSubhexData;
    const NEIGHBORS = D.NEIGHBOR_DELTAS || [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    // Candidate cells: owned cells of this parent that sit on the
    // edge toward nbParent (i.e., have an axial neighbor owned by
    // nbParent). Building this list lets us check each as a possible
    // crossing cell.
    const edgeCells = [];
    for (const c of owned){
      for (const [dq, dr] of NEIGHBORS){
        const owner = D.ownerOf(c.Q + dq, c.R + dr);
        if (owner && owner.col === nbParent.col && owner.row === nbParent.row){
          edgeCells.push(c);
          break;
        }
      }
    }
    if (!edgeCells.length) return null;
    // Find a subhex path that matches the segment by kind+name and
    // includes one of the edge cells. Pick that cell as the marker
    // anchor. If multiple edge cells qualify (path zigzags along the
    // boundary), prefer the one closest to the midpoint so the
    // marker still feels "on the edge" rather than at a corner.
    const paths = window.GCCSubhexPaths.listPaths();
    let bestCell = null, bestD = Infinity;
    const mid = edgeMidpoint(edge);
    for (const p of paths){
      if (p.kind !== seg.kind) continue;
      if (p.name !== seg.name) continue;
      if (!p.cells || !p.cells.length) continue;
      const cellSet = new Set(p.cells.map(c => `${c.Q}_${c.R}`));
      for (const ec of edgeCells){
        if (!cellSet.has(`${ec.Q}_${ec.R}`)) continue;
        const v = cellViewport(ec.Q, ec.R);
        const dx = v.x - mid.x, dy = v.y - mid.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD){ bestD = d2; bestCell = ec; }
      }
    }
    return bestCell;
  }

  function placeMarker(layer, seg, edge, owned, color, segIndex){
    // Prefer the cell where an authored subhex path actually crosses
    // this parent edge. Falls back to the geometric midpoint cell
    // when nothing is authored yet.
    const authoredCell = authoredBoundaryCellForSegment(seg, edge, owned);
    const best = authoredCell || boundaryCellForEdge(edge, owned);
    if (!best) return;
    const mid = edgeMidpoint(edge);
    const cellPos = cellViewport(best.Q, best.R);
    let dx = mid.x - cellPos.x, dy = mid.y - cellPos.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    let mx = cellPos.x, my = cellPos.y;
    if (len > 0){
      const offset = SUB_R * 0.5;
      mx = cellPos.x + dx * (offset / len);
      my = cellPos.y + dy * (offset / len);
    }
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    const isEntry = edge === seg.entryEdge;
    const authoredId = findSubhexPathForSegment(seg, best.Q, best.R);
    let cls = `sxw-parent-path-marker sxw-ppm-${seg.kind}`;
    if (authoredId) cls += ' authored';
    if (state.markerHighlight && state.markerHighlight.segIndex === segIndex
        && state.markerHighlight.edge !== edge){
      // The OTHER end of the segment we just started authoring.
      cls += ' destination';
    }
    g.setAttribute('class', cls);
    g.dataset.segIndex = segIndex;
    g.dataset.edge = edge;
    g.dataset.kind = seg.kind;
    g.dataset.name = seg.name || '';
    g.dataset.cellQ = best.Q;
    g.dataset.cellR = best.R;
    g.dataset.end = isEntry ? 'entry' : 'exit';
    if (authoredId) g.dataset.authoredPath = authoredId;
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', mx.toFixed(1));
    circle.setAttribute('cy', my.toFixed(1));
    circle.setAttribute('r', '4.5');
    circle.setAttribute('fill', color);
    g.appendChild(circle);
    const title = document.createElementNS(ns, 'title');
    title.textContent = pathMarkerTooltip(seg, edge, !!authoredId);
    g.appendChild(title);
    g.addEventListener('click', onParentPathMarkerClick);
    layer.appendChild(g);
  }

  function pathMarkerTooltip(seg, edge, authored){
    const neighbor = (typeof window.GCCPaths.neighborAcross === 'function')
      ? window.GCCPaths.neighborAcross(state.parentCol, state.parentRow, edge)
      : null;
    const neighborLabel = (neighbor && typeof hexIdStr === 'function')
      ? hexIdStr(neighbor.col, neighbor.row)
      : (neighbor ? `${neighbor.col},${neighbor.row}` : '?');
    const name = seg.name || '(unnamed)';
    const verb = authored ? ' [authored — click to extend]' : ' [click to author]';
    return `${name} (${seg.kind}) → ${neighborLabel}${verb}`;
  }

  // Look up the subhex path (if any) that already authors this parent
  // segment crossing. Match by name AND a cell at the boundary subhex.
  // Returns the subhex path id, or null.
  function findSubhexPathForSegment(seg, boundaryQ, boundaryR){
    if (!window.GCCSubhexPaths || !seg.name) return null;
    const paths = window.GCCSubhexPaths.listPaths();
    for (const p of paths){
      if (p.kind !== seg.kind) continue;
      if (p.name !== seg.name) continue;
      if (!p.cells || !p.cells.length) continue;
      for (const c of p.cells){
        if (c.Q === boundaryQ && c.R === boundaryR) return p.id;
      }
    }
    return null;
  }

  // Click on a parent-path marker: create (or arm) a subhex path
  // matching this parent crossing. Pre-fills name and kind, anchors
  // the path's first cell at the marker's boundary subhex, arms the
  // Path tool, and highlights the segment's other-end marker as the
  // destination so the GM can see where to draw to.
  function onParentPathMarkerClick(ev){
    ev.stopPropagation();
    const g = ev.currentTarget;
    const segIndex = +g.dataset.segIndex;
    const edge     = +g.dataset.edge;
    const kind     = g.dataset.kind;
    const name     = g.dataset.name || '(unnamed)';
    const Q = +g.dataset.cellQ, R = +g.dataset.cellR;
    const authoredId = g.dataset.authoredPath;

    let pathId;
    if (authoredId){
      // Already authored — just arm it for extension.
      pathId = authoredId;
    } else {
      // Create a new subhex path with matching kind + name, anchored
      // at the boundary cell.
      const newPath = window.GCCSubhexPaths.createPath(kind, name);
      if (!newPath){
        if (typeof console !== 'undefined') console.warn('[subhex-view] failed to create path for marker', { kind, name });
        return;
      }
      window.GCCSubhexPaths.appendCell(newPath.id, Q, R);
      pathId = newPath.id;
    }

    state.armed = { type: 'path', value: pathId };
    state.markerHighlight = { segIndex, edge };
    rebuildPathArmedPicker();
    showPathArmedPicker(true, pathId);
    showRegionArmedPicker(false);
    // Re-render paths and markers so the new path appears + the
    // destination marker gets the highlight class.
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){
      renderPaths(svg);
      renderParentPathMarkers(svg);
      renderCrossings(svg);
    }
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
    syncPathActionButtons();
  }

  // ── Crossings ──────────────────────────────────────────────────────────
  // A crossing is a subhex cell that sits on 2+ paths. The view scans
  // owned cells against all paths in the parent and renders a small
  // "×" badge in the cell's upper-right corner. Clicking the badge
  // pops a kind picker (Bridge / Ford / Ferry / Crossroads / Dismiss),
  // which writes the chosen feature to the cell. Dismiss adds the
  // cell to a per-parent suppression set so the badge doesn't return
  // for the same path-pair. If the cell already has a feature, no
  // badge renders. If the path mix changes, the suppression for that
  // pair stops applying (we key suppression on the sorted path-id
  // pair).

  const CROSSING_DISMISS_KEY = 'gcc-subhex-crossings-dismissed';

  function loadDismissedCrossings(){
    try {
      return JSON.parse(localStorage.getItem(CROSSING_DISMISS_KEY) || '{}');
    } catch(e){ return {}; }
  }
  function saveDismissedCrossings(map){
    try { localStorage.setItem(CROSSING_DISMISS_KEY, JSON.stringify(map)); } catch(e){}
  }
  function dismissKey(Q, R, pathIds){
    const sorted = [...pathIds].sort();
    return `${Q}_${R}|${sorted.join('|')}`;
  }

  // Build a list of crossing records for the active parent. Each:
  //   { Q, R, paths: [{id, kind, name}, ...] }
  // Only owned cells are considered. Cells already authored with a
  // feature, or dismissed for this exact path-set, are excluded.
  function detectCrossings(){
    if (!window.GCCSubhexPaths) return [];
    const paths = window.GCCSubhexPaths.pathsInParent(state.parentCol, state.parentRow);
    if (paths.length < 2) return [];
    // Bucket: cell key -> list of paths touching it
    const byCell = new Map();
    for (const p of paths){
      if (!p.cells) continue;
      const seen = new Set();
      for (const c of p.cells){
        const k = `${c.Q}_${c.R}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (!byCell.has(k)) byCell.set(k, []);
        byCell.get(k).push(p);
      }
    }
    const owned = window.GCCSubhexData.ownedByParent(state.parentCol, state.parentRow);
    const ownedSet = new Set(owned.map(c => `${c.Q}_${c.R}`));
    const dismissed = loadDismissedCrossings();
    const out = [];
    for (const [key, plist] of byCell){
      if (plist.length < 2) continue;
      if (!ownedSet.has(key)) continue;
      // Skip pure water-meets-water confluences. A river joining
      // another river isn't a "crossing" — it's geography. The ×
      // badge concept is for two transportation modes intersecting
      // (road×river = bridge, road×road = crossroads). When all
      // paths at a cell are rivers/streams, suppress the badge.
      const allWater = plist.every(p => p.kind === 'river' || p.kind === 'stream');
      if (allWater) continue;
      const [Q, R] = key.split('_').map(Number);
      const sub = window.GCCSubhexData.getSubhex(Q, R, state.parentTerrain);
      if (sub && sub.feature && sub.feature.kind) continue;
      const dKey = dismissKey(Q, R, plist.map(p => p.id));
      if (dismissed[dKey]) continue;
      out.push({ Q, R, paths: plist });
    }
    return out;
  }

  function renderCrossings(svg){
    svg.querySelectorAll('.sxw-crossings-layer').forEach(n => n.remove());
    const crossings = detectCrossings();
    if (!crossings.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-crossings-layer');
    for (const x of crossings){
      const c = cellViewport(x.Q, x.R);
      const bx = c.x + SUB_R * 0.55;
      const by = c.y - SUB_R * 0.55;
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'sxw-crossing-badge');
      g.dataset.q = x.Q;
      g.dataset.r = x.R;
      g.dataset.pathIds = x.paths.map(p => p.id).join(',');
      g.dataset.pathKinds = x.paths.map(p => p.kind).join(',');
      g.dataset.pathNames = x.paths.map(p => p.name || '').join('||');
      const bg = document.createElementNS(ns, 'circle');
      bg.setAttribute('cx', bx.toFixed(1));
      bg.setAttribute('cy', by.toFixed(1));
      bg.setAttribute('r', '5.5');
      bg.setAttribute('class', 'sxw-crossing-badge-bg');
      g.appendChild(bg);
      const x1 = document.createElementNS(ns, 'line');
      x1.setAttribute('x1', (bx - 3).toFixed(1));
      x1.setAttribute('y1', (by - 3).toFixed(1));
      x1.setAttribute('x2', (bx + 3).toFixed(1));
      x1.setAttribute('y2', (by + 3).toFixed(1));
      x1.setAttribute('class', 'sxw-crossing-badge-x');
      g.appendChild(x1);
      const x2 = document.createElementNS(ns, 'line');
      x2.setAttribute('x1', (bx - 3).toFixed(1));
      x2.setAttribute('y1', (by + 3).toFixed(1));
      x2.setAttribute('x2', (bx + 3).toFixed(1));
      x2.setAttribute('y2', (by - 3).toFixed(1));
      x2.setAttribute('class', 'sxw-crossing-badge-x');
      g.appendChild(x2);
      const tip = document.createElementNS(ns, 'title');
      const names = x.paths.map(p => p.name || `(${p.kind})`).join(' × ');
      tip.textContent = `Crossing: ${names} — click to add feature`;
      g.appendChild(tip);
      g.addEventListener('click', onCrossingBadgeClick);
      layer.appendChild(g);
    }
    svg.appendChild(layer);
  }

  // Decide which feature kinds make sense for this crossing's path
  // mix. Returns an array of kinds in display order. The picker also
  // always offers "Dismiss" (handled separately in the menu render).
  function suggestedCrossingKinds(pathKinds){
    const kinds = new Set(pathKinds);
    const hasRiver = kinds.has('river');
    const hasRoad  = kinds.has('road');
    const hasTrack = kinds.has('track');
    if (hasRiver && (hasRoad || hasTrack)){
      return ['bridge', 'ford', 'ferry'];
    }
    if (hasRoad && hasTrack){
      return ['crossroads'];
    }
    if (hasRoad && kinds.size === 1 && pathKinds.length >= 2){
      // Two roads meeting
      return ['crossroads'];
    }
    if (hasTrack && kinds.size === 1 && pathKinds.length >= 2){
      return ['crossroads'];
    }
    if (hasRiver && kinds.size === 1 && pathKinds.length >= 2){
      // Two rivers meeting — a confluence. detectCrossings now
      // suppresses these so this branch is unreachable from the
      // normal click flow, but kept as a defensive fallback in case
      // suggestedCrossingKinds is called directly with such input.
      // Returns landmark since that's the closest sensible offer.
      return ['landmark'];
    }
    return ['landmark'];
  }

  function onCrossingBadgeClick(ev){
    ev.stopPropagation();
    const g = ev.currentTarget;
    const Q = +g.dataset.q;
    const R = +g.dataset.r;
    const pathIds   = g.dataset.pathIds.split(',');
    const pathKinds = g.dataset.pathKinds.split(',');
    const pathNames = g.dataset.pathNames.split('||');
    const kinds = suggestedCrossingKinds(pathKinds);
    showCrossingMenu(g, Q, R, pathIds, pathKinds, pathNames, kinds);
  }

  // Pop a small overlay menu next to the badge offering kind chips
  // + Dismiss. The menu is an HTML <div> overlaid on the SVG via the
  // controls window's container — but since the SVG lives in a
  // separate window from the controls, simplest is to render the
  // menu as a foreignObject inside the SVG itself, anchored at the
  // badge position. Picking a kind writes the feature; Dismiss
  // records the suppression.
  function showCrossingMenu(badge, Q, R, pathIds, pathKinds, pathNames, kinds){
    const svg = state.win?.querySelector('#sxw-svg');
    if (!svg) return;
    svg.querySelectorAll('.sxw-crossing-menu').forEach(n => n.remove());
    const ns = 'http://www.w3.org/2000/svg';
    const c = cellViewport(Q, R);
    const mx = c.x + SUB_R * 0.55;
    const my = c.y - SUB_R * 0.55;
    const fo = document.createElementNS(ns, 'foreignObject');
    fo.setAttribute('class', 'sxw-crossing-menu');
    const W = 160, H = 30 + 28 * (kinds.length + 1);
    // Try to place to the right of the badge; flip left if close to viewBox edge.
    const place = (mx + 8 + W < VIEWBOX_W) ? mx + 8 : mx - W - 8;
    const placeY = (my + H < VIEWBOX_H) ? my : Math.max(8, VIEWBOX_H - H - 8);
    fo.setAttribute('x', place.toFixed(1));
    fo.setAttribute('y', placeY.toFixed(1));
    fo.setAttribute('width', W);
    fo.setAttribute('height', H);
    const html = document.createElement('div');
    html.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    html.className = 'sxw-crossing-menu-body';
    const hint = document.createElement('div');
    hint.className = 'sxw-crossing-menu-hint';
    hint.textContent = pathNames.filter(n => n).join(' × ') || 'Crossing';
    html.appendChild(hint);
    for (const kind of kinds){
      const btn = document.createElement('button');
      btn.className = 'sxw-crossing-menu-btn';
      btn.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyCrossingFeature(Q, R, kind, pathKinds, pathNames);
        closeCrossingMenu();
      });
      html.appendChild(btn);
    }
    const dismiss = document.createElement('button');
    dismiss.className = 'sxw-crossing-menu-btn sxw-crossing-menu-btn-dismiss';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      const dismissed = loadDismissedCrossings();
      dismissed[dismissKey(Q, R, pathIds)] = 1;
      saveDismissedCrossings(dismissed);
      closeCrossingMenu();
      const svgInner = state.win?.querySelector('#sxw-svg');
      if (svgInner) renderCrossings(svgInner);
    });
    html.appendChild(dismiss);
    fo.appendChild(html);
    svg.appendChild(fo);
    // Close on outside click — register a one-shot global listener.
    setTimeout(() => {
      const off = (e) => {
        if (!fo.contains || (e.target && !fo.contains(e.target))){
          closeCrossingMenu();
          window.removeEventListener('mousedown', off, true);
        }
      };
      window.addEventListener('mousedown', off, true);
    }, 0);
  }

  function closeCrossingMenu(){
    const svg = state.win?.querySelector('#sxw-svg');
    if (!svg) return;
    svg.querySelectorAll('.sxw-crossing-menu').forEach(n => n.remove());
  }

  // Compose a default name for the crossing feature based on the
  // paths it bridges. Returns e.g. "Bridge over Selintan",
  // "Ford on the Old Coast Road", "Crossroads of X and Y".
  function crossingName(kind, pathKinds, pathNames){
    const named = [];
    for (let i = 0; i < pathKinds.length; i++){
      if (pathNames[i]) named.push({ kind: pathKinds[i], name: pathNames[i] });
    }
    if (kind === 'bridge'){
      const river = named.find(p => p.kind === 'river');
      if (river) return `Bridge over ${river.name}`;
      return 'Bridge';
    }
    if (kind === 'ford'){
      const river = named.find(p => p.kind === 'river');
      if (river) return `Ford on ${river.name}`;
      return 'Ford';
    }
    if (kind === 'ferry'){
      const river = named.find(p => p.kind === 'river');
      if (river) return `Ferry across ${river.name}`;
      return 'Ferry';
    }
    if (kind === 'crossroads'){
      if (named.length >= 2){
        return `Crossroads of ${named[0].name} and ${named[1].name}`;
      }
      return 'Crossroads';
    }
    if (kind === 'landmark' && named.length >= 2){
      const allRivers = named.every(p => p.kind === 'river');
      if (allRivers) return `Confluence of ${named[0].name} and ${named[1].name}`;
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  function applyCrossingFeature(Q, R, kind, pathKinds, pathNames){
    const name = crossingName(kind, pathKinds, pathNames);
    window.GCCSubhexData.setSubhexFeature(Q, R, { kind, name });
    applyCellPaint(Q, R);
    if (Q === state.selectedQ && R === state.selectedR) syncDetailPanel();
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderCrossings(svg);
  }

  // Render every path that touches this parent as a polyline through
  // cell centers via shared-edge midpoints.
  function renderPaths(svg){
    if (!window.GCCSubhexPaths) return;
    svg.querySelectorAll('.sxw-paths-layer').forEach(n => n.remove());
    const paths = window.GCCSubhexPaths.pathsInParent(state.parentCol, state.parentRow);
    if (!paths.length){
      // No path cells in this parent — but if a path is armed and has
      // cells in a neighbor parent, render a ghost marker on this
      // parent's boundary cell so the GM can see where to click to
      // continue.
      renderArmedPathGhost(svg);
      return;
    }
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-paths-layer');
    for (const p of paths){
      if (!p.cells || p.cells.length < 1) continue;
      const pts = pathPolylinePoints(p.cells);
      if (pts.length < 2){
        const c = cellViewport(p.cells[0].Q, p.cells[0].R);
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
      if (state.armed && state.armed.type === 'path' && state.armed.value === p.id){
        poly.classList.add('armed');
      }
      layer.appendChild(poly);
    }
    svg.appendChild(layer);
    // Always also evaluate ghost rendering — it handles the case where
    // an armed path has cells in this parent AND neighbors. (When the
    // path's last cell lies in a neighbor, we still want a ghost in
    // this parent showing where to extend.)
    renderArmedPathGhost(svg);
  }

  // When a path is armed but has no rendered glyphs in the current
  // parent (or its last cell lies in a neighbor parent), draw a
  // pulsing colored dot on this parent's boundary cell that is
  // axially adjacent to the path's last-authored cell. Tells the GM
  // "click here to continue the path into this parent" — mirrors
  // the existing destination-marker treatment for parent-path
  // click-to-author. No-op when no path is armed or the path has no
  // cells anywhere.
  function renderArmedPathGhost(svg){
    svg.querySelectorAll('.sxw-armed-ghost-layer').forEach(n => n.remove());
    if (!state.armed || state.armed.type !== 'path') return;
    const armed = window.GCCSubhexPaths.getPath(state.armed.value);
    if (!armed || !armed.cells || armed.cells.length === 0) return;
    const last = armed.cells[armed.cells.length - 1];
    const lastOwner = window.GCCSubhexData.ownerOf(last.Q, last.R);
    // If the last cell is in this parent, no ghost — the regular
    // path renderer already shows the live tip the GM can extend
    // from. Ghosts are specifically for "the path is somewhere
    // else, here's where to pick it up."
    if (lastOwner && lastOwner.col === state.parentCol && lastOwner.row === state.parentRow){
      return;
    }
    // Find a neighbor of the last cell that is owned by this parent.
    // That cell is the GM's click target. Use the same axial neighbor
    // offsets the data layer uses for adjacency.
    const NEIGHBORS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    let target = null;
    for (const [dq, dr] of NEIGHBORS){
      const cQ = last.Q + dq, cR = last.R + dr;
      const o = window.GCCSubhexData.ownerOf(cQ, cR);
      if (o && o.col === state.parentCol && o.row === state.parentRow){
        target = { Q: cQ, R: cR };
        break;
      }
    }
    if (!target) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-armed-ghost-layer');
    const c = cellViewport(target.Q, target.R);
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', c.x);
    dot.setAttribute('cy', c.y);
    dot.setAttribute('r', 5);
    dot.setAttribute('class', `sxw-armed-ghost sxw-path-${armed.kind}`);
    dot.dataset.pathId = armed.id;
    layer.appendChild(dot);
    svg.appendChild(layer);
  }

  function pathPolylinePoints(cells){
    if (!cells || !cells.length) return [];
    if (cells.length === 1){
      const c = cellViewport(cells[0].Q, cells[0].R);
      return [[c.x, c.y]];
    }
    const pts = [];
    const first = cellViewport(cells[0].Q, cells[0].R);
    pts.push([first.x, first.y]);
    for (let i = 0; i < cells.length - 1; i++){
      const a = cellViewport(cells[i].Q, cells[i].R);
      const b = cellViewport(cells[i+1].Q, cells[i+1].R);
      pts.push([(a.x + b.x) / 2, (a.y + b.y) / 2]);
    }
    const last = cellViewport(cells[cells.length-1].Q, cells[cells.length-1].R);
    pts.push([last.x, last.y]);
    return pts;
  }

  // Drop a centered text label on each region with ≥3 members across
  // the world AND ≥1 member in this parent. Centroid is the average
  // of all member centers in viewport coords (so labels can sit near
  // the parent boundary if a region is mostly in a neighbor).
  function renderRegionLabels(svg){
    if (!window.GCCSubhexData) return;
    svg.querySelectorAll('.sxw-region-label-layer').forEach(n => n.remove());
    const regions = window.GCCSubhexData.regionsInParent(state.parentCol, state.parentRow);
    if (!regions.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.setAttribute('class', 'sxw-region-label-layer');
    for (const region of regions){
      const members = window.GCCSubhexData.regionMembers(region.id);
      if (members.length < 3) continue;
      let sx = 0, sy = 0;
      for (const { Q, R } of members){
        const c = cellViewport(Q, R);
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

  // Repaint a single cell in place (terrain / feature / authored
  // marker) without rebuilding the whole SVG. Works for both owned
  // and fragment cells.
  function applyCellPaint(Q, R){
    const group = document.getElementById(cellDomId(Q, R));
    if (!group) return;
    const isFragment = group.dataset.fragment === '1';
    const fragTerrain = isFragment
      ? (typeof getHexTerrain === 'function'
          ? getHexTerrain(+group.dataset.ownerCol, +group.dataset.ownerRow)
          : state.parentTerrain)
      : state.parentTerrain;
    const sub = window.GCCSubhexData.getSubhex(Q, R, fragTerrain);
    const poly = group.querySelector('.sxw-cell');
    if (!poly) return;
    if (sub.terrain && TERRAIN[sub.terrain]?.rgb){
      poly.setAttribute('fill', `rgb(${TERRAIN[sub.terrain].rgb})`);
    } else {
      poly.setAttribute('fill', '#d8c890');
    }
    poly.classList.toggle('authored', sub.source === 'authored');
    group.querySelectorAll('.sxw-terrain-layer, .sxw-feature-layer').forEach(n => n.remove());
    if (window.GCCSubhexIcons){
      const ns = 'http://www.w3.org/2000/svg';
      const c = cellViewport(Q, R);
      const terrainG = document.createElementNS(ns, 'g');
      terrainG.setAttribute('class', 'sxw-terrain-layer');
      window.GCCSubhexIcons.append(terrainG, sub.terrain, c.x, c.y, SUB_R, Q, R);
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
  function onCellMouseDown(ev){
    if (ev.button !== undefined && ev.button !== 0) return;
    if (!state.armed) return;
    ev.preventDefault();
    ev.stopPropagation();
    const Q = +ev.currentTarget.dataset.q;
    const R = +ev.currentTarget.dataset.r;
    if (state.armed.type !== 'path'){
      state.brushing = true;
      state.brushedThisDrag = new Set();
    }
    paintCell(Q, R, ev.currentTarget);
    if (state.brushing) window.addEventListener('mouseup', onBrushEnd);
  }

  function onCellMouseEnter(ev){
    const g = ev.currentTarget;
    const parent = g.parentNode;
    if (parent && parent.lastChild !== g) parent.appendChild(g);
    if (!state.brushing) return;
    const Q = +g.dataset.q;
    const R = +g.dataset.r;
    paintCell(Q, R, g);
  }

  function onBrushEnd(){
    state.brushing = false;
    state.brushedThisDrag = null;
    window.removeEventListener('mouseup', onBrushEnd);
  }

  // Resolve the parent terrain to use when reading/writing this cell
  // — for fragments, that's the owner's terrain; for owned cells, our
  // own parent's terrain.
  function effectiveParentTerrainFor(group){
    if (!group) return state.parentTerrain;
    if (group.dataset.fragment === '1'){
      return (typeof getHexTerrain === 'function')
        ? getHexTerrain(+group.dataset.ownerCol, +group.dataset.ownerRow)
        : state.parentTerrain;
    }
    return state.parentTerrain;
  }

  function paintCell(Q, R, group){
    const key = `${Q}_${R}`;
    if (state.brushedThisDrag && state.brushedThisDrag.has(key)) return;
    if (state.brushedThisDrag) state.brushedThisDrag.add(key);
    const a = state.armed;
    if (!a) return;
    const pTerrain = effectiveParentTerrainFor(group);
    if (a.type === 'erase'){
      window.GCCSubhexData.setSubhexOverride(Q, R, { terrain: null });
    } else if (a.type === 'terrain'){
      window.GCCSubhexData.setSubhexOverride(Q, R, { terrain: a.value });
    } else if (a.type === 'feature'){
      const existing = window.GCCSubhexData.getSubhex(Q, R, pTerrain);
      const prior = existing && existing.feature;
      const next = (prior && prior.kind === a.value) ? prior : { kind: a.value };
      window.GCCSubhexData.setSubhexFeature(Q, R, next);
    } else if (a.type === 'feature-erase'){
      const existing = window.GCCSubhexData.getSubhex(Q, R, pTerrain);
      const hadFeature = existing && existing.feature && existing.feature.kind;
      window.GCCSubhexData.clearSubhexFeature(Q, R);
      if (!hadFeature){
        // The cell had no feature — most likely the user mistook a
        // path stamp for a feature. Briefly flash the mode label so
        // they know the click was received and there was nothing to
        // erase.
        flashMode('No feature here — paths use the Path tool');
      }
    } else if (a.type === 'region'){
      window.GCCSubhexData.assignCellToRegion(Q, R, a.value, pTerrain);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg) renderRegionLabels(svg);
    } else if (a.type === 'region-erase'){
      window.GCCSubhexData.unassignCellFromRegion(Q, R);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg) renderRegionLabels(svg);
    } else if (a.type === 'path'){
      if (state.brushing) return;
      // If the clicked cell is already part of the armed path, treat
      // the click as "remove this cell and everything after it." This
      // is the natural inverse of append — re-clicking a cell you
      // previously laid down erases it. If the cell is NOT already on
      // the path, append normally.
      const armedPath = window.GCCSubhexPaths.getPath(a.value);
      const onArmed = armedPath && armedPath.cells.some(c => c.Q === Q && c.R === R);
      if (onArmed){
        window.GCCSubhexPaths.truncateBefore(a.value, Q, R);
        const svg = state.win?.querySelector('#sxw-svg');
        if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
        rebuildPathArmedPicker();
        const psel = findEl('sxw-path-armed');
        if (psel) psel.value = a.value;
        syncModeLabel();
        applyCellPaint(Q, R);
        if (Q === state.selectedQ && R === state.selectedR) syncDetailPanel();
        return;
      }
      const ok = window.GCCSubhexPaths.appendCell(a.value, Q, R);
      if (!ok){
        // appendCell rejected. The two reasons it returns false at this
        // point: (1) the click was on the last cell of the path — but
        // we've already handled that via the truncate branch above, so
        // we won't reach here for that case. (2) the click was on a
        // cell that's not axially adjacent to the path's last cell.
        // The latter is the silent-failure case we want to surface.
        const armedPath = window.GCCSubhexPaths.getPath(a.value);
        if (armedPath && armedPath.cells.length){
          const last = armedPath.cells[armedPath.cells.length - 1];
          flashMode(`Not adjacent to path's last cell (Q${last.Q}, R${last.R})`);
        } else {
          flashMode('Could not extend path');
        }
        return;
      }
      {
        const svg = state.win?.querySelector('#sxw-svg');
        // If we're authoring toward a parent-path-marker destination,
        // check whether the newly-appended cell reached the
        // destination marker's boundary subhex. If so, the segment is
        // now end-to-end authored — clear the highlight and re-render
        // markers so the destination dot drops its highlight class
        // and both ends pick up the .authored class.
        if (state.markerHighlight){
          const segments = window.GCCPaths?.segmentsAt(state.parentCol, state.parentRow) || [];
          const seg = segments[state.markerHighlight.segIndex];
          if (seg){
            const otherEdge = (state.markerHighlight.edge === seg.entryEdge) ? seg.exitEdge : seg.entryEdge;
            if (typeof otherEdge === 'number' && otherEdge >= 0){
              const owned = window.GCCSubhexData.ownedByParent(state.parentCol, state.parentRow);
              const destCell = boundaryCellForEdge(otherEdge, owned);
              if (destCell && destCell.Q === Q && destCell.R === R){
                state.markerHighlight = null;
              }
            }
          }
        }
        if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
        syncModeLabel();
      }
    }
    applyCellPaint(Q, R);
    if (Q === state.selectedQ && R === state.selectedR) syncDetailPanel();
  }

  function onCellClick(ev){
    ev.stopPropagation();
    if (state.armed) return;
    const Q = +ev.currentTarget.dataset.q;
    const R = +ev.currentTarget.dataset.r;
    selectCell(Q, R);
  }

  function selectCell(Q, R){
    if (state.selectedQ !== null && state.selectedR !== null){
      const prev = document.getElementById(cellDomId(state.selectedQ, state.selectedR));
      const prevPoly = prev?.querySelector('.sxw-cell');
      if (prevPoly) prevPoly.classList.remove('selected');
    }
    state.selectedQ = Q;
    state.selectedR = R;
    const group = document.getElementById(cellDomId(Q, R));
    const poly  = group?.querySelector('.sxw-cell');
    if (poly) poly.classList.add('selected');
    if (group && group.parentNode && group.parentNode.lastChild !== group){
      group.parentNode.appendChild(group);
    }
    syncDetailPanel();
  }

  // ── Detail panel ───────────────────────────────────────────────────────
  function selectedCellGroup(){
    if (state.selectedQ === null) return null;
    return document.getElementById(cellDomId(state.selectedQ, state.selectedR));
  }
  function selectedIsFragment(){
    const g = selectedCellGroup();
    return !!(g && g.dataset.fragment === '1');
  }
  function selectedFragmentOwner(){
    const g = selectedCellGroup();
    if (!g || g.dataset.fragment !== '1') return null;
    return { col: +g.dataset.ownerCol, row: +g.dataset.ownerRow };
  }
  function selectedParentTerrain(){
    const owner = selectedFragmentOwner();
    if (owner && typeof getHexTerrain === 'function'){
      return getHexTerrain(owner.col, owner.row);
    }
    return state.parentTerrain;
  }

  function syncDetailPanel(){
    if (!state.win && !state.ctrl) return;
    const coord  = findEl('sxw-coord');
    const terr   = findEl('sxw-terrain');
    const ownerSep = findEl('sxw-owner-sep');
    const ownerEl  = findEl('sxw-owner');
    const name   = findEl('sxw-name');
    const notes  = findEl('sxw-notes');
    const fkind  = findEl('sxw-feature-kind');
    const fname  = findEl('sxw-feature-name');
    const flib   = findEl('sxw-feature-libid');
    const fnotes = findEl('sxw-feature-notes');
    const rpick  = findEl('sxw-region-pick');
    const rname  = findEl('sxw-region-name');
    const plist  = findEl('sxw-paths-list');
    const source = findEl('sxw-source');
    const clearB = findEl('sxw-clear');
    if (!coord || !terr || !name || !notes || !fkind || !fname || !flib || !fnotes
        || !rpick || !rname || !source || !clearB) return;

    if (state.selectedQ === null){
      coord.textContent  = '— select a cell';
      terr.textContent   = '—';
      if (ownerSep) ownerSep.style.display = 'none';
      if (ownerEl)  ownerEl.style.display = 'none';
      name.value = '';   name.disabled  = true;
      notes.value = '';  notes.disabled = true;
      fkind.value = '';  fkind.disabled = true;
      fname.value = '';  fname.disabled = true;
      flib.value  = '';  flib.disabled  = true;
      fnotes.value = ''; fnotes.disabled = true;
      rebuildRegionPickOptions(rpick, '', null);
      rpick.disabled = true;
      rname.value = '';  rname.disabled = true;
      if (plist) plist.textContent = '—';
      source.textContent = '';
      clearB.disabled    = true;
      return;
    }
    const pTerrain = selectedParentTerrain();
    const sub = window.GCCSubhexData.getSubhex(state.selectedQ, state.selectedR, pTerrain);
    coord.textContent = `Q${state.selectedQ}, R${state.selectedR}`;
    terr.textContent  = sub.terrain ? (TERRAIN[sub.terrain]?.label || sub.terrain) : '—';
    const owner = selectedFragmentOwner();
    if (owner){
      const ownerLabel = (typeof hexIdStr === 'function') ? hexIdStr(owner.col, owner.row) : `${owner.col},${owner.row}`;
      if (ownerEl){
        ownerEl.textContent = `Owned by ${ownerLabel}`;
        ownerEl.style.display = '';
      }
      if (ownerSep) ownerSep.style.display = '';
    } else {
      if (ownerEl)  ownerEl.style.display = 'none';
      if (ownerSep) ownerSep.style.display = 'none';
    }
    name.value  = sub.name  || '';  name.disabled  = false;
    notes.value = sub.notes || '';  notes.disabled = false;
    const f = sub.feature || null;
    fkind.value = f ? (f.kind || '') : '';
    fkind.disabled = false;
    fname.value = f ? (f.name || '') : '';
    fname.disabled = !f;
    flib.value  = f ? (f.libraryId || '') : '';
    flib.disabled = !f;
    fnotes.value = f ? (f.notes || '') : '';
    fnotes.disabled = !f;
    rebuildRegionPickOptions(rpick, sub.terrain, sub.regionId);
    rpick.disabled = false;
    const region = sub.regionId ? window.GCCSubhexData.getRegion(sub.regionId) : null;
    rname.value = region ? region.name : '';
    rname.disabled = !region;
    if (plist){
      const cellPaths = window.GCCSubhexPaths
        ? window.GCCSubhexPaths.pathsAtCell(state.selectedQ, state.selectedR)
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

  // Build the region <select> options. terrain = the cell's effective
  // terrain (used to filter eligible regions). selectedRegionId = the
  // cell's current regionId. Regions are global so we list every
  // region of matching terrain regardless of which parent its members
  // live in.
  function rebuildRegionPickOptions(sel, terrain, selectedRegionId){
    if (!sel) return;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— none —';
    sel.appendChild(noneOpt);
    if (terrain){
      const regions = window.GCCSubhexData.listRegions()
        .filter(r => r.terrain === terrain);
      for (const r of regions){
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        sel.appendChild(opt);
      }
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
    const pTerrain = selectedParentTerrain();
    if (val === '__new__'){
      const sub = window.GCCSubhexData.getSubhex(state.selectedQ, state.selectedR, pTerrain);
      if (!sub || !sub.terrain){
        ev.target.value = sub?.regionId || '';
        return;
      }
      const name = (typeof prompt === 'function') ? prompt('New region name:') : null;
      if (!name){
        ev.target.value = sub.regionId || '';
        return;
      }
      const region = window.GCCSubhexData.createRegion(name, sub.terrain);
      if (region){
        window.GCCSubhexData.assignCellToRegion(state.selectedQ, state.selectedR, region.id, pTerrain);
        state.armed = { type: 'region', value: region.id };
        showRegionArmedPicker(true, region.id);
        syncPaletteUI();
        syncModeLabel();
      }
    } else if (val === ''){
      window.GCCSubhexData.unassignCellFromRegion(state.selectedQ, state.selectedR);
    } else {
      window.GCCSubhexData.assignCellToRegion(state.selectedQ, state.selectedR, val, pTerrain);
    }
    applyCellPaint(state.selectedQ, state.selectedR);
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderRegionLabels(svg);
    syncDetailPanel();
  }

  function onRegionRename(ev){
    if (state.selectedQ === null) return;
    const pTerrain = selectedParentTerrain();
    const sub = window.GCCSubhexData.getSubhex(state.selectedQ, state.selectedR, pTerrain);
    if (!sub || !sub.regionId) return;
    const newName = ev.target.value.trim();
    if (!newName) return;
    window.GCCSubhexData.renameRegion(sub.regionId, newName);
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderRegionLabels(svg);
    syncDetailPanel();
    rebuildRegionArmedPicker();
  }

  // ── Region tool (toolbar) ──────────────────────────────────────────────
  function onRegionToolClick(){
    if (state.armed && (state.armed.type === 'region' || state.armed.type === 'region-erase')){
      state.armed = null;
      showRegionArmedPicker(false);
      syncPaletteUI();
      syncModeLabel();
      return;
    }
    const psel = findEl('sxw-path-armed');
    if (psel) psel.style.display = 'none';
    rebuildRegionArmedPicker();
    showRegionArmedPicker(true);
  }

  function showRegionArmedPicker(visible, presetValue){
    const sel = findEl('sxw-region-armed');
    if (!sel) return;
    sel.style.display = visible ? '' : 'none';
    if (visible && presetValue !== undefined){
      sel.value = presetValue;
    } else if (visible && !sel.value){
      const regions = window.GCCSubhexData.listRegions();
      if (regions.length){ sel.value = regions[0].id; }
    }
  }

  function rebuildRegionArmedPicker(){
    const sel = findEl('sxw-region-armed');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— pick a region to assign —';
    sel.appendChild(noneOpt);
    const regions = window.GCCSubhexData.listRegions();
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
      if (state.selectedQ === null){
        if (typeof alert === 'function') alert('Select a cell first to use its terrain for the new region.');
        ev.target.value = '';
        return;
      }
      const pTerrain = selectedParentTerrain();
      const sub = window.GCCSubhexData.getSubhex(state.selectedQ, state.selectedR, pTerrain);
      if (!sub || !sub.terrain){
        ev.target.value = '';
        return;
      }
      const name = (typeof prompt === 'function') ? prompt('New region name:') : null;
      if (!name){ ev.target.value = ''; return; }
      const region = window.GCCSubhexData.createRegion(name, sub.terrain);
      if (region){
        window.GCCSubhexData.assignCellToRegion(state.selectedQ, state.selectedR, region.id, pTerrain);
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
      state.markerHighlight = null;
      showPathArmedPicker(false);
      const svg = state.win?.querySelector('#sxw-svg');
      if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
      syncPaletteUI();
      syncModeLabel();
      syncPathActionButtons();
      return;
    }
    const rsel = findEl('sxw-region-armed');
    if (rsel) rsel.style.display = 'none';
    rebuildPathArmedPicker();
    showPathArmedPicker(true);
    syncPathActionButtons();
  }

  // Show or hide the entire path section (picker + action buttons +
  // help line). The picker stays visible whenever the Path tool is
  // open (so the GM can pick or create a path), but the action
  // buttons + help only appear once a path is actually armed.
  function showPathSection(visible){
    const sec = findEl('sxw-path-section');
    if (sec) sec.style.display = visible ? '' : 'none';
  }

  function showPathArmedPicker(visible, presetValue){
    showPathSection(visible);
    const sel = findEl('sxw-path-armed');
    if (sel){
      // Clear any stale inline display:none left from a previous
      // session (close() and old toolbar-era code paths set it). We
      // want the picker to inherit visibility from its section now.
      sel.style.display = visible ? '' : 'none';
      if (visible && presetValue !== undefined){
        sel.value = presetValue;
      }
    }
    syncPathActionButtons();
  }

  function rebuildPathArmedPicker(){
    const sel = findEl('sxw-path-armed');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— pick a path to extend —';
    sel.appendChild(noneOpt);
    const paths = window.GCCSubhexPaths.listPaths();
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
    if (prev) sel.value = prev;
  }

  function onPathArmedChange(ev){
    const val = ev.target.value;
    if (val.startsWith('__new__:')){
      const kind = val.slice('__new__:'.length);
      const name = (typeof prompt === 'function') ? prompt(`New ${kind} name:`) : null;
      if (!name){ ev.target.value = ''; return; }
      const path = window.GCCSubhexPaths.createPath(kind, name);
      if (!path){ ev.target.value = ''; return; }
      rebuildPathArmedPicker();
      ev.target.value = path.id;
      state.armed = { type: 'path', value: path.id };
      state.markerHighlight = null;
    } else if (val){
      // Switched to a different path. Drop the marker highlight unless
      // the new path still corresponds to the highlighted segment.
      const prevHighlight = state.markerHighlight;
      state.armed = { type: 'path', value: val };
      if (prevHighlight){
        const segments = window.GCCPaths?.segmentsAt(state.parentCol, state.parentRow) || [];
        const seg = segments[prevHighlight.segIndex];
        const armedPath = window.GCCSubhexPaths.getPath(val);
        const matches = seg && armedPath && armedPath.kind === seg.kind && armedPath.name === seg.name;
        if (!matches) state.markerHighlight = null;
      }
    } else {
      state.armed = null;
      state.markerHighlight = null;
    }
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
    syncPathActionButtons();
  }

  // Show or hide the action buttons + help line based on whether a
  // path is currently armed. The picker itself stays visible while the
  // section is shown — only the actions hide when nothing is armed.
  // Also updates the section header to show the armed path's name.
  function syncPathActionButtons(){
    const armed = state.armed && state.armed.type === 'path';
    const actionIds = ['sxw-path-undo', 'sxw-path-rename', 'sxw-path-delete', 'sxw-path-done'];
    for (const id of actionIds){
      const el = findEl(id);
      if (el) el.style.display = armed ? '' : 'none';
    }
    const help = findEl('sxw-path-help');
    if (help) help.style.display = armed ? '' : 'none';
    const head = findEl('sxw-path-section-head');
    if (head){
      if (armed){
        const path = window.GCCSubhexPaths?.getPath(state.armed.value);
        if (path){
          // Compose meta info: cell count, plus a hint about where the
          // path's last-authored cell lives. If it's in this parent the
          // hint is silent; if it's in a neighbor we show "last in
          // X4-NN" so the GM knows to look at the boundary.
          let meta = `${path.kind} · ${path.cells.length} cell${path.cells.length === 1 ? '' : 's'}`;
          if (path.cells.length > 0 && window.GCCSubhexData){
            const last = path.cells[path.cells.length - 1];
            const owner = window.GCCSubhexData.ownerOf(last.Q, last.R);
            if (owner && (owner.col !== state.parentCol || owner.row !== state.parentRow)){
              const lastId = (typeof hexIdStr === 'function')
                ? hexIdStr(owner.col, owner.row)
                : `${owner.col},${owner.row}`;
              meta += ` · last in ${lastId}`;
            }
          }
          head.innerHTML = `PATH · ${escapeHtml(path.name)} <span class="sxw-section-meta">(${meta})</span>`;
        } else {
          head.textContent = 'PATH';
        }
      } else {
        head.textContent = 'PATH';
      }
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[ch]));
  }

  function onPathUndoClick(){
    if (!state.armed || state.armed.type !== 'path') return;
    const ok = window.GCCSubhexPaths.popCell(state.armed.value);
    if (!ok){
      flashMode('Path is empty — nothing to undo');
      return;
    }
    rebuildPathArmedPicker();
    const sel = findEl('sxw-path-armed');
    if (sel) sel.value = state.armed.value;
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
    syncModeLabel();
  }

  function onPathRenameClick(){
    if (!state.armed || state.armed.type !== 'path') return;
    const path = window.GCCSubhexPaths.getPath(state.armed.value);
    if (!path) return;
    const name = (typeof prompt === 'function') ? prompt('Rename path:', path.name) : null;
    if (!name) return;
    window.GCCSubhexPaths.renamePath(state.armed.value, name);
    rebuildPathArmedPicker();
    const sel = findEl('sxw-path-armed');
    if (sel) sel.value = state.armed.value;
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
    syncModeLabel();
  }

  function onPathDeleteClick(){
    if (!state.armed || state.armed.type !== 'path') return;
    const path = window.GCCSubhexPaths.getPath(state.armed.value);
    if (!path) return;
    const ok = (typeof confirm === 'function')
      ? confirm(`Delete path "${path.name}" (${path.kind})? This cannot be undone.`)
      : true;
    if (!ok) return;
    window.GCCSubhexPaths.deletePath(state.armed.value);
    state.armed = null;
    state.markerHighlight = null;
    rebuildPathArmedPicker();
    showPathArmedPicker(false);
    const sel = findEl('sxw-path-armed');
    if (sel) sel.value = '';
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
    syncDetailPanel();
    syncPaletteUI();
    syncModeLabel();
    syncPathActionButtons();
  }

  function onPathDoneClick(){
    if (!state.armed || state.armed.type !== 'path') return;
    state.armed = null;
    state.markerHighlight = null;
    showPathArmedPicker(false);
    const sel = findEl('sxw-path-armed');
    if (sel) sel.value = '';
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg){ renderPaths(svg); renderParentPathMarkers(svg); renderCrossings(svg); }
    syncPaletteUI();
    syncModeLabel();
    syncPathActionButtons();
  }

  function persistFields(){
    if (state.selectedQ === null) return;
    const nameEl  = findEl('sxw-name');
    const notesEl = findEl('sxw-notes');
    if (!nameEl || !notesEl) return;
    const name  = nameEl.value.trim();
    const notes = notesEl.value;
    window.GCCSubhexData.setSubhexOverride(state.selectedQ, state.selectedR, { name, notes });
    applyCellPaint(state.selectedQ, state.selectedR);
    syncDetailPanel();
  }

  function persistFeature(){
    if (state.selectedQ === null) return;
    const kindEl = findEl('sxw-feature-kind');
    if (!kindEl) return;
    const kind = kindEl.value;
    if (!kind){
      window.GCCSubhexData.clearSubhexFeature(state.selectedQ, state.selectedR);
    } else {
      const fnameEl = findEl('sxw-feature-name');
      const flibEl  = findEl('sxw-feature-libid');
      const fnotesEl = findEl('sxw-feature-notes');
      const fname = fnameEl ? fnameEl.value.trim() : '';
      const flib  = flibEl  ? flibEl.value.trim()  : '';
      const fnotes = fnotesEl ? fnotesEl.value.trim() : '';
      window.GCCSubhexData.setSubhexFeature(state.selectedQ, state.selectedR, {
        kind,
        name: fname || undefined,
        libraryId: flib || undefined,
        notes: fnotes || undefined,
      });
    }
    applyCellPaint(state.selectedQ, state.selectedR);
    syncDetailPanel();
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderCrossings(svg);
  }

  function onClearOverride(){
    if (state.selectedQ === null) return;
    window.GCCSubhexData.clearSubhex(state.selectedQ, state.selectedR);
    applyCellPaint(state.selectedQ, state.selectedR);
    syncDetailPanel();
    const svg = state.win?.querySelector('#sxw-svg');
    if (svg) renderCrossings(svg);
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
  function clampWindowPos(x, y){
    if (!state.win) return { x, y };
    const KEEPVIS_X = 80;
    const HEADER_PAD = 4;
    const rect = state.win.getBoundingClientRect();
    const w = rect.width || 540;
    const h = rect.height || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x > vw - KEEPVIS_X) x = vw - KEEPVIS_X;
    if (x < KEEPVIS_X - w)  x = KEEPVIS_X - w;
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
  window.GCCSubhexView = { open, close, isOpen, currentParent };
})();
