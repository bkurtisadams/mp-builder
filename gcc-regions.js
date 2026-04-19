// gcc-regions.js v0.1.0 — 2026-04-18
// World of Greyhawk region boundaries, current-grid coordinate frame.
//
// Supports two formats per region, first-match-wins:
//   { name, rect: [cMin, cMax, rMin, rMax] }   // AABB in (col,row)
//   { name, vertices: [...] }                  // closed polygon
//
// Polygon vertices may be Darlene IDs ("P4-85") OR [col,row] pairs.
// Point-in-polygon uses canonical unit-space hex centers — scale- and
// calibration-independent.
//
// ⚠ HISTORICAL NOTE
// The previous inline REGIONS[] in greyhawk-map.html used a stale
// coordinate frame that predates the Darlene-ID calibration. E.g., it
// placed City of Greyhawk at cols[81,88] rows[41,51] while the verified
// landmark C4-86 (City of Greyhawk) resolves to (col=65, row=45). The
// old rectangles have been discarded, not "ported," because a faithful
// port would preserve misclassification. Regions below are re-seeded
// from verified landmark anchors in gcc-landmarks.js; remaining regions
// fall through to "Unknown Reaches" until properly drawn via the
// upcoming region editor.
//
// When the editor lands, it should call GCCRegions.setVertices(name, [...])
// with Darlene-ID or [col,row] vertex lists, and persist to localStorage
// under the same BASE/OVERRIDES layered model as gcc-landmarks.js.

(function(){
  const SQRT3 = Math.sqrt(3);

  // Canonical hex center in unit-space. Flat-top, odd-col offset down.
  // Matches greyhawk-map.html hexCenter() with hexSize=1 and zero offsets.
  function hexCenterU(col, row){
    return { x: col * 1.5, y: row * SQRT3 + (col % 2 === 1 ? SQRT3 / 2 : 0) };
  }

  function resolveVertex(v){
    if (Array.isArray(v)) return { col: v[0], row: v[1] };
    if (typeof v === 'string'){
      if (typeof darleneToInternal !== 'function') return null;
      return darleneToInternal(v);
    }
    return null;
  }

  // Ray-cast point-in-polygon.
  function pointInPoly(x, y, pts){
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)){
        inside = !inside;
      }
    }
    return inside;
  }

  function inRect(col, row, rect){
    return col >= rect[0] && col < rect[1] && row >= rect[2] && row < rect[3];
  }

  // ── REGION DATA ────────────────────────────────────────────────────────────
  // Seeded from verified landmark anchors. Bounding rectangles are deliberately
  // loose — they classify the anchor hex and immediate neighbors correctly but
  // are NOT accurate borders. Replace with real polygons as data becomes
  // available (region editor, LGG transcription).
  //
  // Order matters: inner/more-specific regions listed before their container
  // (e.g., City of Greyhawk before Domain of Greyhawk).
  //
  // `kind` is advisory for the Phase 2 terrain sampler.
  // `anchors` are verified landmark Darlene IDs used by the QA harness.
  const GH_REGIONS = [
    // Inner/specific regions first
    { name:'City of Greyhawk',        kind:'land',  rect:[64, 67, 44, 47],
      anchors:['C4-86'] },
    { name:'Domain of Greyhawk',      kind:'land',  rect:[63, 68, 43, 52],
      anchors:['C4-91'] },
    { name:'Viscounty of Verbobonc',  kind:'land',  rect:[50, 58, 45, 52],
      anchors:['O4-95'] },

    // Mid-scale states anchored on 1–2 cities
    { name:'County of Urnst',         kind:'land',  rect:[72, 84, 34, 42],
      anchors:['Q3-74'] },
    { name:'Duchy of Urnst',          kind:'land',  rect:[72, 84, 42, 50],
      anchors:['R3-81'] },
    { name:'Horned Society',          kind:'land',  rect:[58, 70, 28, 38],
      anchors:['E4-74'] },

    // Larger kingdoms/empires with multi-landmark anchors
    { name:'Kingdom of Furyondy',     kind:'land',  rect:[48, 66, 32, 45],
      anchors:['P4-85','E4-83'] },
    { name:'Wild Coast',              kind:'land',  rect:[57, 64, 44, 54],
      anchors:['G4-89','F4-95','H4-95'] },
    { name:'Empire of Iuz',           kind:'land',  rect:[48, 72, 16, 32],
      anchors:['H4-70'] },
    { name:'Kingdom of Keoland',      kind:'land',  rect:[40, 56, 58, 74],
      anchors:['P4-117','X4-113'] },
    { name:'The Great Kingdom',       kind:'land',  rect:[110, 135, 48, 68],
      anchors:['A2-69','R-72'] },
  ];

  // Per-region polygon point cache. Keyed by region index.
  // Populated lazily on first lookup so darleneToInternal is defined.
  const POLY_CACHE = new Map();

  function polyPointsFor(idx){
    if (POLY_CACHE.has(idx)) return POLY_CACHE.get(idx);
    const reg = GH_REGIONS[idx];
    if (!reg || !reg.vertices){ POLY_CACHE.set(idx, null); return null; }
    const pts = [];
    for (const v of reg.vertices){
      const hit = resolveVertex(v);
      if (!hit){ POLY_CACHE.set(idx, null); return null; }
      pts.push(hexCenterU(hit.col, hit.row));
    }
    const out = pts.length >= 3 ? pts : null;
    POLY_CACHE.set(idx, out);
    return out;
  }

  function hitRegion(col, row, idx){
    const r = GH_REGIONS[idx];
    if (r.vertices){
      const pts = polyPointsFor(idx);
      if (!pts) return false;
      const u = hexCenterU(col, row);
      return pointInPoly(u.x, u.y, pts);
    }
    if (r.rect) return inRect(col, row, r.rect);
    return false;
  }

  function getRegion(col, row){
    for (let i = 0; i < GH_REGIONS.length; i++){
      if (hitRegion(col, row, i)) return GH_REGIONS[i].name;
    }
    return 'Unknown Reaches';
  }

  // Return {name, kind} — useful for terrain defaults in Phase 2.
  function getRegionInfo(col, row){
    for (let i = 0; i < GH_REGIONS.length; i++){
      if (hitRegion(col, row, i)){
        const r = GH_REGIONS[i];
        return { name:r.name, kind:r.kind || 'land' };
      }
    }
    return { name:'Unknown Reaches', kind:'land' };
  }

  function all(){ return GH_REGIONS.slice(); }

  // Replace a region's polygon at runtime (region editor, future).
  function setVertices(name, vertices){
    const idx = GH_REGIONS.findIndex(r => r.name === name);
    if (idx < 0) return false;
    GH_REGIONS[idx].vertices = vertices;
    delete GH_REGIONS[idx].rect;
    POLY_CACHE.delete(idx);
    return true;
  }

  function rebuild(){ POLY_CACHE.clear(); }

  // QA: verify each region's declared anchor landmarks classify into it.
  // Call GCCRegions.qa() from the console.
  function qa(){
    if (typeof darleneToInternal !== 'function'){
      console.warn('GCCRegions.qa: darleneToInternal not available yet');
      return null;
    }
    console.log('── GCCRegions QA ──');
    let pass = 0, fail = 0;
    for (const r of GH_REGIONS){
      if (!r.anchors) continue;
      for (const id of r.anchors){
        const hit = darleneToInternal(id);
        if (!hit){ fail++; console.log(`✗ ${r.name}: bad anchor ${id}`); continue; }
        const got = getRegion(hit.col, hit.row);
        if (got === r.name){ pass++; }
        else { fail++; console.log(`✗ ${r.name}: anchor ${id} (${hit.col},${hit.row}) → ${got}`); }
      }
    }
    console.log(`${pass}/${pass+fail} anchor landmarks classified into their declared region`);
    return { pass, fail };
  }

  window.GCCRegions = {
    data: GH_REGIONS,
    getRegion,
    getRegionInfo,
    all,
    setVertices,
    rebuild,
    qa,
  };
})();
