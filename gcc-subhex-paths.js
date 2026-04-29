// gcc-subhex-paths.js v1.3.0 — 2026-04-29
// v1.3.0: subhexBoundaryInfo now considers ALL boundary cell pairs
// between two parents, not just the geometrically-closest one. The
// old "single boundary cell" model failed when a road on one bank
// of a river crossed a parent boundary at a cell offset from the
// edge midpoint — the planner picked the midpoint cell (which had
// only the river on it) and reported hasRoad=false. New model:
// scan every cell of parent A whose axial neighbor is owned by
// parent B; if any such pair is on the same road path, the edge
// is traversable. Same for rivers. The boundaryCell returned now
// prefers the road-bearing cell so callers (like the ghost marker)
// can highlight the relevant cell.
// v1.2.0: subhex layer is now consulted by the parent-layer movement
// planner. Add subhexBoundaryInfo(parentColA, rowA, parentColB, rowB)
// — returns { hasData, boundaryCell, hasRoad, hasRiver } describing
// what subhex paths exist on the cell between two parents. When
// hasData is true, the planner uses subhex truth (Rule 1: a road on
// the boundary cell makes the edge traversable). When hasData is
// false, the planner falls back to the 30mi parent-layer data.
// Helpers: parentHasSubhexPaths(col, row),
// boundaryCellBetweenParents(colA, rowA, colB, rowB).
// v1.1.0: add truncateBefore(localId, Q, R) — keep cells up to but
// not including the matched cell, drop the rest. Used by the view's
// per-cell remove flow: clicking an armed path's cell during Path
// tool authoring removes that cell (and everything after it).
// Subhex path data layer, global-coordinate model. A path is an ordered
// chain of subhex cells (each adjacent to the previous via axial neighbor
// distance 1). Paths are now global — a single path can cross parent
// boundaries.
//
// ── Schema ──────────────────────────────────────────────────────────────
// {
//   id: 'old-keep-road',         // local id, slug-derived
//   kind: 'road',                // river | road | trail
//   name: 'Old Keep Road',
//   notes: '',
//   cells: [{Q,R}, {Q,R}, ...],  // ordered, each adjacent to previous
//   schemaVersion: 2,
//   authoredAt: ts,
// }
//
// Storage key 'gcc-subhex-paths' as
//   { [`path_${pathLocalId}`]: pathDoc }
//
// ── Migration v0.9 → v1.0 ──────────────────────────────────────────────
// For each existing path `${parentId}__${localId}`:
//   1. Resolve parent (col, row) via window.darleneToInternal
//   2. PCenter = parentCenterAxial(col, row) via GCCSubhexData
//   3. Translate every cell {q,r} ∈ [0..10] → {Q: PQ + q-5, R: PR + r-5}
//   4. Re-key path doc to `path_${localId}`, renaming on collision.
// Runs once, guarded by 'gcc-subhex-paths-migrated-v2'.

(function(){
  'use strict';

  const PATH_KINDS = ['river', 'road', 'trail'];
  const PATH_KINDS_SET = new Set(PATH_KINDS);
  const SCHEMA_VERSION = 2;
  const LS_KEY = 'gcc-subhex-paths';
  const MIGRATION_FLAG_KEY = 'gcc-subhex-paths-migrated-v2';

  let PATHS = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) PATHS = JSON.parse(raw) || {};
  } catch(e){ PATHS = {}; }

  function save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(PATHS)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('gcc-subhex-changed')); } catch(e){}
  }

  function pathDocId(localId){ return `path_${localId}`; }
  function parsePathDocId(id){
    const m = /^path_(.+)$/.exec(id);
    return m ? m[1] : null;
  }
  function slugify(s){
    return String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'path';
  }
  function genLocalId(name){
    const base = slugify(name);
    let id = base, n = 2;
    while (PATHS[pathDocId(id)]) id = `${base}-${n++}`;
    return id;
  }

  // Six axial neighbors (flat-top).
  const NEIGHBOR_DELTAS = [
    [+1,  0], [ 0, +1], [-1, +1],
    [-1,  0], [ 0, -1], [+1, -1],
  ];
  function isNeighbor(a, b){
    if (!a || !b) return false;
    const dQ = b.Q - a.Q, dR = b.R - a.R;
    for (const [ddQ, ddR] of NEIGHBOR_DELTAS){
      if (dQ === ddQ && dR === ddR) return true;
    }
    return false;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  function listPaths(){
    return Object.values(PATHS).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // Paths with at least one cell whose owner is this parent — used by the
  // view to decide which paths to render in a given subhex window.
  function pathsInParent(col, row){
    if (!window.GCCSubhexData) return [];
    const out = [];
    for (const p of listPaths()){
      let hit = false;
      for (const c of p.cells || []){
        const o = window.GCCSubhexData.ownerOf(c.Q, c.R);
        if (o && o.col === col && o.row === row){ hit = true; break; }
      }
      if (hit) out.push(p);
    }
    return out;
  }

  function getPath(localId){
    if (!localId) return null;
    return PATHS[pathDocId(localId)] || null;
  }

  function createPath(kind, name){
    if (!PATH_KINDS_SET.has(kind) || !name) return null;
    const localId = genLocalId(name);
    const doc = {
      id: localId,
      kind,
      name: String(name).trim(),
      notes: '',
      cells: [],
      schemaVersion: SCHEMA_VERSION,
      authoredAt: Date.now(),
    };
    PATHS[pathDocId(localId)] = doc;
    save();
    return doc;
  }

  function renamePath(localId, newName){
    const p = getPath(localId);
    if (!p || !newName) return false;
    p.name = String(newName).trim() || p.name;
    p.authoredAt = Date.now();
    save();
    return true;
  }

  function deletePath(localId){
    const docId = pathDocId(localId);
    if (!PATHS[docId]) return false;
    delete PATHS[docId];
    save();
    return true;
  }

  // Append a cell to the end of a path. Validates adjacency to current
  // last cell (or empty-path start).
  function appendCell(localId, Q, R){
    const p = getPath(localId);
    if (!p) return false;
    const last = p.cells.length ? p.cells[p.cells.length - 1] : null;
    if (last){
      if (last.Q === Q && last.R === R) return false;
      if (!isNeighbor(last, { Q, R })) return false;
    }
    p.cells.push({ Q, R });
    p.authoredAt = Date.now();
    save();
    return true;
  }

  function popCell(localId){
    const p = getPath(localId);
    if (!p || !p.cells.length) return false;
    p.cells.pop();
    p.authoredAt = Date.now();
    save();
    return true;
  }

  // Truncate the path at the first cell matching (Q, R): keep all cells
  // before it, drop that cell and everything after. If the matched
  // cell is the first cell, the path becomes empty (callers may then
  // choose to delete it). Used by the view's per-cell remove flow:
  // clicking an armed path's cell while the Path tool is active treats
  // the click as "I want the path to stop before here."
  function truncateBefore(localId, Q, R){
    const p = getPath(localId);
    if (!p || !p.cells.length) return false;
    const idx = p.cells.findIndex(c => c.Q === Q && c.R === R);
    if (idx < 0) return false;
    p.cells.splice(idx);
    p.authoredAt = Date.now();
    save();
    return true;
  }

  // Find every path that includes (Q, R).
  function pathsAtCell(Q, R){
    const out = [];
    for (const p of listPaths()){
      for (const c of p.cells){
        if (c.Q === Q && c.R === R){ out.push(p); break; }
      }
    }
    return out;
  }

  // ── Boundary queries (for the parent-layer planner) ───────────────────
  // The parent-layer movement planner uses these to ask: "if I cross
  // from parent A to parent B, what does the subhex authoring say?"
  // The subhex layer is canonical when present — if the GM has
  // authored even one path in either parent, the planner trusts the
  // subhex picture entirely for that parent boundary.

  // Quick check: does this parent have ANY subhex paths whose cells
  // are owned by it? Used by the planner to decide whether to consult
  // subhex data or fall back to the 30mi-resolution parent layer.
  function parentHasSubhexPaths(col, row){
    if (!window.GCCSubhexData) return false;
    for (const p of listPaths()){
      for (const c of p.cells || []){
        const o = window.GCCSubhexData.ownerOf(c.Q, c.R);
        if (o && o.col === col && o.row === row) return true;
      }
    }
    return false;
  }

  // Inspect the boundary between two parents and report what subhex
  // authoring says about it. Returns:
  //   { hasData: bool      — at least one of the two parents has any
  //                          subhex paths (so we should trust subhex),
  //     boundaryCell: {Q,R} — the boundary cell (subhex closest to the
  //                          shared parent edge midpoint),
  //     hasRoad: bool      — a road or track passes through that cell,
  //     hasRiver: bool     — a river or stream passes through that cell }
  // If hasData is false, the planner should fall back to parent data.
  // Per Rule 1: a road on the boundary cell makes the edge traversable.
  // A river without a road would normally block, but at this layer we
  // just report what's there — the caller decides.
  function subhexBoundaryInfo(parentColA, parentRowA, parentColB, parentRowB){
    if (!window.GCCSubhexData){
      return { hasData: false, boundaryCell: null, hasRoad: false, hasRiver: false };
    }
    const aHas = parentHasSubhexPaths(parentColA, parentRowA);
    const bHas = parentHasSubhexPaths(parentColB, parentRowB);
    if (!aHas && !bHas){
      return { hasData: false, boundaryCell: null, hasRoad: false, hasRiver: false };
    }
    // A road crosses the parent edge if any pair of axially-adjacent
    // cells (one owned by A, one owned by B) are both on the same
    // road or track path. We scan parent A's boundary cells, look at
    // each cell's neighbors, and check whether any neighbor owned by
    // parent B shares a path with it. Same for rivers.
    const NEIGHBORS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    const ownedA = window.GCCSubhexData.ownedByParent(parentColA, parentRowA);
    let hasRoad = false, hasRiver = false;
    let representativeCell = null;
    let roadCell = null;
    for (const c of ownedA){
      // For each neighbor of c that's owned by parent B, this cell c
      // is on the parent edge. Check if c and the neighbor share any
      // path, and bucket the result.
      for (const [dq, dr] of NEIGHBORS){
        const nQ = c.Q + dq, nR = c.R + dr;
        const nOwner = window.GCCSubhexData.ownerOf(nQ, nR);
        if (!nOwner || nOwner.col !== parentColB || nOwner.row !== parentRowB) continue;
        // c is in A and (nQ, nR) is in B. Check shared paths.
        const atC = pathsAtCell(c.Q, c.R);
        const atN = pathsAtCell(nQ, nR);
        if (!atC.length) continue;
        for (const p of atC){
          if (!atN.some(p2 => p2.id === p.id)) continue;
          // p crosses the parent boundary at this cell pair.
          if (p.kind === 'road' || p.kind === 'track'){
            hasRoad = true;
            roadCell = c;
          } else if (p.kind === 'river' || p.kind === 'stream'){
            hasRiver = true;
          }
        }
        // Track at least one boundary cell for the return value.
        if (!representativeCell) representativeCell = c;
      }
    }
    // Prefer the road cell as the "boundary cell" returned, since
    // that's the one callers want to highlight or query about. Fall
    // back to any boundary cell, then to the closest-to-midpoint
    // computation for the no-data case.
    const cell = roadCell || representativeCell
      || boundaryCellBetweenParents(parentColA, parentRowA, parentColB, parentRowB);
    return { hasData: true, boundaryCell: cell, hasRoad, hasRiver };
  }

  // Pick the subhex cell on parent A whose center is geometrically
  // closest to the midpoint of the shared parent edge. Mirrors the
  // marker-anchoring logic in gcc-subhex-view.js. The parent edge
  // direction is implied by the (A, B) pair — we don't need to know
  // the edge index up front; we just find the boundary cell of A
  // closest to B's center.
  function boundaryCellBetweenParents(colA, rowA, colB, rowB){
    if (!window.GCCSubhexData) return null;
    const aCenter = window.GCCSubhexData.parentCenterAxial(colA, rowA);
    const bCenter = window.GCCSubhexData.parentCenterAxial(colB, rowB);
    // Direction from A to B in axial space.
    const dQ = bCenter.Q - aCenter.Q;
    const dR = bCenter.R - aCenter.R;
    // The boundary cell of A is roughly half a parent away in that
    // direction. Parents are 10 subhex units apart center-to-center,
    // so the boundary midpoint is +5 in (dQ, dR) direction.
    const len = Math.sqrt(dQ * dQ + dR * dR + dQ * dR);
    if (len === 0) return null;
    const targetQ = aCenter.Q + 5 * dQ / len;
    const targetR = aCenter.R + 5 * dR / len;
    // Find the owned cell of parent A closest to that target.
    const owned = window.GCCSubhexData.ownedByParent(colA, rowA);
    if (!owned.length) return null;
    let best = null, bestD = Infinity;
    for (const c of owned){
      const dq = c.Q - targetQ, dr = c.R - targetR;
      // Hex distance via cube coords: max(|q|,|r|,|s|).
      const s = -dq - dr;
      const d = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(s));
      if (d < bestD){ bestD = d; best = c; }
    }
    return best;
  }

  function exportPaths(){ return JSON.parse(JSON.stringify(PATHS)); }
  function importPaths(obj){
    if (!obj || typeof obj !== 'object') return false;
    PATHS = JSON.parse(JSON.stringify(obj));
    save();
    return true;
  }

  // ── Migration v0.9 → v1.0 ──────────────────────────────────────────────
  {
    let migratedFlag = false;
    try { migratedFlag = !!localStorage.getItem(MIGRATION_FLAG_KEY); } catch(e){}
    if (!migratedFlag){
      let mp = 0, mc = 0, dropped = 0;
      const next = {};
      for (const oldId of Object.keys(PATHS)){
        const oldDoc = PATHS[oldId];
        const m = /^(.+)__(.+)$/.exec(oldId);
        if (!m){ dropped++; continue; }
        const parentId = m[1];
        const oldLocalId = oldDoc?.id || m[2];
        const parent = (typeof window.darleneToInternal === 'function')
          ? window.darleneToInternal(parentId)
          : null;
        if (!parent || !window.GCCSubhexData){ dropped++; continue; }
        const center = window.GCCSubhexData.parentCenterAxial(parent.col, parent.row);

        const newCells = [];
        for (const c of (oldDoc.cells || [])){
          if (typeof c.q !== 'number' || typeof c.r !== 'number') continue;
          newCells.push({ Q: center.Q + (c.q - 5), R: center.R + (c.r - 5) });
          mc++;
        }

        let newLocalId = oldLocalId;
        let n = 2;
        while (next[pathDocId(newLocalId)]) newLocalId = `${oldLocalId}-${n++}`;

        next[pathDocId(newLocalId)] = {
          id: newLocalId,
          kind: oldDoc.kind || 'road',
          name: oldDoc.name || newLocalId,
          notes: oldDoc.notes || '',
          cells: newCells,
          schemaVersion: SCHEMA_VERSION,
          authoredAt: oldDoc.authoredAt || Date.now(),
        };
        mp++;
      }
      PATHS = next;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(PATHS));
        localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      } catch(e){}
      if (mp || dropped){
        console.log(`[GCCSubhexPaths] v0.9→v1.0: ${mp} path(s), ${mc} cell(s) migrated; ${dropped} dropped.`);
      }
    }
  }

  window.GCCSubhexPaths = {
    PATH_KINDS, SCHEMA_VERSION,
    listPaths, pathsInParent, getPath, createPath, renamePath, deletePath,
    appendCell, popCell, truncateBefore, pathsAtCell, isNeighbor,
    parentHasSubhexPaths, subhexBoundaryInfo, boundaryCellBetweenParents,
    exportPaths, importPaths,
  };
})();
