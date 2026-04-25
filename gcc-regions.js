// gcc-regions.js v0.3.0 — 2026-04-25
// World of Greyhawk region boundaries, current-grid coordinate frame.
//
// Two formats per region, lookup precedence hex-tags (across all
// regions) → polygon vertices:
//   { name, hexes: ["P4-85", ...] }   // explicit hex membership (primary)
//   { name, vertices: [...] }         // closed polygon (secondary)
//
// Hex-set entries and polygon vertices may be Darlene IDs ("P4-85") OR
// [col,row] pairs. Point-in-polygon uses canonical unit-space hex centers.
//
// v0.3.0: rectangle regions removed. BASE entries now only carry
//   name/kind/color/anchors — geometry comes from painted hex sets.
//   Rects were a pre-hex-set placeholder and produced misclassification
//   on a hex grid (a bbox in (col,row) doesn't trace a country's border).
//   Bootstrap-from-landmarks + paint is the authoritative workflow now.
//   Empty BASE regions sit in the picker waiting to be painted; QA
//   is meaningful once Bootstrap has run. setRegionMeta no longer
//   accepts suppressRect.
//
// v0.2.0: hex-set membership format and editor API.
//   - GH_REGIONS entries can carry `hexes` (preferred) or `vertices`.
//   - localStorage overrides: new regions, hex membership edits, color
//     and kind updates. Layered like gcc-terrain / gcc-landmarks.
//   - addRegion / removeRegion / addHexes / removeHexes / setHexes /
//     erasePaintAt / clearHexes / fillFromPolygon /
//     bootstrapFromLandmarks / exportOverrides / clearOverrides /
//     exportMergedSource.
//   - getMembership() returns { name, source } where source is
//     'hexes' | 'vertices' — lets the editor distinguish
//     painted hexes from polygon fallback.
//   - Each region carries a `color` for editor overlay rendering;
//     defaulted by hash of name when not provided.
//
// v0.1.0: polygon + rect dual support, point-in-polygon over unit-space
//   hex centers, lazy polygon resolution, QA harness.

(function(){
  const SQRT3 = Math.sqrt(3);
  const LS_KEY_DEFS  = 'gcc-region-defs-v1';   // {name: {kind, color}}
  const LS_KEY_HEXES = 'gcc-region-hexes-v1';  // {name: ["col-row", ...]}

  function hexCenterU(col, row){
    return { x: col * 1.5, y: row * SQRT3 + (col % 2 === 1 ? SQRT3 / 2 : 0) };
  }

  function resolveVertex(v){
    if (Array.isArray(v)) return { col: v[0], row: v[1] };
    if (typeof v === 'string'){
      // Internal "col-row" form first — works without darleneToInternal.
      const m = /^(\d+)-(\d+)$/.exec(v);
      if (m) return { col: +m[1], row: +m[2] };
      if (typeof darleneToInternal !== 'function') return null;
      return darleneToInternal(v);
    }
    return null;
  }

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

  function hashHue(name){
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  }
  function defaultColor(name){
    return `hsl(${hashHue(name)}, 55%, 50%)`;
  }

  function colorToRgbTriplet(c){
    if (!c) return '0, 0, 0';
    if (c.startsWith('#')){
      const v = c.slice(1);
      const exp = v.length === 3
        ? v.split('').map(ch => parseInt(ch + ch, 16))
        : [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
      return exp.join(', ');
    }
    if (c.startsWith('hsl')){
      const m = /hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/.exec(c);
      if (!m) return '0, 0, 0';
      const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
      const a = s * Math.min(l, 1 - l);
      const f = n => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      return [f(0), f(8), f(4)].map(v => Math.round(v * 255)).join(', ');
    }
    return '0, 0, 0';
  }

  // ── REGION DATA ────────────────────────────────────────────────────────────
  // BASE: file-baked region definitions. Just curated metadata —
  // name, kind, color, capital, and anchor landmarks for QA.
  // Geometry comes from painted hex sets (Bootstrap / Outline editor).
  //
  // Coverage: Flanaess polities at 1983 canonical baseline. Matches
  // Darlene-map era naming. Post-Wars (569 CY) state for things like
  // Iuz absorbing the Horned Society, Shield Lands occupation, etc.
  // is deferred — when it lands it will layer on top via overrides.
  //
  // Naming convention: formal title where the polity has one in its
  // LGG entry heading (Kingdom of Keoland, Archbarony of Ratik, See
  // of Medegia, etc.); bare name otherwise (Wild Coast, Bandit
  // Kingdoms, Sea Princes — territories without a formal title).
  //
  // Capital field is bibliographic (which city is the seat of
  // government); editor consumers can use it as a reminder when
  // tagging a city landmark with `region:` so the capital actually
  // sits inside its own region's painted hexes.
  //
  // Order is no longer load-bearing — the two-pass lookup (hex-tags
  // first across all regions, then polygon vertices) means inner /
  // outer overlap resolves by which region painted the hex, not by
  // file position. Listed roughly clockwise from Greyhawk City for
  // ease of human scanning.
  const GH_REGIONS = [
    // ── Central Flanaess ────────────────────────────────────────────────
    { name:'City of Greyhawk',          kind:'land', color:'#cc4444', capital:'Greyhawk',         anchors:['C4-86'] },
    { name:'Domain of Greyhawk',        kind:'land', color:'#dd7755', capital:'Greyhawk',         anchors:['C4-91'] },
    { name:'Hardby',                    kind:'land', color:'#cc6655', capital:'Hardby'                              },
    { name:'Wild Coast',                kind:'land', color:'#88aa44', capital:'Safeton',          anchors:['G4-89','F4-95','H4-95'] },
    { name:'County of Urnst',           kind:'land', color:'#bbaa44', capital:'Radigast City',    anchors:['Q3-74'] },
    { name:'Duchy of Urnst',            kind:'land', color:'#998822', capital:'Leukish',          anchors:['R3-81'] },
    // ── Sheldomar Valley (south-west) ───────────────────────────────────
    { name:'Kingdom of Keoland',        kind:'land', color:'#cc8822', capital:'Niole Dra',        anchors:['P4-117','X4-113'] },
    { name:'County of Ulek',            kind:'land', color:'#cc9966', capital:'Jurnre'                              },
    { name:'Duchy of Ulek',             kind:'land', color:'#aa7744', capital:'Tringlee'                             },
    { name:'Principality of Ulek',      kind:'land', color:'#bb6633', capital:'Gryrax'                              },
    { name:'Yeomanry',                  kind:'land', color:'#ddaa55', capital:'Loftwick'                            },
    { name:'Gran March',                kind:'land', color:'#cc9944', capital:'Hookhill'                            },
    { name:'Bissel',                    kind:'land', color:'#ccaa66', capital:'Thornward'                           },
    { name:'Geoff',                     kind:'land', color:'#aa8855', capital:'Gorna'                               },
    { name:'Sterich',                   kind:'land', color:'#998866', capital:'Istivin'                             },
    // ── Veluna / Furyondy / Iuz frontier (north-west) ───────────────────
    { name:'Archclericy of Veluna',     kind:'land', color:'#dddd99', capital:'Mitrik'                              },
    { name:'Viscounty of Verbobonc',    kind:'land', color:'#aa6644', capital:'Verbobonc',        anchors:['O4-95'] },
    { name:'Kingdom of Furyondy',       kind:'land', color:'#4488cc', capital:'Chendl',           anchors:['P4-85','E4-83'] },
    { name:'Shield Lands',              kind:'land', color:'#5577aa', capital:'Critwall'                            },
    { name:'Highfolk',                  kind:'land', color:'#66aabb', capital:'Highfolk Town'                       },
    { name:'Horned Society',            kind:'land', color:'#552255', capital:'Molag',            anchors:['E4-74'] },
    { name:'Empire of Iuz',             kind:'land', color:'#660000', capital:'Dorakaa',          anchors:['H4-70'] },
    { name:'Bandit Kingdoms',           kind:'land', color:'#774422', capital:'Rookroost'                           },
    // ── Far north and north-east ────────────────────────────────────────
    { name:'Wolf Nomads',               kind:'land', color:'#999966', capital:'Eru-Tovar'                           },
    { name:'Tiger Nomads',              kind:'land', color:'#aaaa55', capital:'Yecha'                               },
    { name:'Rovers of the Barrens',     kind:'land', color:'#886633', capital:null                                  }, // nomadic, no fixed capital
    { name:'Hold of Stonefist',         kind:'land', color:'#7788aa', capital:'Vlekstaad'                           },
    { name:'Theocracy of the Pale',     kind:'land', color:'#ddddee', capital:'Wintershiven'                        },
    { name:'Tenh',                      kind:'land', color:'#aa9988', capital:'Nevond Nevnend'                      },
    { name:'Frost Barbarians',          kind:'land', color:'#bbccdd', capital:'Krakenheim'                          },
    { name:'Snow Barbarians',           kind:'land', color:'#ccddee', capital:'Soull'                               },
    { name:'Ice Barbarians',            kind:'land', color:'#aaccdd', capital:'Glot'                                },
    { name:'Bone March',                kind:'land', color:'#ccccaa', capital:'Spinecastle'                         },
    { name:'Archbarony of Ratik',       kind:'land', color:'#bbaa77', capital:'Marner'                              },
    // ── Central / east (Nyrond and around) ──────────────────────────────
    { name:'Kingdom of Nyrond',         kind:'land', color:'#88bb55', capital:'Rel Mord'                            },
    // ── Great Kingdom and successors ────────────────────────────────────
    { name:'Great Kingdom',             kind:'land', color:'#884444', capital:'Rauxes',           anchors:['A2-69','R-72'] },
    { name:'North Province',            kind:'land', color:'#993333', capital:'Eastfair'                            },
    { name:'South Province',            kind:'land', color:'#aa3333', capital:'Zelradton'                           },
    { name:'See of Medegia',            kind:'land', color:'#aa4455', capital:'Mentrey'                             },
    { name:'County of Sunndi',          kind:'land', color:'#669966', capital:'Pitchfield'                          },
    { name:'Idee',                      kind:'land', color:'#aabb66', capital:'Naerie'                              },
    { name:'Onnwal',                    kind:'land', color:'#88aa66', capital:'Scant'                               },
    { name:'Irongate',                  kind:'land', color:'#776655', capital:'Irongate'                            },
    { name:'County of Almor',           kind:'land', color:'#ccbb88', capital:'Chathold'                            },
    { name:'Lordship of the Isles',     kind:'land', color:'#558899', capital:'Sulward'                             },
    // ── South coast ─────────────────────────────────────────────────────
    { name:'Sea Princes',               kind:'land', color:'#aa6688', capital:'Hokar'                               },
    // ── City-states ────────────────────────────────────────────────────
    { name:'City of Dyvers',            kind:'land', color:'#cc7755', capital:'Dyvers'                              },
  ];
  const BASE_REGION_NAMES = new Set(GH_REGIONS.map(r => r.name));

  const POLY_CACHE = new Map();
  const HEX_CACHE  = new Map();

  // ── Overrides (localStorage) ─────────────────────────────────────────────
  let OVERRIDE_DEFS  = {};
  let OVERRIDE_HEXES = {};
  try {
    const a = localStorage.getItem(LS_KEY_DEFS);
    if (a) OVERRIDE_DEFS = JSON.parse(a) || {};
    const b = localStorage.getItem(LS_KEY_HEXES);
    if (b) OVERRIDE_HEXES = JSON.parse(b) || {};
  } catch(e){ OVERRIDE_DEFS = {}; OVERRIDE_HEXES = {}; }

  function saveDefs(){
    try { localStorage.setItem(LS_KEY_DEFS, JSON.stringify(OVERRIDE_DEFS)); } catch(e){}
  }
  function saveHexes(){
    try { localStorage.setItem(LS_KEY_HEXES, JSON.stringify(OVERRIDE_HEXES)); } catch(e){}
  }

  // Apply OVERRIDE_DEFS — patch BASE color/kind, append new regions.
  function applyDefs(){
    for (const [name, def] of Object.entries(OVERRIDE_DEFS)){
      const idx = GH_REGIONS.findIndex(r => r.name === name);
      if (idx < 0){
        GH_REGIONS.push({
          name,
          kind:  def.kind  || 'land',
          color: def.color || defaultColor(name),
        });
      } else {
        if (def.kind)  GH_REGIONS[idx].kind  = def.kind;
        if (def.color) GH_REGIONS[idx].color = def.color;
      }
    }
    for (const r of GH_REGIONS){
      if (!r.color) r.color = defaultColor(r.name);
    }
  }
  applyDefs();

  function applyHexes(){
    HEX_CACHE.clear();
    for (const r of GH_REGIONS){
      if (OVERRIDE_HEXES[r.name]) r.hexes = OVERRIDE_HEXES[r.name].slice();
    }
  }
  applyHexes();

  function hexSetFor(idx){
    if (HEX_CACHE.has(idx)) return HEX_CACHE.get(idx);
    const r = GH_REGIONS[idx];
    if (!r || !r.hexes){ HEX_CACHE.set(idx, null); return null; }
    const set = new Set();
    for (const h of r.hexes){
      const v = resolveVertex(h);
      if (v) set.add(`${v.col}-${v.row}`);
    }
    HEX_CACHE.set(idx, set);
    return set;
  }

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

  // 'vertices' | false. Hex-set is checked separately in the first
  // pass of two-pass lookup so a painted hex anywhere wins over a
  // geometry hit on an earlier-listed region.
  function hitGeometry(col, row, idx){
    const r = GH_REGIONS[idx];
    if (r.vertices){
      const pts = polyPointsFor(idx);
      if (pts){
        const u = hexCenterU(col, row);
        if (pointInPoly(u.x, u.y, pts)) return 'vertices';
      }
    }
    return false;
  }

  function findHexTag(col, row){
    const key = `${col}-${row}`;
    for (let i = 0; i < GH_REGIONS.length; i++){
      const set = hexSetFor(i);
      if (set && set.has(key)) return i;
    }
    return -1;
  }

  function getRegion(col, row){
    const tagged = findHexTag(col, row);
    if (tagged >= 0) return GH_REGIONS[tagged].name;
    for (let i = 0; i < GH_REGIONS.length; i++){
      if (hitGeometry(col, row, i)) return GH_REGIONS[i].name;
    }
    return 'Unknown Reaches';
  }

  function getRegionInfo(col, row){
    const tagged = findHexTag(col, row);
    if (tagged >= 0){
      const r = GH_REGIONS[tagged];
      return { name: r.name, kind: r.kind || 'land' };
    }
    for (let i = 0; i < GH_REGIONS.length; i++){
      if (hitGeometry(col, row, i)){
        const r = GH_REGIONS[i];
        return { name: r.name, kind: r.kind || 'land' };
      }
    }
    return { name: 'Unknown Reaches', kind: 'land' };
  }

  function getMembership(col, row){
    const tagged = findHexTag(col, row);
    if (tagged >= 0){
      const r = GH_REGIONS[tagged];
      return { name: r.name, source: 'hexes', color: r.color };
    }
    for (let i = 0; i < GH_REGIONS.length; i++){
      const src = hitGeometry(col, row, i);
      if (src) return { name: GH_REGIONS[i].name, source: src, color: GH_REGIONS[i].color };
    }
    return null;
  }

  function getHexTagged(col, row){
    const key = `${col}-${row}`;
    for (let i = 0; i < GH_REGIONS.length; i++){
      const set = hexSetFor(i);
      if (set && set.has(key)){
        return { name: GH_REGIONS[i].name, color: GH_REGIONS[i].color };
      }
    }
    return null;
  }

  function all(){ return GH_REGIONS.slice(); }
  function getByName(name){ return GH_REGIONS.find(r => r.name === name) || null; }
  function names(){ return GH_REGIONS.map(r => r.name); }

  // ── Editor mutations ──────────────────────────────────────────────────────
  function addRegion({ name, kind, color }){
    if (!name || typeof name !== 'string') return false;
    if (GH_REGIONS.some(r => r.name === name)) return false;
    OVERRIDE_DEFS[name] = {
      kind:  kind  || 'land',
      color: color || defaultColor(name),
    };
    saveDefs();
    GH_REGIONS.push({ name, kind: OVERRIDE_DEFS[name].kind, color: OVERRIDE_DEFS[name].color });
    return true;
  }

  function removeRegion(name){
    const idx = GH_REGIONS.findIndex(r => r.name === name);
    if (idx < 0) return false;
    delete OVERRIDE_HEXES[name];
    saveHexes();
    if (!BASE_REGION_NAMES.has(name)){
      delete OVERRIDE_DEFS[name];
      saveDefs();
      GH_REGIONS.splice(idx, 1);
    } else {
      // BASE — strip override hexes; metadata remains.
      delete GH_REGIONS[idx].hexes;
    }
    POLY_CACHE.clear();
    HEX_CACHE.clear();
    return true;
  }

  function setRegionColor(name, color){
    const r = getByName(name);
    if (!r) return false;
    r.color = color;
    OVERRIDE_DEFS[name] = Object.assign({}, OVERRIDE_DEFS[name] || { kind: r.kind }, { color });
    saveDefs();
    return true;
  }

  // Unified metadata setter for the editor. color/kind only;
  // suppressRect was retired in v0.3.0 along with rectangle regions.
  function setRegionMeta(name, { color, kind } = {}){
    const r = getByName(name);
    if (!r) return false;
    if (color !== undefined) r.color = color;
    if (kind  !== undefined) r.kind  = kind;
    const cur = OVERRIDE_DEFS[name] || {};
    OVERRIDE_DEFS[name] = {
      kind:  kind  !== undefined ? kind  : (cur.kind  || r.kind || 'land'),
      color: color !== undefined ? color : (cur.color || r.color),
    };
    saveDefs();
    return true;
  }

  function isBase(name){ return BASE_REGION_NAMES.has(name); }

  // Accept "col-row", [col,row], or Darlene ID. Always store internal
  // "col-row" form so overrides round-trip without darleneToInternal.
  function normalizeHexId(h){
    if (Array.isArray(h)) return `${h[0]}-${h[1]}`;
    if (typeof h !== 'string') return null;
    if (/^\d+-\d+$/.test(h)) return h;
    if (typeof darleneToInternal === 'function'){
      const v = darleneToInternal(h);
      if (v) return `${v.col}-${v.row}`;
    }
    return null;
  }

  function setHexes(name, hexIds){
    if (!getByName(name)) return false;
    const ids = (hexIds || []).map(normalizeHexId).filter(Boolean);
    OVERRIDE_HEXES[name] = ids;
    saveHexes();
    applyHexes();
    return true;
  }

  function addHexes(name, hexIds){
    if (!getByName(name)) return false;
    const ids = (hexIds || []).map(normalizeHexId).filter(Boolean);
    if (!ids.length) return false;
    const newKeys = new Set(ids);
    // Painting into A removes from any other override set.
    for (const other in OVERRIDE_HEXES){
      if (other === name) continue;
      const filtered = OVERRIDE_HEXES[other].filter(k => !newKeys.has(k));
      if (filtered.length !== OVERRIDE_HEXES[other].length){
        OVERRIDE_HEXES[other] = filtered;
      }
    }
    const cur = new Set(OVERRIDE_HEXES[name] || []);
    let changed = false;
    for (const k of ids){ if (!cur.has(k)){ cur.add(k); changed = true; } }
    OVERRIDE_HEXES[name] = Array.from(cur);
    saveHexes();
    applyHexes();
    return changed;
  }

  function removeHexes(name, hexIds){
    if (!OVERRIDE_HEXES[name]) return false;
    const drop = new Set((hexIds || []).map(normalizeHexId).filter(Boolean));
    const before = OVERRIDE_HEXES[name].length;
    OVERRIDE_HEXES[name] = OVERRIDE_HEXES[name].filter(k => !drop.has(k));
    if (OVERRIDE_HEXES[name].length === before) return false;
    saveHexes();
    applyHexes();
    return true;
  }

  // Erase whichever override claims (col,row). Returns the cleared name.
  function erasePaintAt(col, row){
    const k = `${col}-${row}`;
    for (const name in OVERRIDE_HEXES){
      const arr = OVERRIDE_HEXES[name];
      const idx = arr.indexOf(k);
      if (idx >= 0){
        arr.splice(idx, 1);
        saveHexes();
        applyHexes();
        return name;
      }
    }
    return null;
  }

  function clearHexes(name){
    if (!OVERRIDE_HEXES[name]) return false;
    delete OVERRIDE_HEXES[name];
    saveHexes();
    applyHexes();
    return true;
  }

  // Seed from gcc-landmarks.js — for each landmark with a `region` tag,
  // add its hex to that region's painted set. Creates regions as needed.
  function bootstrapFromLandmarks(){
    if (typeof GCCLandmarks === 'undefined' || !GCCLandmarks.all) return null;
    const byRegion = new Map();
    for (const [hexId, lm] of GCCLandmarks.all()){
      if (!lm.region) continue;
      if (!byRegion.has(lm.region)) byRegion.set(lm.region, []);
      byRegion.get(lm.region).push(hexId);
    }
    let regionsAdded = 0, hexesAdded = 0;
    for (const [regName, ids] of byRegion){
      if (!getByName(regName)){
        addRegion({ name: regName, kind: 'land' });
        regionsAdded++;
      }
      const before = (OVERRIDE_HEXES[regName] || []).length;
      addHexes(regName, ids);
      const after = (OVERRIDE_HEXES[regName] || []).length;
      hexesAdded += (after - before);
    }
    return { regions: regionsAdded, hexes: hexesAdded, total: byRegion.size };
  }

  // Trace-and-fill. vertices in [col,row] or Darlene-ID.
  function fillFromPolygon(vertices, regionName, gridBounds){
    if (!getByName(regionName)) return 0;
    const pts = [];
    for (const v of vertices || []){
      const hit = resolveVertex(v);
      if (!hit) return 0;
      pts.push(hexCenterU(hit.col, hit.row));
    }
    if (pts.length < 3) return 0;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of pts){
      if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
    }
    const colMax = (gridBounds && gridBounds.colMax) || 146;
    const rowMax = (gridBounds && gridBounds.rowMax) || 96;
    const cMin = Math.max(0, Math.floor(xMin / 1.5) - 1);
    const cMax = Math.min(colMax - 1, Math.ceil(xMax / 1.5) + 1);
    const rMin = Math.max(0, Math.floor(yMin / SQRT3) - 1);
    const rMax = Math.min(rowMax - 1, Math.ceil(yMax / SQRT3) + 1);
    const claimed = [];
    for (let c = cMin; c <= cMax; c++){
      for (let r = rMin; r <= rMax; r++){
        const u = hexCenterU(c, r);
        if (pointInPoly(u.x, u.y, pts)) claimed.push(`${c}-${r}`);
      }
    }
    if (!claimed.length) return 0;
    addHexes(regionName, claimed);
    return claimed.length;
  }

  // ── Override I/O ──────────────────────────────────────────────────────────
  function exportOverrides(){
    return {
      defs:  JSON.parse(JSON.stringify(OVERRIDE_DEFS)),
      hexes: JSON.parse(JSON.stringify(OVERRIDE_HEXES)),
    };
  }

  function clearOverrides(){
    // Remove editor-added regions; clear all override hex sets.
    for (let i = GH_REGIONS.length - 1; i >= 0; i--){
      if (!BASE_REGION_NAMES.has(GH_REGIONS[i].name)){
        GH_REGIONS.splice(i, 1);
      } else {
        delete GH_REGIONS[i].hexes;
      }
    }
    OVERRIDE_DEFS = {};
    OVERRIDE_HEXES = {};
    saveDefs();
    saveHexes();
    POLY_CACHE.clear();
    HEX_CACHE.clear();
  }

  // Emit a paste-ready GH_REGIONS array.
  function exportMergedSource(){
    const lines = ['  const GH_REGIONS = ['];
    for (const r of GH_REGIONS){
      const parts = [];
      parts.push(`name:${JSON.stringify(r.name)}`);
      parts.push(`kind:${JSON.stringify(r.kind || 'land')}`);
      parts.push(`color:${JSON.stringify(r.color || defaultColor(r.name))}`);
      if (r.vertices) parts.push(`vertices:${JSON.stringify(r.vertices)}`);
      if (r.hexes && r.hexes.length){
        const sorted = r.hexes.slice().sort((a,b) => {
          const [ac, ar] = a.split('-').map(Number);
          const [bc, br] = b.split('-').map(Number);
          return ac !== bc ? ac - bc : ar - br;
        });
        parts.push(`hexes:${JSON.stringify(sorted)}`);
      }
      if (r.anchors)  parts.push(`anchors:${JSON.stringify(r.anchors)}`);
      lines.push(`    { ${parts.join(', ')} },`);
    }
    lines.push('  ];');
    return lines.join('\n');
  }

  function rebuild(){ POLY_CACHE.clear(); HEX_CACHE.clear(); }

  function setVertices(name, vertices){
    const idx = GH_REGIONS.findIndex(r => r.name === name);
    if (idx < 0) return false;
    GH_REGIONS[idx].vertices = vertices;
    POLY_CACHE.delete(idx);
    return true;
  }

  function stats(){
    let total = 0;
    const counts = {};
    for (const name in OVERRIDE_HEXES){
      const n = OVERRIDE_HEXES[name].length;
      counts[name] = n;
      total += n;
    }
    return { total, counts, regions: GH_REGIONS.length };
  }

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
    getMembership,
    getHexTagged,
    all,
    names,
    getByName,
    addRegion,
    removeRegion,
    setRegionColor,
    setRegionMeta,
    isBase,
    setHexes,
    addHexes,
    removeHexes,
    erasePaintAt,
    clearHexes,
    bootstrapFromLandmarks,
    fillFromPolygon,
    setVertices,
    exportOverrides,
    clearOverrides,
    exportMergedSource,
    rebuild,
    stats,
    qa,
    colorToRgbTriplet,
    defaultColor,
  };
})();
