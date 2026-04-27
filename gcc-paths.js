// gcc-paths.js v0.3.0 — 2026-04-27
// Edge-based path features for the Greyhawk hex map: rivers, roads,
// bridges, fords, ferries. v0.2 adds editor-driven CRUD with
// localStorage override layering on top of hardcoded base data.
// v0.3.0: Phase B — crossing CRUD (saveCrossing/deleteCrossing/
// allCrossings/crossingAt) with override storage + replay. No base
// crossings yet; all live in the override layer until baked.
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
//
// v0.2.1: All 44 canonical Flanaess rivers baked into base data.
// Placeholder bridges removed (Phase B will add real ones via the
// Crossings editor). After loading, click Reset All in the Paths
// pane to clear stale localStorage overrides from the v0.2 placeholders.

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
  const LS_RIVERS    = 'gcc-paths-rivers';
  const LS_DELETED   = 'gcc-paths-rivers-deleted';
  const LS_CROSSINGS = 'gcc-paths-crossings';

  let overrideRivers = {};
  let deletedBaseRivers = new Set();
  // Crossings keyed by canonical edge id "ownerCol-ownerRow-edge".
  // Each value: {kind, name}. No deleted-tombstone list because there
  // are no base crossings yet — Phase B introduces them via the editor.
  let overrideCrossings = {};

  function loadOverrides(){
    try {
      const r = localStorage.getItem(LS_RIVERS);
      overrideRivers = r ? JSON.parse(r) : {};
      const d = localStorage.getItem(LS_DELETED);
      deletedBaseRivers = new Set(d ? JSON.parse(d) : []);
      const c = localStorage.getItem(LS_CROSSINGS);
      overrideCrossings = c ? JSON.parse(c) : {};
    } catch (e) {
      overrideRivers = {};
      deletedBaseRivers = new Set();
      overrideCrossings = {};
    }
  }
  function saveOverridesLS(){
    try {
      localStorage.setItem(LS_RIVERS, JSON.stringify(overrideRivers));
      localStorage.setItem(LS_DELETED, JSON.stringify(Array.from(deletedBaseRivers)));
      localStorage.setItem(LS_CROSSINGS, JSON.stringify(overrideCrossings));
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
    overrideCrossings = {};
    saveOverridesLS();
    rebuild();
  }
  function exportOverrides(){
    return {
      rivers: JSON.parse(JSON.stringify(overrideRivers)),
      deletedRivers: Array.from(deletedBaseRivers),
      crossings: JSON.parse(JSON.stringify(overrideCrossings)),
    };
  }

  // ── Crossings (bridges/fords/ferries) ──────────────────────────────────
  // Single record per shared edge, stored under the canonical owner hex
  // per ownerHex(). Editor-driven; no base crossings until Phase F bake.
  function _crossingKey(colA, rowA, colB, rowB){
    const owner = ownerHex(colA, rowA, colB, rowB);
    const ownerIsA = (owner.col === colA && owner.row === rowA);
    const nbCol = ownerIsA ? colB : colA;
    const nbRow = ownerIsA ? rowB : rowA;
    const e = edgeBetween(owner.col, owner.row, nbCol, nbRow);
    if (e < 0) return null;
    return `${owner.col}-${owner.row}-${e}`;
  }
  function _parseCrossingKey(key){
    const parts = key.split('-');
    if (parts.length !== 3) return null;
    const col = +parts[0], row = +parts[1], edge = +parts[2];
    if (!Number.isFinite(col) || !Number.isFinite(row) || !Number.isFinite(edge)) return null;
    return { col, row, edge };
  }
  function saveCrossing(colA, rowA, colB, rowB, kind, name){
    if (!CROSSING_KINDS.has(kind)) throw new Error(`bad crossing kind: ${kind}`);
    const k = _crossingKey(colA, rowA, colB, rowB);
    if (!k) throw new Error('hexes are not adjacent');
    overrideCrossings[k] = { kind, name: (name || '').trim() };
    saveOverridesLS();
    rebuild();
  }
  function deleteCrossing(colA, rowA, colB, rowB){
    const k = _crossingKey(colA, rowA, colB, rowB);
    if (!k) return;
    if (overrideCrossings[k]){
      delete overrideCrossings[k];
      saveOverridesLS();
      rebuild();
    }
  }
  function crossingAt(colA, rowA, colB, rowB){
    return edgeFeaturesAt(colA, rowA, colB, rowB).find(f => CROSSING_KINDS.has(f.kind)) || null;
  }
  function allCrossings(){
    const out = [];
    for (const k of Object.keys(hexEdgeFeatures)){
      const [colStr, rowStr] = k.split('-');
      const col = +colStr, row = +rowStr;
      const edges = hexEdgeFeatures[k];
      for (const eStr of Object.keys(edges)){
        const e = +eStr;
        const nb = neighborAcross(col, row, e);
        for (const f of edges[eStr]){
          if (CROSSING_KINDS.has(f.kind)){
            out.push({
              key: `${col}-${row}-${e}`,
              ownerCol: col, ownerRow: row, edge: e,
              hexA: { col, row }, hexB: nb,
              kind: f.kind, name: f.name || '',
            });
          }
        }
      }
    }
    return out;
  }
  function riverNameOnEdge(colA, rowA, colB, rowB){
    const r = _riverOnEdge(colA, rowA, colB, rowB);
    return r ? r.name : null;
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
    // Greyhawk Wars campaign data — 44 named rivers from the
    // Darlene/Living Greyhawk maps, painted via the Hex Editor
    // and baked here as the new base layer (v0.2.1).
    _baseRiver('Selintan', 'great_river', 2, [{col:66,row:43},{col:65,row:43},{col:64,row:44},{col:63,row:44},{col:63,row:45},{col:63,row:46},{col:64,row:47},{col:64,row:48},{col:63,row:48},{col:64,row:49},{col:65,row:49}]);
    _baseRiver('Velverdyva', 'great_river', 2, [{col:38,row:27},{col:37,row:27},{col:37,row:28},{col:38,row:29},{col:38,row:30},{col:39,row:30},{col:39,row:31},{col:39,row:32},{col:39,row:33},{col:39,row:34},{col:40,row:35},{col:41,row:35},{col:42,row:35},{col:43,row:35},{col:44,row:36},{col:45,row:36},{col:44,row:37},{col:44,row:38},{col:44,row:39},{col:44,row:40},{col:45,row:40},{col:46,row:40},{col:47,row:40},{col:47,row:41},{col:47,row:42},{col:47,row:43},{col:47,row:44},{col:48,row:45},{col:49,row:44},{col:50,row:45},{col:50,row:46},{col:50,row:47},{col:51,row:47},{col:52,row:47},{col:53,row:46},{col:54,row:46},{col:54,row:45},{col:54,row:44},{col:55,row:43},{col:55,row:44},{col:56,row:45},{col:57,row:45},{col:58,row:45}]);
    _baseRiver('Sheldomar', 'great_river', 2, [{col:36,row:57},{col:37,row:56},{col:38,row:56},{col:38,row:55},{col:39,row:54},{col:40,row:55},{col:41,row:55},{col:42,row:55},{col:42,row:56},{col:42,row:57},{col:43,row:57},{col:44,row:58},{col:45,row:58},{col:44,row:59},{col:44,row:60},{col:44,row:61},{col:45,row:61},{col:46,row:62},{col:47,row:62},{col:48,row:63},{col:49,row:63},{col:50,row:64},{col:51,row:64},{col:51,row:65},{col:51,row:66},{col:51,row:67},{col:51,row:68}]);
    _baseRiver('Javan', 'great_river', 3, [{col:20,row:48},{col:21,row:48},{col:22,row:49},{col:22,row:48},{col:23,row:47},{col:24,row:47},{col:25,row:46},{col:26,row:47},{col:26,row:48},{col:26,row:49},{col:26,row:50},{col:27,row:50},{col:27,row:51},{col:27,row:52},{col:26,row:53},{col:26,row:54},{col:27,row:54},{col:28,row:55},{col:29,row:55},{col:30,row:55},{col:31,row:55},{col:31,row:56},{col:30,row:57},{col:30,row:58},{col:31,row:58},{col:31,row:59},{col:30,row:60},{col:30,row:61},{col:31,row:61},{col:31,row:62},{col:31,row:63},{col:32,row:64},{col:33,row:64},{col:34,row:64},{col:35,row:63},{col:36,row:64},{col:36,row:65},{col:37,row:65},{col:37,row:66},{col:37,row:67},{col:38,row:67},{col:39,row:67},{col:40,row:68},{col:40,row:69},{col:40,row:70},{col:39,row:70},{col:39,row:71},{col:38,row:72},{col:38,row:73},{col:39,row:73},{col:40,row:73},{col:41,row:73},{col:41,row:74},{col:42,row:75},{col:43,row:74},{col:43,row:73},{col:44,row:73},{col:45,row:73}]);
    _baseRiver('Flanmi', 'great_river', 2, [{col:118,row:42},{col:118,row:43},{col:118,row:44},{col:117,row:44},{col:118,row:45},{col:119,row:45},{col:120,row:46},{col:120,row:47},{col:120,row:48},{col:121,row:48},{col:122,row:49},{col:123,row:49},{col:123,row:50},{col:122,row:51},{col:121,row:51},{col:120,row:52},{col:119,row:52},{col:119,row:53},{col:119,row:54},{col:120,row:55},{col:121,row:55},{col:121,row:56},{col:121,row:57},{col:120,row:58},{col:119,row:57},{col:118,row:58},{col:117,row:57},{col:116,row:58},{col:115,row:58},{col:115,row:59},{col:114,row:60},{col:115,row:60},{col:115,row:61},{col:114,row:62},{col:114,row:63},{col:115,row:63},{col:116,row:64},{col:117,row:63},{col:118,row:64},{col:119,row:64},{col:119,row:65},{col:118,row:66},{col:118,row:67},{col:119,row:67},{col:120,row:68}]);
    _baseRiver('Artonsamay', 'great_river', 2, [{col:68,row:19},{col:69,row:18},{col:70,row:18},{col:71,row:18},{col:71,row:19},{col:71,row:20},{col:72,row:21},{col:73,row:21},{col:74,row:22},{col:75,row:22},{col:76,row:23},{col:76,row:24},{col:77,row:24},{col:78,row:25},{col:79,row:24},{col:80,row:25},{col:81,row:25},{col:82,row:26},{col:83,row:26},{col:84,row:27},{col:85,row:27},{col:86,row:28},{col:87,row:28},{col:87,row:29},{col:87,row:30},{col:87,row:31},{col:87,row:32},{col:87,row:33},{col:87,row:34},{col:86,row:34},{col:86,row:33},{col:85,row:32},{col:85,row:33},{col:85,row:34},{col:85,row:35},{col:84,row:36},{col:83,row:35},{col:83,row:34},{col:82,row:34},{col:82,row:33},{col:81,row:32},{col:80,row:33},{col:80,row:34},{col:80,row:35},{col:79,row:34},{col:79,row:35},{col:78,row:36},{col:77,row:35},{col:76,row:36}]);
    _baseRiver('Nesser', 'great_river', 2, [{col:78,row:44},{col:79,row:43},{col:80,row:44},{col:80,row:45},{col:79,row:45},{col:79,row:46},{col:79,row:47},{col:80,row:48},{col:81,row:48},{col:81,row:49},{col:80,row:50},{col:79,row:50},{col:79,row:51},{col:80,row:51},{col:81,row:51},{col:80,row:52},{col:79,row:52},{col:80,row:53},{col:81,row:53},{col:81,row:54},{col:80,row:55},{col:81,row:55},{col:82,row:55},{col:82,row:56},{col:82,row:57},{col:82,row:58},{col:82,row:59},{col:82,row:60}]);
    _baseRiver('Harp', 'river', 2, [{col:106,row:34},{col:107,row:34},{col:107,row:35},{col:107,row:36},{col:107,row:37},{col:107,row:38},{col:107,row:39},{col:107,row:40},{col:108,row:41},{col:108,row:42},{col:109,row:42},{col:109,row:43},{col:109,row:44},{col:109,row:45},{col:110,row:46},{col:110,row:47},{col:109,row:47},{col:109,row:48},{col:108,row:49},{col:107,row:48},{col:106,row:48},{col:105,row:47},{col:104,row:47},{col:103,row:47},{col:103,row:48},{col:104,row:49},{col:104,row:50},{col:104,row:51},{col:105,row:51},{col:106,row:52},{col:106,row:53},{col:105,row:53},{col:105,row:54},{col:106,row:55},{col:106,row:56},{col:105,row:56},{col:104,row:56},{col:103,row:55},{col:102,row:55},{col:101,row:54}]);
    _baseRiver('Veng', 'river', 2, [{col:58,row:29},{col:58,row:30},{col:58,row:31},{col:59,row:31},{col:60,row:31},{col:61,row:30},{col:62,row:30},{col:63,row:30},{col:63,row:31},{col:62,row:32},{col:62,row:33},{col:61,row:33},{col:61,row:34},{col:62,row:35},{col:63,row:35},{col:64,row:35},{col:65,row:35},{col:64,row:36},{col:64,row:37},{col:65,row:37}]);
    _baseRiver('Jewel', 'river', 2, [{col:57,row:48},{col:58,row:49},{col:58,row:50},{col:59,row:50},{col:59,row:51},{col:58,row:52},{col:58,row:53},{col:58,row:54},{col:57,row:54},{col:57,row:55},{col:57,row:56},{col:57,row:57},{col:56,row:58},{col:57,row:58},{col:57,row:59},{col:58,row:60},{col:59,row:60},{col:59,row:61},{col:60,row:62},{col:61,row:62},{col:62,row:63},{col:63,row:63},{col:62,row:64},{col:61,row:64},{col:61,row:65},{col:60,row:66},{col:60,row:67}]);
    _baseRiver('Fler', 'river', 2, [{col:43,row:3},{col:42,row:4},{col:41,row:4},{col:40,row:5},{col:39,row:5},{col:39,row:6},{col:38,row:7},{col:37,row:6},{col:36,row:7},{col:35,row:7},{col:34,row:8},{col:33,row:8},{col:33,row:9},{col:32,row:10},{col:32,row:11},{col:32,row:12},{col:32,row:13},{col:33,row:13},{col:32,row:14},{col:32,row:15},{col:32,row:16},{col:32,row:17}]);
    _baseRiver('Tuflik', 'river', 2, [{col:26,row:39},{col:25,row:38},{col:24,row:38},{col:24,row:37},{col:24,row:36},{col:23,row:35},{col:22,row:36},{col:22,row:37},{col:21,row:37},{col:20,row:37},{col:19,row:36},{col:19,row:35},{col:18,row:35},{col:17,row:34},{col:17,row:33},{col:16,row:33},{col:15,row:32},{col:14,row:32},{col:13,row:31},{col:12,row:31},{col:11,row:31},{col:10,row:31},{col:10,row:30},{col:9,row:29},{col:8,row:29},{col:8,row:28}]);
    _baseRiver('Att', 'river', 2, [{col:49,row:35},{col:50,row:36},{col:51,row:36},{col:52,row:37},{col:53,row:37},{col:54,row:38},{col:55,row:38},{col:56,row:39},{col:55,row:39},{col:54,row:40},{col:53,row:40},{col:52,row:41},{col:51,row:41},{col:51,row:42},{col:50,row:43},{col:51,row:43},{col:52,row:44},{col:53,row:44},{col:54,row:45}]);
    _baseRiver('Blackwater', 'river', 2, [{col:47,row:13},{col:48,row:14},{col:49,row:14},{col:50,row:15},{col:51,row:14},{col:52,row:15},{col:52,row:16},{col:53,row:16},{col:54,row:17}]);
    _baseRiver('Blashikmund', 'river', 2, [{col:22,row:20},{col:22,row:21},{col:22,row:22},{col:21,row:22},{col:20,row:22},{col:19,row:21},{col:18,row:22},{col:17,row:22},{col:17,row:23},{col:17,row:24},{col:17,row:25},{col:16,row:25},{col:15,row:25},{col:15,row:26},{col:15,row:27},{col:15,row:28},{col:15,row:29},{col:14,row:30},{col:14,row:31},{col:13,row:31}]);
    _baseRiver('Cold', 'river', 2, [{col:78,row:17},{col:79,row:17},{col:79,row:18},{col:78,row:19},{col:78,row:20},{col:77,row:20},{col:77,row:21},{col:77,row:22},{col:77,row:23},{col:77,row:24}]);
    _baseRiver('Crystal', 'river', 2, [{col:52,row:34},{col:53,row:34},{col:54,row:34},{col:55,row:34},{col:56,row:35},{col:57,row:35},{col:58,row:35},{col:59,row:35},{col:60,row:35},{col:61,row:34}]);
    _baseRiver('Davish', 'river', 3, [{col:23,row:67},{col:23,row:66},{col:23,row:65},{col:24,row:65},{col:25,row:64},{col:26,row:64},{col:26,row:63},{col:27,row:62},{col:28,row:63},{col:29,row:62},{col:30,row:63},{col:31,row:63}]);
    _baseRiver('Deepstil', 'river', 2, [{col:46,row:19},{col:47,row:19},{col:48,row:20},{col:49,row:19},{col:50,row:20},{col:51,row:20},{col:52,row:21},{col:53,row:20},{col:54,row:21}]);
    _baseRiver('Dulsi', 'river', 2, [{col:56,row:11},{col:55,row:11},{col:54,row:12},{col:54,row:13},{col:55,row:13},{col:55,row:14},{col:55,row:15},{col:55,row:16},{col:54,row:17},{col:54,row:18},{col:53,row:18},{col:54,row:19},{col:54,row:20},{col:54,row:21},{col:54,row:22},{col:54,row:23}]);
    _baseRiver('Duntide', 'river', 1, [{col:96,row:42},{col:95,row:42},{col:95,row:43},{col:94,row:44},{col:93,row:44},{col:93,row:45},{col:92,row:46},{col:92,row:47},{col:91,row:47},{col:90,row:48},{col:90,row:49},{col:89,row:48},{col:88,row:48},{col:88,row:49},{col:87,row:49},{col:87,row:50},{col:86,row:51},{col:86,row:52},{col:86,row:53},{col:86,row:54},{col:85,row:54},{col:85,row:55},{col:84,row:56},{col:84,row:57},{col:83,row:57},{col:82,row:58}]);
    _baseRiver('Ery', 'river', 1, [{col:65,row:44},{col:65,row:45},{col:64,row:46},{col:63,row:46}]);
    _baseRiver('Fals', 'river', 3, [{col:34,row:40},{col:33,row:40},{col:33,row:41},{col:34,row:42},{col:35,row:41},{col:36,row:42},{col:37,row:42},{col:38,row:42},{col:39,row:41},{col:39,row:40},{col:38,row:40},{col:38,row:39},{col:39,row:38},{col:40,row:38},{col:41,row:38},{col:42,row:38},{col:43,row:38},{col:44,row:39}]);
    _baseRiver('Franz', 'river', 2, [{col:88,row:38},{col:87,row:38},{col:87,row:39},{col:86,row:40},{col:85,row:40},{col:85,row:41},{col:85,row:42},{col:84,row:43},{col:83,row:42},{col:82,row:43},{col:81,row:43},{col:81,row:44},{col:80,row:45}]);
    _baseRiver('Frozen', 'river', 2, [{col:98,row:15},{col:97,row:14},{col:97,row:13},{col:96,row:13},{col:95,row:13},{col:95,row:12},{col:96,row:12},{col:97,row:11},{col:97,row:10},{col:96,row:11},{col:95,row:10},{col:95,row:9},{col:95,row:8},{col:94,row:8},{col:94,row:9},{col:93,row:9},{col:92,row:10}]);
    _baseRiver('Grayflood', 'river', 2, [{col:102,row:65},{col:103,row:65},{col:104,row:65},{col:105,row:64},{col:106,row:64},{col:107,row:64}]);
    _baseRiver('Handmaiden', 'river', 2, [{col:52,row:52},{col:51,row:52},{col:52,row:53},{col:52,row:54},{col:53,row:54},{col:54,row:55},{col:54,row:56},{col:54,row:57},{col:55,row:57},{col:56,row:58}]);
    _baseRiver('Hool', 'river', 2, [{col:35,row:82},{col:36,row:82},{col:36,row:81},{col:36,row:80},{col:35,row:79},{col:36,row:79},{col:36,row:78},{col:37,row:77},{col:37,row:76},{col:38,row:76},{col:39,row:75},{col:40,row:75},{col:41,row:74}]);
    _baseRiver('Imeda', 'river', 2, [{col:128,row:52},{col:127,row:52},{col:126,row:52},{col:125,row:52},{col:124,row:53},{col:123,row:53},{col:123,row:54},{col:122,row:55},{col:121,row:55}]);
    _baseRiver('Jenelrad', 'river', 3, [{col:121,row:6},{col:120,row:7},{col:120,row:8},{col:119,row:8},{col:119,row:9},{col:118,row:10},{col:117,row:10},{col:117,row:11},{col:117,row:12}]);
    _baseRiver('Kewl', 'river', 4, [{col:49,row:53},{col:50,row:54},{col:50,row:55},{col:49,row:55},{col:49,row:56},{col:50,row:57},{col:49,row:57},{col:48,row:58},{col:48,row:59},{col:47,row:59},{col:47,row:60},{col:48,row:61},{col:49,row:61},{col:49,row:62},{col:50,row:63},{col:50,row:64}]);
    _baseRiver('Lort', 'river', 2, [{col:41,row:52},{col:42,row:53},{col:42,row:54},{col:42,row:55}]);
    _baseRiver('Mikar', 'river', 2, [{col:131,row:54},{col:130,row:54},{col:129,row:54},{col:129,row:55},{col:130,row:56},{col:130,row:57},{col:129,row:57},{col:129,row:58},{col:129,row:59},{col:128,row:60},{col:127,row:60},{col:127,row:61},{col:126,row:61},{col:125,row:61},{col:124,row:62},{col:123,row:62},{col:123,row:63},{col:122,row:64},{col:121,row:64},{col:120,row:65},{col:119,row:65}]);
    _baseRiver('Neen', 'river', 1, [{col:70,row:44},{col:70,row:45},{col:69,row:45},{col:68,row:46},{col:67,row:45},{col:66,row:46},{col:66,row:47},{col:65,row:46},{col:64,row:46}]);
    _baseRiver('Old', 'river', 2, [{col:56,row:61},{col:55,row:61},{col:54,row:62},{col:53,row:62},{col:52,row:63},{col:52,row:64},{col:51,row:64}]);
    _baseRiver('Opicm', 'river', 2, [{col:63,row:11},{col:63,row:12},{col:63,row:13},{col:63,row:14},{col:63,row:15},{col:63,row:16},{col:62,row:17},{col:62,row:18},{col:61,row:18},{col:61,row:19},{col:62,row:20},{col:62,row:21},{col:62,row:22},{col:61,row:22}]);
    _baseRiver('Pawluck', 'river', 1, [{col:102,row:73},{col:101,row:72},{col:102,row:72},{col:103,row:72},{col:104,row:72},{col:104,row:73},{col:105,row:73},{col:105,row:74},{col:106,row:74},{col:107,row:73},{col:107,row:74},{col:106,row:75},{col:107,row:75},{col:108,row:75},{col:109,row:74},{col:109,row:75},{col:108,row:76},{col:107,row:76}]);
    _baseRiver('Realstream', 'river', 3, [{col:29,row:43},{col:29,row:44},{col:30,row:45},{col:30,row:46},{col:30,row:47},{col:30,row:48},{col:31,row:48},{col:32,row:49},{col:32,row:50},{col:31,row:50},{col:31,row:51},{col:31,row:52},{col:30,row:53},{col:29,row:53},{col:28,row:54},{col:27,row:54}]);
    _baseRiver('Ritensa', 'river', 2, [{col:66,row:25},{col:67,row:25},{col:67,row:26},{col:68,row:27},{col:68,row:28},{col:69,row:28},{col:69,row:29},{col:68,row:30},{col:67,row:30},{col:67,row:31},{col:66,row:32},{col:65,row:32},{col:65,row:33},{col:65,row:34},{col:64,row:35}]);
    _baseRiver('Teesar', 'river', 2, [{col:117,row:34},{col:116,row:35},{col:115,row:35},{col:114,row:35},{col:113,row:35},{col:113,row:36},{col:113,row:37},{col:112,row:38},{col:112,row:39},{col:111,row:39},{col:111,row:40},{col:110,row:41},{col:110,row:42},{col:109,row:42}]);
    _baseRiver('Thelly', 'river', 2, [{col:105,row:59},{col:105,row:60},{col:106,row:61},{col:107,row:61},{col:107,row:62},{col:107,row:63},{col:107,row:64},{col:108,row:65},{col:109,row:64},{col:110,row:65},{col:111,row:65},{col:112,row:66},{col:113,row:66},{col:114,row:66},{col:115,row:66},{col:116,row:66},{col:117,row:66},{col:118,row:67}]);
    _baseRiver('Trask', 'river', 2, [{col:121,row:39},{col:122,row:40},{col:123,row:39},{col:124,row:40},{col:125,row:40},{col:125,row:41},{col:126,row:41},{col:127,row:40},{col:128,row:40},{col:129,row:39},{col:130,row:39},{col:131,row:39}]);
    _baseRiver('Yol', 'river', 2, [{col:95,row:21},{col:96,row:22},{col:97,row:22},{col:97,row:23},{col:96,row:24},{col:96,row:25},{col:95,row:25},{col:94,row:26},{col:94,row:27},{col:93,row:27},{col:92,row:28},{col:92,row:29},{col:91,row:29},{col:90,row:29},{col:89,row:29},{col:88,row:30},{col:87,row:30}]);
    _baseRiver('Zumker', 'river', 4, [{col:92,row:16},{col:91,row:16},{col:90,row:17},{col:89,row:17},{col:89,row:18},{col:88,row:19},{col:88,row:20},{col:88,row:21},{col:87,row:21},{col:86,row:21},{col:85,row:21},{col:84,row:22},{col:84,row:23},{col:84,row:24},{col:83,row:24},{col:82,row:25},{col:82,row:26}]);
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
    for (const [k, def] of Object.entries(overrideCrossings)){
      if (!def || !CROSSING_KINDS.has(def.kind)) continue;
      const parsed = _parseCrossingKey(k);
      if (!parsed) continue;
      try {
        _addEdgeFeature(parsed.col, parsed.row, parsed.edge, {
          kind: def.kind, name: def.name || '',
        });
      } catch (e) {
        console.warn('[gcc-paths] crossing apply failed:', k, e);
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
    crossingAt, allCrossings, riverNameOnEdge,
    // CRUD (persists)
    saveRiver, deleteRiver, clearOverrides, exportOverrides,
    saveCrossing, deleteCrossing,
    // Resolver
    edgeRiverInfo, edgeBlocks, edgeRoadBonus,
    // Utility
    chainToSegments, validateChain,
    // Lifecycle
    rebuild,
  };
})();
