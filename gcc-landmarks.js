// gcc-landmarks.js v0.3.0 — 2026-04-18
// World of Greyhawk landmarks, keyed by Darlene hex ID.
// Layered store: BASE file data + PENDING (no hex yet) + OVERRIDES (localStorage).
//
// Format: "Letter[Rep]-Diag": { name, kind, ... }
//   kind: "city" | "town" | "castle" | "ruin" | "village" | "feature" | "landmark"

(function(){
  const LS_KEY = 'gcc-landmark-overrides-v1';

  // ── BASE: verified from 27MB Darlene scan ─────────────────────────────────
  const GH_LANDMARKS = {
    "D4-86":  { name: "City of Greyhawk",   kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk" },
    "H4-89":  { name: "Dyvers",             kind: "city", size: "city",       pop: 42000, region: "Wild Coast" },
    "C4-91":  { name: "Hardby",             kind: "town", size: "small-city", pop: 7500,  region: "Domain of Greyhawk" },
    "Y4-113": { name: "Niole Dra",          kind: "city", size: "city",                   region: "Kingdom of Keoland" },
  };

  // ── PENDING: known cities waiting for hex ID assignment ───────────────────
  // Place via the landmark editor (gcc-landmark-edit.js).
      const GH_LANDMARKS = {
    "A2-69"   : { name: "Rauxes", kind: "city", region: "Great Kingdom" },
    "C4-86"   : { name: "City of Greyhawk", kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk" },
    "C4-91"   : { name: "Hardby", kind: "town", size: "small-city", pop: 7500, region: "Domain of Greyhawk" },
    "E4-74"   : { name: "Molag", kind: "city", region: "Horned Society" },
    "E4-83"   : { name: "Willip", kind: "city", region: "Kingdom of Furyondy" },
    "F4-95"   : { name: "Safeton", kind: "town", region: "Wild Coast" },
    "G4-89"   : { name: "Dyvers", kind: "city", size: "city", pop: 42000, region: "Wild Coast" },
    "H4-70"   : { name: "Dorakaa", kind: "city", region: "Empire of Iuz" },
    "H4-95"   : { name: "Narwell", kind: "town", region: "Wild Coast" },
    "N4-97"   : { name: "Hommlet", kind: "village" },
    "O4-95"   : { name: "Verbobonc", kind: "city", region: "Viscounty of Verbobonc" },
    "P4-117"  : { name: "Gradsul", kind: "city", region: "Kingdom of Keoland" },
    "P4-85"   : { name: "Chendl", kind: "city", region: "Kingdom of Furyondy" },
    "Q3-74"   : { name: "Radigast City", kind: "city", region: "County of Urnst" },
    "R-72"    : { name: "Rel Astra", kind: "city", region: "Great Kingdom" },
    "R3-81"   : { name: "Leukish", kind: "city", region: "Duchy of Urnst" },
    "X4-113"  : { name: "Niole Dra", kind: "city", size: "city", region: "Kingdom of Keoland" },
  };

  // ── OVERRIDES: user placements via editor, persisted to localStorage ──────
  // Shape: { [name]: { id, name, kind, region?, notes?, _override:true } }
  let OVERRIDES = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) OVERRIDES = JSON.parse(raw) || {};
  } catch(e){ OVERRIDES = {}; }

  function saveOverrides(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
  }

  // Precedence: overrides > base. Pending only appears once it has an override.
  // If an override exists for a name, the base entry keyed by the OLD hex id is
  // suppressed so moves don't leave a ghost at the old spot.
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
    OVERRIDES[entry.name] = {
      name: entry.name,
      id: entry.id,
      kind: entry.kind || existing.kind || 'feature',
      ...(entry.region || existing.region ? { region: entry.region || existing.region } : {}),
      ...(entry.notes  || existing.notes  ? { notes:  entry.notes  || existing.notes  } : {}),
      _override: true,
    };
    saveOverrides();
    return true;
  }

  function removeOverride(name){
    if (OVERRIDES[name]){ delete OVERRIDES[name]; saveOverrides(); return true; }
    return false;
  }
  function clearOverrides(){ OVERRIDES = {}; saveOverrides(); }
  function exportOverrides(){ return JSON.parse(JSON.stringify(OVERRIDES)); }

  // Paste-ready replacement for the GH_LANDMARKS object reflecting all overrides.
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
