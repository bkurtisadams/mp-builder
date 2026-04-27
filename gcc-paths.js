// gcc-paths.js v0.1.0 — 2026-04-27
// Edge-based path features for the Greyhawk hex map: rivers, roads,
// bridges, fords, ferries. The journey planner's resolver consults this
// module to determine whether a hex-to-hex transition is blocked by a
// river or accelerated by a road.
//
// ── Edge numbering ──────────────────────────────────────────────────────────
// Flat-top hexes with odd-q-offset coordinates (odd cols shifted DOWN
// by half a row). Edges numbered clockwise from N:
//   0 = N, 1 = NE, 2 = SE, 3 = S, 4 = SW, 5 = NW
// neighborAcross(col, row, edge) returns the hex on the other side.
// edgeBetween(colA, rowA, colB, rowB) returns 0..5 if adjacent, -1 if not.
// Opposite edge = (e + 3) % 6.
//
// ── Storage ─────────────────────────────────────────────────────────────────
// Two kinds of features:
//
// SEGMENTS (rivers, roads): a linear feature passing THROUGH a hex.
//   Stored per-hex in hexSegments. Each segment has entryEdge + exitEdge
//   identifying where it crosses the hex boundary. A river that flows
//   through hexes A→B has a segment record in EACH hex (A's exitEdge
//   matches B's entryEdge across the shared border).
//
// EDGE FEATURES (bridges, fords, ferries): a point-on-edge feature at
//   the boundary between two hexes. Stored ONCE per shared edge, on
//   the lower-coordinate hex per ownerHex(). edgeFeaturesAt() handles
//   lookup from either side.
//
// ── Resolver ────────────────────────────────────────────────────────────────
// edgeBlocks(A, B, mode) → bool. True if ground travel from A to B
//   crosses an unbridged river. Streams are always crossable; rivers
//   and great rivers need a bridge/ford/ferry. Flying ignores all blocks.
// edgeRoadBonus(A, B, terrain) → multiplier. 1.5 for true road, 1.2
//   for track or road-through-rugged-terrain (per WoG rule that roads
//   downgrade through hills/mountains/marsh/desert).
// edgeRiverInfo(A, B) → { blocks, river, crossing } — the full picture
//   for the planner to render journey-log narration ("crossed Free
//   City Bridge over the Selintan").
//
// ── v0.1 scope ──────────────────────────────────────────────────────────────
// Phase 1 of the path layer: data model + resolver + test data only.
// No editor UI yet, no journey-planner integration yet (next session).
// Test rivers (Selintan, Velverdyva, Sheldomar, Javan) are positionally
// approximate — they exercise the resolver but will be replaced by
// editor-authored data in a later phase.

(function(){
  'use strict';

  const NEIGHBOR_OFFSETS = {
    even: [[0,-1],[1,-1],[1,0],[0,1],[-1,0],[-1,-1]], // N, NE, SE, S, SW, NW
    odd:  [[0,-1],[1, 0],[1,1],[0,1],[-1,1],[-1, 0]],
  };
  const EDGE_NAMES = ['N','NE','SE','S','SW','NW'];
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

  const hexSegments     = {};   // 'col-row' → [seg, ...]
  const hexEdgeFeatures = {};   // 'col-row' → { edgeNum: [feature, ...] }
  const namedRivers     = {};   // 'Selintan' → [{col, row, segment}, ...]
  const namedRoads      = {};   //  same shape

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

  // Find a river segment touching the shared edge between A and B,
  // checking both hexes' segment lists (the segment is recorded in both
  // hexes the river passes through; this query returns the first match).
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
  // Road bonus multiplier on miles/day for ground travel along a road.
  // WoG: roads through hills/mountains/marsh/desert/barrens count as
  // tracks. terrain string is the destination hex's terrain (the leg
  // we're entering); if its difficulty isn't 'normal', a true road
  // downgrades to track for that leg.
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

  // ── TEST DATA ─────────────────────────────────────────────────────────────
  // Hardcoded sample rivers + a couple bridges for resolver validation.
  // Coordinates anchored near canonical landmarks (Greyhawk D4-86 = col
  // 64 row 44, Highfolk B5-90 = col 40 row 36, etc.) but the exact paths
  // are approximations — Phase 4 (editor) will replace this with real data.
  function _addRiverChain(name, type, current, path){
    for (const h of path){
      _addSegment(h.col, h.row, {
        kind: 'river', type, current, name,
        entryEdge: h.entry, exitEdge: h.exit,
        downstreamEdge: h.exit,
      });
    }
  }
  // Selintan: Nyr Dyv → Greyhawk → Hardby → Woolly Bay
  _addRiverChain('Selintan', 'great_river', 2, [
    { col: 64, row: 41, entry: 0, exit: 3 },
    { col: 64, row: 42, entry: 0, exit: 3 },
    { col: 64, row: 43, entry: 0, exit: 3 },
    { col: 64, row: 44, entry: 0, exit: 2 },  // Greyhawk: enters N, exits SE
    { col: 65, row: 44, entry: 5, exit: 3 },  // odd col: enters NW, exits S
    { col: 65, row: 45, entry: 0, exit: 3 },
    { col: 65, row: 46, entry: 0, exit: 3 },
    { col: 65, row: 47, entry: 0, exit: 3 },
    { col: 65, row: 48, entry: 0, exit: 3 },
    { col: 65, row: 49, entry: 0, exit: 3 },  // Hardby
  ]);
  // Velverdyva: Yatil Mountains → Highfolk → east toward Veluna/Nyr Dyv
  _addRiverChain('Velverdyva', 'great_river', 2, [
    { col: 38, row: 36, entry: 4, exit: 2 },  // even: SW → SE
    { col: 39, row: 36, entry: 5, exit: 1 },  // odd:  NW → NE
    { col: 40, row: 36, entry: 4, exit: 2 },  // Highfolk
    { col: 41, row: 36, entry: 5, exit: 1 },
    { col: 42, row: 36, entry: 4, exit: 2 },
    { col: 43, row: 36, entry: 5, exit: 1 },
  ]);
  // Sheldomar: simple N-S chain through approximate Keoland heartland
  _addRiverChain('Sheldomar', 'great_river', 2, [
    { col: 44, row: 50, entry: 0, exit: 3 },
    { col: 44, row: 51, entry: 0, exit: 3 },
    { col: 44, row: 52, entry: 0, exit: 3 },
    { col: 44, row: 53, entry: 0, exit: 3 },
    { col: 44, row: 54, entry: 0, exit: 3 },
    { col: 44, row: 55, entry: 0, exit: 3 },
  ]);
  // Javan: smaller river, west of the Sheldomar through Sterich/Yeomanry
  _addRiverChain('Javan', 'river', 2, [
    { col: 36, row: 56, entry: 0, exit: 3 },
    { col: 36, row: 57, entry: 0, exit: 3 },
    { col: 36, row: 58, entry: 0, exit: 3 },
    { col: 36, row: 59, entry: 0, exit: 3 },
    { col: 36, row: 60, entry: 0, exit: 3 },
    { col: 36, row: 61, entry: 0, exit: 3 },
  ]);
  // Test bridges on the Selintan around Greyhawk City. Storage on the
  // lower-coord hex (per ownerHex). Edge nums are from the owner's POV.
  //   (64,43) edge 3 (S)  → boundary between (64,43) and (64,44=Greyhawk)
  //   (64,44) edge 2 (SE) → boundary between (64,44) and (65,44)
  _addEdgeFeature(64, 43, 3, { kind: 'bridge', name: 'Free City Bridge' });
  _addEdgeFeature(64, 44, 2, { kind: 'bridge', name: 'Greyhawk South Bridge' });

  // ── EXPORT ────────────────────────────────────────────────────────────────
  window.GCCPaths = {
    // Geometry
    neighborAcross, edgeBetween, ownerHex,
    EDGE_NAMES, EDGE_N: 0, EDGE_NE: 1, EDGE_SE: 2, EDGE_S: 3, EDGE_SW: 4, EDGE_NW: 5,
    // Data accessors
    segmentsAt, riversAt, roadsAt, edgeFeaturesAt,
    getNamedRiver, getNamedRoad, allRiverNames, allRoadNames,
    // Resolver
    edgeRiverInfo, edgeBlocks, edgeRoadBonus,
    CROSSING_KINDS,
  };
})();
