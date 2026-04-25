// gcc-hex-edit.js v0.6.6 — 2026-04-23
// Hex Editor: tab shell for Landmarks / Paint / Outline / Draw.
// Requires globals: GCCLandmarks, GCCTerrain, TERRAIN, hexIdStr,
//   darleneToInternal, mapToHex, screenToMap, showToast,
//   rebuildLandmarkOverlay/rebuildGrid/buildHexGrid,
//   makeDraggable (from greyhawk-map.html inline script).
//
// v0.6.6: Parse LGG ⚗ button — small button beside the Description
//   label. Reads the textarea, runs parseLggHeader() to split the
//   canonical LGG city-entry format into structured fields, and
//   replaces desc with just the prose. Rejoins PDF-extracted mid-
//   sentence line breaks (including hyphenated word breaks like
//   "particu-\nlarly" → "particularly"). Idempotent: running it on
//   already-parsed prose returns null and leaves state untouched.
// v0.6.5: Panel now bounded to viewport height. LGG header + desc
//   textarea made the Landmarks pane taller than the screen on many
//   laptops — bottom fields were unreachable. Switched panel to a
//   flex column (header + tabs fixed, active pane flex:1 with its
//   own overflow-y:auto). Added a themed 6px scrollbar in the panel
//   gold.
// v0.6.4: LGG Header group — rulerName, rulerTitle, pop, popTotal,
//   demihumans, humanoids, resources. Seven inputs wired through a
//   shared LGG_FIELDS table and a unified persistLandmarkFields() save
//   function that writes all editor state (desc + LGG) in a single
//   setOverride call on any field blur. Datalist offers None/Few/Some/
//   Many suggestions for the two density fields. Supports the henchmen-
//   recruitment use case.
// v0.6.3: Description textarea on Landmarks pane — long-form landmark
//   text surfaced in the map's new landmark info panel (Layer 1+2 of
//   landmark-details). Saves on blur for placed landmarks; captured in
//   state.newFields for new-mode and applied on placement. Threaded
//   through canonical-ID override + hex-click paths.
// v0.6.2: Rename "Port ⚓" checkbox → "On Water ≈" (broad water-adjacent
//   tag). Element IDs he-is-port/he-port-hint/he-port-row → he-on-water/
//   he-water-hint/he-water-row; handler onPortToggle → onWaterToggle.
//   Type-filter input above landmark dropdown — case-insensitive substring
//   filter via refreshSelect(filter). Filter hides "+ New landmark…"
//   option while active so it doesn't match unintentionally. isPort +
//   anchor ⚓ are retained in the overlay path but reserved for voyage
//   sim; no UI toggle for it yet.
// v0.6.1: Port ⚓ checkbox on Landmarks pane — toggles isPort attribute
//   on landmarks. Immediate apply for placed landmarks (setOverride +
//   redrawOverlay so ⚓ appears/disappears without re-clicking the hex).
//   New-mode captures state; hex-click + canonical-ID paths preserve
//   isPort through re-placement.
// v0.6.0: Panel is now draggable by its header — calls global
//   makeDraggable helper on buildPanel and restores saved position on
//   re-enter (re-clamps into viewport if browser was resized). Drag
//   state persisted to 'gh-hex-edit-pos' in localStorage. Dblclick
//   header to reset to default (top:72px right:16px).
// v0.5.1: opacity slider on Paint tab controls the --hex-paint-alpha
//   CSS var on :root; all painted hexes re-render via browser cascade
//   (no JS iteration). Slider value persisted to localStorage and
//   applied on script load so first paint-session render matches
//   last-saved opacity.
// v0.5.0: Phase 2 — Paint tab live. 2-col terrain palette + Erase,
//   click-to-paint plus drag-paint (mousedown/mousemove/mouseup capture
//   while Paint tab is active, stopImmediatePropagation beats the map's
//   pan handler). Paint writes to GCCTerrain and updates the hex
//   polygon's --hex-paint CSS var directly (no grid rebuild). Per-hex
//   dedup prevents re-paint across a single hex during a drag. Paint tab
//   has its own status line, per-terrain count stats, Export, Reset All.
//   Outline and Draw remain stubs.
// v0.4.0: Phase 1 refactor. Renamed #landmark-edit-panel → #hex-edit-panel,
//   #btn-landmark-edit → #btn-hex-edit, body.le-placing → body.he-editing,
//   CSS prefix le- → he-, window.GCCLandmarkEdit → window.GCCHexEdit.
//   onMapClick routes to the active tab; non-landmark tabs still swallow
//   clicks to keep the map's side-panel/move-dialog suppressed.
// (Pre-rename history lives in gcc-landmark-edit.js v0.1.0–v0.3.1.)

(function(){
  if (typeof window === 'undefined') return;
  const LOG = (...a) => console.log('[hex-edit]', ...a);
  LOG('gcc-hex-edit.js v0.6.0 loaded');

  const KINDS = ['city','town','castle','ruin','village','feature','landmark'];

  // LGG header fields — single source of truth for the Landmarks pane's
  // input wiring, new-mode state capture, and existing-mode blur save.
  // `id`: DOM element id. `key`: field name in GCCLandmarks schema.
  // `numeric`: true → value is parsed to int before persist + compared/
  // displayed as number. Everything else is stored as a string.
  const LGG_FIELDS = [
    { id:'he-ruler-name',  key:'rulerName' },
    { id:'he-ruler-title', key:'rulerTitle' },
    { id:'he-pop',         key:'pop',        numeric:true },
    { id:'he-pop-total',   key:'popTotal',   numeric:true },
    { id:'he-demihumans',  key:'demihumans' },
    { id:'he-humanoids',   key:'humanoids' },
    { id:'he-resources',   key:'resources' },
  ];

  // Parse a raw LGG gazetteer paragraph into structured fields. The LGG
  // city-entry format is consistent:
  //   <rulerTitle line(s)>            ← anything before the em-dash
  //   — <rulerName>                   ← em-dash, en-dash, or leading "-"
  //   Population: N (city)
  //   N+ (total, including surrounding area)
  //   Demi-humans: <density>
  //   Humanoids:  <density>
  //   Resources:  <comma-list>
  //   <history + politics prose>
  // Returns an object with the seven LGG fields + cleaned `desc` (prose),
  // or null if no recognizable structured fields were found (don't touch
  // the description in that case — probably already parsed or free-form).
  // PDF-extracted prose usually has mid-sentence line breaks, which we
  // rejoin with spaces; double-newline paragraph breaks are preserved.
  function parseLggHeader(text){
    if (!text || typeof text !== 'string') return null;
    const lines = text.split(/\r?\n/);
    const out = { rulerTitle:'', rulerName:'', pop:'', popTotal:'',
                  demihumans:'', humanoids:'', resources:'', desc:'' };
    const titleLines = [], proseLines = [];
    let foundStructured = false, proseStarted = false;

    for (const raw of lines){
      if (proseStarted){ proseLines.push(raw); continue; }
      const line = raw.trim();
      if (!line) continue;  // blank lines in header zone: ignore

      let m;
      // em-dash ruler name (U+2014, U+2013, or leading ASCII hyphen)
      if (!out.rulerName && (m = line.match(/^[\u2014\u2013\-]\s*(.+)$/))){
        out.rulerName = m[1].trim(); foundStructured = true; continue;
      }
      // Population: N (optional parenthetical after)
      if ((m = line.match(/^Population:\s*([0-9,]+)/i))){
        out.pop = m[1].replace(/[^0-9]/g,''); foundStructured = true; continue;
      }
      // "N+ (total, including...)" or "(total, including surrounding area, N...)"
      if ((m = line.match(/([0-9,]+)\+?\s*\(total/i)) ||
          (m = line.match(/\(total[^0-9]*([0-9,]+)/i))){
        out.popTotal = m[1].replace(/[^0-9]/g,''); foundStructured = true; continue;
      }
      if ((m = line.match(/^Demi[\s\-]?humans?:\s*(.+)$/i))){
        out.demihumans = m[1].trim(); foundStructured = true; continue;
      }
      if ((m = line.match(/^Humanoids?:\s*(.+)$/i))){
        out.humanoids = m[1].trim(); foundStructured = true; continue;
      }
      if ((m = line.match(/^Resources?:\s*(.+)$/i))){
        out.resources = m[1].trim(); foundStructured = true; continue;
      }
      // No structured match: title if we haven't started structured parsing,
      // otherwise this line begins the prose.
      if (!foundStructured){ titleLines.push(line); }
      else { proseStarted = true; proseLines.push(raw); }
    }

    out.rulerTitle = titleLines.join(' ').trim();
    let desc = proseLines.join('\n').trim();
    desc = desc.replace(/([a-z])-\n([a-z])/g, '$1$2');  // rejoin hyphenated word breaks
    desc = desc.replace(/([^\n])\n([^\n])/g, '$1 $2');  // join single linebreaks with space
    out.desc = desc;

    // Nothing recognizable — caller should leave desc alone.
    if (!out.rulerName && !out.pop && !out.demihumans && !out.humanoids && !out.resources){
      return null;
    }
    return out;
  }
  const TABS = [
    { id:'landmarks', label:'Landmarks' },
    { id:'paint',     label:'Paint' },
    { id:'outline',   label:'Outline' },
    { id:'draw',      label:'Draw' },
  ];

  // ── Paint overlay opacity ─────────────────────────────────────────────────
  // Persisted 0..1; applied to :root as --hex-paint-alpha so all painted
  // hexes re-render via the CSS cascade whenever it changes. Loaded at
  // script start so the initial buildHexGrid renders at the right opacity.
  const PAINT_OPACITY_KEY = 'gcc-terrain-opacity';
  const DEFAULT_PAINT_OPACITY = 0.4;
  function loadPaintOpacity(){
    try {
      const raw = localStorage.getItem(PAINT_OPACITY_KEY);
      if (raw == null) return DEFAULT_PAINT_OPACITY;
      const v = parseFloat(raw);
      return (isFinite(v) && v >= 0 && v <= 1) ? v : DEFAULT_PAINT_OPACITY;
    } catch(e){ return DEFAULT_PAINT_OPACITY; }
  }
  function applyPaintOpacity(v){
    document.documentElement.style.setProperty('--hex-paint-alpha', String(v));
  }
  const initialOpacity = loadPaintOpacity();
  applyPaintOpacity(initialOpacity);

  const state = {
    active: false,
    activeTab: 'landmarks',
    selectedName: null,
    newMode: false,
    newFields: {
      name:'', kind:'city', region:'',
      onWater:false, desc:'',
      rulerName:'', rulerTitle:'',
      pop:'', popTotal:'',
      demihumans:'', humanoids:'',
      resources:''
    },
    paintTerrain: 'plains',
    paintOpacity: initialOpacity,
    paintDragging: false,
    lastPaintKey: null,
    rgSelected: null,        // currently selected region name
    rgMode: 'paint',         // 'paint' | 'erase' | 'trace'
    rgOpacity: 0.55,
    rgDragging: false,
    rgLastKey: null,
    rgTrace: [],             // [{col,row}] in-progress polygon vertices
    rgFormMode: null,        // null | 'new' | 'edit'
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
      ${buildPaintPane()}
      ${buildOutlinePane()}
      ${buildStubPane('draw', 'Paths',
        'Draw roads, rivers, trails, and other linear features. Paths carry terrain-speed modifiers that feed the CTT-integrated movement system.',
        'Phase 4')}
    `;
    document.body.appendChild(p);
    state.panelEl = p;

    // Make the panel draggable by its header. makeDraggable is defined as a
    // global in greyhawk-map.html's inline script. Drag ignores button clicks
    // inside the header (so .he-close still works). Position persists to
    // localStorage; double-click the header to reset to default.
    if (typeof window.makeDraggable === 'function'){
      const hdr = p.querySelector('.he-hdr');
      if (hdr){
        state.heDrag = window.makeDraggable(p, hdr, 'gh-hex-edit-pos');
        state.heDrag.restore();  // apply saved pos if any; CSS default otherwise
      }
    }

    // Restore saved panel height. The CSS default is 50vh so first-time
    // users get a compact panel; subsequent opens use whatever they
    // dragged the resize grip to. ResizeObserver writes back on every
    // size change (debounced via rAF) so closing-and-reopening preserves it.
    try {
      const savedH = parseInt(localStorage.getItem('gh-hex-edit-h'), 10);
      if (savedH && savedH >= 200 && savedH <= window.innerHeight - 88){
        p.style.height = savedH + 'px';
      }
    } catch(e){}
    let resizeFrame = null;
    if (typeof ResizeObserver === 'function'){
      const ro = new ResizeObserver(() => {
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          try { localStorage.setItem('gh-hex-edit-h', String(p.offsetHeight)); } catch(e){}
        });
      });
      ro.observe(p);
    }

    p.querySelector('.he-close').onclick = exit;
    p.querySelectorAll('.he-tab').forEach(t =>
      t.onclick = () => setActiveTab(t.dataset.tab));

    // Landmarks tab wiring
    p.querySelector('#he-select').onchange  = onSelect;
    p.querySelector('#he-remove').onclick   = onRemove;
    p.querySelector('#he-export').onclick   = onExport;
    p.querySelector('#he-reset').onclick    = onReset;
    p.querySelector('#he-set-id').onclick   = onSetCanonicalId;
    p.querySelector('#he-parse-lgg').onclick = onParseLggClick;
    p.querySelector('#he-canon-id').addEventListener('keydown', e => {
      if (e.key === 'Enter'){ e.preventDefault(); onSetCanonicalId(); }
    });
    p.querySelector('#he-new-name').oninput   = e => state.newFields.name   = e.target.value;
    p.querySelector('#he-new-kind').onchange  = e => state.newFields.kind   = e.target.value;
    p.querySelector('#he-new-region').oninput = e => state.newFields.region = e.target.value;
    p.querySelector('#he-on-water').onchange  = onWaterToggle;
    p.querySelector('#he-filter').oninput     = e => refreshSelect(e.target.value);
    // Description textarea: in new-mode, capture state; for existing placed
    // landmarks, persist on blur (so we don't thrash setOverride every
    // keystroke). Hint text mirrors the pattern used by the water toggle.
    const descEl = p.querySelector('#he-desc');
    descEl.addEventListener('input', () => {
      const hint = p.querySelector('#he-desc-hint');
      if (state.newMode){ state.newFields.desc = descEl.value; hint.textContent = descEl.value ? 'saved on place' : 'optional'; }
      else if (state.selectedName){ hint.textContent = 'unsaved — click out to save'; }
    });
    descEl.addEventListener('blur', onDescBlur);
    // LGG header fields — unified handler. Each input captures to
    // state.newFields in new-mode; on blur for a placed existing landmark,
    // the full LGG block is written via persistLandmarkLggFields() so we
    // only hit setOverride once per field-exit regardless of how many
    // fields the user touched.
    LGG_FIELDS.forEach(({id, key, numeric}) => {
      const el = p.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (state.newMode){
          state.newFields[key] = numeric ? (el.value.replace(/[^0-9]/g,'') || '') : el.value;
        }
        setLggHint(state.newMode ? 'saved on place' : 'unsaved — click out to save');
      });
      el.addEventListener('blur', onLggFieldBlur);
    });

    // Paint tab wiring
    p.querySelectorAll('.he-swatch').forEach(sw =>
      sw.onclick = () => setPaintTerrain(sw.dataset.terrain));
    p.querySelector('#he-paint-export').onclick = onPaintExport;
    p.querySelector('#he-paint-reset').onclick  = onPaintReset;
    const opacityInput = p.querySelector('#he-opacity');
    const opacityVal   = p.querySelector('#he-opacity-val');
    opacityInput.addEventListener('input', e => {
      const pct = parseInt(e.target.value, 10) || 0;
      const v = pct / 100;
      state.paintOpacity = v;
      applyPaintOpacity(v);
      opacityVal.textContent = `${pct}%`;
    });
    opacityInput.addEventListener('change', e => {
      // Persist on release rather than every 'input' tick to avoid
      // localStorage churn while dragging the slider.
      try { localStorage.setItem(PAINT_OPACITY_KEY, String(state.paintOpacity)); } catch(err){}
    });
    setPaintTerrain(state.paintTerrain);
    updatePaintStats();

    // Outline tab wiring
    p.querySelector('#he-rg-select').onchange    = onRgSelect;
    p.querySelector('#he-rg-newbtn').onclick     = onRgNewBtn;
    p.querySelector('#he-rg-editbtn').onclick    = onRgEditBtn;
    p.querySelector('#he-rg-form-cancel').onclick   = onRgFormCancel;
    p.querySelector('#he-rg-form-save').onclick     = onRgFormSave;
    p.querySelector('#he-rg-form-clearhex').onclick = onRgFormClearHex;
    p.querySelector('#he-rg-form-delete').onclick   = onRgFormDelete;
    p.querySelector('#he-rg-bootstrap').onclick  = onRgBootstrap;
    p.querySelector('#he-rg-export').onclick     = onRgExport;
    p.querySelector('#he-rg-reset').onclick      = onRgReset;
    p.querySelector('#he-rg-trace-fill').onclick  = onRgTraceFill;
    p.querySelector('#he-rg-trace-undo').onclick  = onRgTraceUndo;
    p.querySelector('#he-rg-trace-clear').onclick = onRgTraceClear;
    p.querySelectorAll('.he-rg-mode').forEach(b =>
      b.onclick = () => setRgMode(b.dataset.mode));
    const rgOp = p.querySelector('#he-rg-opacity');
    const rgOpVal = p.querySelector('#he-rg-opacity-val');
    rgOp.addEventListener('input', e => {
      const pct = parseInt(e.target.value, 10) || 0;
      state.rgOpacity = pct / 100;
      rgOpVal.textContent = `${pct}%`;
      if (state.activeTab === 'outline') redrawAllRegionOverlay();
    });
    refreshRegionSelect();
    setRgMode(state.rgMode);
    updateRgStats();

    injectStyles();
    setActiveTab(state.activeTab);
    refreshSelect();
    return p;
  }

  function buildPaintPane(){
    // Canon-driven palette (1980 WoG + 1983 Darlene key). Order flows open
    // → forested → rough → water. Short labels fit the 3-col narrow cells;
    // full labels live in TERRAIN[id].label and show in the hover readout.
    const types = [
      { id:'plains',           short:'Plains'    },
      { id:'hardwood',         short:'Hwd Forest'},
      { id:'conifer',          short:'Con Forest'},
      { id:'jungle',           short:'Jungle'    },
      { id:'hills',            short:'Hills'     },
      { id:'forest_hills',     short:'Fst Hills' },
      { id:'mountains',        short:'Mountains' },
      { id:'desert',           short:'Desert'    },
      { id:'barrens',          short:'Barrens'   },
      { id:'swamp',            short:'Swamp'     },
      { id:'water',            short:'Water'     },
      { id:'water_fresh',      short:'Fresh'     },
      { id:'water_inland_sea', short:'Inld Sea'  },
      { id:'water_coastal',    short:'Coastal'   },
      { id:'water_shallow',    short:'Shallow'   },
      { id:'water_deep',       short:'Deep'      },
    ];
    const swatches = types.map(({id, short}) => {
      // Swatch chip always shows full-saturation rgb so the palette stays
      // legible regardless of the overlay opacity slider.
      const rgb = (typeof TERRAIN !== 'undefined' && TERRAIN[id]?.rgb) || '0, 0, 0';
      const full = (typeof TERRAIN !== 'undefined' && TERRAIN[id]?.label) || id;
      return `<button class="he-swatch" data-terrain="${id}" style="--swatch:rgb(${rgb})" title="${full}"><span class="he-swatch-chip"></span><span class="he-swatch-lbl">${short}</span></button>`;
    }).join('');
    const pct = Math.round(state.paintOpacity * 100);
    return `
      <div class="he-pane" id="he-pane-paint">
        <label class="he-lbl">Terrain</label>
        <div class="he-palette">
          ${swatches}
          <button class="he-swatch he-swatch-erase" data-terrain="__erase" title="Clear paint on clicked hex (reverts to base)"><span class="he-swatch-chip he-swatch-chip-erase">⌫</span><span class="he-swatch-lbl">Erase</span></button>
        </div>
        <div class="he-opacity-row">
          <label class="he-lbl">Overlay Opacity</label>
          <div class="he-opacity-controls">
            <input type="range" class="he-opacity" id="he-opacity" min="0" max="100" step="1" value="${pct}">
            <span class="he-opacity-val" id="he-opacity-val">${pct}%</span>
          </div>
        </div>
        <div class="he-status" id="he-paint-status">Pick a terrain, then click or drag over hexes.</div>
        <div class="he-btns">
          <button class="he-btn" id="he-paint-export">Export</button>
          <button class="he-btn he-danger" id="he-paint-reset">Reset All</button>
        </div>
        <div class="he-paint-stats" id="he-paint-stats">Nothing painted yet.</div>
      </div>
    `;
  }

  function buildLandmarksPane(){
    return `
      <div class="he-pane" id="he-pane-landmarks">
        <label class="he-lbl">Landmark</label>
        <input class="he-input" id="he-filter" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false" style="margin-bottom:4px">
        <select class="he-select" id="he-select"></select>

        <label class="he-lbl" style="margin-top:8px">Canonical Hex ID</label>
        <div class="he-id-row">
          <input class="he-input he-id-input" id="he-canon-id" type="text"
                 placeholder="e.g. D4-86" autocomplete="off" spellcheck="false">
          <button class="he-btn he-id-btn" id="he-set-id" title="Apply this ID directly, overriding any placed pixel position">Set</button>
        </div>
        <div class="he-id-hint" id="he-id-hint">Select a landmark first.</div>

        <label class="he-lbl he-water-row" style="margin-top:8px;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="he-on-water" style="margin:0;cursor:pointer">
          <span>On Water ≈</span>
          <span class="he-water-hint" id="he-water-hint" style="color:#88ccdd;font-weight:normal;font-size:9px;margin-left:auto">—</span>
        </label>

        <div class="he-group-hdr" style="margin-top:10px;padding-top:6px;border-top:1px solid rgba(139,110,69,.3);font-family:'Cinzel',serif;font-size:9px;color:#8b6e45;letter-spacing:.1em;text-transform:uppercase">LGG Header
          <span class="he-lgg-hint" id="he-lgg-hint" style="color:#88ccdd;font-weight:normal;font-size:9px;letter-spacing:normal;text-transform:none;float:right;font-family:inherit">—</span>
        </div>
        <label class="he-lbl">Ruler Name</label>
        <input class="he-input he-lgg-field" id="he-ruler-name" type="text" placeholder="e.g. Nerof Gasgol" autocomplete="off">
        <label class="he-lbl">Ruler Title</label>
        <input class="he-input he-lgg-field" id="he-ruler-title" type="text" placeholder="e.g. Lord Mayor" autocomplete="off">
        <label class="he-lbl">Population</label>
        <input class="he-input he-lgg-field" id="he-pop" type="number" min="0" placeholder="e.g. 58000">
        <label class="he-lbl">Pop. Total</label>
        <input class="he-input he-lgg-field" id="he-pop-total" type="number" min="0" placeholder="e.g. 75000 (including surroundings)">
        <label class="he-lbl">Demi-humans</label>
        <input class="he-input he-lgg-field" id="he-demihumans" type="text" list="he-density-list" placeholder="None / Few / Some / Many" autocomplete="off">
        <label class="he-lbl">Humanoids</label>
        <input class="he-input he-lgg-field" id="he-humanoids" type="text" list="he-density-list" placeholder="None / Few / Some / Many" autocomplete="off">
        <label class="he-lbl">Resources</label>
        <input class="he-input he-lgg-field" id="he-resources" type="text" placeholder="e.g. silver, gold, gems (I-IV)" autocomplete="off">
        <datalist id="he-density-list">
          <option value="None">
          <option value="Few">
          <option value="Some">
          <option value="Many">
        </datalist>

        <label class="he-lbl" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:6px">
          <span style="flex-shrink:0">Description</span>
          <span style="display:flex;align-items:center;gap:6px;font-weight:normal">
            <button class="he-btn he-btn-mini" id="he-parse-lgg" type="button" title="Parse LGG header from description: extracts ruler / population / density / resources fields, leaves the narrative prose behind.">Parse LGG ⚗</button>
            <span class="he-desc-hint" id="he-desc-hint" style="color:#88ccdd;font-size:9px">—</span>
          </span>
        </label>
        <textarea class="he-input" id="he-desc" rows="5" placeholder="Long-form description shown in the map's landmark info panel. Player-visible." style="resize:vertical;min-height:70px;font-family:inherit"></textarea>

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

  function buildOutlinePane(){
    return `
      <div class="he-pane" id="he-pane-outline">
        <label class="he-lbl">Region</label>
        <select class="he-select" id="he-rg-select"></select>

        <div class="he-rg-form" id="he-rg-form" style="display:none">
          <label class="he-lbl" style="margin-top:6px">
            <span id="he-rg-form-title">New Region</span>
            <span class="he-rg-form-base" id="he-rg-form-base" style="display:none;color:#88ccdd;font-weight:normal;font-size:9px;float:right">BASE</span>
          </label>
          <input class="he-input" id="he-rg-form-name" type="text" placeholder="e.g. Sea Princes" autocomplete="off">
          <div class="he-rg-newctl">
            <input class="he-input he-rg-color" id="he-rg-form-color" type="color" value="#888888" title="Region tint">
            <select class="he-input he-rg-kind" id="he-rg-form-kind">
              <option value="land">land</option>
              <option value="water">water</option>
            </select>
          </div>
          <div class="he-rg-form-btns">
            <button class="he-btn" id="he-rg-form-save">Save</button>
            <button class="he-btn" id="he-rg-form-cancel">Cancel</button>
          </div>
          <div class="he-rg-form-btns" id="he-rg-form-danger" style="display:none">
            <button class="he-btn he-danger" id="he-rg-form-clearhex" title="Clear painted hexes for this region; metadata kept">Clear Hexes</button>
            <button class="he-btn he-danger" id="he-rg-form-delete" title="Delete this region entirely (override-only)">Delete Region</button>
          </div>
        </div>

        <div class="he-rg-modes">
          <button class="he-rg-mode" data-mode="paint"  title="Click/drag hexes to add to selected region">Paint</button>
          <button class="he-rg-mode" data-mode="erase"  title="Click/drag hexes to remove from any region">Erase</button>
          <button class="he-rg-mode" data-mode="trace"  title="Click vertices, then Fill — claims all hexes inside the polygon for the selected region">Trace</button>
        </div>

        <div class="he-rg-traceaux" id="he-rg-traceaux" style="display:none">
          <button class="he-btn" id="he-rg-trace-fill" title="Claim all hexes inside the traced polygon">Fill (0 pts)</button>
          <button class="he-btn" id="he-rg-trace-undo" title="Undo last vertex">Undo</button>
          <button class="he-btn he-danger" id="he-rg-trace-clear" title="Discard the polygon in progress">Clear</button>
        </div>

        <div class="he-opacity-row">
          <label class="he-lbl">Overlay Opacity</label>
          <div class="he-opacity-controls">
            <input type="range" class="he-opacity" id="he-rg-opacity" min="0" max="100" step="1" value="55">
            <span class="he-opacity-val" id="he-rg-opacity-val">55%</span>
          </div>
        </div>

        <div class="he-status" id="he-rg-status">Pick a region, then click or drag.</div>

        <div class="he-btns">
          <button class="he-btn" id="he-rg-newbtn"   title="Create a new region">+ New</button>
          <button class="he-btn" id="he-rg-editbtn"  title="Edit metadata for the selected region" disabled>Edit</button>
          <button class="he-btn" id="he-rg-bootstrap" title="Seed regions from landmark region tags">Bootstrap</button>
        </div>
        <div class="he-btns">
          <button class="he-btn" id="he-rg-export" title="Print merged GH_REGIONS source for paste-back">Export</button>
          <button class="he-btn he-danger" id="he-rg-reset" title="Clear all region overrides">Reset All</button>
        </div>
        <div class="he-paint-stats" id="he-rg-stats">No regions tagged.</div>
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
        /* Default to half-height so the panel doesn't dominate the map.
           User can drag the bottom-right grip to resize; height is
           persisted in localStorage via the ResizeObserver below.
           min/max bound the drag so the panel can't shrink past
           usefulness or balloon past the viewport. */
        height: 50vh;
        min-height: 200px;
        max-height: calc(100vh - 88px);
        resize: vertical;
        display: flex; flex-direction: column; overflow: hidden;
      }
      #hex-edit-panel::-webkit-resizer {
        background:
          linear-gradient(135deg, transparent 0 6px, #c8941a 6px 7px, transparent 7px 9px,
                                  #c8941a 9px 10px, transparent 10px);
      }
      #hex-edit-panel .he-hdr {
        display:flex; justify-content:space-between; align-items:center;
        padding:8px 10px; background:rgba(200,148,26,.18); border-bottom:1px solid #8b6e45;
        font-size:13px; font-weight:600; letter-spacing:.05em;
        cursor:grab; user-select:none; flex-shrink:0;
      }
      #hex-edit-panel .he-hdr.dragging { cursor:grabbing; }
      #hex-edit-panel .he-close {
        background:none; border:none; color:#c8a96e; font-size:14px; cursor:pointer; padding:0 4px;
      }
      #hex-edit-panel .he-close:hover { color:#e8b840; }
      #hex-edit-panel .he-tabs {
        display:flex; border-bottom:1px solid #8b6e45; background:rgba(0,0,0,.25);
        flex-shrink:0;
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
      /* Active pane takes remaining vertical space and scrolls its own
         content. min-height:0 is the flex-child incantation that lets the
         pane actually shrink + scroll instead of ballooning past its parent. */
      #hex-edit-panel .he-pane { display:none; padding:10px; }
      #hex-edit-panel .he-pane.active { display:block; flex:1 1 auto; min-height:0; overflow-y:auto; }
      #hex-edit-panel .he-pane::-webkit-scrollbar { width:6px; }
      #hex-edit-panel .he-pane::-webkit-scrollbar-track { background:rgba(0,0,0,.2); }
      #hex-edit-panel .he-pane::-webkit-scrollbar-thumb { background:rgba(200,148,26,.35); border-radius:3px; }
      #hex-edit-panel .he-pane::-webkit-scrollbar-thumb:hover { background:rgba(200,148,26,.55); }
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
      /* Mini variant: inline alongside labels. No flex:1 / min-width, so
         it sits snug next to the hint span instead of stretching. */
      #hex-edit-panel .he-btn.he-btn-mini {
        flex:0 0 auto; min-width:0; padding:2px 7px; font-size:9.5px; letter-spacing:.04em;
      }
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
      #hex-edit-panel .he-palette {
        display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:4px;
      }
      #hex-edit-panel .he-swatch {
        display:flex; align-items:center; gap:5px; padding:4px 5px;
        background:rgba(0,0,0,.25); border:1px solid #8b6e45; border-radius:2px;
        color:#c8a96e; font-family:'Crimson Text',Georgia,serif; font-size:11px;
        cursor:pointer; transition:all .1s; text-align:left; min-width:0;
      }
      #hex-edit-panel .he-swatch:hover { border-color:#c8941a; color:#e8b840; }
      #hex-edit-panel .he-swatch.active {
        border-color:#e8b840; background:rgba(200,148,26,.15); color:#ffeebb;
        box-shadow:inset 0 0 0 1px rgba(232,184,64,.4);
      }
      #hex-edit-panel .he-swatch-chip {
        display:inline-block; width:14px; height:14px; border-radius:2px;
        background:var(--swatch, transparent); border:1px solid rgba(0,0,0,.4); flex-shrink:0;
      }
      #hex-edit-panel .he-swatch-chip-erase {
        display:flex; align-items:center; justify-content:center;
        background:rgba(180,50,20,.2); color:#cc6644; font-size:10px;
      }
      #hex-edit-panel .he-swatch-erase.active { border-color:#cc6644; background:rgba(180,50,20,.15); color:#ff7755; }
      #hex-edit-panel .he-swatch-lbl {
        flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      #hex-edit-panel .he-paint-stats {
        margin-top:8px; padding:5px 8px; background:rgba(0,0,0,.25);
        border-left:2px solid #8b6e45; font-family:'Crimson Text',Georgia,serif;
        font-size:11px; line-height:1.35; color:#c8a96e; word-wrap:break-word;
      }
      #hex-edit-panel .he-opacity-row { margin-top:8px; }
      #hex-edit-panel .he-opacity-controls {
        display:flex; align-items:center; gap:8px;
      }
      #hex-edit-panel .he-opacity {
        flex:1; -webkit-appearance:none; appearance:none;
        height:4px; background:rgba(0,0,0,.4); border:1px solid #8b6e45;
        border-radius:2px; outline:none; cursor:pointer;
      }
      #hex-edit-panel .he-opacity::-webkit-slider-thumb {
        -webkit-appearance:none; appearance:none;
        width:14px; height:14px; background:#c8941a; border:1px solid #5a3d0a;
        border-radius:50%; cursor:pointer;
      }
      #hex-edit-panel .he-opacity::-moz-range-thumb {
        width:14px; height:14px; background:#c8941a; border:1px solid #5a3d0a;
        border-radius:50%; cursor:pointer;
      }
      #hex-edit-panel .he-opacity-val {
        flex:0 0 auto; min-width:36px; text-align:right;
        font-family:monospace; font-size:11px; color:#ffeebb;
      }
      /* Outline tab — region editor */
      #hex-edit-panel .he-rg-modes {
        display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;
        margin:6px 0 4px;
      }
      #hex-edit-panel .he-rg-mode {
        background:#1a1408; color:#c8a96e; border:1px solid #5a3d0a;
        padding:4px 6px; font-size:10px; font-family:inherit; cursor:pointer;
        border-radius:2px; letter-spacing:.04em;
      }
      #hex-edit-panel .he-rg-mode:hover { border-color:#c8941a; color:#e8b840; }
      #hex-edit-panel .he-rg-mode.active {
        background:rgba(200,148,26,.22); color:#ffeebb; border-color:#c8941a;
      }
      #hex-edit-panel .he-rg-form {
        margin:6px 0; padding:6px; background:rgba(20,14,6,.6);
        border:1px solid #5a3d0a; border-radius:2px;
      }
      #hex-edit-panel .he-rg-newctl {
        display:grid; grid-template-columns:36px 1fr; gap:4px;
        margin-top:6px; align-items:center;
      }
      #hex-edit-panel .he-rg-color {
        padding:0; height:24px; cursor:pointer; border:1px solid #5a3d0a;
        background:none;
      }
      #hex-edit-panel .he-rg-kind {
        font-size:10px; padding:2px 4px; height:24px;
      }
      #hex-edit-panel .he-rg-form-btns {
        display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px;
      }
      #hex-edit-panel .he-rg-form-btns .he-btn { font-size:10px; padding:4px 6px; }
      #hex-edit-panel .he-btn[disabled] {
        opacity:.4; cursor:not-allowed; color:#5a3d0a;
      }
      #hex-edit-panel .he-rg-traceaux {
        display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;
        margin-bottom:6px;
      }
      #hex-edit-panel .he-rg-traceaux .he-btn { font-size:10px; padding:3px 4px; }
      body.he-editing #map-wrap { cursor:crosshair !important; }
      body.he-painting #map-wrap { cursor:cell !important; }
      #btn-hex-edit.active { background:rgba(200,148,26,.28); color:#ffeebb; border-color:#c8941a; }
    `;
    document.head.appendChild(s);
  }

  function setActiveTab(id){
    const prev = state.activeTab;
    state.activeTab = id;
    if (!state.panelEl) return;
    state.panelEl.querySelectorAll('.he-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === id));
    state.panelEl.querySelectorAll('.he-pane').forEach(p =>
      p.classList.toggle('active', p.id === `he-pane-${id}`));
    // Region overlay: paint when entering, restore terrain when leaving.
    if (id === 'outline' && prev !== 'outline'){
      redrawAllRegionOverlay();
    } else if (prev === 'outline' && id !== 'outline'){
      restoreTerrainOverlay();
      clearTraceOverlay();
    }
  }

  // ── Landmarks tab ─────────────────────────────────────────────────────────
  // Rebuilds the <select>'s options. Optional filter string hides names
  // that don't contain it (case-insensitive substring) — called on every
  // keystroke from #he-filter. Current state.selectedName is preserved
  // even if filtered out; clearing the filter restores the full list.
  function refreshSelect(filter){
    const sel = state.panelEl.querySelector('#he-select');
    const names = GCCLandmarks.allNames();
    const unplaced = new Set(GCCLandmarks.unplacedPending().map(p => p.name));
    const overridden = new Set(Object.keys(GCCLandmarks.exportOverrides()));
    const f = (filter || '').trim().toLowerCase();
    const visible = f ? names.filter(n => n.toLowerCase().includes(f)) : names;
    sel.innerHTML =
      '<option value="">— choose —</option>' +
      visible.map(n => {
        let tag = '';
        if (unplaced.has(n)) tag = ' ◇';
        else if (overridden.has(n)) tag = ' ●';
        return `<option value="${n}">${n}${tag}</option>`;
      }).join('') +
      (f ? '' : '<option value="__new__">+ New landmark…</option>');
    sel.value = state.selectedName || '';
  }

  function onSelect(e){
    const v = e.target.value;
    const newBlock = state.panelEl.querySelector('#he-new');
    const idInput  = state.panelEl.querySelector('#he-canon-id');
    const idHint   = state.panelEl.querySelector('#he-id-hint');
    const waterCb   = state.panelEl.querySelector('#he-on-water');
    const waterHint = state.panelEl.querySelector('#he-water-hint');
    const descEl    = state.panelEl.querySelector('#he-desc');
    const descHint  = state.panelEl.querySelector('#he-desc-hint');
    // Small helper — fills an LGG input from a source object, tolerating
    // missing keys (bare landmarks just show empty fields).
    const fillLgg = src => {
      LGG_FIELDS.forEach(({id, key}) => {
        const el = state.panelEl.querySelector('#' + id);
        if (el) el.value = (src && src[key] != null) ? src[key] : '';
      });
    };
    if (v === '__new__'){
      state.newMode = true;
      state.selectedName = null;
      newBlock.style.display = 'block';
      idInput.value = '';
      idHint.textContent = 'New landmarks get their ID from the hex you click.';
      waterCb.checked = !!state.newFields.onWater;
      waterHint.textContent = 'applied on place';
      descEl.value = state.newFields.desc || '';
      descHint.textContent = 'saved on place';
      fillLgg(state.newFields);
      setLggHint('saved on place');
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
      waterCb.checked = !!(existing && existing.onWater);
      waterHint.textContent = existing && existing.id ? 'toggle to apply' : 'place landmark first';
      descEl.value = (existing && existing.desc) || '';
      descHint.textContent = existing && existing.id ? 'edit, then click out to save' : 'place landmark first';
      fillLgg(existing);
      setLggHint(existing && existing.id ? 'edit, then click out to save' : 'place landmark first');
      const idLabel = existing && existing.id ? ` (currently ${existing.id})` : ' (unplaced)';
      setStatus(`Armed: ${v}${idLabel}. Click a hex, or type an ID above.`, true);
    } else {
      state.newMode = false;
      state.selectedName = null;
      newBlock.style.display = 'none';
      idInput.value = '';
      idHint.textContent = 'Select a landmark first.';
      waterCb.checked = false;
      waterHint.textContent = '—';
      descEl.value = '';
      descHint.textContent = '—';
      fillLgg({});
      setLggHint('—');
      setStatus('Pick a landmark, then click a hex.', false);
    }
  }

  // On-water toggle: for new-mode, capture the flag for use at placement.
  // For an existing landmark already assigned to a hex, apply immediately
  // via setOverride + redraw so the ≈ overlay updates without a re-click.
  function onWaterToggle(e){
    const checked = !!e.target.checked;
    const waterHint = state.panelEl.querySelector('#he-water-hint');
    if (state.newMode){
      state.newFields.onWater = checked;
      waterHint.textContent = checked ? 'will be on water' : 'applied on place';
      return;
    }
    const name = state.selectedName;
    if (!name){ e.target.checked = false; return; }
    const existing = GCCLandmarks.getByName(name) || {};
    if (!existing.id){
      e.target.checked = !!existing.onWater;
      waterHint.textContent = 'place landmark first';
      return;
    }
    const payload = {
      name,
      id:      existing.id,
      kind:    existing.kind || 'city',
      region:  existing.region,
      notes:   existing.notes,
      onWater: checked,
      isPort:  !!existing.isPort,  // preserve reserved flag (seaport)
    };
    if (existing.symbolPixel) payload.symbolPixel = existing.symbolPixel;
    const ok = GCCLandmarks.setOverride(payload);
    LOG('onWater toggle →', { name, onWater: checked, ok });
    if (ok){
      waterHint.textContent = checked ? '✓ on water' : '✓ not on water';
      showToast(`${name} ${checked ? 'is now on water ≈' : 'is no longer on water'}`);
      redrawOverlay();
    } else {
      e.target.checked = !checked;
      waterHint.textContent = 'failed';
    }
  }

  // Description blur: for new-mode, state.newFields already holds current
  // value (via input handler) — nothing to persist until placement. For an
  // existing placed landmark, write all editor fields (desc + LGG header)
  // to the override in one setOverride call via persistLandmarkFields.
  function onDescBlur(e){
    if (state.newMode) return;
    const hint = state.panelEl.querySelector('#he-desc-hint');
    const ok = persistLandmarkFields();
    if (ok === null){ hint.textContent = 'place landmark first'; return; }
    if (ok === 'nochange'){ hint.textContent = e.currentTarget.value ? 'saved' : 'optional'; return; }
    hint.textContent = ok ? (e.currentTarget.value ? '✓ saved' : '✓ cleared') : 'save failed';
  }

  // LGG header blur: same unified save path. One hint span covers the
  // whole block since users can't tell which field's blur fired.
  function onLggFieldBlur(){
    if (state.newMode) return;
    const ok = persistLandmarkFields();
    if (ok === null){ setLggHint('place landmark first'); return; }
    if (ok === 'nochange'){ setLggHint('saved'); return; }
    setLggHint(ok ? '✓ saved' : 'save failed');
  }

  function setLggHint(msg){
    const h = state.panelEl.querySelector('#he-lgg-hint');
    if (h) h.textContent = msg;
  }

  // Parse LGG button: reads the Description textarea, runs parseLggHeader,
  // and splits the header fields out into the structured LGG inputs. The
  // description is replaced with just the prose. If the parser returns
  // null (no recognizable LGG markers) the current state is untouched and
  // the hint tells the user why — safer than silently doing nothing.
  // For new-mode: populates state.newFields + DOM; applied on placement.
  // For existing placed landmarks: calls persistLandmarkFields() to write
  // all seven LGG fields + desc in a single setOverride.
  function onParseLggClick(){
    const descEl = state.panelEl.querySelector('#he-desc');
    const hint   = state.panelEl.querySelector('#he-desc-hint');
    const raw    = descEl.value;
    if (!raw.trim()){
      hint.textContent = 'paste LGG text first';
      return;
    }
    const parsed = parseLggHeader(raw);
    if (!parsed){
      hint.textContent = 'no LGG header found';
      showToast('Parse LGG: no ruler / population / density / resources lines detected.');
      return;
    }
    // Populate the seven structured inputs. Only overwrite when the parser
    // found a value — a partial paste (e.g. just "Resources: gold") updates
    // one field without wiping the others.
    LGG_FIELDS.forEach(({id, key}) => {
      const el = state.panelEl.querySelector('#' + id);
      if (!el) return;
      if (parsed[key] !== '' && parsed[key] !== undefined){
        el.value = parsed[key];
      }
    });
    // Replace desc with just the prose
    descEl.value = parsed.desc;

    const populated = LGG_FIELDS.filter(({key}) => parsed[key] !== '' && parsed[key] !== undefined).length;
    if (state.newMode){
      // Capture everything into state.newFields — applied on placement
      LGG_FIELDS.forEach(({id, key, numeric}) => {
        const el = state.panelEl.querySelector('#' + id);
        if (el) state.newFields[key] = numeric ? (el.value.replace(/[^0-9]/g,'') || '') : el.value;
      });
      state.newFields.desc = parsed.desc;
      setLggHint('saved on place');
      hint.textContent = 'saved on place';
    } else {
      const ok = persistLandmarkFields();
      setLggHint(ok === true ? '✓ saved' : ok === 'nochange' ? 'saved' : ok === null ? 'place landmark first' : 'save failed');
      if (ok === true) hint.textContent = '✓ saved';
      else if (ok === null) hint.textContent = 'place landmark first';
    }
    showToast(`Parsed ${populated} LGG field${populated === 1 ? '' : 's'}.`);
    LOG('parseLgg →', { populated, newMode: state.newMode, descLen: parsed.desc.length });
  }

  // Unified save for existing-mode landmark editing. Reads every editor
  // field and writes a single setOverride. Returns:
  //   true         — saved with changes
  //   'nochange'   — nothing differed from existing, skip save
  //   null         — no selection, or landmark not placed yet
  //   false        — setOverride failed
  // Called from onDescBlur and onLggFieldBlur so one user blur persists
  // the whole editor state, and hints can report meaningful status.
  function persistLandmarkFields(){
    const name = state.selectedName;
    if (!name) return null;
    const existing = GCCLandmarks.getByName(name) || {};
    if (!existing.id) return null;

    const getVal = id => {
      const el = state.panelEl.querySelector('#' + id);
      return el ? el.value : '';
    };
    const parseNum = v => {
      const n = parseInt(String(v).replace(/[^0-9]/g,''), 10);
      return isNaN(n) || n <= 0 ? '' : n;
    };

    // Collect current editor state
    const current = {
      desc:       getVal('he-desc'),
      rulerName:  getVal('he-ruler-name'),
      rulerTitle: getVal('he-ruler-title'),
      pop:        parseNum(getVal('he-pop')),
      popTotal:   parseNum(getVal('he-pop-total')),
      demihumans: getVal('he-demihumans'),
      humanoids:  getVal('he-humanoids'),
      resources:  getVal('he-resources'),
    };

    // Change detection — every tracked field must match existing
    const unchanged = Object.keys(current).every(k => {
      const cur = current[k] === '' ? undefined : current[k];
      const exi = existing[k] === '' ? undefined : existing[k];
      return (cur || '') === (exi || '') || (cur === undefined && exi === undefined);
    });
    if (unchanged) return 'nochange';

    const payload = Object.assign({
      name,
      id:      existing.id,
      kind:    existing.kind || 'city',
      region:  existing.region,
      notes:   existing.notes,
      onWater: !!existing.onWater,
      isPort:  !!existing.isPort,
    }, current);
    if (existing.symbolPixel) payload.symbolPixel = existing.symbolPixel;

    const ok = GCCLandmarks.setOverride(payload);
    LOG('landmark fields saved →', { name, ok, fields: Object.keys(current).filter(k => current[k]) });
    return ok;
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
      id:         normalized,
      kind:       existing.kind   || 'city',
      region:     existing.region,
      notes:      existing.notes,
      desc:       existing.desc || '',
      rulerName:  existing.rulerName  || '',
      rulerTitle: existing.rulerTitle || '',
      pop:        existing.pop,
      popTotal:   existing.popTotal,
      demihumans: existing.demihumans || '',
      humanoids:  existing.humanoids  || '',
      resources:  existing.resources  || '',
      onWater:    !!existing.onWater,
      isPort:     !!existing.isPort,
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
    } else if (state.activeTab === 'outline'){
      onOutlineClick(ev);
    }
    // Paint / Draw: no-op for click — Paint uses mousedown/move/up.
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

    let name, kind, region, notes, desc, onWater, isPort, lgg;
    if (state.newMode){
      name = (state.newFields.name || '').trim();
      if (!name){ setStatus('Enter a name first.', false); return; }
      kind = state.newFields.kind || 'city';
      region = state.newFields.region || '';
      desc = state.newFields.desc || '';
      onWater = !!state.newFields.onWater;
      isPort = false;  // reserved: voyage sim owns this later
      lgg = {
        rulerName:  state.newFields.rulerName  || '',
        rulerTitle: state.newFields.rulerTitle || '',
        pop:        state.newFields.pop        || undefined,
        popTotal:   state.newFields.popTotal   || undefined,
        demihumans: state.newFields.demihumans || '',
        humanoids:  state.newFields.humanoids  || '',
        resources:  state.newFields.resources  || '',
      };
    } else if (state.selectedName){
      name = state.selectedName;
      const existing = GCCLandmarks.getByName(name) || {};
      kind = existing.kind || 'city';
      region = existing.region;
      notes = existing.notes;
      desc = existing.desc || '';
      // On-water is governed by the checkbox (onWaterToggle). Preserve
      // both flags on re-placement so dragging to a new hex doesn't lose them.
      onWater = !!existing.onWater;
      isPort  = !!existing.isPort;
      lgg = {
        rulerName:  existing.rulerName  || '',
        rulerTitle: existing.rulerTitle || '',
        pop:        existing.pop,
        popTotal:   existing.popTotal,
        demihumans: existing.demihumans || '',
        humanoids:  existing.humanoids  || '',
        resources:  existing.resources  || '',
      };
    } else {
      setStatus('Pick a landmark first.', false);
      return;
    }

    const id = hexIdStr(hit.col, hit.row);
    const payload = Object.assign({ name, id, kind, region, notes, desc, onWater, isPort }, lgg);
    payload.symbolPixel = { mx: m.x, my: m.y };
    const ok = GCCLandmarks.setOverride(payload);
    LOG('setOverride →', { name, id, kind, ok, pixel: { mx: m.x, my: m.y } });
    showToast(`${name} → ${id}`);
    setStatus(`Placed: ${name} at ${id}. Pick next.`, false);

    if (state.newMode){
      state.panelEl.querySelector('#he-new-name').value = '';
      state.panelEl.querySelector('#he-new-region').value = '';
      state.panelEl.querySelector('#he-new-kind').value = 'city';
      state.panelEl.querySelector('#he-on-water').checked = false;
      state.panelEl.querySelector('#he-desc').value = '';
      LGG_FIELDS.forEach(({id, key}) => {
        const el = state.panelEl.querySelector('#' + id);
        if (el) el.value = '';
        state.newFields[key] = '';
      });
      state.newFields.name = '';
      state.newFields.region = '';
      state.newFields.kind = 'city';
      state.newFields.onWater = false;
      state.newFields.desc = '';
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

  // ── Paint tab ─────────────────────────────────────────────────────────────
  function setPaintTerrain(t){
    state.paintTerrain = t;
    if (!state.panelEl) return;
    state.panelEl.querySelectorAll('.he-swatch').forEach(sw =>
      sw.classList.toggle('active', sw.dataset.terrain === t));
    const label = t === '__erase'
      ? 'Erase'
      : (typeof TERRAIN !== 'undefined' && TERRAIN[t]?.label) || t;
    const el = state.panelEl.querySelector('#he-paint-status');
    if (el) el.textContent = `Armed: ${label}. Click or drag over hexes.`;
  }

  function applyPaintToCell(col, row){
    const el = document.getElementById(`hex-${col}-${row}`);
    if (!el) return;
    const t = GCCTerrain.get(col, row);
    if (t && typeof TERRAIN !== 'undefined' && TERRAIN[t]?.rgb){
      el.style.setProperty('--hex-paint-rgb', TERRAIN[t].rgb);
    } else {
      el.style.removeProperty('--hex-paint-rgb');
    }
  }

  function paintAt(ev){
    if (typeof screenToMap !== 'function' || typeof mapToHex !== 'function') return;
    const m = screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = mapToHex(m.x, m.y);
    if (!hit) return;
    const key = `${hit.col}-${hit.row}`;
    if (key === state.lastPaintKey) return;
    state.lastPaintKey = key;
    if (state.paintTerrain === '__erase'){
      GCCTerrain.clear(hit.col, hit.row);
    } else {
      GCCTerrain.set(hit.col, hit.row, state.paintTerrain);
    }
    applyPaintToCell(hit.col, hit.row);
    updatePaintStats();
  }

  function onPaintMousedown(ev){
    if (!state.active || state.activeTab !== 'paint') return;
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();
    state.paintDragging = true;
    state.lastPaintKey = null;
    document.body.classList.add('he-painting');
    paintAt(ev);
  }

  function onPaintMousemove(ev){
    if (!state.paintDragging) return;
    paintAt(ev);
  }

  function onPaintMouseup(ev){
    if (!state.paintDragging) return;
    state.paintDragging = false;
    state.lastPaintKey = null;
    document.body.classList.remove('he-painting');
  }

  function updatePaintStats(){
    if (!state.panelEl) return;
    const el = state.panelEl.querySelector('#he-paint-stats');
    if (!el) return;
    const by = GCCTerrain.countByTerrain();
    const total = GCCTerrain.count();
    if (total === 0){ el.textContent = 'Nothing painted yet.'; return; }
    const details = Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t}:${c}`)
      .join(' · ');
    el.textContent = `${total} painted · ${details}`;
  }

  function onPaintExport(){
    const src = GCCTerrain.exportMergedSource();
    console.log('── gcc-terrain.js export ──');
    console.log(src);
    navigator.clipboard && navigator.clipboard.writeText(src).then(
      () => showToast('Terrain exported to clipboard (also in console)'),
      () => showToast('Terrain exported to console (clipboard blocked)')
    );
  }

  function onPaintReset(){
    const n = Object.keys(GCCTerrain.exportOverrides()).length;
    if (n === 0){ showToast('No terrain overrides to clear'); return; }
    if (!confirm(`Clear ${n} terrain override${n===1?'':'s'}? File-data entries are not touched.`)) return;
    // Capture the currently-overridden set BEFORE clearing so we can
    // remove their --hex-paint-rgb without a full grid rebuild.
    const overridden = GCCTerrain.allOverridden();
    GCCTerrain.clearAll();
    for (const { col, row } of overridden){
      applyPaintToCell(col, row); // re-reads GCCTerrain → now returns null → clears
    }
    showToast('Terrain overrides cleared');
    updatePaintStats();
  }

  // ── Outline tab (region editor) ───────────────────────────────────────────
  // Region overlay: while the Outline tab is active, every hex cell's
  // --hex-paint-rgb is swapped to the region color (or unset). Leaving
  // the tab restores the terrain colors via applyPaintToCell.

  function refreshRegionSelect(){
    if (!state.panelEl || typeof GCCRegions === 'undefined') return;
    const sel = state.panelEl.querySelector('#he-rg-select');
    if (!sel) return;
    const stats = GCCRegions.stats();
    const all = GCCRegions.all().slice().sort((a,b) => a.name.localeCompare(b.name));
    sel.innerHTML =
      '<option value="">— choose —</option>' +
      all.map(r => {
        const n = stats.counts[r.name] || 0;
        const tag = n > 0 ? ` ● ${n}` : '';
        return `<option value="${r.name}">${r.name}${tag}</option>`;
      }).join('');
    sel.value = state.rgSelected || '';
  }

  function onRgSelect(e){
    state.rgSelected = e.target.value || null;
    setRgStatus(state.rgSelected
      ? `Armed: ${state.rgSelected}. ${state.rgMode === 'erase' ? 'Click/drag to erase.' : state.rgMode === 'trace' ? 'Click vertices, then Fill.' : 'Click/drag to add hexes.'}`
      : 'Pick a region first.');
    const editBtn = state.panelEl.querySelector('#he-rg-editbtn');
    if (editBtn) editBtn.disabled = !state.rgSelected;
    // If the edit form is open for a different region, close it.
    if (state.rgFormMode === 'edit') closeRgForm();
  }

  function setRgMode(mode){
    state.rgMode = mode;
    if (!state.panelEl) return;
    state.panelEl.querySelectorAll('.he-rg-mode').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));
    const aux = state.panelEl.querySelector('#he-rg-traceaux');
    if (aux) aux.style.display = mode === 'trace' ? '' : 'none';
    if (mode !== 'trace') clearTraceOverlay();
    if (state.rgSelected){
      const hint = mode === 'erase' ? 'Click/drag to erase.'
                 : mode === 'trace' ? 'Click vertices, then Fill.'
                 : 'Click/drag to add hexes.';
      setRgStatus(`Armed: ${state.rgSelected}. ${hint}`);
    } else {
      setRgStatus('Pick a region first.');
    }
  }

  function setRgStatus(msg){
    if (!state.panelEl) return;
    const el = state.panelEl.querySelector('#he-rg-status');
    if (el) el.textContent = msg;
  }

  function openRgForm(mode, name){
    state.rgFormMode = mode;
    if (!state.panelEl) return;
    const form    = state.panelEl.querySelector('#he-rg-form');
    const title   = state.panelEl.querySelector('#he-rg-form-title');
    const baseTag = state.panelEl.querySelector('#he-rg-form-base');
    const nameEl  = state.panelEl.querySelector('#he-rg-form-name');
    const colorEl = state.panelEl.querySelector('#he-rg-form-color');
    const kindEl  = state.panelEl.querySelector('#he-rg-form-kind');
    const saveBtn = state.panelEl.querySelector('#he-rg-form-save');
    const dangerRow = state.panelEl.querySelector('#he-rg-form-danger');
    const delBtn  = state.panelEl.querySelector('#he-rg-form-delete');
    const clearHexBtn = state.panelEl.querySelector('#he-rg-form-clearhex');

    if (mode === 'new'){
      title.textContent = 'New Region';
      baseTag.style.display = 'none';
      nameEl.readOnly = false;
      nameEl.value = '';
      colorEl.value = '#888888';
      kindEl.value = 'land';
      saveBtn.textContent = 'Create';
      dangerRow.style.display = 'none';
    } else if (mode === 'edit'){
      const r = GCCRegions.getByName(name);
      if (!r){ closeRgForm(); return; }
      const isB = GCCRegions.isBase(name);
      title.textContent = `Edit: ${name}`;
      baseTag.style.display = isB ? '' : 'none';
      nameEl.readOnly = true;
      nameEl.value = name;
      colorEl.value = r.color && r.color.startsWith('#') ? r.color : '#888888';
      kindEl.value = r.kind || 'land';
      saveBtn.textContent = 'Save';
      // Clear-hexes available if there's a hex-set; Delete only for non-BASE.
      const hasHexes = (GCCRegions.exportOverrides().hexes[name] || []).length > 0;
      const showDanger = hasHexes || !isB;
      dangerRow.style.display = showDanger ? '' : 'none';
      delBtn.style.display = isB ? 'none' : '';
      clearHexBtn.style.display = hasHexes ? '' : 'none';
    }
    form.style.display = '';
    if (mode === 'new') nameEl.focus();
  }

  function closeRgForm(){
    state.rgFormMode = null;
    if (!state.panelEl) return;
    state.panelEl.querySelector('#he-rg-form').style.display = 'none';
  }

  function onRgNewBtn(){ openRgForm('new'); }
  function onRgEditBtn(){
    if (!state.rgSelected) return;
    openRgForm('edit', state.rgSelected);
  }
  function onRgFormCancel(){ closeRgForm(); }

  function onRgFormSave(){
    const name  = state.panelEl.querySelector('#he-rg-form-name').value.trim();
    const color = state.panelEl.querySelector('#he-rg-form-color').value;
    const kind  = state.panelEl.querySelector('#he-rg-form-kind').value;
    if (state.rgFormMode === 'new'){
      if (!name){ setRgStatus('Enter a region name first.'); return; }
      const ok = GCCRegions.addRegion({ name, kind, color });
      if (!ok){ setRgStatus(`"${name}" already exists.`); return; }
      showToast(`Created region: ${name}`);
      state.rgSelected = name;
    } else if (state.rgFormMode === 'edit'){
      GCCRegions.setRegionMeta(name, { color, kind });
      showToast(`Saved: ${name}`);
    }
    closeRgForm();
    refreshRegionSelect();
    setRgMode(state.rgMode);
    if (state.activeTab === 'outline') redrawAllRegionOverlay();
  }

  function onRgFormClearHex(){
    const name = state.panelEl.querySelector('#he-rg-form-name').value.trim();
    if (!name) return;
    const n = (GCCRegions.exportOverrides().hexes[name] || []).length;
    if (!n) return;
    if (!confirm(`Clear ${n} painted hex${n===1?'':'es'} for "${name}"? Region metadata is kept.`)) return;
    GCCRegions.clearHexes(name);
    showToast(`Cleared ${n} hex${n===1?'':'es'} from ${name}`);
    closeRgForm();
    refreshRegionSelect();
    updateRgStats();
    if (state.activeTab === 'outline') redrawAllRegionOverlay();
  }

  function onRgFormDelete(){
    const name = state.panelEl.querySelector('#he-rg-form-name').value.trim();
    if (!name) return;
    if (GCCRegions.isBase(name)){
      setRgStatus('BASE regions cannot be deleted; use Clear Hexes.');
      return;
    }
    const n = (GCCRegions.exportOverrides().hexes[name] || []).length;
    const msg = n
      ? `Delete region "${name}" and ${n} painted hex${n===1?'':'es'}?`
      : `Delete region "${name}"?`;
    if (!confirm(msg)) return;
    GCCRegions.removeRegion(name);
    showToast(`Deleted ${name}`);
    state.rgSelected = null;
    closeRgForm();
    refreshRegionSelect();
    updateRgStats();
    redrawAllRegionOverlay();
  }

  function onRgBootstrap(){
    if (typeof GCCRegions === 'undefined' || typeof GCCLandmarks === 'undefined'){
      setRgStatus('Region or landmark module not loaded.'); return;
    }
    const r = GCCRegions.bootstrapFromLandmarks();
    if (!r){ setRgStatus('Bootstrap failed.'); return; }
    showToast(`Bootstrap: +${r.regions} regions, +${r.hexes} hexes (${r.total} regions tagged total)`);
    refreshRegionSelect();
    updateRgStats();
    if (state.activeTab === 'outline') redrawAllRegionOverlay();
  }

  function onRgExport(){
    const src = GCCRegions.exportMergedSource();
    console.log('── gcc-regions.js export ──');
    console.log(src);
    navigator.clipboard && navigator.clipboard.writeText(src).then(
      () => showToast('Regions exported to clipboard (also in console)'),
      () => showToast('Regions exported to console (clipboard blocked)')
    );
  }

  function onRgReset(){
    const ov = GCCRegions.exportOverrides();
    const n = Object.keys(ov.hexes).length + Object.keys(ov.defs).length;
    if (n === 0){ showToast('No region overrides to clear'); return; }
    if (!confirm(`Clear all region overrides (${Object.keys(ov.defs).length} defs, ${Object.keys(ov.hexes).length} hex sets)? BASE region metadata is not touched.`)) return;
    GCCRegions.clearOverrides();
    state.rgSelected = null;
    refreshRegionSelect();
    updateRgStats();
    redrawAllRegionOverlay();
    showToast('Region overrides cleared');
  }

  function updateRgStats(){
    if (!state.panelEl) return;
    const el = state.panelEl.querySelector('#he-rg-stats');
    if (!el) return;
    const s = GCCRegions.stats();
    if (s.total === 0){ el.textContent = `${s.regions} regions · no hexes tagged.`; return; }
    el.textContent = `${s.regions} regions · ${s.total} hexes tagged.`;
  }

  // Apply the region overlay tint to a single cell. Returns true if a
  // tint was applied. When force=false and no region claims the hex,
  // the tint is cleared.
  function applyRegionToCell(col, row){
    const el = document.getElementById(`hex-${col}-${row}`);
    if (!el) return false;
    if (typeof GCCRegions === 'undefined') return false;
    const m = GCCRegions.getMembership(col, row);
    if (m){
      const rgb = GCCRegions.colorToRgbTriplet(m.color);
      el.style.setProperty('--hex-paint-rgb', rgb);
      el.style.setProperty('--hex-paint-alpha', String(state.rgOpacity));
      return true;
    } else {
      el.style.removeProperty('--hex-paint-rgb');
      el.style.removeProperty('--hex-paint-alpha');
      return false;
    }
  }

  // Walk every hex cell once and paint the region overlay. Slow when
  // the grid is large (~14k cells) but only fires on tab activate /
  // bootstrap / reset, not per-paint-stroke.
  function redrawAllRegionOverlay(){
    const cells = document.querySelectorAll('.hex-cell');
    cells.forEach(el => {
      const m = /^hex-(\d+)-(\d+)$/.exec(el.id);
      if (!m) return;
      applyRegionToCell(+m[1], +m[2]);
    });
  }

  // Restore terrain overlay across the grid when leaving the outline tab.
  function restoreTerrainOverlay(){
    document.documentElement.style.setProperty('--hex-paint-alpha', String(state.paintOpacity));
    const cells = document.querySelectorAll('.hex-cell');
    cells.forEach(el => {
      const m = /^hex-(\d+)-(\d+)$/.exec(el.id);
      if (!m) return;
      el.style.removeProperty('--hex-paint-alpha');
      applyPaintToCell(+m[1], +m[2]);
    });
  }

  // Paint mode: drag-paint claims hexes for the selected region.
  // Erase mode: drag-erase removes hex from any region's override set.
  function rgPaintAt(ev){
    if (typeof screenToMap !== 'function' || typeof mapToHex !== 'function') return;
    const m = screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = mapToHex(m.x, m.y);
    if (!hit) return;
    const key = `${hit.col}-${hit.row}`;
    if (key === state.rgLastKey) return;
    state.rgLastKey = key;
    if (state.rgMode === 'erase'){
      const cleared = GCCRegions.erasePaintAt(hit.col, hit.row);
      if (cleared) applyRegionToCell(hit.col, hit.row);
    } else {
      if (!state.rgSelected){ setRgStatus('Pick a region first.'); return; }
      // If the hex was painted into a different region, repaint that
      // cell (since addHexes silently moved it).
      const prev = GCCRegions.getHexTagged(hit.col, hit.row);
      GCCRegions.addHexes(state.rgSelected, [`${hit.col}-${hit.row}`]);
      applyRegionToCell(hit.col, hit.row);
      if (prev && prev.name !== state.rgSelected){
        // The single cell already updated above, but the per-region
        // tint changed for that hex. No additional cells affected.
      }
    }
    updateRgStats();
  }

  function onOutlineMousedown(ev){
    if (!state.active || state.activeTab !== 'outline') return;
    if (state.rgMode === 'trace') return;          // trace uses click handler
    if (ev.button !== 0) return;
    if (state.rgMode === 'paint' && !state.rgSelected) return;
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();
    state.rgDragging = true;
    state.rgLastKey = null;
    document.body.classList.add('he-painting');
    rgPaintAt(ev);
  }
  function onOutlineMousemove(ev){
    if (!state.rgDragging) return;
    rgPaintAt(ev);
  }
  function onOutlineMouseup(){
    if (!state.rgDragging) return;
    state.rgDragging = false;
    state.rgLastKey = null;
    document.body.classList.remove('he-painting');
    refreshRegionSelect();
  }

  // Trace mode: each click adds a vertex. Vertices snap to hex
  // centers (so polygon outlines lie exactly on the same lattice the
  // hex-fill uses, avoiding sub-hex precision artifacts).
  function onOutlineClick(ev){
    if (state.rgMode !== 'trace') return;
    if (!state.rgSelected){ setRgStatus('Pick a region first.'); return; }
    if (typeof screenToMap !== 'function' || typeof mapToHex !== 'function') return;
    const m = screenToMap(ev.clientX, ev.clientY);
    if (!m) return;
    const hit = mapToHex(m.x, m.y);
    if (!hit) return;
    state.rgTrace.push({ col: hit.col, row: hit.row });
    drawTraceOverlay();
    state.panelEl.querySelector('#he-rg-trace-fill').textContent =
      `Fill (${state.rgTrace.length} pts)`;
  }

  function onRgTraceUndo(){
    if (!state.rgTrace.length) return;
    state.rgTrace.pop();
    drawTraceOverlay();
    state.panelEl.querySelector('#he-rg-trace-fill').textContent =
      `Fill (${state.rgTrace.length} pts)`;
  }
  function onRgTraceClear(){
    state.rgTrace = [];
    clearTraceOverlay();
    state.panelEl.querySelector('#he-rg-trace-fill').textContent = 'Fill (0 pts)';
  }
  function onRgTraceFill(){
    if (state.rgTrace.length < 3){
      setRgStatus(`Need at least 3 vertices (have ${state.rgTrace.length}).`);
      return;
    }
    if (!state.rgSelected){ setRgStatus('Pick a region first.'); return; }
    const verts = state.rgTrace.map(v => [v.col, v.row]);
    const bounds = (typeof GRID_COLS !== 'undefined' && typeof GRID_ROWS !== 'undefined')
      ? { colMax: GRID_COLS, rowMax: GRID_ROWS }
      : undefined;
    const n = GCCRegions.fillFromPolygon(verts, state.rgSelected, bounds);
    showToast(`Filled ${n} hexes for ${state.rgSelected}`);
    state.rgTrace = [];
    clearTraceOverlay();
    state.panelEl.querySelector('#he-rg-trace-fill').textContent = 'Fill (0 pts)';
    refreshRegionSelect();
    updateRgStats();
    redrawAllRegionOverlay();
  }

  // Trace overlay: a transparent SVG sibling layer drawn into the
  // map root showing in-progress polygon vertices and connecting lines.
  // The map's hex grid root id varies; query for the SVG root once.
  function getMapSvg(){
    return document.getElementById('hex-svg');
  }
  function drawTraceOverlay(){
    clearTraceOverlay();
    if (!state.rgTrace.length) return;
    const svg = getMapSvg();
    if (!svg) return;
    if (typeof hexCenter !== 'function'){
      // No hex-center helper — can't render. Trace still works; user
      // just doesn't get a preview overlay.
      return;
    }
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.id = 'he-rg-trace-overlay';
    g.setAttribute('pointer-events', 'none');
    const pts = state.rgTrace.map(v => hexCenter(v.col, v.row));
    if (pts.length >= 2){
      const poly = document.createElementNS(ns, 'polyline');
      poly.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', '#ffeebb');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('stroke-dasharray', '4,3');
      g.appendChild(poly);
      // Closing edge (dotted) so users can see what the fill polygon
      // would look like.
      if (pts.length >= 3){
        const close = document.createElementNS(ns, 'line');
        close.setAttribute('x1', pts[pts.length - 1].x);
        close.setAttribute('y1', pts[pts.length - 1].y);
        close.setAttribute('x2', pts[0].x);
        close.setAttribute('y2', pts[0].y);
        close.setAttribute('stroke', '#ffeebb');
        close.setAttribute('stroke-width', '1');
        close.setAttribute('stroke-dasharray', '2,4');
        g.appendChild(close);
      }
    }
    for (const p of pts){
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#ffeebb');
      dot.setAttribute('stroke', '#553300');
      dot.setAttribute('stroke-width', '1');
      g.appendChild(dot);
    }
    svg.appendChild(g);
  }
  function clearTraceOverlay(){
    const old = document.getElementById('he-rg-trace-overlay');
    if (old) old.remove();
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
    else {
      state.panelEl.style.display = 'block';
      // Re-clamp position into viewport in case browser was resized while
      // the panel was hidden (restore() clamps via place()).
      if (state.heDrag) state.heDrag.restore();
    }
    refreshSelect();
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      wrap.addEventListener('click', onMapClick, true);
      // Paint drag: mousedown must be capture-phase on the wrap to beat the
      // map's bubble-phase pan-arming handler. mousemove/mouseup live on
      // window so we catch the drag even if the cursor leaves the wrap.
      wrap.addEventListener('mousedown', onPaintMousedown, true);
      wrap.addEventListener('mousedown', onOutlineMousedown, true);
      window.addEventListener('mousemove', onPaintMousemove);
      window.addEventListener('mousemove', onOutlineMousemove);
      window.addEventListener('mouseup', onPaintMouseup);
      window.addEventListener('mouseup', onOutlineMouseup);
    }
    document.addEventListener('keydown', onKey, true);
    const btn = document.getElementById('btn-hex-edit');
    if (btn) btn.classList.add('active');
    LOG('entered, activeTab=', state.activeTab);
  }

  function exit(){
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove('he-editing');
    document.body.classList.remove('he-painting');
    state.paintDragging = false;
    state.lastPaintKey = null;
    state.rgDragging = false;
    state.rgLastKey = null;
    if (state.activeTab === 'outline'){
      restoreTerrainOverlay();
      clearTraceOverlay();
    }
    if (state.panelEl) state.panelEl.style.display = 'none';
    const wrap = document.getElementById('map-wrap');
    if (wrap){
      wrap.removeEventListener('click', onMapClick, true);
      wrap.removeEventListener('mousedown', onPaintMousedown, true);
      wrap.removeEventListener('mousedown', onOutlineMousedown, true);
    }
    window.removeEventListener('mousemove', onPaintMousemove);
    window.removeEventListener('mousemove', onOutlineMousemove);
    window.removeEventListener('mouseup', onPaintMouseup);
    window.removeEventListener('mouseup', onOutlineMouseup);
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
