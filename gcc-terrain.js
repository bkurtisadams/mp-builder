// gcc-terrain.js v0.1.0 — 2026-04-19
// Per-hex terrain overrides keyed by "col-row" (internal grid coords).
// Layered store: BASE file data + OVERRIDES (localStorage).
//
// Used by the Hex Editor Paint tab (gcc-hex-edit.js) and consulted by
// getHexTerrain() in greyhawk-map.html. BASE_TERRAIN is empty in-repo;
// populate it by painting in the editor, Export → paste into this file,
// then Reset All to clear the overrides that have been baked in.

(function(){
  const LS_KEY = 'gcc-terrain-overrides-v1';

  // ── BASE: curated terrain baked into the file via Export. ─────────────────
  const BASE_TERRAIN = {
    // (empty — populate via Paint tab → Export → paste here)
  };

  let OVERRIDES = {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) OVERRIDES = JSON.parse(raw) || {};
  } catch(e){ OVERRIDES = {}; }

  function save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch(e){}
  }

  function key(col, row){ return `${col}-${row}`; }

  function get(col, row){
    const k = key(col, row);
    if (k in OVERRIDES) return OVERRIDES[k];
    if (k in BASE_TERRAIN) return BASE_TERRAIN[k];
    return null;
  }

  function set(col, row, terrain){
    if (!terrain) return false;
    OVERRIDES[key(col, row)] = terrain;
    save();
    return true;
  }

  function clear(col, row){
    const k = key(col, row);
    let changed = false;
    if (k in OVERRIDES){ delete OVERRIDES[k]; changed = true; }
    // A clear on a BASE hex requires storing an explicit sentinel so the
    // override layer can shadow it. For now, BASE clears need an Export →
    // paste round-trip. Document this if it becomes a pain point.
    if (changed) save();
    return changed;
  }

  function clearAll(){ OVERRIDES = {}; save(); }

  function count(){
    const merged = new Set([...Object.keys(BASE_TERRAIN), ...Object.keys(OVERRIDES)]);
    return merged.size;
  }

  function countByTerrain(){
    const merged = { ...BASE_TERRAIN, ...OVERRIDES };
    const counts = {};
    for (const t of Object.values(merged)){
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }

  function exportOverrides(){ return JSON.parse(JSON.stringify(OVERRIDES)); }

  function exportMergedSource(){
    const merged = { ...BASE_TERRAIN, ...OVERRIDES };
    const entries = Object.entries(merged).sort((a, b) => {
      const [ac, ar] = a[0].split('-').map(Number);
      const [bc, br] = b[0].split('-').map(Number);
      if (ac !== bc) return ac - bc;
      return ar - br;
    });
    const lines = ['  const BASE_TERRAIN = {'];
    for (const [k, t] of entries){
      lines.push(`    ${JSON.stringify(k).padEnd(10)}: ${JSON.stringify(t)},`);
    }
    lines.push('  };');
    return lines.join('\n');
  }

  function allOverridden(){
    const merged = { ...BASE_TERRAIN, ...OVERRIDES };
    return Object.entries(merged).map(([k, t]) => {
      const [col, row] = k.split('-').map(Number);
      return { col, row, terrain: t };
    });
  }

  window.GCCTerrain = {
    get, set, clear, clearAll,
    count, countByTerrain,
    exportOverrides, exportMergedSource, allOverridden,
    data: BASE_TERRAIN,
  };
})();
