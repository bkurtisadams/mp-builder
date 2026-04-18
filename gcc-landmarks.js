// gcc-landmarks.js v0.1.0 — 2026-04-18
// World of Greyhawk landmarks, keyed by Darlene hex ID.
// Source of truth for city / castle / ruin / feature positions.
// Expand iteratively from Living Greyhawk Gazetteer / Canonfire / 1983 Folio.
//
// Format: "Letter[Rep]-Diag": { name, kind, ... }
//   kind: "city" | "town" | "castle" | "ruin" | "village" | "feature" | "landmark"
//   size: "metropolis" | "city" | "small-city" | "town" | "village"   (optional)
//   pop:  approximate population                                      (optional)
//   region: canonical region name                                     (optional)
//   source: "published" | "campaign"   (default "published")
//   notes: freeform string                                            (optional)

(function(){
  const GH_LANDMARKS = {
    // ── VERIFIED FROM 27MB DARLENE SCAN (anchor set) ──────────────────────────
    "D4-86":  { name: "City of Greyhawk",   kind: "city", size: "metropolis", pop: 58000, region: "Domain of Greyhawk" },
    "H4-89":  { name: "Dyvers",             kind: "city", size: "city",       pop: 42000, region: "Wild Coast" },
    "C4-91":  { name: "Hardby",             kind: "town", size: "small-city", pop: 7500,  region: "Domain of Greyhawk" },
    "Y4-113": { name: "Niole Dra",          kind: "city", size: "city",                   region: "Kingdom of Keoland" },

    // ── TODO: fill from LGG / Canonfire gazetteer ────────────────────────────
    // Each entry below should be verified on the scan by diagonal-trace before
    // trusting it. Leave commented until verified.
    //
    // "??-??":  { name: "Chendl",             kind: "city", region: "Kingdom of Furyondy" },
    // "??-??":  { name: "Mitrik",             kind: "city", region: "Archclericy of Veluna" },
    // "??-??":  { name: "Verbobonc",          kind: "city", region: "Viscounty of Verbobonc" },
    // "??-??":  { name: "Willip",             kind: "city", region: "Kingdom of Furyondy" },
    // "??-??":  { name: "Nulb",               kind: "village" },
    // "??-??":  { name: "Hommlet",            kind: "village" },
    // "??-??":  { name: "Rel Mord",           kind: "city", region: "Kingdom of Nyrond" },
    // "??-??":  { name: "Rauxes",             kind: "city", region: "Great Kingdom" },
    // "??-??":  { name: "Rel Astra",          kind: "city", region: "Great Kingdom" },
    // "??-??":  { name: "Irongate",           kind: "city", region: "Iron League" },
    // "??-??":  { name: "Gradsul",            kind: "city", region: "Kingdom of Keoland" },
    // "??-??":  { name: "Saltmarsh",          kind: "town", region: "Kingdom of Keoland" },
    // "??-??":  { name: "Safeton",            kind: "town", region: "Wild Coast" },
    // "??-??":  { name: "Narwell",            kind: "town", region: "Wild Coast" },
    // "??-??":  { name: "Leukish",            kind: "city", region: "Duchy of Urnst" },
    // "??-??":  { name: "Radigast City",      kind: "city", region: "County of Urnst" },
    // "??-??":  { name: "Molag",              kind: "city", region: "Horned Society" },
    // "??-??":  { name: "Dorakaa",            kind: "city", region: "Empire of Iuz" },
    // "??-??":  { name: "Maure Castle",       kind: "castle", notes: "Maure family ruin" },
  };

  // ── API ───────────────────────────────────────────────────────────────────

  // Look up landmark metadata by Darlene hex ID string.
  function getLandmarkById(id){
    return GH_LANDMARKS[id] || null;
  }

  // Look up landmark metadata by internal (col, row). Requires global hexIdStr.
  function getLandmarkByHex(col, row){
    if(typeof hexIdStr !== 'function') return null;
    return GH_LANDMARKS[hexIdStr(col, row)] || null;
  }

  // Iterate landmarks as [id, data] pairs.
  function allLandmarks(){
    return Object.entries(GH_LANDMARKS);
  }

  // Resolve a landmark's internal (col, row) via darleneToInternal.
  // Requires global darleneToInternal.
  function landmarkHex(id){
    if(typeof darleneToInternal !== 'function') return null;
    return darleneToInternal(id);
  }

  // Expose on window under a namespace.
  window.GCCLandmarks = {
    data: GH_LANDMARKS,
    getById: getLandmarkById,
    getByHex: getLandmarkByHex,
    all: allLandmarks,
    hex: landmarkHex,
  };
})();
