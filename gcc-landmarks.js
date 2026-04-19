// gcc-landmarks.js v0.4.0 — 2026-04-18
// World of Greyhawk landmarks, keyed by Darlene hex ID.
// Layered store: BASE file data + PENDING (no hex yet) + OVERRIDES (localStorage).
//
// v0.4.0: setOverride now accepts optional clickPixel:{mx,my} so placed
// landmarks can feed the affine calibration solver.
//
// Format: "Letter[Rep]-Diag": { name, kind, ... }
//   kind: "city" | "town" | "castle" | "ruin" | "village" | "feature" | "landmark"

(function(){
  const LS_KEY = 'gcc-landmark-overrides-v1';

  // ── BASE: verified via the landmark editor against 27MB Darlene scan ──────
  const GH_LANDMARKS = {
    "A2-69":  { name: "Rauxes",             kind: "city", region: "Great Kingdom" },
    "C4-86":  { name: "City of Greyhawk",   kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk" },
    "C4-91":  { name: "Hardby",             kind: "town", size: "small-city", pop: 7500,  region: "Domain of Greyhawk" },
    "E4-74":  { name: "Molag",              kind: "city", region: "Horned Society" },
    "E4-83":  { name: "Willip",             kind: "city", region: "Kingdom of Furyondy" },
    "F4-95":  { name: "Safeton",            kind: "town", region: "Wild Coast" },
    "G4-89":  { name: "Dyvers",             kind: "city", size: "city",       pop: 42000, region: "Wild Coast" },
    "H4-70":  { name: "Dorakaa",            kind: "city", region: "Empire of Iuz" },
    "H4-95":  { name: "Narwell",            kind: "town", region: "Wild Coast" },
    "N4-97":  { name: "Hommlet",            kind: "village" },
    "O4-95":  { name: "Verbobonc",          kind: "city", region: "Viscounty of Verbobonc" },
    "P4-85":  { name: "Chendl",             kind: "city", region: "Kingdom of Furyondy" },
    "P4-117": { name: "Gradsul",            kind: "city", region: "Kingdom of Keoland" },
    "Q3-74":  { name: "Radigast City",      kind: "city", region: "County of Urnst" },
    "R-72":   { name: "Rel Astra",          kind: "city", region: "Great Kingdom" },
    "R3-81":  { name: "Leukish",            kind: "city", region: "Duchy of Urnst" },
    "X4-113": { name: "Niole Dra",          kind: "city", size: "city",                   region: "Kingdom of Keoland" },
  };

  // ── PENDING: known cities still waiting for hex ID assignment ─────────────
  // Place via the landmark editor (gcc-landmark-edit.js).
  const GH_PENDING = [
    { name: "Mitrik",       kind: "city",   region: "Archclericy of Veluna" },
    { name: "Nulb",         kind: "village" },
    { name: "Rel Mord",     kind: "city",   region: "Kingdom of Nyrond" },
    { name: "Irongate",     kind: "city",   region: "Iron League" },
    { name: "Saltmarsh",    kind: "town",   region: "Kingdom of Keoland" },
    { name: "Maure Castle", kind: "castle", notes: "Maure family ruin" },
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
    const existing = getByName(entry.name) || {};
    const merged = {
      name: entry.name,
      id: entry.id,
      kind: entry.kind || existing.kind || 'feature',
      ...(entry.region || existing.region ? { region: entry.region || existing.region } : {}),
      ...(entry.notes  || existing.notes  ? { notes:  entry.notes  || existing.notes  } : {}),
      _override: true,
    };
    // clickPixel: {mx, my} in canonical map space (output of screenToMap).
    // Recorded at placement so calibration can solve affine from placed landmarks.
    if (entry.clickPixel && typeof entry.clickPixel.mx === 'number' && typeof entry.clickPixel.my === 'number'){
      merged.clickPixel = { mx: entry.clickPixel.mx, my: entry.clickPixel.my };
    } else if (OVERRIDES[entry.name] && OVERRIDES[entry.name].clickPixel){
      merged.clickPixel = OVERRIDES[entry.name].clickPixel;
    }
    OVERRIDES[entry.name] = merged;
    saveOverrides();
    return true;
  }

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
