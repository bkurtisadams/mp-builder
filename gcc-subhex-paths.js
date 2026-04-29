// gcc-subhex-paths.js v1.1.0 — 2026-04-28
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
    exportPaths, importPaths,
  };
})();
