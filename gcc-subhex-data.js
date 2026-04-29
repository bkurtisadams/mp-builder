// gcc-subhex-data.js v2.0.1 — 2026-04-28
// v2.0.1: fragmentsForParent now uses SAT polygon-overlap instead of
// a circular reach test. The circle-of-radius-22 test included ~50
// cells per parent; only ~33 actually overlap the parent's hex
// polygon. The over-included cells rendered as floating hexes outside
// the parent boundary, which looked wrong now that we don't clip.
// Subhex data layer rebuilt on a global axial coord model. Replaces the
// per-parent local (q,r) ∈ [0..10] layout (v0.4–v1.1), which did not tile
// across parent boundaries.
//
// ── Geometry (verified) ────────────────────────────────────────────────────
// Main map: HEX_R=20 SVG units, flat-top, neighbor distance = HEX_R*√3 ≈
// 34.64 SVG = 30 miles. So 1 mi = HEX_R*√3/30 SVG and a 3-mile subhex has
// neighbor distance 2√3 SVG units, giving sub_R = 2.0 SVG (exact 10:1).
//
// ── Coords ─────────────────────────────────────────────────────────────────
// Subhex axial (Q, R) ∈ ℤ. Origin: ANCHOR_COL=70, ANCHOR_ROW=50 — the
// parent at that offset position has its center subhex at (Q,R)=(0,0).
// Once chosen this anchor is fixed forever; changing it requires
// rewriting every doc id.
//
// Parent (col, row) center axial (closed-form):
//   Q = (col - ANCHOR_COL) * 10
//   R = 10*(row - ANCHOR_ROW) - 5*(col - ANCHOR_COL) + 5*(col%2 - ANCHOR_COL%2)
//
// Owner of subhex (Q, R) = parent whose center is closest in SVG distance.
// Ties resolved by lower col, then lower row.
//
// ── Doc ids ────────────────────────────────────────────────────────────────
// Cells:    `subhex_${Q}_${R}`        (Q/R may be negative)
// Regions:  `region_${localId}`        (was `${parentId}__${localId}`)
// Members are scanned from cell.regionId — no parallel list to keep in sync.
//
// ── Schema (v2) ────────────────────────────────────────────────────────────
// Cell override doc fields (all optional, doc removed when fully empty):
//   terrain   : terrain key string or null
//   name      : cell name
//   notes     : freeform GM notes
//   feature   : { kind, name?, libraryId? } or null
//   regionId  : region localId reference, or null
//   schemaVersion: 2
//   authoredAt: ts
//
// Region doc:
//   { id (localId), name, terrain, schemaVersion: 2, authoredAt }
// Regions are now global — a region can span multiple parents.
//
// ── Migration v1.1 → v2.0 ──────────────────────────────────────────────────
// For each existing override `${parentId}__${q}_${r}` where (q,r)∈[0..10]
// with center (5,5):
//   1. Resolve parent (col, row) via window.darleneToInternal
//   2. parent_center_axial(col, row) = (PQ, PR)
//   3. New axial = (PQ + q - 5, PR + r - 5)
//   4. Re-key to `subhex_${Q}_${R}`
// Regions: re-key from `${parentId}__${localId}` to `region_${localId}`,
// renaming on collision so two parents with a "swamp" region become
// "swamp" and "swamp-2".
// Paths: handled in gcc-subhex-paths.js v1.0 (mirror migration).
// Guarded by MIGRATION_FLAG_KEY 'gcc-subhex-migrated-v5' (bumped from v4).

(function(){
  'use strict';

  const WORLD_SEED = 'greyhawk-flanaess-v1';
  const SCHEMA_VERSION = 2;

  // Anchor — fixed forever once chosen. Center of the Greyhawk map area.
  const ANCHOR_COL = 70;
  const ANCHOR_ROW = 50;

  // World SVG geometry (mirrors greyhawk-map.html). HEX_R is canonical.
  const HEX_R = 20;
  const SUB_R = 2;                  // = HEX_R / 10, exact
  const SQRT3 = Math.sqrt(3);

  const LS_KEY = 'gcc-subhex-overrides';
  const LS_REGIONS_KEY = 'gcc-subhex-regions';
  const MIGRATION_FLAG_KEY = 'gcc-subhex-migrated-v5';
  const PARENT_BIAS = 0.75;

  // Per-parent-terrain variation tables (carried over from v1.1).
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
    water:            { water: 1 },
    water_fresh:      { water_fresh: 1 },
    water_inland_sea: { water_inland_sea: 1 },
    water_coastal:    { water_coastal: 1 },
    water_shallow:    { water_shallow: 1 },
    water_deep:       { water_deep: 1 },
  };

  const FEATURE_KINDS = [
    'castle', 'ruin', 'tower', 'village',
    'camp', 'cache', 'shrine', 'lair',
    'grave', 'landmark',
  ];
  const FEATURE_KINDS_SET = new Set(FEATURE_KINDS);

  // ── Geometry helpers ────────────────────────────────────────────────────

  // World SVG center of a parent hex at offset (col, row). Mirrors
  // greyhawk-map.html hexCenter() exactly.
  function parentSvgCenter(col, row){
    return {
      x: HEX_R + col * 1.5 * HEX_R,
      y: HEX_R*SQRT3/2 + row*SQRT3*HEX_R + ((col & 1) ? HEX_R*SQRT3/2 : 0),
    };
  }

  // World axial (Q, R) of a parent's center subhex. Closed-form.
  function parentCenterAxial(col, row){
    const dCol = col - ANCHOR_COL;
    return {
      Q: dCol * 10,
      R: 10*(row - ANCHOR_ROW) - 5*dCol + 5*(col & 1) - 5*(ANCHOR_COL & 1),
    };
  }

  const ANCHOR_SVG = parentSvgCenter(ANCHOR_COL, ANCHOR_ROW);
  function subhexSvgCenter(Q, R){
    return {
      x: ANCHOR_SVG.x + 1.5 * SUB_R * Q,
      y: ANCHOR_SVG.y + SQRT3 * SUB_R * (R + Q/2),
    };
  }

  function axialRound(qf, rf){
    let x = qf, z = rf, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z);
    if (xd > yd && xd > zd)      rx = -ry - rz;
    else if (yd > zd)             ry = -rx - rz;
    else                          rz = -rx - ry;
    return { Q: rx, R: rz };
  }
  function svgToAxial(x, y){
    const dx = x - ANCHOR_SVG.x;
    const dy = y - ANCHOR_SVG.y;
    const qf = (2/3) * dx / SUB_R;
    const rf = (-dx/3 + SQRT3*dy/3) / SUB_R;
    return axialRound(qf, rf);
  }

  // Owner of subhex (Q, R) — nearest parent center in SVG, tiebreak
  // (lower col, then lower row). Cached.
  const _ownerCache = new Map();
  function ownerOf(Q, R){
    const key = `${Q}_${R}`;
    let cached = _ownerCache.get(key);
    if (cached) return cached;
    const sx = ANCHOR_SVG.x + 1.5 * SUB_R * Q;
    const sy = ANCHOR_SVG.y + SQRT3 * SUB_R * (R + Q/2);
    const colEst = ANCHOR_COL + Math.round(Q / 10);
    const rowEst = ANCHOR_ROW + Math.round((R + Q/2) / 10);
    let best = null, bestD = Infinity;
    for (let dc = -2; dc <= 2; dc++){
      for (let dr = -2; dr <= 2; dr++){
        const col = colEst + dc, row = rowEst + dr;
        if (col < 0 || row < 0) continue;
        const c = parentSvgCenter(col, row);
        const d = (sx - c.x)*(sx - c.x) + (sy - c.y)*(sy - c.y);
        if (d < bestD - 1e-9){
          best = { col, row }; bestD = d;
        } else if (Math.abs(d - bestD) < 1e-9){
          if (best === null || col < best.col || (col === best.col && row < best.row)){
            best = { col, row }; bestD = d;
          }
        }
      }
    }
    if (best) _ownerCache.set(key, best);
    return best;
  }

  // Enumerate the subhex axials owned by a parent. ~100 cells per
  // parent in the regular interior.
  function ownedByParent(col, row){
    const center = parentCenterAxial(col, row);
    const out = [];
    for (let dQ = -11; dQ <= 11; dQ++){
      for (let dR = -11; dR <= 11; dR++){
        const Q = center.Q + dQ, R = center.R + dR;
        const o = ownerOf(Q, R);
        if (o && o.col === col && o.row === row) out.push({ Q, R });
      }
    }
    return out;
  }

  // SAT: do two convex polygons (each as [[x,y], ...]) overlap?
  function _polysOverlap(a, b){
    for (const poly of [a, b]){
      for (let i = 0; i < poly.length; i++){
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % poly.length];
        const nx = y2 - y1, ny = -(x2 - x1);
        let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
        for (const [x, y] of a){
          const p = x*nx + y*ny;
          if (p < aMin) aMin = p; if (p > aMax) aMax = p;
        }
        for (const [x, y] of b){
          const p = x*nx + y*ny;
          if (p < bMin) bMin = p; if (p > bMax) bMax = p;
        }
        if (aMax < bMin - 1e-9 || bMax < aMin - 1e-9) return false;
      }
    }
    return true;
  }
  function _flatTopCorners(cx, cy, R){
    const out = new Array(6);
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      out[i] = [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    }
    return out;
  }

  // Subhex axials whose hex polygon overlaps the given parent polygon
  // but are owned by a different parent — used for fragment rendering.
  // Uses an actual polygon-overlap test (SAT) so cells that only
  // approximately approach the parent are excluded.
  function fragmentsForParent(col, row){
    const center = parentCenterAxial(col, row);
    const pc = parentSvgCenter(col, row);
    const parentPoly = _flatTopCorners(pc.x, pc.y, HEX_R);
    const out = [];
    for (let dQ = -11; dQ <= 11; dQ++){
      for (let dR = -11; dR <= 11; dR++){
        const Q = center.Q + dQ, R = center.R + dR;
        const o = ownerOf(Q, R);
        if (!o || (o.col === col && o.row === row)) continue;
        const sc = subhexSvgCenter(Q, R);
        const cellPoly = _flatTopCorners(sc.x, sc.y, SUB_R);
        if (_polysOverlap(parentPoly, cellPoly)){
          out.push({ Q, R, ownerCol: o.col, ownerRow: o.row });
        }
      }
    }
    return out;
  }

  // Six axial neighbors (flat-top).
  const NEIGHBOR_DELTAS = [
    [+1,  0], [ 0, +1], [-1, +1],
    [-1,  0], [ 0, -1], [+1, -1],
  ];

  // ── Storage ────────────────────────────────────────────────────────────

  let OVERRIDES = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) OVERRIDES = JSON.parse(raw) || {};
  } catch(e){ OVERRIDES = {}; }

  let REGIONS = {};
  try {
    const raw = localStorage.getItem(LS_REGIONS_KEY);
    if (raw) REGIONS = JSON.parse(raw) || {};
  } catch(e){ REGIONS = {}; }

  function save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('gcc-subhex-changed')); } catch(e){}
  }
  function saveRegions(){
    try { localStorage.setItem(LS_REGIONS_KEY, JSON.stringify(REGIONS)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('gcc-subhex-changed')); } catch(e){}
  }

  function subhexId(Q, R){ return `subhex_${Q}_${R}`; }
  function parseSubhexId(id){
    const m = /^subhex_(-?\d+)_(-?\d+)$/.exec(id);
    if (!m) return null;
    return { Q: +m[1], R: +m[2] };
  }
  function regionDocId(localId){ return `region_${localId}`; }
  function parseRegionId(id){
    const m = /^region_(.+)$/.exec(id);
    return m ? m[1] : null;
  }
  function slugify(s){
    return String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'region';
  }
  function genRegionLocalId(name){
    const base = slugify(name);
    let id = base, n = 2;
    while (REGIONS[regionDocId(id)]) id = `${base}-${n++}`;
    return id;
  }

  // ── Procedural ─────────────────────────────────────────────────────────

  function proceduralTerrain(parentTerrain, Q, R){
    if (!parentTerrain) return null;
    const seed = window.GCCRng.seedFor(WORLD_SEED, 'subhex-terrain', Q, R);
    const rng = window.GCCRng.mulberry32(seed);
    if (window.GCCRng.chance(rng, PARENT_BIAS)) return parentTerrain;
    const table = VARIATION[parentTerrain] || { [parentTerrain]: 1 };
    return window.GCCRng.pickWeighted(rng, table);
  }

  function canonicalSubhex(Q, R){ return null; }   // Phase D stub.

  function getSubhex(Q, R, parentTerrain){
    const id = subhexId(Q, R);
    const ov = OVERRIDES[id];
    if (ov){
      return {
        id, Q, R,
        terrain:  ov.terrain || canonicalSubhex(Q, R)?.terrain
                  || proceduralTerrain(parentTerrain, Q, R),
        name:     ov.name || '',
        notes:    ov.notes || '',
        feature:  ov.feature || null,
        regionId: ov.regionId || null,
        source:   'authored',
        schemaVersion: ov.schemaVersion || SCHEMA_VERSION,
      };
    }
    const canon = canonicalSubhex(Q, R);
    if (canon){
      return { id, Q, R, source: 'canonical', name: '', notes: '', feature: null, regionId: null, ...canon };
    }
    return {
      id, Q, R,
      terrain: proceduralTerrain(parentTerrain, Q, R),
      name: '', notes: '', feature: null, regionId: null,
      source: 'seed',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  function normalizeFeature(f){
    if (!f) return null;
    if (typeof f === 'string') f = { kind: f };
    if (!f.kind || !FEATURE_KINDS_SET.has(f.kind)) return null;
    const out = { kind: f.kind };
    if (f.name && String(f.name).trim()) out.name = String(f.name).trim();
    if (f.libraryId && String(f.libraryId).trim()) out.libraryId = String(f.libraryId).trim();
    return out;
  }

  function setSubhexOverride(Q, R, fields){
    const id = subhexId(Q, R);
    const cur = OVERRIDES[id] || {};
    const next = { ...cur };
    let terrainChanged = false;
    const prevTerrain = cur.terrain || null;
    if ('terrain' in fields){
      const newT = fields.terrain || null;
      if (newT !== prevTerrain) terrainChanged = true;
      next.terrain = newT;
    }
    if ('name'    in fields) next.name    = fields.name || '';
    if ('notes'   in fields) next.notes   = fields.notes || '';
    if ('feature' in fields) next.feature = normalizeFeature(fields.feature);
    if ('regionId' in fields) next.regionId = fields.regionId || null;

    const prevRegionId = cur.regionId || null;
    if (terrainChanged && next.regionId){
      const region = REGIONS[regionDocId(next.regionId)];
      const effective = next.terrain || canonicalSubhex(Q, R)?.terrain || null;
      if (region && effective && region.terrain !== effective){
        next.regionId = null;
      }
    }

    next.schemaVersion = SCHEMA_VERSION;
    next.authoredAt = Date.now();
    const empty = !next.terrain && !next.name && !next.notes && !next.feature && !next.regionId;
    if (empty) delete OVERRIDES[id];
    else       OVERRIDES[id] = next;
    save();

    const newRegionId = next.regionId || null;
    if (prevRegionId && prevRegionId !== newRegionId) gcRegionIfEmpty(prevRegionId);
    return true;
  }

  function setSubhexFeature(Q, R, feature){ return setSubhexOverride(Q, R, { feature }); }
  function clearSubhexFeature(Q, R){ return setSubhexOverride(Q, R, { feature: null }); }
  function clearSubhex(Q, R){
    const id = subhexId(Q, R);
    if (id in OVERRIDES){ delete OVERRIDES[id]; save(); return true; }
    return false;
  }
  function clearAll(){ OVERRIDES = {}; save(); }

  // ── Regions (global scope) ─────────────────────────────────────────────

  function listRegions(){
    return Object.values(REGIONS).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  function getRegion(localId){
    if (!localId) return null;
    return REGIONS[regionDocId(localId)] || null;
  }

  function createRegion(name, terrain){
    if (!name || !terrain) return null;
    const localId = genRegionLocalId(name);
    const region = {
      id: localId,
      name: String(name).trim(),
      terrain,
      schemaVersion: SCHEMA_VERSION,
      authoredAt: Date.now(),
    };
    REGIONS[regionDocId(localId)] = region;
    saveRegions();
    return region;
  }

  function renameRegion(localId, newName){
    const region = getRegion(localId);
    if (!region || !newName) return false;
    region.name = String(newName).trim() || region.name;
    region.authoredAt = Date.now();
    saveRegions();
    return true;
  }

  function deleteRegion(localId){
    const docId = regionDocId(localId);
    if (!REGIONS[docId]) return false;
    delete REGIONS[docId];
    saveRegions();
    let dirty = false;
    for (const cellId of Object.keys(OVERRIDES)){
      const ov = OVERRIDES[cellId];
      if (ov.regionId !== localId) continue;
      delete ov.regionId;
      if (!ov.terrain && !ov.name && !ov.notes && !ov.feature) delete OVERRIDES[cellId];
      dirty = true;
    }
    if (dirty) save();
    return true;
  }

  function assignCellToRegion(Q, R, localId, parentTerrain){
    const region = getRegion(localId);
    if (!region) return false;
    const sub = getSubhex(Q, R, parentTerrain);
    if (!sub) return false;
    if (sub.terrain !== region.terrain) return false;
    return setSubhexOverride(Q, R, { regionId: localId });
  }

  function unassignCellFromRegion(Q, R){
    return setSubhexOverride(Q, R, { regionId: null });
  }

  function regionMembers(localId){
    const out = [];
    for (const cellId of Object.keys(OVERRIDES)){
      const ov = OVERRIDES[cellId];
      if (ov.regionId !== localId) continue;
      const p = parseSubhexId(cellId);
      if (p) out.push({ Q: p.Q, R: p.R });
    }
    return out;
  }

  function regionsInParent(col, row){
    const out = new Map();
    for (const cellId of Object.keys(OVERRIDES)){
      const ov = OVERRIDES[cellId];
      if (!ov.regionId) continue;
      const p = parseSubhexId(cellId);
      if (!p) continue;
      const o = ownerOf(p.Q, p.R);
      if (!o || o.col !== col || o.row !== row) continue;
      const region = REGIONS[regionDocId(ov.regionId)];
      if (region && !out.has(region.id)) out.set(region.id, region);
    }
    return Array.from(out.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  function gcRegionIfEmpty(localId){
    if (!localId) return;
    const docId = regionDocId(localId);
    if (!REGIONS[docId]) return;
    if (regionMembers(localId).length > 0) return;
    delete REGIONS[docId];
    saveRegions();
  }

  // ── Export / import / introspection ────────────────────────────────────

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
  function exportRegions(){ return JSON.parse(JSON.stringify(REGIONS)); }
  function importRegions(obj){
    if (!obj || typeof obj !== 'object') return false;
    REGIONS = JSON.parse(JSON.stringify(obj));
    saveRegions();
    return true;
  }

  // ── Migration v1.1 → v2.0 ──────────────────────────────────────────────
  {
    let migratedFlag = false;
    try { migratedFlag = !!localStorage.getItem(MIGRATION_FLAG_KEY); } catch(e){}
    if (!migratedFlag){
      let mc = 0, dropped = 0, mr = 0;
      const nextOv = {};
      const nextRg = {};
      const regionRekey = {};   // `${parentId}__${oldLocalId}` → newLocalId

      // Regions first.
      for (const oldDocId of Object.keys(REGIONS)){
        const oldDoc = REGIONS[oldDocId];
        const m = /^(.+)__(.+)$/.exec(oldDocId);
        const oldLocalId = oldDoc?.id || (m ? m[2] : oldDocId);
        let newLocalId = oldLocalId;
        let n = 2;
        while (nextRg[regionDocId(newLocalId)]) newLocalId = `${oldLocalId}-${n++}`;
        regionRekey[oldDocId] = newLocalId;
        nextRg[regionDocId(newLocalId)] = {
          id: newLocalId,
          name: oldDoc?.name || newLocalId,
          terrain: oldDoc?.terrain || null,
          schemaVersion: SCHEMA_VERSION,
          authoredAt: oldDoc?.authoredAt || Date.now(),
        };
        mr++;
      }

      // Cells.
      for (const oldId of Object.keys(OVERRIDES)){
        const ov = OVERRIDES[oldId];
        const m = /^(.+)__(\d+)_(\d+)$/.exec(oldId);
        if (!m){ dropped++; continue; }
        const parentId = m[1];
        const q = +m[2], r = +m[3];
        const parent = (typeof window.darleneToInternal === 'function')
          ? window.darleneToInternal(parentId)
          : null;
        if (!parent){ dropped++; continue; }
        const center = parentCenterAxial(parent.col, parent.row);
        const Q = center.Q + (q - 5);
        const R = center.R + (r - 5);
        const newId = subhexId(Q, R);

        let nextRegionId = ov.regionId || null;
        if (nextRegionId){
          const oldRegionDocId = `${parentId}__${nextRegionId}`;
          if (regionRekey[oldRegionDocId]) nextRegionId = regionRekey[oldRegionDocId];
        }

        const candidate = {
          ...ov,
          regionId: nextRegionId,
          schemaVersion: SCHEMA_VERSION,
        };
        const existing = nextOv[newId];
        if (!existing || (candidate.authoredAt || 0) >= (existing.authoredAt || 0)){
          nextOv[newId] = candidate;
        }
        mc++;
      }

      OVERRIDES = nextOv;
      REGIONS = nextRg;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES));
        localStorage.setItem(LS_REGIONS_KEY, JSON.stringify(REGIONS));
        localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      } catch(e){}
      if (mc || mr || dropped){
        console.log(`[GCCSubhexData] v1.1→v2.0: ${mc} cell(s), ${mr} region(s) migrated; ${dropped} dropped.`);
      }
    }
  }

  window.GCCSubhexData = {
    WORLD_SEED, SCHEMA_VERSION, ANCHOR_COL, ANCHOR_ROW, HEX_R, SUB_R,
    FEATURE_KINDS,
    parentSvgCenter, parentCenterAxial, subhexSvgCenter,
    svgToAxial, ownerOf, ownedByParent, fragmentsForParent,
    NEIGHBOR_DELTAS,
    subhexId, parseSubhexId, regionDocId, parseRegionId,
    getSubhex, setSubhexOverride, clearSubhex, clearAll,
    setSubhexFeature, clearSubhexFeature,
    listRegions, regionsInParent, getRegion, createRegion, renameRegion, deleteRegion,
    assignCellToRegion, unassignCellFromRegion, regionMembers, gcRegionIfEmpty,
    allAuthored, authoredCount,
    exportOverrides, importOverrides,
    exportRegions, importRegions,
    proceduralTerrain, canonicalSubhex,
    VARIATION,
  };
})();
