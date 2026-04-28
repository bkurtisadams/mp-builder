// gcc-subhex-paths.js v0.9.0 — 2026-04-28
// Subhex-resolution path data layer. A path is an ordered chain of
// cells in a single parent hex, all neighbors in sequence. Each path
// has a kind (river / road / trail) and a name. Bridges and fords are
// deferred to v1.0 since they sit ON other paths and need different
// modeling.
//
// ── Schema ──────────────────────────────────────────────────────────────
// {
//   id: 'old-keep-road',         // local id, slug-derived
//   parentId: 'F4-95',
//   kind: 'road',                // river | road | trail
//   name: 'Old Keep Road',
//   notes: '',
//   cells: [{q,r}, {q,r}, ...],  // ordered, each adjacent to previous
//   schemaVersion: 1,
//   authoredAt: ts,
// }
//
// Storage key 'gcc-subhex-paths' as
//   { [`${parentId}__${pathLocalId}`]: pathDoc }
//
// ── Cell membership ─────────────────────────────────────────────────────
// A cell can belong to multiple paths (a road and a river crossing the
// same cell — that's where bridges/fords come from in v1.0). Membership
// is computed by scanning paths, not stored on the cell.

(function(){
  'use strict';

  const PATH_KINDS = ['river', 'road', 'trail'];
  const PATH_KINDS_SET = new Set(PATH_KINDS);
  const SCHEMA_VERSION = 1;
  const LS_KEY = 'gcc-subhex-paths';

  let PATHS = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) PATHS = JSON.parse(raw) || {};
  } catch(e){ PATHS = {}; }

  function save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(PATHS)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent('gcc-subhex-changed')); } catch(e){}
  }

  function pathDocId(parentId, localId){ return `${parentId}__${localId}`; }
  function slugify(s){
    return String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'path';
  }
  function genLocalId(parentId, name){
    const base = slugify(name);
    let id = base, n = 2;
    while (PATHS[pathDocId(parentId, id)]) id = `${base}-${n++}`;
    return id;
  }

  // Flat-top axial neighbor table. Six valid (dq, dr) deltas; everything
  // else is not a neighbor.
  const NEIGHBOR_DELTAS = [
    [+1,  0], [ 0, +1], [-1, +1],
    [-1,  0], [ 0, -1], [+1, -1],
  ];
  function isNeighbor(a, b){
    if (!a || !b) return false;
    const dq = b.q - a.q, dr = b.r - a.r;
    for (const [ddq, ddr] of NEIGHBOR_DELTAS){
      if (dq === ddq && dr === ddr) return true;
    }
    return false;
  }

  function listPaths(parentId){
    const out = [];
    const prefix = `${parentId}__`;
    for (const docId of Object.keys(PATHS)){
      if (docId.startsWith(prefix)) out.push(PATHS[docId]);
    }
    out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return out;
  }

  function getPath(parentId, localId){
    if (!localId) return null;
    return PATHS[pathDocId(parentId, localId)] || null;
  }

  function createPath(parentId, kind, name){
    if (!parentId || !PATH_KINDS_SET.has(kind) || !name) return null;
    const localId = genLocalId(parentId, name);
    const doc = {
      id: localId,
      parentId,
      kind,
      name: String(name).trim(),
      notes: '',
      cells: [],
      schemaVersion: SCHEMA_VERSION,
      authoredAt: Date.now(),
    };
    PATHS[pathDocId(parentId, localId)] = doc;
    save();
    return doc;
  }

  function renamePath(parentId, localId, newName){
    const p = getPath(parentId, localId);
    if (!p || !newName) return false;
    p.name = String(newName).trim() || p.name;
    p.authoredAt = Date.now();
    save();
    return true;
  }

  function deletePath(parentId, localId){
    const docId = pathDocId(parentId, localId);
    if (!PATHS[docId]) return false;
    delete PATHS[docId];
    save();
    return true;
  }

  // Append a cell to the end of a path. Validates: cell must be a
  // neighbor of the current last cell (or the path must be empty).
  // Returns true on success, false on validation failure.
  function appendCell(parentId, localId, q, r){
    const p = getPath(parentId, localId);
    if (!p) return false;
    const last = p.cells.length ? p.cells[p.cells.length - 1] : null;
    if (last){
      if (last.q === q && last.r === r) return false;        // duplicate of last
      if (!isNeighbor(last, { q, r })) return false;          // not a neighbor
    }
    p.cells.push({ q, r });
    p.authoredAt = Date.now();
    save();
    return true;
  }

  // Drop the last cell of a path (undo last extend). Returns true if
  // a cell was removed.
  function popCell(parentId, localId){
    const p = getPath(parentId, localId);
    if (!p || !p.cells.length) return false;
    p.cells.pop();
    p.authoredAt = Date.now();
    save();
    return true;
  }

  // Find every path in the parent that includes the given cell.
  function pathsAtCell(parentId, q, r){
    const out = [];
    for (const p of listPaths(parentId)){
      for (const c of p.cells){
        if (c.q === q && c.r === r){ out.push(p); break; }
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

  window.GCCSubhexPaths = {
    PATH_KINDS, SCHEMA_VERSION,
    listPaths, getPath, createPath, renamePath, deletePath,
    appendCell, popCell, pathsAtCell, isNeighbor,
    exportPaths, importPaths,
  };
})();
