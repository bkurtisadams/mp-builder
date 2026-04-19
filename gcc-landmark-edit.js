// gcc-landmark-edit.js v0.3.0 — 2026-04-19
// Click-to-place landmark editor + canonical hex ID override input.
// Requires globals: GCCLandmarks, hexIdStr, darleneToInternal, mapToHex,
//   screenToMap, showToast, buildHexGrid/rebuildGrid.
// v0.3.0: removed alignment-era machinery (placement mode radios, align
//   buttons, onAlignFromPlaced/TPS/Reset, gatherHexCenterControls).
//   Alignment is now handled entirely by the image-align transform.

(function(){
  if (typeof window === 'undefined') return;
  const LOG = (...a) => console.log('[landmark-edit]', ...a);
  LOG('gcc-landmark-edit.js v0.3.0 loaded');

  const KINDS = ['city','town','castle','ruin','village','feature','landmark'];

  const state = {
    active: false,
    selectedName: null,       // landmark name currently armed for placement
    newMode: false,           // creating a brand-new landmark
    newFields: { name:'', kind:'city', region:'' },
    panelEl: null,
  };

  // ── UI: floating panel ────────────────────────────────────────────────────
  function buildPanel(){
    const p = document.createElement('div');
    p.id = 'landmark-edit-panel';
    p.innerHTML = `
      <div class="le-hdr">
        <span>📍 Landmark Editor</span>
        <button class="le-close" title="Exit">✕</button>
      </div>
      <div class="le-body">
        <label class="le-lbl">Landmark</label>
        <select class="le-select" id="le-select"></select>

        <label class="le-lbl" style="margin-top:8px">Canonical Hex ID</label>
        <div class="le-id-row">
          <input class="le-input le-id-input" id="le-canon-id" type="text"
                 placeholder="e.g. D4-86" autocomplete="off" spellcheck="false">
          <button class="le-btn le-id-btn" id="le-set-id" title="Apply this ID directly, overriding any placed pixel position">Set</button>
        </div>
        <div class="le-id-hint" id="le-id-hint">Select a landmark first.</div>

        <div class="le-new" id="le-new" style="display:none">
          <label class="le-lbl">Name</label>
          <input class="le-input" id="le-new-name" type="text" placeholder="e.g. Highfolk">
          <label class="le-lbl">Kind</label>
          <select class="le-input" id="le-new-kind">
            ${KINDS.map(k => `<option value="${k}">${k}</option>`).join('')}
          </select>
          <label class="le-lbl">Region (optional)</label>
          <input class="le-input" id="le-new-region" type="text" placeholder="e.g. Highvale">
        </div>

        <div class="le-status" id="le-status">Pick a landmark, then click a hex.</div>

        <div class="le-btns">
          <button class="le-btn" id="le-remove">Clear Override</button>
          <button class="le-btn" id="le-export">Export</button>
          <button class="le-btn le-danger" id="le-reset">Reset All</button>
        </div>
      </div>
    `;
    document.body.appendChild(p);
    state.panelEl = p;

    p.querySelector('.le-close').onclick = exit;
    p.querySelector('#le-select').onchange = onSelect;
    p.querySelector('#le-remove').onclick  = onRemove;
    p.querySelector('#le-export').onclick  = onExport;
    p.querySelector('#le-reset').onclick   = onReset;
    p.querySelector('#le-set-id').onclick  = onSetCanonicalId;
    p.querySelector('#le-canon-id').addEventListener('keydown', e => {
      if (e.key === 'Enter'){ e.preventDefault(); onSetCanonicalId(); }
    });
    p.querySelector('#le-new-name').oninput  = e => state.newFields.name   = e.target.value;
    p.querySelector('#le-new-kind').onchange = e => state.newFields.kind   = e.target.value;
    p.querySelector('#le-new-region').oninput= e => state.newFields.region = e.target.value;

    injectStyles();
    refreshSelect();
    return p;
  }

  function injectStyles(){
    if (document.getElementById('le-styles')) return;
    const s = document.createElement('style');
    s.id = 'le-styles';
    s.textContent = `
      #landmark-edit-panel {
        position:fixed; top:72px; right:16px; width:260px; z-index:2000;
        background:rgba(20,14,6,.96); border:1px solid #c8941a; border-radius:3px;
        font-family:'Cinzel',serif; color:#f4e4b8; box-shadow:0 4px 20px rgba(0,0,0,.6);
      }
      #landmark-edit-panel .le-hdr {
        display:flex; justify-content:space-between; align-items:center;
        padding:8px 10px; background:rgba(200,148,26,.18); border-bottom:1px solid #8b6e45;
        font-size:13px; font-weight:600; letter-spacing:.05em;
      }
      #landmark-edit-panel .le-close {
        background:none; border:none; color:#c8a96e; font-size:14px; cursor:pointer; padding:0 4px;
      }
      #landmark-edit-panel .le-close:hover { color:#e8b840; }
      #landmark-edit-panel .le-body { padding:10px; }
      #landmark-edit-panel .le-lbl {
        display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em;
        color:#c8a96e; margin:6px 0 3px;
      }
      #landmark-edit-panel .le-select, #landmark-edit-panel .le-input {
        width:100%; background:rgba(0,0,0,.4); color:#f4e4b8; border:1px solid #8b6e45;
        border-radius:2px; padding:4px 6px; font-family:inherit; font-size:12px; box-sizing:border-box;
      }
      #landmark-edit-panel .le-status {
        margin-top:8px; padding:6px 8px; background:rgba(0,0,0,.35); border-left:2px solid #c8941a;
        font-size:11px; line-height:1.4; color:#c8a96e; min-height:14px;
      }
      #landmark-edit-panel .le-status.armed { color:#44ffbb; border-left-color:#44ffbb; }
      #landmark-edit-panel .le-id-row { display:flex; gap:6px; align-items:stretch; }
      #landmark-edit-panel .le-id-input { flex:1; font-family:monospace; letter-spacing:.04em; text-transform:uppercase; }
      #landmark-edit-panel .le-id-btn {
        flex:0 0 auto; padding:4px 10px; font-size:11px;
        background:rgba(68,255,187,.14); border:1px solid #44ffbb; color:#aaffdd;
        border-radius:2px; font-family:inherit; cursor:pointer;
      }
      #landmark-edit-panel .le-id-btn:hover { background:rgba(68,255,187,.28); color:#ddffee; }
      #landmark-edit-panel .le-id-hint { font-size:10px; color:#c8a96e; margin-top:3px; min-height:12px; line-height:1.3; }
      #landmark-edit-panel .le-btns { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
      #landmark-edit-panel .le-btn {
        flex:1; min-width:70px; background:rgba(200,148,26,.1); border:1px solid #8b6e45;
        color:#c8a96e; padding:5px 8px; border-radius:2px; font-family:inherit; font-size:11px;
        cursor:pointer; transition:all .12s;
      }
      #landmark-edit-panel .le-btn:hover { background:rgba(200,148,26,.25); color:#e8b840; border-color:#c8941a; }
      #landmark-edit-panel .le-btn.le-danger { color:#cc6644; border-color:#663311; }
      #landmark-edit-panel .le-btn.le-danger:hover { background:rgba(180,50,20,.2); color:#ff7755; }
      body.le-placing #map-wrap { cursor:crosshair !important; }
    `;
    document.head.appendChild(s);
  }

  function refreshSelect(){
    const sel = state.panelEl.querySelector('#le-select');
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
    const newBlock = state.panelEl.querySelector('#le-new');
    const idInput  = state.panelEl.querySelector('#le-canon-id');
    const idHint   = state.panelEl.querySelector('#le-id-hint');
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

  // ── Canonical ID override ────────────────────────────────────────────────
  // Bypass pixel-position conversion entirely. User types an authoritative
  // Darlene hex ID (e.g. D4-86 for City of Greyhawk per the 1983 boxed set).
  // We validate with darleneToInternal, then stamp the id onto the landmark
  // override without touching symbolPixel. Rendering will use the new id to
  // compute hex position via hexCenterDisplay — immune to formula drift from
  // the old pixel click.
  function onSetCanonicalId(){
    const name = state.selectedName;
    const idHint = state.panelEl.querySelector('#le-id-hint');
    if (!name){
      idHint.textContent = 'Select a landmark first.';
      return;
    }
    const raw = state.panelEl.querySelector('#le-canon-id').value.trim();
    if (!raw){ idHint.textContent = 'Enter an ID like D4-86.'; return; }
    if (typeof darleneToInternal !== 'function'){
      idHint.textContent = 'ID validator not available.'; return;
    }
    const parsed = darleneToInternal(raw);
    if (!parsed){
      idHint.textContent = `"${raw}" is not a valid Darlene ID.`;
      return;
    }
    // Normalize via hexIdStr so we store the canonical form regardless of
    // case / whitespace in the user's input.
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
    // Preserve an existing symbolPixel if present (marker position on the
    // city art); drop hexCenterPixel since it's now derived from the id.
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
    const el = state.panelEl.querySelector('#le-status');
    el.textContent = msg;
    el.classList.toggle('armed', !!armed);
  }

  // ── Map click interception ───────────────────────────────────────────────
  function onMapClick(ev){
    if (!state.active) return;
    LOG('click received at', ev.clientX, ev.clientY);
    const wrap = document.getElementById('map-wrap');
    if (!wrap) return;
    if (typeof screenToMap !== 'function' || typeof mapToHex !== 'function'){
      LOG('✗ screenToMap or mapToHex not a function');
      setStatus('Map coord helpers not available yet.', false); return;
    }
    const m = screenToMap(ev.clientX, ev.clientY);
    LOG('screenToMap →', m);
    if (!m) return;
    const hit = mapToHex(m.x, m.y);
    LOG('mapToHex →', hit);
    if (!hit){ setStatus('Click was outside the hex grid.', false); return; }

    ev.stopPropagation();
    ev.preventDefault();

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
    LOG('merged count now:', GCCLandmarks.all().length, 'overrides:', Object.keys(GCCLandmarks.exportOverrides()));
    showToast(`${name} → ${id}`);
    setStatus(`Placed: ${name} at ${id}. Pick next.`, false);

    if (state.newMode){
      state.panelEl.querySelector('#le-new-name').value = '';
      state.newFields.name = '';
    }
    state.selectedName = null;
    refreshSelect();
    redrawOverlay();
  }

  // ── Actions ──────────────────────────────────────────────────────────────
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
      LOG('rebuildLandmarkOverlay()'); rebuildLandmarkOverlay();
    } else if (typeof rebuildGrid === 'function'){
      LOG('rebuildGrid() (fallback)'); rebuildGrid();
    } else if (typeof buildHexGrid === 'function'){
      LOG('buildHexGrid() (fallback)'); buildHexGrid();
    } else {
      LOG('✗ no rebuild path available');
    }
  }

  // ── Enter / exit mode ────────────────────────────────────────────────────
  function enter(){
    LOG('enter() called; state.active was', state.active);
    if (state.active) return;
    if (typeof GCCLandmarks === 'undefined'){
      LOG('✗ GCCLandmarks undefined — gcc-landmarks.js not loaded');
      (typeof showToast === 'function' ? showToast : alert)('gcc-landmarks.js not loaded');
      return;
    }
    state.active = true;
    document.body.classList.add('le-placing');
    if (!state.panelEl) buildPanel();
    else state.panelEl.style.display = 'block';
    refreshSelect();
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      wrap.addEventListener('click', onMapClick, true);
      LOG('✓ click listener attached to #map-wrap');
    } else {
      LOG('✗ #map-wrap not found');
    }
    document.addEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-landmark-edit');
    if (btn) btn.classList.add('active');
    LOG('mode entered');
  }

  function exit(){
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove('le-placing');
    if (state.panelEl) state.panelEl.style.display = 'none';
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.removeEventListener('click', onMapClick, true);
    document.removeEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-landmark-edit');
    if (btn) btn.classList.remove('active');
  }

  function toggle(){ state.active ? exit() : enter(); }

  function onKey(e){
    if (e.key === 'Escape'){ exit(); }
  }

  // ── Wire toolbar button after DOM ready ──────────────────────────────────
  function wire(){
    const btn = document.getElementById('btn-landmark-edit');
    if (btn){
      btn.addEventListener('click', toggle);
      LOG('✓ button #btn-landmark-edit wired');
    } else {
      LOG('✗ button #btn-landmark-edit not found — toolbar edit missing?');
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', wire);
  else wire();

  window.GCCLandmarkEdit = { enter, exit, toggle };
})();
