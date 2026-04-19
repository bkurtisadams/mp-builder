// gcc-landmarks.js v0.6.2 — 2026-04-19
// World of Greyhawk landmarks, keyed by Darlene hex ID.
// Layered store: BASE file data + PENDING (no hex yet) + OVERRIDES (localStorage).
//
// v0.6.2: added 13 canonical landmarks — Highport, Eastfair, Highfolk,
//   Critwall, Forgotten City, Gryrax, Rookroost, Hochoch, Enstad, Jurnre
//   region, Kro Terlep, Admundfort, Zelradton. Saltmarsh dropped from
//   PENDING (not on Darlene map — U1-U3 publication era, non-canon here).
// v0.6.1: canonical ID sweep. All 17 pre-existing BASE entries re-pinned to
//   canonical Darlene hex IDs against the image-align transform. Four former
//   pendings placed (Mitrik, Rel Mord, Irongate, Maure Castle); two new
//   entries (Ekbir, Yecha) added. Nulb and Saltmarsh remain pending.
// v0.6.0: single pixel field per override (symbolPixel). hexCenterPixel
//   retired along with the landmark-based affine/TPS solvers; image-align
//   transform replaces that workflow.
// v0.5.0: two pixel fields (symbolPixel, hexCenterPixel).
// v0.4.0: setOverride accepted optional clickPixel for affine calibration.
//
// Format: "Letter[Rep]-Diag": { name, kind, ... }
//   kind: "city" | "town" | "castle" | "ruin" | "village" | "feature" | "landmark"

(function(){
  const LS_KEY = 'gcc-landmark-overrides-v1';

  // ── BASE: verified via the landmark editor against 27MB Darlene scan ──────
  const GH_LANDMARKS = {
    "A4-101": { name: "Highport",           kind: "city" },
    "B2-56":  { name: "Eastfair",           kind: "city" },
    "B3-75":  { name: "Rel Mord",           kind: "city", region: "Kingdom of Nyrond" },
    "B5-90":  { name: "Highfolk",           kind: "city" },
    "B5-95":  { name: "Mitrik",             kind: "city", region: "Archclericy of Veluna" },
    "C4-78":  { name: "Critwall",           kind: "city", region: "Shield Lands" },
    "C4-91":  { name: "Hardby",             kind: "town", size: "small-city", pop: 7500,  region: "Domain of Greyhawk" },
    "D4-86":  { name: "City of Greyhawk",   kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk" },
    "E3-98":  { name: "Irongate",           kind: "city", region: "Iron League" },
    "E4-73":  { name: "Molag",              kind: "city", region: "Horned Society" },
    "E4-82":  { name: "Willip",             kind: "city", region: "Kingdom of Furyondy" },
    "F4-94":  { name: "Safeton",            kind: "town", region: "Wild Coast" },
    "H4-89":  { name: "Dyvers",             kind: "city", size: "city",       pop: 42000, region: "Wild Coast" },
    "H6-95":  { name: "Ekbir",              kind: "city" },
    "I4-68":  { name: "Dorakaa",            kind: "city", region: "Empire of Iuz" },
    "I4-94":  { name: "Narwell",            kind: "town", region: "Wild Coast" },
    "J6-163": { name: "Forgotten City",     kind: "city" },
    "L4-113": { name: "Gryrax",             kind: "city" },
    "N3-58":  { name: "Rookroost",          kind: "city" },
    "N5-114": { name: "Hochoch",            kind: "city", region: "Grand Duchy of Geoff" },
    "O4-96":  { name: "Hommlet",            kind: "village" },
    "P-70":   { name: "Rel Astra",          kind: "city", region: "Great Kingdom" },
    "P4-100": { name: "Enstad",             kind: "city", region: "Celene" },
    "P4-95":  { name: "Verbobonc",          kind: "city", region: "Viscounty of Verbobonc" },
    "Q3-73":  { name: "Radigast City",      kind: "city", region: "County of Urnst" },
    "Q4-117": { name: "Gradsul",            kind: "city", region: "Kingdom of Keoland" },
    "Q4-83":  { name: "Chendl",             kind: "city", region: "Kingdom of Furyondy" },
    "R3-80":  { name: "Leukish",            kind: "city", region: "Duchy of Urnst" },
    "R4-112": { name: "Jurnre",             kind: "city", region: "County of Ulek" },
    "V2-112": { name: "Kro Terlep",         kind: "city" },
    "X3-77":  { name: "Admundfort",         kind: "city", region: "Shield Lands" },
    "X3-86":  { name: "Maure Castle",       kind: "castle", notes: "Maure family ruin" },
    "Y-68":   { name: "Rauxes",             kind: "city", region: "Great Kingdom" },
    "Y2-92":  { name: "Zelradton",          kind: "city" },
    "Y4-113": { name: "Niole Dra",          kind: "city", size: "city",                   region: "Kingdom of Keoland" },
    "Y5-79":  { name: "Yecha",              kind: "city" },
  };

  // ── PENDING: known cities still waiting for hex ID assignment ─────────────
  // Place via the landmark editor (gcc-landmark-edit.js).
  const GH_PENDING = [
    { name: "Nulb", kind: "village" },
  ];

  // ── OVERRIDES: user placements via editor, persisted to localStorage ──────
  let OVERRIDES = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) OVERRIDES = JSON.parse(raw) || {};
  } catch(e){ OVERRIDES = {}; }

  function saveOverrides(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
  }

  function mergedView(){
    const out = {};
    const overriddenNames = new Set(Object.keys(OVERRIDES));
    for (const [id, e] of Object.entries(GH_LANDMARKS)){
      if (overriddenNames.has(e.name)) continue;
      out[id] = e;
    }
    for (const name of overriddenNames){
      const ov = OVERRIDES[name];
      if (!ov || !ov.id) continue;
      const basePair = Object.entries(GH_LANDMARKS).find(([,v]) => v.name === name);
      const pendingEntry = GH_PENDING.find(p => p.name === name);
      const baseEntry = basePair ? basePair[1] : (pendingEntry || {});
      out[ov.id] = { ...baseEntry, ...ov, _override: true };
    }
    return out;
  }

  function getLandmarkById(id){ return mergedView()[id] || null; }
  function getLandmarkByHex(col, row){
    if(typeof hexIdStr !== 'function') return null;
    return mergedView()[hexIdStr(col, row)] || null;
  }
  function allLandmarks(){ return Object.entries(mergedView()); }
  function landmarkHex(id){
    if(typeof darleneToInternal !== 'function') return null;
    return darleneToInternal(id);
  }

  function allNames(){
    const s = new Set();
    for (const e of Object.values(GH_LANDMARKS)) s.add(e.name);
    for (const p of GH_PENDING) s.add(p.name);
    for (const n of Object.keys(OVERRIDES)) s.add(n);
    return [...s].sort();
  }

  function getByName(name){
    const ov = OVERRIDES[name];
    const basePair = Object.entries(GH_LANDMARKS).find(([,v]) => v.name === name);
    const base = basePair ? { id: basePair[0], ...basePair[1] } : null;
    const pending = GH_PENDING.find(p => p.name === name) || null;
    if (!ov && !base && !pending) return null;
    return { ...(pending||{}), ...(base||{}), ...(ov||{}) };
  }

  function setOverride(entry){
    if (!entry || !entry.name || !entry.id) return false;
    const merged = {
      name: entry.name,
      id: entry.id,
      kind: entry.kind || (getByName(entry.name) || {}).kind || 'feature',
      _override: true,
    };
    const existing = getByName(entry.name) || {};
    if (entry.region || existing.region) merged.region = entry.region || existing.region;
    if (entry.notes  || existing.notes)  merged.notes  = entry.notes  || existing.notes;

    // v0.6.0: single pixel field. symbolPixel — where the city art is drawn
    // on the Darlene scan. Drives marker rendering in buildLandmarkOverlay.
    // The old hexCenterPixel was used by the landmark-based affine/TPS
    // alignment, removed 2026-04-19 in favour of the image-align transform.
    const prev = OVERRIDES[entry.name] || {};
    const sym = entry.symbolPixel || prev.symbolPixel;
    if (sym && typeof sym.mx === 'number' && typeof sym.my === 'number'){
      merged.symbolPixel = { mx: +sym.mx, my: +sym.my };
    }
    OVERRIDES[entry.name] = merged;
    saveOverrides();
    return true;
  }

  // One-shot cleanup: strip legacy clickPixel (pre-v0.5) and hexCenterPixel
  // (v0.5, used by removed alignment solvers) from stored overrides. Both
  // are superseded by symbolPixel + the image-align transform.
  function migrateLegacyOverrides(){
    let migrated = 0;
    for (const name in OVERRIDES){
      const o = OVERRIDES[name];
      if (!o || typeof o !== 'object') continue;
      if (o.clickPixel){
        if (!o.symbolPixel && typeof o.clickPixel.mx === 'number'){
          o.symbolPixel = { mx: +o.clickPixel.mx, my: +o.clickPixel.my };
        }
        delete o.clickPixel;
        migrated++;
      }
      if (o.hexCenterPixel){
        delete o.hexCenterPixel;
        migrated++;
      }
    }
    if (migrated > 0){
      saveOverrides();
      console.log('[gcc-landmarks] stripped', migrated, 'legacy pixel fields');
    }
  }
  migrateLegacyOverrides();

  function removeOverride(name){
    if (OVERRIDES[name]){ delete OVERRIDES[name]; saveOverrides(); return true; }
    return false;
  }
  function clearOverrides(){ OVERRIDES = {}; saveOverrides(); }
  function exportOverrides(){ return JSON.parse(JSON.stringify(OVERRIDES)); }

  function exportMergedSource(){
    const merged = mergedView();
    const lines = ['  const GH_LANDMARKS = {'];
    const entries = Object.entries(merged).sort((a,b)=>a[0].localeCompare(b[0]));
    for (const [id, e] of entries){
      const parts = [`name: ${JSON.stringify(e.name)}`, `kind: ${JSON.stringify(e.kind)}`];
      if (e.size)   parts.push(`size: ${JSON.stringify(e.size)}`);
      if (e.pop)    parts.push(`pop: ${e.pop}`);
      if (e.region) parts.push(`region: ${JSON.stringify(e.region)}`);
      if (e.notes)  parts.push(`notes: ${JSON.stringify(e.notes)}`);
      lines.push(`    ${JSON.stringify(id).padEnd(10)}: { ${parts.join(', ')} },`);
    }
    lines.push('  };');
    return lines.join('\n');
  }

  function unplacedPending(){
    return GH_PENDING.filter(p => !OVERRIDES[p.name]);
  }

  window.GCCLandmarks = {
    data: GH_LANDMARKS,
    pending: GH_PENDING,
    getById: getLandmarkById,
    getByHex: getLandmarkByHex,
    getByName,
    all: allLandmarks,
    allNames,
    hex: landmarkHex,
    setOverride,
    removeOverride,
    clearOverrides,
    exportOverrides,
    exportMergedSource,
    unplacedPending,
  };
})();
