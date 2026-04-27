// gcc-paths.js v0.2.0 — 2026-04-27
// Edge-based path features for the Greyhawk hex map: rivers, roads,
// bridges, fords, ferries. v0.2 adds editor-driven CRUD with
// localStorage override layering on top of hardcoded base data.
//
// ── Edge numbering ──────────────────────────────────────────────────────────
// Flat-top hexes with odd-q-offset coordinates (odd cols shifted DOWN
// by half a row). Edges numbered clockwise from N: 0=N, 1=NE, 2=SE,
// 3=S, 4=SW, 5=NW. Opposite edge = (e + 3) % 6.
//
// ── Storage ─────────────────────────────────────────────────────────────────
// SEGMENTS (rivers/roads): per-hex records in hexSegments. Each segment
// has entryEdge + exitEdge identifying its hex boundaries; first hex of
// a chain has entry = -1 (open source), last has exit = -1 (open mouth).
//
// EDGE FEATURES (bridges/fords/ferries): single record per shared edge
// stored on the lower-coord hex per ownerHex().
//
// ── Override model ──────────────────────────────────────────────────────────
// Two-layer like gcc-terrain / gcc-regions. Base data is hardcoded
// here; override data lives in localStorage as {name → {type, current,
// chain}} plus a deletedRivers tombstone list. rebuild() wipes and
// replays both — base entities not in deleted set restored, override
// entities (including ones sharing a base name) clobber the base.
//
// ── v0.2 scope ─────────────────────────────────────────────────────────────
// Phase A of the Hex Editor wiring: rivers only. Roads, edge-feature
// CRUD, and Firebase sync remain as in v0.1 (Phase B/C/F).

(function(){
  'use strict';

  const NEIGHBOR_OFFSETS = {
    even: [[0,-1],[1,-1],[1,0],[0,1],[-1,0],[-1,-1]],
    odd:  [[0,-1],[1, 0],[1,1],[0,1],[-1,1],[-1, 0]],
  };
  const EDGE_NAMES = ['N','NE','SE','S','SW','NW'];
  const RIVER_TYPES = ['stream','river','great_river'];
  const ROAD_KINDS = ['road','track'];
  const CROSSING_KINDS = new Set(['bridge','footbridge','ford','ferry']);

  function neighborAcross(col, row, edge){
    const off = (col % 2 === 0) ? NEIGHBOR_OFFSETS.even : NEIGHBOR_OFFSETS.odd;
    const [dc, dr] = off[edge];
    return { col: col + dc, row: row + dr };
  }
  function edgeBetween(colA, rowA, colB, rowB){
    const off = (colA % 2 === 0) ? NEIGHBOR_OFFSETS.even : NEIGHBOR_OFFSETS.odd;
    for (let e = 0; e < 6; e++){
      if (colA + off[e][0] === colB && rowA + off[e][1] === rowB) return e;
    }
    return -1;
  }
  function ownerHex(colA, rowA, colB, rowB){
    if (colA < colB) return { col: colA, row: rowA };
    if (colA > colB) return { col: colB, row: rowB };
    return rowA < rowB ? { col: colA, row: rowA } : { col: colB, row: rowB };
  }
  function keyOf(col, row){ return `${col}-${row}`; }
  function areAdjacent(colA, rowA, colB, rowB){
    return edgeBetween(colA, rowA, colB, rowB) >= 0;
  }

  // ── Stores ─────────────────────────────────────────────────────────────
  const hexSegments = {};       // 'col-row' → [seg, ...]
  const hexEdgeFeatures = {};   // 'col-row' → { edgeNum: [feature, ...] }
  const namedRivers = {};       // 'Selintan' → [{col, row, segment}, ...]
  const namedRoads = {};

  function _addSegment(col, row, seg){
    const k = keyOf(col, row);
    (hexSegments[k] = hexSegments[k] || []).push(seg);
    if (seg.name){
      const bucket = seg.kind === 'river' ? namedRivers : namedRoads;
      (bucket[seg.name] = bucket[seg.name] || []).push({ col, row, segment: seg });
    }
  }
  function _addEdgeFeature(col, row, edge, feature){
    const k = keyOf(col, row);
    if (!hexEdgeFeatures[k]) hexEdgeFeatures[k] = {};
    (hexEdgeFeatures[k][edge] = hexEdgeFeatures[k][edge] || []).push(feature);
  }
  function _wipeRiver(name){
    const entries = namedRivers[name] || [];
    for (const { col, row, segment } of entries){
      const k = keyOf(col, row);
      const arr = hexSegments[k];
      if (!arr) continue;
      const filtered = arr.filter(s => s !== segment);
      if (filtered.length === 0) delete hexSegments[k];
      else hexSegments[k] = filtered;
    }
    delete namedRivers[name];
  }
  function _clearAll(){
    for (const k of Object.keys(hexSegments)) delete hexSegments[k];
    for (const k of Object.keys(hexEdgeFeatures)) delete hexEdgeFeatures[k];
    for (const k of Object.keys(namedRivers)) delete namedRivers[k];
    for (const k of Object.keys(namedRoads)) delete namedRoads[k];
  }

  // ── Accessors ──────────────────────────────────────────────────────────
  function segmentsAt(col, row){ return hexSegments[keyOf(col, row)] || []; }
  function riversAt(col, row){   return segmentsAt(col, row).filter(s => s.kind === 'river'); }
  function roadsAt(col, row){    return segmentsAt(col, row).filter(s => s.kind === 'road'); }
  function edgeFeaturesAt(colA, rowA, colB, rowB){
    const owner = ownerHex(colA, rowA, colB, rowB);
    const ownerIsA = (owner.col === colA && owner.row === rowA);
    const nbCol = ownerIsA ? colB : colA;
    const nbRow = ownerIsA ? rowB : rowA;
    const e = edgeBetween(owner.col, owner.row, nbCol, nbRow);
    if (e < 0) return [];
    return hexEdgeFeatures[keyOf(owner.col, owner.row)]?.[e] || [];
  }

  function _riverOnEdge(colA, rowA, colB, rowB){
    const eA = edgeBetween(colA, rowA, colB, rowB);
    if (eA < 0) return null;
    for (const seg of riversAt(colA, rowA)){
      if (seg.entryEdge === eA || seg.exitEdge === eA) return seg;
    }
    const eB = (eA + 3) % 6;
    for (const seg of riversAt(colB, rowB)){
      if (seg.entryEdge === eB || seg.exitEdge === eB) return seg;
    }
    return null;
  }
  function _roadOnEdge(colA, rowA, colB, rowB){
    const eA = edgeBetween(colA, rowA, colB, rowB);
    if (eA < 0) return null;
    for (const seg of roadsAt(colA, rowA)){
      if (seg.entryEdge === eA || seg.exitEdge === eA) return seg;
    }
    const eB = (eA + 3) % 6;
    for (const seg of roadsAt(colB, rowB)){
      if (seg.entryEdge === eB || seg.exitEdge === eB) return seg;
    }
    return null;
  }

  // ── Resolver ───────────────────────────────────────────────────────────
  function edgeRiverInfo(colA, rowA, colB, rowB){
    const river = _riverOnEdge(colA, rowA, colB, rowB);
    if (!river) return { blocks: false, river: null, crossing: null };
    const crossing = edgeFeaturesAt(colA, rowA, colB, rowB)
      .find(f => CROSSING_KINDS.has(f.kind));
    if (river.type === 'stream') return { blocks: false, river, crossing: crossing || null };
    return { blocks: !crossing, river, crossing: crossing || null };
  }
  function edgeBlocks(colA, rowA, colB, rowB, mode){
    if (mode === 'flying') return false;
    return edgeRiverInfo(colA, rowA, colB, rowB).blocks;
  }
  function edgeRoadBonus(colA, rowA, colB, rowB, terrain){
    const road = _roadOnEdge(colA, rowA, colB, rowB);
    if (!road) return 1.0;
    const t = (typeof window !== 'undefined' && window.TERRAIN) ? window.TERRAIN[terrain] : null;
    const isHard = t && t.difficulty && t.difficulty !== 'normal';
    const effKind = (road.kind === 'road' && isHard) ? 'track' : road.kind;
    return effKind === 'road' ? 1.5 : 1.2;
  }

  function getNamedRiver(name){ return namedRivers[name] || []; }
  function getNamedRoad (name){ return namedRoads [name] || []; }
  function allRiverNames(){ return Object.keys(namedRivers).sort(); }
  function allRoadNames (){ return Object.keys(namedRoads ).sort(); }

  // ── Chain ↔ segments ───────────────────────────────────────────────────
  // Build per-hex segment records from a chain of adjacent hexes.
  // chain[0] is upstream (entry = -1, open source); chain[-1] is
  // downstream (exit = -1, open mouth). Internal hexes get entry =
  // edge to prev, exit = edge to next.
  function chainToSegments(chain){
    const segs = [];
    for (let i = 0; i < chain.length; i++){
      const h = chain[i];
      const prev = i > 0 ? chain[i-1] : null;
      const next = i < chain.length-1 ? chain[i+1] : null;
      const entry = prev ? edgeBetween(h.col, h.row, prev.col, prev.row) : -1;
      const exit  = next ? edgeBetween(h.col, h.row, next.col, next.row) : -1;
      segs.push({ col: h.col, row: h.row, entry, exit });
    }
    return segs;
  }
  // Returns null on success; otherwise the index of the first non-adjacent
  // step. chain.length < 2 is treated as valid.
  function validateChain(chain){
    for (let i = 1; i < chain.length; i++){
      if (!areAdjacent(chain[i-1].col, chain[i-1].row, chain[i].col, chain[i].row)) return i;
    }
    return null;
  }

  // ── In-memory write (used by base loader + override replay) ────────────
  function setRiverFromChain(name, type, current, chain){
    if (!name) throw new Error('river needs a name');
    if (!RIVER_TYPES.includes(type)) throw new Error(`bad river type: ${type}`);
    const broken = validateChain(chain);
    if (broken !== null) throw new Error(`chain breaks at index ${broken}`);
    _wipeRiver(name);
    const segs = chainToSegments(chain);
    for (const s of segs){
      _addSegment(s.col, s.row, {
        kind: 'river', type, current, name,
        entryEdge: s.entry, exitEdge: s.exit,
        downstreamEdge: s.exit,
      });
    }
  }

  // namedRivers entries are in chain order (upstream → downstream) by
  // virtue of setRiverFromChain pushing in chain order.
  function getRiverChain(name){
    const entries = namedRivers[name];
    if (!entries || entries.length === 0) return null;
    return entries.map(e => ({ col: e.col, row: e.row }));
  }
  function getRiverInfo(name){
    const entries = namedRivers[name];
    if (!entries || entries.length === 0) return null;
    const first = entries[0].segment;
    return {
      name,
      type: first.type,
      current: first.current,
      hexCount: entries.length,
      isBase: baseRiverNames.includes(name),
      isOverride: !!overrideRivers[name],
    };
  }

  // ── Persistence (localStorage overrides) ───────────────────────────────
  const LS_RIVERS  = 'gcc-paths-rivers';
  const LS_DELETED = 'gcc-paths-rivers-deleted';

  let overrideRivers = {};
  let deletedBaseRivers = new Set();

  function loadOverrides(){
    try {
      const r = localStorage.getItem(LS_RIVERS);
      overrideRivers = r ? JSON.parse(r) : {};
      const d = localStorage.getItem(LS_DELETED);
      deletedBaseRivers = new Set(d ? JSON.parse(d) : []);
    } catch (e) {
      overrideRivers = {};
      deletedBaseRivers = new Set();
    }
  }
  function saveOverridesLS(){
    try {
      localStorage.setItem(LS_RIVERS, JSON.stringify(overrideRivers));
      localStorage.setItem(LS_DELETED, JSON.stringify(Array.from(deletedBaseRivers)));
    } catch (e) {}
  }

  // Editor-driven save: persist override + replay.
  function saveRiver(name, type, current, chain){
    const cleanChain = chain.map(h => ({ col: h.col|0, row: h.row|0 }));
    const broken = validateChain(cleanChain);
    if (broken !== null) throw new Error(`chain breaks at index ${broken}`);
    if (!RIVER_TYPES.includes(type)) throw new Error(`bad river type: ${type}`);
    overrideRivers[name] = { type, current: +current, chain: cleanChain };
    deletedBaseRivers.delete(name);
    saveOverridesLS();
    rebuild();
  }
  function deleteRiver(name){
    if (overrideRivers[name]) delete overrideRivers[name];
    if (baseRiverNames.includes(name)) deletedBaseRivers.add(name);
    saveOverridesLS();
    rebuild();
  }
  function clearOverrides(){
    overrideRivers = {};
    deletedBaseRivers = new Set();
    saveOverridesLS();
    rebuild();
  }
  function exportOverrides(){
    return {
      rivers: JSON.parse(JSON.stringify(overrideRivers)),
      deletedRivers: Array.from(deletedBaseRivers),
    };
  }

  // ── Base data ──────────────────────────────────────────────────────────
  // Hardcoded baseline. Coordinates approximate — replace via the
  // Hex Editor.
  const baseRiverNames = [];
  function _baseRiver(name, type, current, chain){
    baseRiverNames.push(name);
    setRiverFromChain(name, type, current, chain);
  }
  function loadBaseData(){
    _baseRiver('Selintan', 'great_river', 2, [
      {col:64,row:41},{col:64,row:42},{col:64,row:43},{col:64,row:44},
      {col:65,row:44},{col:65,row:45},{col:65,row:46},{col:65,row:47},
      {col:65,row:48},{col:65,row:49},
    ]);
    _baseRiver('Velverdyva', 'great_river', 2, [
      {col:38,row:36},{col:39,row:36},{col:40,row:36},
      {col:41,row:36},{col:42,row:36},{col:43,row:36},
    ]);
    _baseRiver('Sheldomar', 'great_river', 2, [
      {col:44,row:50},{col:44,row:51},{col:44,row:52},
      {col:44,row:53},{col:44,row:54},{col:44,row:55},
    ]);
    _baseRiver('Javan', 'river', 2, [
      {col:36,row:56},{col:36,row:57},{col:36,row:58},
      {col:36,row:59},{col:36,row:60},{col:36,row:61},
    ]);
    _addEdgeFeature(64, 43, 3, { kind: 'bridge', name: 'Free City Bridge' });
    _addEdgeFeature(64, 44, 2, { kind: 'bridge', name: 'Greyhawk South Bridge' });
  }

  function rebuild(){
    _clearAll();
    baseRiverNames.length = 0;
    loadBaseData();
    for (const name of deletedBaseRivers){
      _wipeRiver(name);
    }
    for (const [name, def] of Object.entries(overrideRivers)){
      if (!def || !def.chain) continue;
      try {
        setRiverFromChain(name, def.type, def.current, def.chain);
      } catch (e) {
        console.warn('[gcc-paths] override apply failed:', name, e);
      }
    }
    if (typeof window !== 'undefined' && typeof window.rebuildPathOverlay === 'function'){
      try { window.rebuildPathOverlay(); } catch (e) {}
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
  loadOverrides();
  rebuild();

  // ── Export ─────────────────────────────────────────────────────────────
  window.GCCPaths = {
    // Geometry
    neighborAcross, edgeBetween, ownerHex, areAdjacent,
    EDGE_NAMES, EDGE_N: 0, EDGE_NE: 1, EDGE_SE: 2, EDGE_S: 3, EDGE_SW: 4, EDGE_NW: 5,
    RIVER_TYPES, ROAD_KINDS, CROSSING_KINDS,
    // Data accessors
    segmentsAt, riversAt, roadsAt, edgeFeaturesAt,
    getNamedRiver, getNamedRoad, allRiverNames, allRoadNames,
    getRiverChain, getRiverInfo,
    // CRUD (persists)
    saveRiver, deleteRiver, clearOverrides, exportOverrides,
    // Resolver
    edgeRiverInfo, edgeBlocks, edgeRoadBonus,
    // Utility
    chainToSegments, validateChain,
    // Lifecycle
    rebuild,
  };
})();
