// gcc-hex-edit.js v0.4.0 — 2026-04-19
// Hex Editor: tab shell for Landmarks / Paint / Outline / Draw.
// Replaces gcc-landmark-edit.js. Landmarks tab is the former landmark
// editor unchanged; Paint / Outline / Draw are Phase 2 / 3 / 4 stubs.
//
// Requires globals: GCCLandmarks, hexIdStr, darleneToInternal, mapToHex,
//   screenToMap, showToast, rebuildLandmarkOverlay/rebuildGrid/buildHexGrid.
//
// v0.4.0: Phase 1 refactor. Renamed #landmark-edit-panel → #hex-edit-panel,
//   #btn-landmark-edit → #btn-hex-edit, body.le-placing → body.he-editing,
//   CSS prefix le- → he-, window.GCCLandmarkEdit → window.GCCHexEdit.
//   onMapClick routes to the active tab; non-landmark tabs still swallow
//   clicks to keep the map's side-panel/move-dialog suppressed.
// (Pre-rename history lives in gcc-landmark-edit.js v0.1.0–v0.3.1.)

(function(){
  if (typeof window === 'undefined') return;
  const LOG = (...a) => console.log('[hex-edit]', ...a);
  LOG('gcc-hex-edit.js v0.4.0 loaded');

  const KINDS = ['city','town','castle','ruin','village','feature','landmark'];
  const TABS = [
    { id:'landmarks', label:'Landmarks' },
    { id:'paint',     label:'Paint' },
    { id:'outline',   label:'Outline' },
    { id:'draw',      label:'Draw' },
  ];

  const state = {
    active: false,
    activeTab: 'landmarks',
    selectedName: null,
    newMode: false,
    newFields: { name:'', kind:'city', region:'' },
    panelEl: null,
  };

  // ── UI: floating panel ────────────────────────────────────────────────────
  function buildPanel(){
    const p = document.createElement('div');
    p.id = 'hex-edit-panel';
    p.innerHTML = `
      <div class="he-hdr">
        <span>🧰 Hex Editor</span>
        <button class="he-close" title="Exit (Esc)">✕</button>
      </div>
      <div class="he-tabs">
        ${TABS.map(t => `<button class="he-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      ${buildLandmarksPane()}
      ${buildStubPane('paint', 'Terrain Paint',
        'Click hexes to assign terrain types (plains, forest, hills, mountains, swamp, desert, …). Currently terrain is served by a static lookup; this tab will let you paint overrides and persist them per-hex.',
        'Phase 2')}
      ${buildStubPane('outline', 'Region Outlines',
        'Draw polygon outlines for regions (Domain of Greyhawk, Empire of Iuz, …), replacing the rough-bbox placeholder in gcc-regions.js. The polygon editor is generic — the same tool will draw zones inside sub-hex scenes at Maure Castle Environs scale.',
        'Phase 3')}
      ${buildStubPane('draw', 'Paths',
        'Draw roads, rivers, trails, and other linear features. Paths carry terrain-speed modifiers that feed the CTT-integrated movement system.',
        'Phase 4')}
    `;
    document.body.appendChild(p);
    state.panelEl = p;

    p.querySelector('.he-close').onclick = exit;
    p.querySelectorAll('.he-tab').forEach(t =>
      t.onclick = () => setActiveTab(t.dataset.tab));

    // Landmarks tab wiring
    p.querySelector('#he-select').onchange  = onSelect;
    p.querySelector('#he-remove').onclick   = onRemove;
    p.querySelector('#he-export').onclick   = onExport;
    p.querySelector('#he-reset').onclick    = onReset;
    p.querySelector('#he-set-id').onclick   = onSetCanonicalId;
    p.querySelector('#he-canon-id').addEventListener('keydown', e => {
      if (e.key === 'Enter'){ e.preventDefault(); onSetCanonicalId(); }
    });
    p.querySelector('#he-new-name').oninput   = e => state.newFields.name   = e.target.value;
    p.querySelector('#he-new-kind').onchange  = e => state.newFields.kind   = e.target.value;
    p.querySelector('#he-new-region').oninput = e => state.newFields.region = e.target.value;

    injectStyles();
    setActiveTab(state.activeTab);
    refreshSelect();
    return p;
  }

  function buildLandmarksPane(){
    return `
      <div class="he-pane" id="he-pane-landmarks">
        <label class="he-lbl">Landmark</label>
        <select class="he-select" id="he-select"></select>

        <label class="he-lbl" style="margin-top:8px">Canonical Hex ID</label>
        <div class="he-id-row">
          <input class="he-input he-id-input" id="he-canon-id" type="text"
                 placeholder="e.g. D4-86" autocomplete="off" spellcheck="false">
          <button class="he-btn he-id-btn" id="he-set-id" title="Apply this ID directly, overriding any placed pixel position">Set</button>
        </div>
        <div class="he-id-hint" id="he-id-hint">Select a landmark first.</div>

        <div class="he-new" id="he-new" style="display:none">
          <label class="he-lbl">Name</label>
          <input class="he-input" id="he-new-name" type="text" placeholder="e.g. Highfolk">
          <label class="he-lbl">Kind</label>
          <select class="he-input" id="he-new-kind">
            ${KINDS.map(k => `<option value="${k}">${k}</option>`).join('')}
          </select>
          <label class="he-lbl">Region (optional)</label>
          <input class="he-input" id="he-new-region" type="text" placeholder="e.g. Highvale">
        </div>

        <div class="he-status" id="he-status">Pick a landmark, then click a hex.</div>

        <div class="he-btns">
          <button class="he-btn" id="he-remove">Clear Override</button>
          <button class="he-btn" id="he-export">Export</button>
          <button class="he-btn he-danger" id="he-reset">Reset All</button>
        </div>
      </div>
    `;
  }

  function buildStubPane(id, title, body, phase){
    return `
      <div class="he-pane" id="he-pane-${id}">
        <div class="he-stub">
          <h3 class="he-stub-h">${title}</h3>
          <p class="he-stub-p">${body}</p>
          <div class="he-stub-phase">${phase}</div>
        </div>
      </div>
    `;
  }

  function injectStyles(){
    if (document.getElementById('he-styles')) return;
    const s = document.createElement('style');
    s.id = 'he-styles';
    s.textContent = `
      #hex-edit-panel {
        position:fixed; top:72px; right:16px; width:260px; z-index:2000;
        background:rgba(20,14,6,.96); border:1px solid #c8941a; border-radius:3px;
        font-family:'Cinzel',serif; color:#f4e4b8; box-shadow:0 4px 20px rgba(0,0,0,.6);
      }
      #hex-edit-panel .he-hdr {
        display:flex; justify-content:space-between; align-items:center;
        padding:8px 10px; background:rgba(200,148,26,.18); border-bottom:1px solid #8b6e45;
        font-size:13px; font-weight:600; letter-spacing:.05em;
      }
      #hex-edit-panel .he-close {
        background:none; border:none; color:#c8a96e; font-size:14px; cursor:pointer; padding:0 4px;
      }
      #hex-edit-panel .he-close:hover { color:#e8b840; }
      #hex-edit-panel .he-tabs {
        display:flex; border-bottom:1px solid #8b6e45; background:rgba(0,0,0,.25);
      }
      #hex-edit-panel .he-tab {
        flex:1; padding:7px 4px; background:none; border:none; color:#8b6e45;
        font-family:'Cinzel',serif; font-size:10.5px; letter-spacing:.05em; cursor:pointer;
        border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .12s;
      }
      #hex-edit-panel .he-tab:hover { color:#c8a96e; background:rgba(200,148,26,.06); }
      #hex-edit-panel .he-tab.active {
        color:#ffeebb; border-bottom-color:#c8941a; background:rgba(200,148,26,.12);
      }
      #hex-edit-panel .he-pane { display:none; padding:10px; }
      #hex-edit-panel .he-pane.active { display:block; }
      #hex-edit-panel .he-lbl {
        display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em;
        color:#c8a96e; margin:6px 0 3px;
      }
      #hex-edit-panel .he-select, #hex-edit-panel .he-input {
        width:100%; background:rgba(0,0,0,.4); color:#f4e4b8; border:1px solid #8b6e45;
        border-radius:2px; padding:4px 6px; font-family:'Crimson Text',Georgia,serif; font-size:13px; box-sizing:border-box;
      }
      #hex-edit-panel .he-status {
        margin-top:8px; padding:6px 8px; background:rgba(0,0,0,.35); border-left:2px solid #c8941a;
        font-size:11px; line-height:1.4; color:#c8a96e; min-height:14px;
      }
      #hex-edit-panel .he-status.armed { color:#44ffbb; border-left-color:#44ffbb; }
      #hex-edit-panel .he-id-row { display:flex; gap:6px; align-items:stretch; }
      #hex-edit-panel .he-id-input { flex:1; font-family:monospace; letter-spacing:.04em; text-transform:uppercase; }
      #hex-edit-panel .he-id-btn {
        flex:0 0 auto; padding:4px 10px; font-size:11px;
        background:rgba(68,255,187,.14); border:1px solid #44ffbb; color:#aaffdd;
        border-radius:2px; font-family:inherit; cursor:pointer;
      }
      #hex-edit-panel .he-id-btn:hover { background:rgba(68,255,187,.28); color:#ddffee; }
      #hex-edit-panel .he-id-hint { font-size:10px; color:#c8a96e; margin-top:3px; min-height:12px; line-height:1.3; }
      #hex-edit-panel .he-btns { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
      #hex-edit-panel .he-btn {
        flex:1; min-width:70px; background:rgba(200,148,26,.1); border:1px solid #8b6e45;
        color:#c8a96e; padding:5px 8px; border-radius:2px; font-family:inherit; font-size:11px;
        cursor:pointer; transition:all .12s;
      }
      #hex-edit-panel .he-btn:hover { background:rgba(200,148,26,.25); color:#e8b840; border-color:#c8941a; }
      #hex-edit-panel .he-btn.he-danger { color:#cc6644; border-color:#663311; }
      #hex-edit-panel .he-btn.he-danger:hover { background:rgba(180,50,20,.2); color:#ff7755; }
      #hex-edit-panel .he-stub { padding:10px 4px 6px; }
      #hex-edit-panel .he-stub-h {
        margin:0 0 8px; font-size:14px; font-weight:600; color:#e8b840; letter-spacing:.04em;
      }
      #hex-edit-panel .he-stub-p {
        margin:0 0 12px; font-family:'Crimson Text',Georgia,serif; font-size:12.5px;
        line-height:1.45; color:#c8a96e;
      }
      #hex-edit-panel .he-stub-phase {
        display:inline-block; padding:2px 8px; background:rgba(200,148,26,.12);
        border:1px solid #8b6e45; border-radius:2px; font-size:9.5px;
        letter-spacing:.1em; color:#c8a96e; text-transform:uppercase;
      }
      body.he-editing #map-wrap { cursor:crosshair !important; }
      #btn-hex-edit.active { background:rgba(200,148,26,.28); color:#ffeebb; border-color:#c8941a; }
    `;
    document.head.appendChild(s);
  }

  function setActiveTab(id){
    state.activeTab = id;
    if (!state.panelEl) return;
    state.panelEl.querySelectorAll('.he-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === id));
    state.panelEl.querySelectorAll('.he-pane').forEach(p =>
      p.classList.toggle('active', p.id === `he-pane-${id}`));
  }

  // ── Landmarks tab ─────────────────────────────────────────────────────────
  function refreshSelect(){
    const sel = state.panelEl.querySelector('#he-select');
    const names = GCCLandmarks.allNames();
    const unplaced = new Set(GCCLandmarks.unplacedPending().map(p => p.name));
    const overridden = new Set(Object.keys(GCCLandmarks.exportOverrides()));
    sel.innerHTML =
      '<option value="">— choose —</option>' +
      names.map(n => {
        let tag = '';
        if (unplaced.has(n)) tag = ' ◇';
        else if (overridden.has(n)) tag = ' ●';
        return `<option value="${n}">${n}${tag}</option>`;
      }).join('') +
      '<option value="__new__">+ New landmark…</option>';
    sel.value = state.selectedName || '';
  }

  function onSelect(e){
    const v = e.target.value;
    const newBlock = state.panelEl.querySelector('#he-new');
    const idInput  = state.panelEl.querySelector('#he-canon-id');
    const idHint   = state.panelEl.querySelector('#he-id-hint');
    if (v === '__new__'){
      state.newMode = true;
      state.selectedName = null;
      newBlock.style.display = 'block';
      idInput.value = '';
      idHint.textContent = 'New landmarks get their ID from the hex you click.';
      setStatus('Fill in name + kind, then click a hex.', false);
    } else if (v){
      state.newMode = false;
      state.selectedName = v;
      newBlock.style.display = 'none';
      const existing = GCCLandmarks.getByName(v);
      idInput.value = (existing && existing.id) ? existing.id : '';
      idHint.textContent = existing && existing.id
        ? 'Type the canonical ID and press Enter (or Set) to override.'
        : 'No ID yet — type the canonical ID or click a hex.';
      const idLabel = existing && existing.id ? ` (currently ${existing.id})` : ' (unplaced)';
      setStatus(`Armed: ${v}${idLabel}. Click a hex, or type an ID above.`, true);
    } else {
      state.newMode = false;
      state.selectedName = null;
      newBlock.style.display = 'none';
      idInput.value = '';
      idHint.textContent = 'Select a landmark first.';
      setStatus('Pick a landmark, then click a hex.', false);
    }
  }

  function onSetCanonicalId(){
    const idInput = state.panelEl.querySelector('#he-canon-id');
    const idHint  = state.panelEl.querySelector('#he-id-hint');
    if (!state.selectedName){
      idHint.textContent = 'Pick a landmark first (Canonical ID override needs a name).';
      return;
    }
    const raw = (idInput.value || '').trim().toUpperCase();
    if (!raw){
      idHint.textContent = 'Type a hex ID like D4-86.';
      return;
    }
    const parsed = (typeof darleneToInternal === 'function') ? darleneToInternal(raw) : null;
    if (!parsed){
      idHint.textContent = `"${raw}" is not a valid hex ID.`;
      return;
    }
    const name = state.selectedName;
    const normalized = (typeof hexIdStr === 'function')
      ? hexIdStr(parsed.col, parsed.row)
      : raw;

    const existing = GCCLandmarks.getByName(name) || {};
    const payload = {
      name,
      id:     normalized,
      kind:   existing.kind   || 'city',
      region: existing.region,
      notes:  existing.notes,
    };
    if (existing.symbolPixel) payload.symbolPixel = existing.symbolPixel;
    const ok = GCCLandmarks.setOverride(payload);
    LOG('canonical ID set →', { name, id: normalized, ok });
    if (ok){
      idHint.textContent = `✓ ${name} → ${normalized}`;
      showToast(`${name} → ${normalized} [CANON]`);
      refreshSelect();
      redrawOverlay();
    } else {
      idHint.textContent = 'Failed to update override.';
    }
  }

  function setStatus(msg, armed){
    const el = state.panelEl.querySelector('#he-status');
    el.textContent = msg;
    el.classList.toggle('armed', !!armed);
  }

  // ── Map click routing ────────────────────────────────────────────────────
  function onMapClick(ev){
    if (!state.active) return;
    LOG('click received at', ev.clientX, ev.clientY, 'tab=', state.activeTab);
    // Suppress map's bubble-phase click unconditionally while editor is
    // open — keeps side-panel/move-dialog from firing regardless of tab.
    // stopImmediate also blocks co-registered listeners on the same target.
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();

    if (state.activeTab === 'landmarks'){
      onLandmarksClick(ev);
    }
    // Paint / Outline / Draw: no-op for Phase 1 — click is still swallowed
    // so the map doesn't open the side panel or pop the move dialog.
  }

  function onLandmarksClick(ev){
    if (typeof screenToMap !== 'function' || typeof mapToHex !== 'function'){
      LOG('✗ screenToMap or mapToHex not a function');
      setStatus('Map coord helpers not available yet.', false); return;
    }
    const m = screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = mapToHex(m.x, m.y);
    if (!hit){ setStatus('Click was outside the hex grid.', false); return; }

    let name, kind, region, notes;
    if (state.newMode){
      name = (state.newFields.name || '').trim();
      if (!name){ setStatus('Enter a name first.', false); return; }
      kind = state.newFields.kind || 'city';
      region = state.newFields.region || '';
    } else if (state.selectedName){
      name = state.selectedName;
      const existing = GCCLandmarks.getByName(name) || {};
      kind = existing.kind || 'city';
      region = existing.region;
      notes = existing.notes;
    } else {
      setStatus('Pick a landmark first.', false);
      return;
    }

    const id = hexIdStr(hit.col, hit.row);
    const payload = { name, id, kind, region, notes };
    payload.symbolPixel = { mx: m.x, my: m.y };
    const ok = GCCLandmarks.setOverride(payload);
    LOG('setOverride →', { name, id, kind, ok, pixel: { mx: m.x, my: m.y } });
    showToast(`${name} → ${id}`);
    setStatus(`Placed: ${name} at ${id}. Pick next.`, false);

    if (state.newMode){
      state.panelEl.querySelector('#he-new-name').value = '';
      state.panelEl.querySelector('#he-new-region').value = '';
      state.panelEl.querySelector('#he-new-kind').value = 'city';
      state.newFields.name = '';
      state.newFields.region = '';
      state.newFields.kind = 'city';
    }
    state.selectedName = null;
    refreshSelect();
    redrawOverlay();
  }

  // ── Landmark actions ─────────────────────────────────────────────────────
  function onRemove(){
    const name = state.selectedName;
    if (!name){ setStatus('Pick an overridden landmark first.', false); return; }
    if (GCCLandmarks.removeOverride(name)){
      showToast(`Cleared override for ${name}`);
      setStatus(`Cleared ${name}. File-data hex restored (if any).`, false);
      state.selectedName = null;
      refreshSelect();
      redrawOverlay();
    } else {
      setStatus(`${name} has no override to clear.`, false);
    }
  }

  function onExport(){
    const src = GCCLandmarks.exportMergedSource();
    console.log('── gcc-landmarks.js export ──');
    console.log(src);
    navigator.clipboard && navigator.clipboard.writeText(src).then(
      () => showToast('Exported to clipboard (also in console)'),
      () => showToast('Exported to console (clipboard blocked)')
    );
  }

  function onReset(){
    if (!confirm('Clear all landmark overrides? File-data entries are not touched.')) return;
    GCCLandmarks.clearOverrides();
    showToast('All overrides cleared');
    refreshSelect();
    redrawOverlay();
  }

  function redrawOverlay(){
    if (typeof rebuildLandmarkOverlay === 'function'){
      rebuildLandmarkOverlay();
    } else if (typeof rebuildGrid === 'function'){
      rebuildGrid();
    } else if (typeof buildHexGrid === 'function'){
      buildHexGrid();
    }
  }

  // ── Enter / exit mode ────────────────────────────────────────────────────
  function enter(){
    if (state.active) return;
    if (typeof GCCLandmarks === 'undefined'){
      (typeof showToast === 'function' ? showToast : alert)('gcc-landmarks.js not loaded');
      return;
    }
    state.active = true;
    document.body.classList.add('he-editing');
    if (!state.panelEl) buildPanel();
    else state.panelEl.style.display = 'block';
    refreshSelect();
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.addEventListener('click', onMapClick, true);
    document.addEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-hex-edit');
    if (btn) btn.classList.add('active');
    LOG('entered, activeTab=', state.activeTab);
  }

  function exit(){
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove('he-editing');
    if (state.panelEl) state.panelEl.style.display = 'none';
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.removeEventListener('click', onMapClick, true);
    document.removeEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-hex-edit');
    if (btn) btn.classList.remove('active');
  }

  function toggle(){ state.active ? exit() : enter(); }

  function onKey(e){
    if (e.key === 'Escape'){ exit(); }
  }

  // ── Wire toolbar button after DOM ready ──────────────────────────────────
  function wire(){
    const btn = document.getElementById('btn-hex-edit');
    if (btn){ btn.addEventListener('click', toggle); LOG('✓ #btn-hex-edit wired'); }
    else { LOG('✗ #btn-hex-edit not found — toolbar button missing?'); }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.GCCHexEdit = { enter, exit, toggle, setActiveTab };
})();
