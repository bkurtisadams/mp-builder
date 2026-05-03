// gcc-edges.js v0.2.0 — 2026-05-03
// v0.2.0 — promote River into the picker (shares Coast classifier,
//          differs only in variant-naming); add shift/right-click
//          remove-all-flags-on-hex gesture for easier cleanup
//          regardless of which mode painted what.
// v0.1.0 — initial slice 3 paint mode + panel + dot overlay.
// Edges paint mode + panel + flagged-parent dot overlay (slice 3 of
// the Edges scanner redesign). Workflow:
//
//   1. Click 🪡 Edges in the toolbar to enter paint mode.
//   2. Pick a mode in the panel (Coast is the only mode in slice 3).
//   3. Click parent hexes on the map to toggle flags. Visible
//      colored dots appear at flagged parents.
//   4. Click "Run scans" to iterate every (parent, mode) pair and
//      write overrides via GCCEdgeScanner.scanParent + applyResults.
//   5. "Clear flags" wipes the flag set. "Exit" leaves paint mode.
//
// The "Show flag dots" toggle hides/shows the overlay independently
// of paint-mode state — useful for keeping the GM aware of which
// parents have authored detail without paint-mode chrome on screen.
// Persisted in localStorage as gcc-edge-dots-visible (default true).
//
// Architecture notes:
//   - Capture-phase mousedown on #map-wrap, mirroring the Hex
//     Editor paint tab (gcc-hex-edit.js v0.5.0+). Beats the map's
//     bubble-phase pan handler.
//   - Coords resolved via screenToMap + mapToHex (defined in
//     greyhawk-map.html, hoisted onto window).
//   - SVG dot overlay layer #edge-flag-overlay parallels
//     #landmark-overlay; pointerEvents:none so clicks pass through
//     to the hex polygons.
//   - Run-scans uses GCCSubhexData.flushOverrides at the end of
//     the batch (single localStorage write across all parents).
//
// Cross-script gotcha: greyhawk-map.html script-src loaders DON'T
// share top-level const/let — only window.* propagates. All cross-
// module references go through window.GCCEdges / window.GCCEdgeFlags
// / window.GCCEdgeScanner / etc.

(function(){
  'use strict';

  const DOTS_VISIBLE_KEY = 'gcc-edge-dots-visible';

  // ── Per-mode visual style ──────────────────────────────────────────
  // Color and label for the panel radio + the SVG dot overlay. Must
  // stay in sync with GCCEdgeModes.list — slice 5 adds forest, slice
  // 6 adds river/jungle. Hidden modes (e.g. an experimental one not
  // ready for the picker) can be omitted from MODE_UI without
  // breaking storage compatibility.
  const MODE_UI = {
    coast:  { label: 'Coast',  glyph: '🌊', color: '#4a9fd0' },
    river:  { label: 'River',  glyph: '🌊', color: '#5fb8a8' },
    forest: { label: 'Forest', glyph: '🌲', color: '#5a9a3a' },
    jungle: { label: 'Jungle', glyph: '🌴', color: '#2f7a3a' },
  };
  // Modes available in the picker. Slice 3.1 promotes River alongside
  // Coast (they share the HSV classifier). Slice 5 adds Forest;
  // slice 6 adds Jungle.
  const SLICE_MODES = ['coast', 'river'];

  // ── Module state ───────────────────────────────────────────────────
  const state = {
    active: false,
    activeMode: 'coast',
    paintDragging: false,
    lastPaintKey: null,
    showDots: _loadShowDots(),
    panelEl: null,
  };

  function _loadShowDots(){
    try {
      const raw = localStorage.getItem(DOTS_VISIBLE_KEY);
      if (raw === null) return true;
      return raw === '1';
    } catch(_){ return true; }
  }
  function _saveShowDots(v){
    try { localStorage.setItem(DOTS_VISIBLE_KEY, v ? '1' : '0'); } catch(_){}
  }

  // ── Style injection ────────────────────────────────────────────────
  // Cursor for paint mode + toolbar active state. Mirrors the
  // gcc-hex-edit.js pattern (style block appended on script init).
  function _injectStyle(){
    if (document.getElementById('gcc-edges-style')) return;
    const s = document.createElement('style');
    s.id = 'gcc-edges-style';
    s.textContent = `
      body.edges-painting #map-wrap { cursor:cell !important; }
      #btn-edges.active { background:rgba(200,148,26,.28); color:#ffeebb; border-color:#c8941a; }
    `;
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _injectStyle);
  } else {
    _injectStyle();
  }

  function LOG(...args){ if (window.GCC_DEBUG_EDGES) console.log('[Edges]', ...args); }

  // ── SVG dot overlay ────────────────────────────────────────────────
  // Builds (or rebuilds) #edge-flag-overlay inside #hex-svg. One small
  // circle per (flagged-parent, mode) pair. Multiple modes on a single
  // parent stack horizontally with a 4px offset so all are visible.
  // pointerEvents:none keeps the overlay from intercepting paint
  // clicks — the underlying hex polygon owns the click event.
  function buildEdgeFlagOverlay(){
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.id = 'edge-flag-overlay';
    g.style.pointerEvents = 'none';
    if (!state.showDots) g.style.display = 'none';
    if (typeof window.GCCEdgeFlags === 'undefined') return g;
    if (typeof window.hexCenterDisplay !== 'function' && typeof window.hexCenter !== 'function') return g;
    const center = window.hexCenterDisplay || window.hexCenter;
    const mapToStage = window.mapToStage;
    const all = window.GCCEdgeFlags.getAll();
    for (const f of all){
      const c = center(f.col, f.row);
      const stage = (typeof mapToStage === 'function') ? mapToStage(c.x, c.y) : c;
      const modes = f.modes;
      // Stack: center the row of dots on the parent center. With
      // n=1 dot, offset 0; with n=2, offsets ±4; with n=3, -8/0/+8;
      // generally i*8 - (n-1)*4 along x for evenly spaced dots.
      const n = modes.length;
      const SPACING = 8;
      for (let i = 0; i < n; i++){
        const m = modes[i];
        const ui = MODE_UI[m] || { color: '#888' };
        const dx = i * SPACING - (n - 1) * (SPACING / 2);
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', (stage.x + dx).toFixed(1));
        dot.setAttribute('cy', stage.y.toFixed(1));
        dot.setAttribute('r', '3.2');
        dot.setAttribute('fill', ui.color);
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '0.8');
        dot.setAttribute('opacity', '0.92');
        g.appendChild(dot);
      }
    }
    return g;
  }
  function rebuildEdgeFlagOverlay(){
    const svg = document.getElementById('hex-svg');
    if (!svg) return;
    const old = document.getElementById('edge-flag-overlay');
    const next = buildEdgeFlagOverlay();
    if (old && old.parentNode) old.parentNode.replaceChild(next, old);
    else svg.appendChild(next);
  }
  function setShowDots(v){
    state.showDots = !!v;
    _saveShowDots(state.showDots);
    const el = document.getElementById('edge-flag-overlay');
    if (el) el.style.display = state.showDots ? '' : 'none';
    // Also tick the panel checkbox if open and out of sync.
    const cb = state.panelEl && state.panelEl.querySelector('#edges-show-dots');
    if (cb && cb.checked !== state.showDots) cb.checked = state.showDots;
  }

  // ── Panel ──────────────────────────────────────────────────────────
  function buildPanel(){
    const wrap = document.createElement('div');
    wrap.id = 'edges-panel';
    wrap.style.cssText = `
      position:fixed; top:60px; right:16px;
      width:280px; z-index:300;
      background:#120900; color:#f4e8c4;
      border:1px solid #c8941a; border-radius:3px;
      padding:12px 14px;
      box-shadow:0 6px 30px rgba(0,0,0,.7);
      font-family:'Crimson Text', Georgia, serif;
    `;
    wrap.innerHTML = `
      <div style="font-family:'Cinzel',serif; font-size:13px; color:#e8b840; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #5a4a30; display:flex; justify-content:space-between; align-items:baseline;">
        <span>🪡 Edges</span>
        <span style="cursor:pointer; color:#c8a070; font-size:18px;" id="edges-close" title="Exit">×</span>
      </div>
      <div style="font-size:10px; color:#c8a070; letter-spacing:.06em; text-transform:uppercase; margin-bottom:4px;">Mode</div>
      <div id="edges-mode-picker" style="font-size:12px; line-height:1.7; margin-bottom:10px;"></div>
      <div id="edges-stats" style="font-size:12px; color:#c8a070; margin-bottom:10px; line-height:1.4;">—</div>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button id="edges-run" style="flex:1; background:#5a3a0a; color:#f4e8c4; border:1px solid #c8941a; border-radius:3px; padding:6px 0; font-family:inherit; font-size:12px; cursor:pointer; font-weight:600;">Run scans</button>
        <button id="edges-clear" style="background:transparent; color:#f4e8c4; border:1px solid #8b6a30; border-radius:3px; padding:6px 10px; font-family:inherit; font-size:12px; cursor:pointer;" title="Remove all flags">Clear</button>
      </div>
      <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:#c8a070; cursor:pointer; user-select:none;">
        <input type="checkbox" id="edges-show-dots" ${state.showDots ? 'checked' : ''}>
        Show flag dots on map
      </label>
      <div style="font-size:10px; color:#8b6a30; margin-top:8px; line-height:1.5;">
        <b style="color:#c8a070;">Click</b> a parent to toggle the active mode.<br>
        <b style="color:#c8a070;">Shift-click</b> or <b style="color:#c8a070;">right-click</b> to clear all modes from a hex.
      </div>
    `;
    document.body.appendChild(wrap);
    state.panelEl = wrap;
    _renderModePicker();
    _renderStats();
    document.getElementById('edges-close').addEventListener('click', exit);
    document.getElementById('edges-run').addEventListener('click', onRunClick);
    document.getElementById('edges-clear').addEventListener('click', onClearClick);
    document.getElementById('edges-show-dots').addEventListener('change', e => {
      setShowDots(!!e.target.checked);
    });
  }
  function _renderModePicker(){
    const host = state.panelEl && state.panelEl.querySelector('#edges-mode-picker');
    if (!host) return;
    const rows = [];
    for (const id of SLICE_MODES){
      const ui = MODE_UI[id] || { label: id, color: '#888' };
      const checked = (state.activeMode === id) ? 'checked' : '';
      rows.push(`
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="radio" name="edges-mode" value="${id}" ${checked}>
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${ui.color}; border:1px solid rgba(255,255,255,0.4);"></span>
          <span>${ui.label}</span>
        </label>`);
    }
    // Future-modes hint until slice 5 / 6 lands.
    rows.push(`<div style="font-size:10px; color:#8b6a30; margin-top:6px;">Forest, Jungle land in later slices.</div>`);
    host.innerHTML = rows.join('');
    host.querySelectorAll('input[name="edges-mode"]').forEach(r => {
      r.addEventListener('change', e => { state.activeMode = e.target.value; });
    });
  }
  function _renderStats(){
    const host = state.panelEl && state.panelEl.querySelector('#edges-stats');
    if (!host) return;
    if (typeof window.GCCEdgeFlags === 'undefined'){
      host.textContent = '(GCCEdgeFlags not loaded)';
      return;
    }
    const c = window.GCCEdgeFlags.count();
    if (c.total === 0){
      host.innerHTML = `<span style="color:#8b6a30;">No parents flagged. Click a hex to start.</span>`;
      return;
    }
    const breakdown = Object.entries(c.byMode)
      .map(([m, n]) => {
        const ui = MODE_UI[m] || { label: m, color: '#888' };
        return `<span style="color:${ui.color};">${n} ${ui.label.toLowerCase()}</span>`;
      })
      .join(' · ');
    host.innerHTML = `<b style="color:#e8b840;">${c.total}</b> parent${c.total === 1 ? '' : 's'} flagged · ${breakdown}`;
  }

  // ── Run / Clear ────────────────────────────────────────────────────
  function onRunClick(){
    if (typeof window.GCCEdgeFlags === 'undefined' || typeof window.GCCEdgeScanner === 'undefined'){
      alert('Edges scanner not loaded.');
      return;
    }
    if (typeof window.GCCEdgeModes === 'undefined'){
      alert('Edges modes not loaded.');
      return;
    }
    const flags = window.GCCEdgeFlags.getAll();
    if (flags.length === 0){
      _toast('No flagged parents to scan.');
      return;
    }
    // Build the work list as (parent, mode) pairs.
    const work = [];
    for (const f of flags){
      for (const modeId of f.modes){
        const mode = window.GCCEdgeModes.byId && window.GCCEdgeModes.byId[modeId];
        if (!mode){
          console.warn(`[Edges] flagged mode "${modeId}" not registered — skipping`);
          continue;
        }
        work.push({ col: f.col, row: f.row, modeId, mode });
      }
    }
    if (work.length === 0){
      _toast('No (parent, mode) pairs to scan.');
      return;
    }
    // Confirm before writing — bulk authoring touches a lot of cells.
    const summary = `Run ${work.length} scan${work.length === 1 ? '' : 's'} on ${flags.length} parent${flags.length === 1 ? '' : 's'}?`;
    if (!confirm(summary)) return;
    // Execute. scanParent + applyResults already use deferSave +
    // flushOverrides internally per-parent; calling applyResults
    // n times still results in n flush calls, which is fine for the
    // ~50-parent ceiling Kurt's authoring scale targets. If this
    // ever bottlenecks, we can lift the flush to a single call by
    // using GCCSubhexData.peekOverride/setSubhexOverride directly.
    const SD = window.GCCSubhexData;
    const errors = [];
    let totalWritten = 0, totalSkipped = 0, parentsAborted = 0;
    for (const w of work){
      const out = window.GCCEdgeScanner.scanParent(w.col, w.row, { mode: w.mode });
      if (out.error){
        errors.push(`${w.col},${w.row} (${w.modeId}): ${out.error}`);
        continue;
      }
      if (out.summary && out.summary.aborted){
        parentsAborted++;
        continue;
      }
      const ap = window.GCCEdgeScanner.applyResults(out.results, {});
      totalWritten += ap.written || 0;
      totalSkipped += ap.skipped || 0;
    }
    if (errors.length){
      console.warn('[Edges] scan errors:', errors);
    }
    const parts = [`${work.length} scan${work.length === 1 ? '' : 's'} run`,
                   `${totalWritten} override${totalWritten === 1 ? '' : 's'} written`];
    if (totalSkipped) parts.push(`${totalSkipped} skipped`);
    if (parentsAborted) parts.push(`${parentsAborted} aborted (off-image)`);
    if (errors.length) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
    _toast(parts.join(' · '));
    if (totalWritten > 0){
      window.dispatchEvent(new CustomEvent('gcc-subhex-changed', {
        detail: { reason: 'edges-run' },
      }));
    }
  }
  function onClearClick(){
    if (typeof window.GCCEdgeFlags === 'undefined') return;
    const c = window.GCCEdgeFlags.count();
    if (c.total === 0){ _toast('No flags to clear.'); return; }
    if (!confirm(`Remove all ${c.total} parent flag${c.total === 1 ? '' : 's'}? Subhex overrides already written are not affected.`)) return;
    window.GCCEdgeFlags.clearAll();
  }

  // ── Toast ──────────────────────────────────────────────────────────
  function _toast(msg){
    if (typeof window.showToast === 'function'){ window.showToast(msg); return; }
    console.log('[Edges]', msg);
  }

  // ── Map click capture ──────────────────────────────────────────────
  // Capture-phase on #map-wrap so we beat the map's bubble-phase
  // pan-arming handler. We swallow the event entirely (preventDefault
  // + stopImmediatePropagation) so left-click while in paint mode
  // never starts a pan. Drag-paint is intentionally NOT supported —
  // flagging is point-and-click; dragging across parents would be a
  // footgun.
  //
  // Click semantics:
  //   left click          → toggle active-mode flag on hex
  //   shift+left click    → remove ALL flags (any mode) from hex
  //   right click         → same as shift+left (remove all)
  // The "remove all" path means the GM doesn't have to remember
  // which mode painted a hex to clear it — particularly useful when
  // a hex has stacked dots from multiple modes.
  function _removeAllFlags(col, row){
    const F = window.GCCEdgeFlags;
    if (!F) return 0;
    const modes = F.getModes(col, row);
    let n = 0;
    for (const m of modes){
      if (F.removeFlag(col, row, m)) n++;
    }
    return n;
  }
  function onMapMousedown(ev){
    if (!state.active) return;
    // Accept left (0) and right (2). Middle-click ignored.
    if (ev.button !== 0 && ev.button !== 2) return;
    if (typeof window.screenToMap !== 'function' || typeof window.mapToHex !== 'function') return;
    const m = window.screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = window.mapToHex(m.x, m.y);
    if (!hit) return;
    if (state.panelEl && state.panelEl.contains(ev.target)) return;
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if (typeof window.GCCEdgeFlags === 'undefined') return;
    const isRemoveAll = (ev.button === 2) || ev.shiftKey;
    if (isRemoveAll){
      const n = _removeAllFlags(hit.col, hit.row);
      if (n > 0) LOG('remove-all', hit.col, hit.row, '→', n, 'flags removed');
      return;
    }
    const newState = window.GCCEdgeFlags.toggleFlag(hit.col, hit.row, state.activeMode);
    LOG('toggle', hit.col, hit.row, state.activeMode, '→', newState);
  }

  // Right-click on the map should clear flags (when in Edges mode)
  // rather than open the browser context menu. Capture-phase on
  // map-wrap so we beat anything else; only swallows when we're in
  // Edges mode and the click is over a flagged hex (otherwise the
  // normal context menu would be slightly weird to suppress).
  function onMapContextMenu(ev){
    if (!state.active) return;
    if (typeof window.screenToMap !== 'function' || typeof window.mapToHex !== 'function') return;
    const m = window.screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = window.mapToHex(m.x, m.y);
    if (!hit) return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  function enter(){
    if (state.active) return;
    state.active = true;
    document.body.classList.add('edges-painting');
    if (!state.panelEl) buildPanel();
    else state.panelEl.style.display = 'block';
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      wrap.addEventListener('mousedown', onMapMousedown, true);
      wrap.addEventListener('contextmenu', onMapContextMenu, true);
    }
    document.addEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-edges');
    if (btn) btn.classList.add('active');
    // Make sure the dot overlay is in sync with current data on
    // entry. (It was rebuilt on every flag change; this handles the
    // first-entry case where no flag changes have fired yet.)
    rebuildEdgeFlagOverlay();
    LOG('entered, mode=', state.activeMode);
  }
  function exit(){
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove('edges-painting');
    if (state.panelEl) state.panelEl.style.display = 'none';
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      wrap.removeEventListener('mousedown', onMapMousedown, true);
      wrap.removeEventListener('contextmenu', onMapContextMenu, true);
    }
    document.removeEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-edges');
    if (btn) btn.classList.remove('active');
    LOG('exited');
  }
  function toggle(){ state.active ? exit() : enter(); }

  function onKey(e){
    if (e.key === 'Escape'){ exit(); }
  }

  // ── Wire reactions to flag changes ─────────────────────────────────
  // Repaint the overlay + refresh the panel stats whenever flags
  // change, regardless of whether we're in paint mode (the dots stay
  // visible by default so the GM always knows what's flagged).
  if (typeof window !== 'undefined' && window.addEventListener){
    window.addEventListener('gcc-edge-flags-changed', () => {
      rebuildEdgeFlagOverlay();
      _renderStats();
    });
    // Build the overlay once on the next tick, after greyhawk-map's
    // buildHexGrid has run. Ensures dots show up on page load even
    // before the user enters paint mode.
    function _initialOverlay(){
      // Defer: hex-svg only exists after greyhawk-map's DOMContentLoaded
      // wires up. setTimeout(0) runs after the current task chain.
      setTimeout(rebuildEdgeFlagOverlay, 0);
    }
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', _initialOverlay);
    } else {
      _initialOverlay();
    }
  }

  // ── Toolbar wire ───────────────────────────────────────────────────
  function wireButton(){
    const btn = document.getElementById('btn-edges');
    if (!btn) return false;
    if (btn.dataset.edgesWired) return true;
    btn.dataset.edgesWired = '1';
    btn.addEventListener('click', toggle);
    return true;
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireButton);
  } else {
    wireButton();
  }

  window.GCCEdges = {
    enter, exit, toggle,
    setShowDots,
    rebuildOverlay: rebuildEdgeFlagOverlay,
    MODE_UI, SLICE_MODES,
  };
})();
