// gcc-landmarks.js v0.7.0 — 2026-04-23
// World of Greyhawk landmarks, keyed by Darlene hex ID.
// Layered store: BASE file data + PENDING (no hex yet) + OVERRIDES (localStorage).
//
// v0.7.0: `isPort` (broad "water-accessible") renamed to `onWater`; the
//   name `isPort` is now reserved for a narrower "trading seaport"
//   designation the voyage simulator will own later. Legacy override
//   migration copies any stored `isPort:true` to `onWater:true` and
//   drops the old field. Expanded BASE to 108 canonical landmarks.
// v0.6.3: added isPort boolean attribute (composes with any kind — a
//   landmark can be a city AND a port). Tagged 11 canonical ports on
//   Nyr Dyv / Azure Sea / Solnor coasts. setOverride and
//   exportMergedSource persist isPort through overrides.
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
//   kind:    "city" | "town" | "castle" | "ruin" | "village" | "feature" | "landmark"
//   onWater: true (optional) — landmark is on or adjacent to water (river,
//            lake, coast). Renders a wave ≈ overlay on the map. Broad tag.
//   isPort:  true (optional, reserved) — landmark is a true trading seaport
//            for the voyage simulator. Renders an anchor ⚓ overlay. Narrow
//            subset of onWater cities; not user-exposed yet.

(function(){
  const LS_KEY = 'gcc-landmark-overrides-v1';

  // ── BASE: verified via the landmark editor against 27MB Darlene scan ──────
  const GH_LANDMARKS = {
    "A4-101": { name: "Highport",           kind: "city", onWater: true },
    "A4-105": { name: "Stoneheim",          kind: "city" },
    "A5-133": { name: "Hokar",              kind: "city" },
    "B2-47":  { name: "Johnsport",          kind: "city", onWater: true },
    "B2-56":  { name: "Eastfair",           kind: "city" },
    "B2-99":  { name: "Ducchan",            kind: "city", onWater: true },
    "B3-38":  { name: "Bastro",             kind: "city", onWater: true },
    "B3-75":  { name: "Rel Mord",           kind: "city", region: "Kingdom of Nyrond", onWater: true },
    "B5-90":  { name: "Highfolk",           kind: "city", onWater: true },
    "B5-95":  { name: "Mitrik",             kind: "city", region: "Archclericy of Veluna", onWater: true },
    "C-17":   { name: "Glot",               kind: "city", onWater: true },
    "C2-27":  { name: "Krakenheim",         kind: "city", onWater: true },
    "C3-42":  { name: "Vlekstaad",          kind: "city", onWater: true },
    "C4-78":  { name: "Critwall",           kind: "city", region: "Shield Lands", onWater: true },
    "C4-91":  { name: "Hardby",             kind: "town", size: "small-city", pop: 7500, region: "Domain of Greyhawk", onWater: true },
    "C5-77":  { name: "Traft",              kind: "city", onWater: true },
    "D-55":   { name: "Oakenhart",          kind: "city", onWater: true },
    "D-79":   { name: "Lo Reltarma",        kind: "city" },
    "D2-78":  { name: "Torrich",            kind: "city" },
    "D2-93":  { name: "Dullstrand",         kind: "city", onWater: true },
    "D4-86":  { name: "City of Greyhawk",   kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk", onWater: true },
    "D5-109": { name: "Shiboleth",          kind: "city" },
    "D5-123": { name: "Longspear",          kind: "city" },
    "E3-98":  { name: "Irongate",           kind: "city", region: "Iron League", onWater: true },
    "E4-73":  { name: "Molag",              kind: "city", region: "Horned Society", onWater: true },
    "E4-82":  { name: "Willip",             kind: "city", region: "Kingdom of Furyondy", onWater: true },
    "E5-82":  { name: "Schwartzenbruin",    kind: "city", onWater: true },
    "F2-83":  { name: "Nulbish",            kind: "city", onWater: true },
    "F4-94":  { name: "Safeton",            kind: "town", region: "Wild Coast", onWater: true },
    "F4-101": { name: "Elredd",             kind: "city", onWater: true },
    "F5-105": { name: "Hookhill",           kind: "city" },
    "G-22":   { name: "Soill",              kind: "city", onWater: true },
    "G-54":   { name: "Asperdi",            kind: "city", onWater: true },
    "H2-47":  { name: "Ratikhill",          kind: "city" },
    "H4-89":  { name: "Dyvers",             kind: "city", size: "city", pop: 42000, region: "Wild Coast", onWater: true },
    "H4-99":  { name: "Fax",                kind: "city", onWater: true },
    "H6-95":  { name: "Ekbir",              kind: "city" },
    "I2-44":  { name: "Marner",             kind: "city", onWater: true },
    "I2-51":  { name: "Spinecastle",        kind: "city" },
    "I3-64":  { name: "Stoink",             kind: "city" },
    "I4-68":  { name: "Dorakaa",            kind: "city", region: "Empire of Iuz", onWater: true },
    "I4-94":  { name: "Narwell",            kind: "town", region: "Wild Coast" },
    "I4-102": { name: "Badwall",            kind: "city" },
    "I5-100": { name: "Thornward",          kind: "city" },
    "J2-37":  { name: "Djekul",             kind: "city" },
    "J3-74":  { name: "Trigol",             kind: "city", onWater: true },
    "J4-76":  { name: "Grabford",           kind: "city", onWater: true },
    "J5-120": { name: "Flen",               kind: "city" },
    "J6-163": { name: "Forgotten City",     kind: "city" },
    "K-54":   { name: "Winetha",            kind: "city", onWater: true },
    "K4-111": { name: "Havenhill",          kind: "city" },
    "L2-90":  { name: "Pitchfield",         kind: "city" },
    "L4-113": { name: "Gryrax",             kind: "city", onWater: true },
    "L6-101": { name: "Zeif",               kind: "city", onWater: true },
    "M4-95":  { name: "Nulb",               kind: "village" },
    "M5-93":  { name: "Molvar",             kind: "city" },
    "M5-114": { name: "Orlane",             kind: "city" },
    "M5-130": { name: "Loftwick",           kind: "city" },
    "N-11":   { name: "Jotsplat",           kind: "city", onWater: true },
    "N-18":   { name: "Knudje",             kind: "city" },
    "N-52":   { name: "Rinloru",            kind: "city" },
    "N-59":   { name: "Roland",             kind: "city" },
    "N3-58":  { name: "Rookroost",          kind: "city" },
    "N3-100": { name: "Scant",              kind: "city", onWater: true },
    "N4-96":  { name: "Hommlet",            kind: "village" },
    "N4-104": { name: "Courwood",           kind: "city", onWater: true },
    "N5-82":  { name: "Exag",               kind: "city" },
    "N5-114": { name: "Hochoch",            kind: "city", region: "Gran March" },
    "O-48":   { name: "Atirr",              kind: "city", onWater: true },
    "O5-123": { name: "Istivin",            kind: "city" },
    "P-70":   { name: "Rel Astra",          kind: "city", region: "Great Kingdom", onWater: true },
    "P4-89":  { name: "Littleberg",         kind: "city", region: "Kingdom of Furyondy", onWater: true },
    "P4-95":  { name: "Verbobonc",          kind: "city", region: "Viscounty of Verbobonc", onWater: true },
    "P4-100": { name: "Enstad",             kind: "city", region: "Celene", onWater: true },
    "Q3-73":  { name: "Radigast City",      kind: "city", region: "County of Urnst", onWater: true },
    "Q4-55":  { name: "Dandredun",          kind: "city" },
    "Q4-81":  { name: "Crockport",          kind: "city", onWater: true },
    "Q4-83":  { name: "Chendl",             kind: "city", region: "Kingdom of Furyondy", onWater: true },
    "Q4-117": { name: "Gradsul",            kind: "city", region: "Kingdom of Keoland", onWater: true },
    "R2-33":  { name: "Kelten",             kind: "city" },
    "R2-88":  { name: "Hexpools",           kind: "city", onWater: true },
    "R3-80":  { name: "Leukish",            kind: "city", region: "Duchy of Urnst", onWater: true },
    "R4-112": { name: "Jurnre",             kind: "city", region: "County of Ulek", onWater: true },
    "R5-120": { name: "Gorna",              kind: "city" },
    "S-77":   { name: "Mentrey",            kind: "city" },
    "S2-79":  { name: "Chathold",           kind: "city", onWater: true },
    "S4-107": { name: "Tringlee",           kind: "city" },
    "S5-98":  { name: "Lopolla",            kind: "city", onWater: true },
    "T4-125": { name: "Monmurg",            kind: "city", onWater: true },
    "U-90":   { name: "Sulward",            kind: "city", onWater: true },
    "U2-85":  { name: "Prymp",              kind: "city", onWater: true },
    "U3-103": { name: "Blue",               kind: "city", onWater: true },
    "U4-64":  { name: "Eru-Tovar",          kind: "city", onWater: true },
    "V-48":   { name: "Kaport Bay",         kind: "city", onWater: true },
    "V-59":   { name: "Delarie",            kind: "city", onWater: true },
    "V2-99":  { name: "Naerie",             kind: "city", onWater: true },
    "V2-112": { name: "Kro Terlep",         kind: "city", onWater: true },
    "V4-130": { name: "Port Toli",          kind: "city", onWater: true },
    "W2-40":  { name: "Purmill",            kind: "city", onWater: true },
    "X3-77":  { name: "Admundfort",         kind: "city", region: "Shield Lands", onWater: true },
    "X3-86":  { name: "Maure Castle",       kind: "castle", notes: "Maure family ruin" },
    "Y-68":   { name: "Rauxes",             kind: "city", region: "Great Kingdom", onWater: true },
    "Y2-77":  { name: "Mithat",             kind: "city", onWater: true },
    "Y2-92":  { name: "Zelradton",          kind: "city" },
    "Y4-96":  { name: "Veluna City",        kind: "city", region: "Veluna" },
    "Y4-107": { name: "Waybury",            kind: "city" },
    "Y4-113": { name: "Niole Dra",          kind: "city", size: "city", region: "Kingdom of Keoland" },
    "Y4-128": { name: "Westkeep",           kind: "city" },
    "Y5-79":  { name: "Yecha",              kind: "city" },
    "Z-82":   { name: "Pontylver",          kind: "city", onWater: true },
    "Z2-80":  { name: "Oldred",             kind: "city", onWater: true },
    "Z5-98":  { name: "Sefmur",             kind: "city", onWater: true },
    "Z5-100": { name: "Ceshra",             kind: "city", onWater: true },
  };

  // ── PENDING: known cities still waiting for hex ID assignment ─────────────
  // Place via the Hex Editor, Landmarks tab (gcc-hex-edit.js).
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
    // onWater (broad water-adjacent) and isPort (narrow trading seaport —
    // reserved for voyage sim). Both booleans use three-state logic: an
    // explicit boolean in `entry` wins, otherwise inherit from base.
    if (typeof entry.onWater === 'boolean') merged.onWater = entry.onWater;
    else if (typeof existing.onWater === 'boolean') merged.onWater = existing.onWater;
    if (typeof entry.isPort === 'boolean') merged.isPort = entry.isPort;
    else if (typeof existing.isPort === 'boolean') merged.isPort = existing.isPort;

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
      // v0.7.0 rename: the earlier `isPort` override meant "water-adjacent"
      // (Kurt's broad usage). Move it to `onWater` so `isPort` can be
      // reclaimed for the narrow trading-seaport tag the voyage sim owns.
      if (o.isPort === true && o.onWater === undefined){
        o.onWater = true;
        delete o.isPort;
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
      if (e.notes)   parts.push(`notes: ${JSON.stringify(e.notes)}`);
      if (e.onWater) parts.push(`onWater: true`);
      if (e.isPort)  parts.push(`isPort: true`);
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
