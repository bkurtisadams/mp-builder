// gcc-subhex-data.js v0.4.0 — 2026-04-28
// Subhex data layer: 3mi cells inscribed within 30mi parent hexes.
//
// ── Coords ──────────────────────────────────────────────────────────────────
// Parent stays offset (col, row) per greyhawk-map.html. Subhex axial
// (q, r) ∈ [0..10] within parent — 11×11 grid, 91 valid cells in a
// radius-5 hex-of-hexes, same flat-top orientation. Center subhex = (5, 5).
//
// ── Doc id ──────────────────────────────────────────────────────────────────
// `${parentDarleneId}__${q}_${r}`  e.g. "B4-115__2_3"
// Mirrors the landmarks/{hexId} pattern used by seed-landmarks.js. Stable
// across reloads and across seed changes — id is keyed on Darlene canon.
//
// ── Lookup chain ────────────────────────────────────────────────────────────
// getSubhex(col, row, q, r) → first match wins:
//   1. localStorage authored override   (Phase A)
//   2. canonical features (gcc-flanaess-features.js, future)  (Phase A stub)
//   3. procedural seed → terrain         (Phase A)
// Procedural results never persist; only authored ones consume storage.
//
// ── Phase A scope ───────────────────────────────────────────────────────────
// localStorage only. Firestore schema + rules are landed but client I/O
// lives in Phase B. setSubhexOverride writes to localStorage and emits a
// 'gcc-subhex-changed' event; Phase B will hook that to a debounced sync.

(function(){
  'use strict';

  const WORLD_SEED = 'greyhawk-flanaess-v1';
  const SCHEMA_VERSION = 1;
  const LS_KEY = 'gcc-subhex-overrides';
  const MIGRATION_FLAG_KEY = 'gcc-subhex-migrated-v4';
  const SUBHEX_DIM = 11;           // q,r index range [0..10]
  const SUBHEX_RADIUS = 5;         // hex-of-hexes radius from center (5,5)
  const SUBHEX_COUNT = 91;         // 1 + 6 + 12 + 18 + 24 + 30
  const PARENT_BIAS = 0.75;        // 75% chance subhex inherits parent terrain

  // v0.4: 91-cell radius-5 hex-of-hexes within [0..10]². Ring 0 = center
  // (5,5). Six rings totalling 1+6+12+18+24+30 cells. Replaces the v0.3
  // 19-cell radius-2 layout — same rendering math, just a wider grid that
  // gives ~3mi resolution per cell (vs 6mi at v0.3) and enough cells to
  // host icon-stamped terrain in the Wilderlands / Darlene published-map
  // tradition. v0.4 migration shifts every existing override key by
  // (+3, +3) to recenter v0.3 (2,2)-relative authored cells onto the
  // v0.4 (5,5) center. Guarded by MIGRATION_FLAG_KEY so it only runs once.
  const VALID_CELLS = (() => {
    const out = [];
    const c = (SUBHEX_DIM - 1) / 2;   // center index (5 for dim=11, 2 for dim=5)
    for (let q = 0; q < SUBHEX_DIM; q++){
      for (let r = 0; r < SUBHEX_DIM; r++){
        const dq = q - c, dr = r - c;
        const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
        if (dist <= SUBHEX_RADIUS) out.push({ q, r });
      }
    }
    return out;
  })();
  const VALID_KEYS = new Set(VALID_CELLS.map(c => `${c.q}_${c.r}`));
  function isValidCell(q, r){ return VALID_KEYS.has(`${q}_${r}`); }

  // Per-parent-terrain variation tables. Each entry is a weighted dict of
  // alternative terrains for the 25% non-inherited rolls. Stub-quality —
  // intent is to flesh out from DMG Appendix B + Greyhawk Glossography
  // before Phase B locks the seed. Edits to these tables change every
  // procedural subhex deterministically — once published, freeze.
  const VARIATION = {
    clear:        { plains: 4, forest: 2, hills: 2, hardwood: 1 },
    plains:       { clear: 3, forest: 2, hills: 2, hardwood: 1, swamp: 1 },
    forest:       { hardwood: 4, clear: 2, hills: 2, swamp: 1 },
    hardwood:     { forest: 4, conifer: 2, hills: 2, clear: 1 },
    conifer:      { hardwood: 3, forest: 2, mountains: 2, hills: 1 },
    jungle:       { swamp: 3, forest: 2, hills: 1 },
    hills:        { plains: 3, forest: 2, mountains: 2, forest_hills: 2, clear: 1 },
    forest_hills: { hills: 3, hardwood: 3, forest: 2, mountains: 1 },
    mountains:    { hills: 4, forest_hills: 2, conifer: 1 },
    desert:       { barrens: 3, plains: 2, hills: 1 },
    barrens:      { desert: 3, hills: 2, plains: 1 },
    swamp:        { forest: 2, plains: 2, water_fresh: 1 },
    // Water parents stay 100% same water — no variation.
    water:            { water: 1 },
    water_fresh:      { water_fresh: 1 },
    water_inland_sea: { water_inland_sea: 1 },
    water_coastal:    { water_coastal: 1 },
    water_shallow:    { water_shallow: 1 },
    water_deep:       { water_deep: 1 },
  };

  let OVERRIDES = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) OVERRIDES = JSON.parse(raw) || {};
  } catch(e){ OVERRIDES = {}; }

  function save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('gcc-subhex-changed')); } catch(e){}
  }

  function dim(){ return SUBHEX_DIM; }

  function subhexId(parentDarleneId, q, r){
    return `${parentDarleneId}__${q}_${r}`;
  }

  function parseSubhexId(id){
    const m = /^(.+)__(\d+)_(\d+)$/.exec(id);
    if (!m) return null;
    return { parentDarleneId: m[1], q: +m[2], r: +m[3] };
  }

  function inBounds(q, r){
    if (q < 0 || q >= SUBHEX_DIM || r < 0 || r >= SUBHEX_DIM) return false;
    return isValidCell(q, r);
  }

  function proceduralTerrain(parentTerrain, parentDarleneId, q, r){
    if (!parentTerrain) return null;
    const seed = window.GCCRng.seedFor(WORLD_SEED, parentDarleneId, 'subhex-terrain', q, r);
    const rng = window.GCCRng.mulberry32(seed);
    if (window.GCCRng.chance(rng, PARENT_BIAS)) return parentTerrain;
    const table = VARIATION[parentTerrain] || { [parentTerrain]: 1 };
    return window.GCCRng.pickWeighted(rng, table);
  }

  // Canonical-features pass — Phase A stub. Phase D will load from
  // gcc-flanaess-features.js (Greyhawk canon, City of Greyhawk, Castle
  // Greyhawk, Iuz's tower, named ruins). For now, returns null so the
  // chain falls through to procedural.
  function canonicalSubhex(parentDarleneId, q, r){ return null; }

  function getSubhex(parentDarleneId, q, r, parentTerrain){
    if (!inBounds(q, r)) return null;
    const id = subhexId(parentDarleneId, q, r);
    const ov = OVERRIDES[id];
    if (ov){
      return {
        id, q, r,
        parentDarleneId,
        terrain: ov.terrain || canonicalSubhex(parentDarleneId, q, r)?.terrain
                 || proceduralTerrain(parentTerrain, parentDarleneId, q, r),
        name:    ov.name || '',
        notes:   ov.notes || '',
        source:  'authored',
        schemaVersion: ov.schemaVersion || SCHEMA_VERSION,
      };
    }
    const canon = canonicalSubhex(parentDarleneId, q, r);
    if (canon){
      return { id, q, r, parentDarleneId, source: 'canonical', name: '', notes: '', ...canon };
    }
    return {
      id, q, r,
      parentDarleneId,
      terrain: proceduralTerrain(parentTerrain, parentDarleneId, q, r),
      name: '',
      notes: '',
      source: 'seed',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  function setSubhexOverride(parentDarleneId, q, r, fields){
    if (!inBounds(q, r)) return false;
    const id = subhexId(parentDarleneId, q, r);
    const cur = OVERRIDES[id] || {};
    const next = { ...cur };
    if ('terrain' in fields) next.terrain = fields.terrain || null;
    if ('name'    in fields) next.name    = fields.name || '';
    if ('notes'   in fields) next.notes   = fields.notes || '';
    next.schemaVersion = SCHEMA_VERSION;
    next.authoredAt = Date.now();
    // Strip empty doc
    const empty = !next.terrain && !next.name && !next.notes;
    if (empty){ delete OVERRIDES[id]; }
    else      { OVERRIDES[id] = next; }
    save();
    return true;
  }

  function clearSubhex(parentDarleneId, q, r){
    const id = subhexId(parentDarleneId, q, r);
    if (id in OVERRIDES){ delete OVERRIDES[id]; save(); return true; }
    return false;
  }

  function clearAll(){ OVERRIDES = {}; save(); }

  function allAuthored(){
    return Object.entries(OVERRIDES).map(([id, data]) => {
      const p = parseSubhexId(id);
      return p ? { id, ...p, ...data } : null;
    }).filter(Boolean);
  }

  function authoredCount(){ return Object.keys(OVERRIDES).length; }

  function exportOverrides(){ return JSON.parse(JSON.stringify(OVERRIDES)); }

  function importOverrides(obj){
    if (!obj || typeof obj !== 'object') return false;
    OVERRIDES = JSON.parse(JSON.stringify(obj));
    save();
    return true;
  }

  // v0.4 migration: shift every authored cell by (+3, +3) so v0.3 cells
  // centered on (2,2) recenter onto v0.4's (5,5). Runs once, guarded by
  // MIGRATION_FLAG_KEY. After migration we still run the prune below as
  // a defensive sweep against any malformed keys.
  {
    let migratedFlag = false;
    try { migratedFlag = !!localStorage.getItem(MIGRATION_FLAG_KEY); } catch(e){}
    if (!migratedFlag){
      let migrated = 0;
      const next = {};
      for (const id of Object.keys(OVERRIDES)){
        const p = parseSubhexId(id);
        if (!p){ continue; }
        const newQ = p.q + 3, newR = p.r + 3;
        const newId = `${p.parentDarleneId}__${newQ}_${newR}`;
        next[newId] = OVERRIDES[id];
        migrated++;
      }
      OVERRIDES = next;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES));
        localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      } catch(e){}
      if (migrated > 0){
        console.log(`[GCCSubhexData] Migrated ${migrated} authored cell(s) v0.3 → v0.4 (shifted +3,+3).`);
      }
    }
    let pruned = 0;
    for (const id of Object.keys(OVERRIDES)){
      const p = parseSubhexId(id);
      if (!p || !isValidCell(p.q, p.r)){ delete OVERRIDES[id]; pruned++; }
    }
    if (pruned > 0){
      console.log(`[GCCSubhexData] Pruned ${pruned} authored cell(s) outside 91-cell layout.`);
      try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
    }
  }

  window.GCCSubhexData = {
    WORLD_SEED, SCHEMA_VERSION, SUBHEX_DIM, SUBHEX_RADIUS, SUBHEX_COUNT,
    dim, subhexId, parseSubhexId, inBounds, isValidCell,
    validCells: () => VALID_CELLS.slice(),
    getSubhex, setSubhexOverride, clearSubhex, clearAll,
    allAuthored, authoredCount,
    exportOverrides, importOverrides,
    proceduralTerrain, canonicalSubhex,
    VARIATION,
  };
})();
