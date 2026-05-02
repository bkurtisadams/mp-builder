// gcc-coast-scanner.js v0.3.1 — 2026-05-02
// v0.3.1: loosen water DEFAULT_THRESHOLDS so Darlene's near-white
// lake water (e.g. inside G4-88, plains parent containing the
// western edge of Whyestil) classifies as definite water on the
// strict pass. v0.3.0's S>=0.20 / V<=0.85 was tuned for saturated
// inland-sea blues and rejected the desaturated lake interior, so
// approach-C had nothing to spread from there.
//
// New water defaults:
//   Hue:  180°-240°    (was 180°-230°; widened to catch deeper blues)
//   Sat:  >= 0.015     (was >= 0.20; pale-blue-tinted-white now passes)
//   Val:  0.30-0.99    (was 0.30-0.85; admits whitish water, still
//                       rejects pure-pure-white text & UI highlights)
//
// Discriminator vs parchment is hue: parchment is yellow-tinted
// (H~50°), Darlene's lake is blue-tinted (H~200°), so even a tiny
// Sat min still excludes parchment because it's outside the hue band.
//
// v0.3.0 — 2026-05-02
// v0.3.0: edge-aware classification (approach C). The v0.2 parent-
// terrain tiebreaker pointed in the wrong direction for parents that
// CONTAIN water but aren't water-typed (e.g. plains hex containing
// the western edge of Whyestil Lake at G4-88). Ambiguous coastal
// pixels there were defaulting to land regardless of the visible
// water signal in neighboring cells.
//
// Two-pass scan now:
//   Pass 1: classify each cell as 'water' | 'land' | 'ambiguous'
//   Pass 2: for each ambiguous cell, look at its 6 axial neighbors:
//     - if any definite-water neighbor and no definite-land → water
//     - if any definite-land neighbor and no definite-water → land
//     - if both/neither → fall through to parent-terrain tiebreaker
//
// This means definite classifications "spread" one cell into ambiguous
// regions. Cells far from any color signal still use the parent's
// terrain as the prior. Result on G4-88 (plains parent): ambiguous
// cells adjacent to the definite-blue strip in the upper-left now
// correctly classify as water; cells deep in the plains stay land.
//
// Result.resolution field added: 'water' | 'land' | 'water-via-neighbor'
// | 'land-via-neighbor' | 'water-via-parent' | 'land-via-parent'.
// Preview summary breaks down which way ambiguous cells went.
//
// v0.2.1 — 2026-05-02
// v0.2.1: raise DEFAULT_LAND_THRESHOLDS.vMax from 0.70 to 0.92.
// Verified empirically against I4-89: Darlene's land coloring is
// pale-bright yellow-tan (V~0.85-0.88), not the moderate-tone V<0.70
// I assumed. With the old default, land cells fell into "ambiguous"
// and the parent-terrain tiebreaker (water_inland_sea → water) flipped
// them all to water. New cap at 0.92 catches Darlene's pale land
// without picking up pure-white coastal pixels (V≈0.98).
//
// v0.2.0 — 2026-05-02
// v0.2.0: parent-terrain tiebreaker for ambiguous pixels.
// Darlene's coastal water is nearly white (RGB ~245,245,250 with H~240°
// but S~0.02, V~0.98), failing the v0.1 saturated-blue threshold. Same
// goes for pale parchment land: too desaturated to call definitively.
// New tri-state classifier:
//   classifyPixel(r,g,b) → 'water' | 'land' | 'ambiguous'
// And in scanParent, ambiguous cells use the parent's terrain as the
// tiebreaker (water_* parents default ambiguous → water; land parents
// default ambiguous → land). The modal now exposes a separate land
// threshold so the GM can tune both water and land detection.
//
// v0.1.2 — 2026-05-02
// v0.1.2: fix svgToImagePixel — world coords from hexCenter() are
// already in image-CSS-box space (origin at the image's CSS top-left).
// The 0.1.1 fix added a stageBounds offset that shouldn't have been
// there. Verified empirically against a live probe at D4-86 (col=64,
// row=44): world (1940, 1541.53) → natural pixel (956.48, 804.92),
// matching DOM bounding-rect ground truth (977.49, 804.95) to within
// rounding.
//
// v0.1.1 — 2026-05-02 (DID NOT FIX THE BUG)
// v0.1.0 — 2026-05-02
//
// Scans the Darlene map image and classifies each subhex cell of a
// parent hex as water-vs-land, writing subhex overrides for the water
// cells. Sole feature: water/coast detection by HSV threshold on
// pixel samples taken at each subhex center.
//
// The Darlene image is positioned in the page via a CSS transform
// (imgX in greyhawk-map.html). To sample the right pixel for a given
// subhex SVG center, we invert that transform: SVG world → pre-transform
// image pixel, then read from a hidden canvas drawn at the image's
// natural size.
//
// Public API (single-parent MVP):
//   GCCCoastScanner.openPreview(col, row)
//     Open a modal dialog showing the scan result for parent (col, row).
//     Operator can adjust the threshold, preview the classification,
//     and apply it as subhex overrides (source='scanner-coast-v1').
//
//   GCCCoastScanner.scanParent(col, row, opts) → { results, summary }
//     Headless scan returning [{Q, R, isWater, terrain, alreadyAuthored}, …].
//     opts.threshold = HSV thresholds (see DEFAULT_THRESHOLDS).
//
//   GCCCoastScanner.applyResults(results) → { written, skipped }
//     Write water overrides for all results where isWater=true and the
//     cell isn't already authored. Skips authored cells unless
//     opts.overwriteAuthored=true.
//
// Coordinate flow:
//   subhex (Q,R) ──subhexSvgCenter──> world SVG (x,y)
//   world SVG (x,y) ──invert imgX──> image pixel (px,py)
//   image pixel ──canvas getImageData──> RGB
//   RGB ──rgbToHsv → threshold──> isWater bool
//
// Calibration baseline: HSV with H ∈ [180°, 230°], S > 0.20, V ∈ [0.30, 0.85]
// works well against Darlene's blue water palette without picking up
// the parchment background or shaded mountains. Threshold can be
// adjusted live in the preview panel.

(function(){
  'use strict';

  // ── Defaults ────────────────────────────────────────────────────────
  // Water threshold — anything in the blue hue band with even a tiny
  // saturation tint, except pure-pure-white. Catches both saturated
  // sea blues (Nyr Dyv proper) and Darlene's near-white lake interior
  // (Whyestil's western fingers in plains/forest parents). The hue
  // band excludes parchment (which is yellow-tinted ~50°) so the
  // very-low saturation floor doesn't pick up cream/tan. Bounds are
  // slightly margined (sMin 0.015 not 0.02; vMax 0.99 not 0.98) to
  // admit pixels right at the boundary that compute as e.g. S=0.0199
  // due to floating-point.
  const DEFAULT_THRESHOLDS = {
    hMin: 180, hMax: 240,
    sMin: 0.015, sMax: 1.00,
    vMin: 0.30, vMax: 0.99,
  };
  // Land threshold — anything clearly green/brown/yellow-tan is
  // "definitely land". Together with DEFAULT_THRESHOLDS for water, the
  // remaining pixels are "ambiguous" and resolved by parent-terrain
  // tiebreaker in scanParent. Defaults catch forest/hills/plains/
  // mountain/Darlene-pale-tan hues (earthy browns from ~20°, greens
  // through ~110°, V up to 0.92 to include Darlene's pale-bright land
  // coloring without grabbing pure-white coast pixels at V≈0.98).
  const DEFAULT_LAND_THRESHOLDS = {
    hMin: 20, hMax: 110,
    sMin: 0.15, sMax: 1.00,
    vMin: 0.10, vMax: 0.92,
  };
  const SAMPLE_RADIUS_PX = 2;     // average over a (2r+1)x(2r+1) window
  const SOURCE_TAG = 'scanner-coast-v1';

  // ── Internal canvas (cached) ────────────────────────────────────────
  // We draw the Darlene image into a canvas at natural size once, then
  // sample from it for as many parents as needed. Re-draws if the image
  // src changes (rare). The canvas is hidden — never inserted into DOM.
  let _canvas = null, _ctx = null, _imgSrc = null, _imgNW = 0, _imgNH = 0;
  function ensureCanvas(){
    const img = document.getElementById('map-img');
    if (!img || !img.naturalWidth) return null;
    if (_canvas && _imgSrc === img.src && _imgNW === img.naturalWidth) return _ctx;
    _canvas = document.createElement('canvas');
    _canvas.width  = img.naturalWidth;
    _canvas.height = img.naturalHeight;
    _ctx = _canvas.getContext('2d', { willReadFrequently: true });
    _ctx.drawImage(img, 0, 0);
    _imgSrc = img.src;
    _imgNW = img.naturalWidth;
    _imgNH = img.naturalHeight;
    return _ctx;
  }

  // ── Coordinate transforms ───────────────────────────────────────────
  // World SVG (wx, wy) → image natural pixel.
  //
  // Geometry of greyhawk-map.html (verified empirically against
  // a live probe at D4-86 / col=64,row=44):
  //   - hexCenter() returns "map coords" where (0,0) = col 0 left edge
  //     = the image's CSS top-left corner. So world (0,0) corresponds
  //     to image-CSS-box (0,0). No stageBounds offset enters here —
  //     the image's stage offset (-stageBounds.minX, -stageBounds.minY)
  //     just shifts the image inside the stage; map coords already
  //     start at the image's top-left.
  //   - Image's CSS box is MAP_W × MAP_H; natural pixels are
  //     naturalWidth × naturalHeight.
  //   - imgX transform: translate(tx,ty) rotate(rot°) scale(sx,sy)
  //     around CSS box center (MAP_W/2, MAP_H/2).
  //
  // Forward chain (image-box pixel → world):
  //   centered = (ibX - MAP_W/2, ibY - MAP_H/2)
  //   scaled   = (sx * cx,       sy * cy)
  //   rotated  = (rotate(scaled by rot°))
  //   world    = (rotated.x + MAP_W/2 + tx, rotated.y + MAP_H/2 + ty)
  // Inverse: subtract translate, un-center, un-rotate, un-scale, re-center.
  function svgToImagePixel(svgX, svgY){
    const img = document.getElementById('map-img');
    if (!img) return null;
    const X = window.imgX || { tx:0, ty:0, sx:1, sy:1, rot:0 };
    const MAP_W = window.MAP_W;
    const MAP_H = window.MAP_H;
    if (!MAP_W || !MAP_H || !img.naturalWidth) return null;

    // 1. Recenter relative to image-box center, removing the
    //    translate.
    let dx = svgX - MAP_W / 2 - X.tx;
    let dy = svgY - MAP_H / 2 - X.ty;

    // 2. Inverse rotate.
    const a = -X.rot * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const xr = dx*ca - dy*sa;
    const yr = dx*sa + dy*ca;

    // 3. Inverse scale, re-center → image-CSS-box coords (MAP_W×MAP_H).
    const ibX = xr / X.sx + MAP_W / 2;
    const ibY = yr / X.sy + MAP_H / 2;

    // 4. Scale from image-CSS-box space to natural-pixel space.
    const px = ibX * (img.naturalWidth  / MAP_W);
    const py = ibY * (img.naturalHeight / MAP_H);
    return { px, py };
  }

  // ── Color classification ────────────────────────────────────────────
  function rgbToHsv(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0){
      if      (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }
  function isWaterRgb(r, g, b, T){
    const { h, s, v } = rgbToHsv(r, g, b);
    return h >= T.hMin && h <= T.hMax
        && s >= T.sMin && s <= T.sMax
        && v >= T.vMin && v <= T.vMax;
  }
  function passesThreshold(h, s, v, T){
    return h >= T.hMin && h <= T.hMax
        && s >= T.sMin && s <= T.sMax
        && v >= T.vMin && v <= T.vMax;
  }
  // Tri-state classification. 'ambiguous' means neither water nor land
  // threshold matched — the caller should resolve via parent-terrain
  // tiebreaker. Order matters: water check first because some water
  // hues overlap loosely with land hues at the edges.
  function classifyPixel(r, g, b, waterT, landT){
    waterT = waterT || DEFAULT_THRESHOLDS;
    landT  = landT  || DEFAULT_LAND_THRESHOLDS;
    const { h, s, v } = rgbToHsv(r, g, b);
    if (passesThreshold(h, s, v, waterT)) return 'water';
    if (passesThreshold(h, s, v, landT))  return 'land';
    return 'ambiguous';
  }

  // Sample at (px, py) with a (2r+1)x(2r+1) average. Out-of-bounds
  // pixels skip; if all pixels are out, return null.
  function samplePixel(ctx, px, py){
    const r = SAMPLE_RADIUS_PX;
    const ix = Math.round(px), iy = Math.round(py);
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let dy = -r; dy <= r; dy++){
      for (let dx = -r; dx <= r; dx++){
        const x = ix + dx, y = iy + dy;
        if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue;
        const d = ctx.getImageData(x, y, 1, 1).data;
        rs += d[0]; gs += d[1]; bs += d[2]; n++;
      }
    }
    if (n === 0) return null;
    return { r: rs/n, g: gs/n, b: bs/n };
  }

  // Pick the right water variant for a subhex based on the parent's
  // terrain. Identity if the parent is itself a water terrain; falls
  // back to water_fresh for inland (forest/plains/etc.) parents that
  // contain small lakes.
  function waterVariantForParent(parentTerrain){
    if (!parentTerrain) return 'water_fresh';
    if (parentTerrain === 'water')              return 'water_fresh';
    if (parentTerrain.startsWith('water_'))     return parentTerrain;
    return 'water_fresh';
  }

  // ── Scan one parent ─────────────────────────────────────────────────
  function scanParent(col, row, opts){
    opts = opts || {};
    const T  = Object.assign({}, DEFAULT_THRESHOLDS,      opts.threshold     || {});
    const TL = Object.assign({}, DEFAULT_LAND_THRESHOLDS, opts.landThreshold || {});
    const ctx = ensureCanvas();
    if (!ctx){
      return { error: 'map image not ready', results: [], summary: null };
    }
    if (!window.GCCSubhexData){
      return { error: 'GCCSubhexData not loaded', results: [], summary: null };
    }
    const SD = window.GCCSubhexData;
    const cells = SD.ownedByParent(col, row);
    const parentTerrain = (typeof window.getHexTerrain === 'function')
      ? window.getHexTerrain(col, row) : null;
    const waterVariant = waterVariantForParent(parentTerrain);
    const parentIsWater = parentTerrain && (parentTerrain === 'water' || parentTerrain.startsWith('water_'));

    // ── Pass 1: per-cell classification ────────────────────────────────
    // Build results indexed by "Q,R" key for fast neighbor lookup in
    // pass 2. Each entry has classification ∈ water|land|ambiguous and
    // sample data; isWater + resolution are filled in pass 2.
    const byKey = new Map();
    const results = [];
    let sampleFails = 0;
    for (const { Q, R } of cells){
      const svg = SD.subhexSvgCenter(Q, R);
      const pix = svgToImagePixel(svg.x, svg.y);
      if (!pix){ sampleFails++; continue; }
      const rgb = samplePixel(ctx, pix.px, pix.py);
      if (!rgb){ sampleFails++; continue; }
      const cls = classifyPixel(rgb.r, rgb.g, rgb.b, T, TL);
      const sub = SD.getSubhex(Q, R, parentTerrain);
      const alreadyAuthored = sub && sub.source === 'authored';
      const r = {
        Q, R, rgb,
        classification: cls,
        isWater: false,        // filled in pass 2
        resolution: null,      // filled in pass 2
        terrain: null,
        alreadyAuthored,
      };
      results.push(r);
      byKey.set(`${Q},${R}`, r);
    }

    // ── Pass 2: resolve ambiguous via neighbors, then parent ───────────
    // Definite-classified cells finalize first (they're their own
    // evidence). Then ambiguous cells inspect their 6 axial neighbors
    // and resolve based on what the surrounding terrain looks like.
    const NB = SD.NEIGHBOR_DELTAS;
    let waterN = 0, landN = 0, ambigN = 0, alreadyN = 0;
    let resWaterDirect = 0, resLandDirect = 0;
    let resWaterByNeighbor = 0, resLandByNeighbor = 0;
    let resWaterByParent = 0, resLandByParent = 0;
    for (const r of results){
      if (r.alreadyAuthored) alreadyN++;
      if (r.classification === 'water'){
        r.isWater = true;
        r.resolution = 'water';
        resWaterDirect++;
      } else if (r.classification === 'land'){
        r.isWater = false;
        r.resolution = 'land';
        resLandDirect++;
      } else {
        ambigN++;
        // Count definite-water vs definite-land neighbors. Neighbors
        // outside this parent (or sample-failed) just don't appear in
        // byKey and don't contribute evidence either way.
        let nw = 0, nl = 0;
        for (const [dQ, dR] of NB){
          const nb = byKey.get(`${r.Q + dQ},${r.R + dR}`);
          if (!nb) continue;
          if (nb.classification === 'water') nw++;
          else if (nb.classification === 'land') nl++;
        }
        if (nw > 0 && nl === 0){
          r.isWater = true;
          r.resolution = 'water-via-neighbor';
          resWaterByNeighbor++;
        } else if (nl > 0 && nw === 0){
          r.isWater = false;
          r.resolution = 'land-via-neighbor';
          resLandByNeighbor++;
        } else {
          // Both or neither — defer to parent-terrain prior.
          r.isWater = !!parentIsWater;
          r.resolution = parentIsWater ? 'water-via-parent' : 'land-via-parent';
          if (parentIsWater) resWaterByParent++;
          else               resLandByParent++;
        }
      }
      if (r.isWater){
        r.terrain = waterVariant;
        waterN++;
      } else {
        landN++;
      }
    }

    return {
      results,
      summary: {
        col, row,
        parentTerrain,
        parentIsWater,
        waterVariant,
        cellCount: cells.length,
        water: waterN,
        land: landN,
        ambiguous: ambigN,
        sampleFails,
        alreadyAuthored: alreadyN,
        // Breakdown of how ambiguous cells got resolved.
        resolution: {
          waterDirect: resWaterDirect,
          landDirect: resLandDirect,
          waterByNeighbor: resWaterByNeighbor,
          landByNeighbor: resLandByNeighbor,
          waterByParent: resWaterByParent,
          landByParent: resLandByParent,
        },
        threshold: T,
        landThreshold: TL,
      },
    };
  }

  // ── Apply results to overrides ──────────────────────────────────────
  function applyResults(results, opts){
    opts = opts || {};
    const overwriteAuthored = !!opts.overwriteAuthored;
    if (!window.GCCSubhexData) return { written: 0, skipped: 0, error: 'no data layer' };
    const SD = window.GCCSubhexData;
    let written = 0, skipped = 0;
    for (const r of results){
      if (!r.isWater) continue;
      if (r.alreadyAuthored && !overwriteAuthored){ skipped++; continue; }
      SD.setSubhexOverride(r.Q, r.R, {
        terrain: r.terrain,
        source: SOURCE_TAG,
      });
      written++;
    }
    return { written, skipped };
  }

  // ── Preview UI ──────────────────────────────────────────────────────
  // A small modal: parent label, threshold sliders, preview canvas,
  // counts, Apply / Cancel buttons. Reuses the page's gold/parchment
  // styling (themed to the map page chrome).
  let _previewState = null;

  function openPreview(col, row){
    if (col == null || row == null){
      const s = window.state;
      if (s && s.selectedCol != null){
        col = s.selectedCol;
        row = s.selectedRow;
      } else {
        alert('Pick a parent hex first (click one on the map), then run the coast scanner.');
        return;
      }
    }
    closePreview();
    _previewState = {
      col, row,
      threshold:     Object.assign({}, DEFAULT_THRESHOLDS),
      landThreshold: Object.assign({}, DEFAULT_LAND_THRESHOLDS),
      results: null,
    };
    buildPreviewDOM();
    runPreview();
  }

  function closePreview(){
    const ex = document.getElementById('coast-scanner-modal');
    if (ex) ex.remove();
    _previewState = null;
  }

  function buildPreviewDOM(){
    const wrap = document.createElement('div');
    wrap.id = 'coast-scanner-modal';
    wrap.style.cssText = `
      position:fixed; top:50%; left:50%;
      transform:translate(-50%, -50%);
      background:#120900; color:#f4e8c4;
      border:1px solid #c8941a; border-radius:3px;
      padding:14px 16px; z-index:400;
      min-width:480px; max-width:560px;
      max-height:90vh; overflow-y:auto;
      box-shadow:0 10px 50px rgba(0,0,0,.85);
      font-family:'Crimson Text', Georgia, serif;
    `;
    const id = (typeof hexIdStr === 'function') ? hexIdStr(_previewState.col, _previewState.row)
      : `${_previewState.col},${_previewState.row}`;
    wrap.innerHTML = `
      <div style="font-family:'Cinzel',serif; font-size:14px; color:#e8b840; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #5a4a30; display:flex; justify-content:space-between; align-items:baseline;">
        <span>Coast Scanner · ${id}</span>
        <span style="cursor:pointer; color:#c8a070; font-size:18px;" id="cs-close">×</span>
      </div>
      <div id="cs-summary" style="font-size:13px; line-height:1.5; margin-bottom:10px;">scanning…</div>
      <canvas id="cs-canvas" width="320" height="320" style="display:block; margin:0 auto 10px; border:1px solid #5a4a30; background:#000;"></canvas>
      <div style="font-size:11px; color:#c8a070; margin-bottom:8px; line-height:1.4;">Solid = definite · Faded = inferred from neighbors · Grey = inferred from parent terrain</div>
      <div style="font-size:11px; line-height:1.6; margin-bottom:6px;">
        <div style="font-size:10px; color:#e8b840; letter-spacing:.06em; text-transform:uppercase; margin-bottom:4px;">Water threshold (blue hues)</div>
        <div style="display:grid; grid-template-columns:60px 1fr 60px; gap:4px 8px; align-items:center;">
          <label>Hue min</label>
            <input type="range" id="cs-w-hmin" min="0" max="360" value="${DEFAULT_THRESHOLDS.hMin}" style="width:100%;">
            <span id="cs-w-hmin-v">${DEFAULT_THRESHOLDS.hMin}°</span>
          <label>Hue max</label>
            <input type="range" id="cs-w-hmax" min="0" max="360" value="${DEFAULT_THRESHOLDS.hMax}" style="width:100%;">
            <span id="cs-w-hmax-v">${DEFAULT_THRESHOLDS.hMax}°</span>
          <label>Sat min</label>
            <input type="range" id="cs-w-smin" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.sMin*100)}" style="width:100%;">
            <span id="cs-w-smin-v">${Math.round(DEFAULT_THRESHOLDS.sMin*100)}%</span>
          <label>Val min</label>
            <input type="range" id="cs-w-vmin" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.vMin*100)}" style="width:100%;">
            <span id="cs-w-vmin-v">${Math.round(DEFAULT_THRESHOLDS.vMin*100)}%</span>
          <label>Val max</label>
            <input type="range" id="cs-w-vmax" min="0" max="100" value="${Math.round(DEFAULT_THRESHOLDS.vMax*100)}" style="width:100%;">
            <span id="cs-w-vmax-v">${Math.round(DEFAULT_THRESHOLDS.vMax*100)}%</span>
        </div>
      </div>
      <div style="font-size:11px; line-height:1.6; margin-bottom:10px;">
        <div style="font-size:10px; color:#c8a070; letter-spacing:.06em; text-transform:uppercase; margin-bottom:4px;">Land threshold (greens, browns)</div>
        <div style="display:grid; grid-template-columns:60px 1fr 60px; gap:4px 8px; align-items:center;">
          <label>Hue min</label>
            <input type="range" id="cs-l-hmin" min="0" max="360" value="${DEFAULT_LAND_THRESHOLDS.hMin}" style="width:100%;">
            <span id="cs-l-hmin-v">${DEFAULT_LAND_THRESHOLDS.hMin}°</span>
          <label>Hue max</label>
            <input type="range" id="cs-l-hmax" min="0" max="360" value="${DEFAULT_LAND_THRESHOLDS.hMax}" style="width:100%;">
            <span id="cs-l-hmax-v">${DEFAULT_LAND_THRESHOLDS.hMax}°</span>
          <label>Sat min</label>
            <input type="range" id="cs-l-smin" min="0" max="100" value="${Math.round(DEFAULT_LAND_THRESHOLDS.sMin*100)}" style="width:100%;">
            <span id="cs-l-smin-v">${Math.round(DEFAULT_LAND_THRESHOLDS.sMin*100)}%</span>
          <label>Val min</label>
            <input type="range" id="cs-l-vmin" min="0" max="100" value="${Math.round(DEFAULT_LAND_THRESHOLDS.vMin*100)}" style="width:100%;">
            <span id="cs-l-vmin-v">${Math.round(DEFAULT_LAND_THRESHOLDS.vMin*100)}%</span>
          <label>Val max</label>
            <input type="range" id="cs-l-vmax" min="0" max="100" value="${Math.round(DEFAULT_LAND_THRESHOLDS.vMax*100)}" style="width:100%;">
            <span id="cs-l-vmax-v">${Math.round(DEFAULT_LAND_THRESHOLDS.vMax*100)}%</span>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button id="cs-cancel" style="background:transparent; color:#f4e8c4; border:1px solid #8b6a30; border-radius:3px; padding:6px 14px; font-family:inherit; font-size:13px; cursor:pointer;">Close</button>
        <button id="cs-apply" style="background:#5a3a0a; color:#f4e8c4; border:1px solid #c8941a; border-radius:3px; padding:6px 14px; font-family:inherit; font-size:13px; cursor:pointer; font-weight:600;">Apply water overrides</button>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('cs-close').addEventListener('click', closePreview);
    document.getElementById('cs-cancel').addEventListener('click', closePreview);
    document.getElementById('cs-apply').addEventListener('click', onApplyClick);
    for (const ctl of ['hmin','hmax','smin','vmin','vmax']){
      const wEl = document.getElementById('cs-w-' + ctl);
      const lEl = document.getElementById('cs-l-' + ctl);
      if (wEl) wEl.addEventListener('input', () => onSliderInput('water', ctl));
      if (lEl) lEl.addEventListener('input', () => onSliderInput('land',  ctl));
    }
    document.addEventListener('keydown', _onCsKey, true);
  }

  function _onCsKey(e){
    if (e.key === 'Escape' && document.getElementById('coast-scanner-modal')){
      e.preventDefault(); e.stopPropagation();
      closePreview();
      document.removeEventListener('keydown', _onCsKey, true);
    }
  }

  function onSliderInput(kind, name){
    const T = (kind === 'water') ? _previewState.threshold : _previewState.landThreshold;
    const prefix = (kind === 'water') ? 'cs-w-' : 'cs-l-';
    const v = parseFloat(document.getElementById(prefix + name).value);
    if (name === 'hmin'){ T.hMin = v; document.getElementById(prefix + 'hmin-v').textContent = v + '°'; }
    if (name === 'hmax'){ T.hMax = v; document.getElementById(prefix + 'hmax-v').textContent = v + '°'; }
    if (name === 'smin'){ T.sMin = v/100; document.getElementById(prefix + 'smin-v').textContent = v + '%'; }
    if (name === 'vmin'){ T.vMin = v/100; document.getElementById(prefix + 'vmin-v').textContent = v + '%'; }
    if (name === 'vmax'){ T.vMax = v/100; document.getElementById(prefix + 'vmax-v').textContent = v + '%'; }
    runPreview();
  }

  function runPreview(){
    if (!_previewState) return;
    const { col, row, threshold, landThreshold } = _previewState;
    const out = scanParent(col, row, { threshold, landThreshold });
    _previewState.results = out.results;
    const sumEl = document.getElementById('cs-summary');
    if (out.error){
      sumEl.textContent = 'Error: ' + out.error;
      return;
    }
    const s = out.summary;
    const r = s.resolution;
    const parts = [];
    if (r.waterByNeighbor)  parts.push(`<span style="color:#9adfff;">${r.waterByNeighbor} → water (neighbor)</span>`);
    if (r.landByNeighbor)   parts.push(`<span style="color:#e8c890;">${r.landByNeighbor} → land (neighbor)</span>`);
    if (r.waterByParent)    parts.push(`<span style="color:#9adfff;">${r.waterByParent} → water (parent)</span>`);
    if (r.landByParent)     parts.push(`<span style="color:#e8c890;">${r.landByParent} → land (parent)</span>`);
    const ambigDetail = parts.length ? ` · ${parts.join(' · ')}` : '';
    sumEl.innerHTML = `
      <div>Parent: <b>${s.parentTerrain || '(unknown)'}</b> · would write as <b>${s.waterVariant}</b></div>
      <div>${s.cellCount} cells · <span style="color:#6dc8c8;">${s.water} water</span> · <span style="color:#c8a070;">${s.land} land</span>${ambigDetail}</div>
      <div style="font-size:11px; color:#a08a60; margin-top:2px;">
        ${s.sampleFails ? `${s.sampleFails} sample fail · ` : ''}
        ${s.alreadyAuthored ? `${s.alreadyAuthored} already authored (will skip)` : ''}
      </div>
    `;
    drawPreviewCanvas();
  }

  function drawPreviewCanvas(){
    if (!_previewState) return;
    const cv = document.getElementById('cs-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const ctx2 = ensureCanvas();
    if (!ctx2){
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle = '#e07070'; ctx.font = '14px sans-serif'; ctx.fillText('Image not loaded', 10, 30);
      return;
    }
    // Compute the parent's image-pixel bounding box from its 6 corners.
    const SD = window.GCCSubhexData;
    const center = SD.parentSvgCenter(_previewState.col, _previewState.row);
    const HEX_R = SD.HEX_R || 20;     // hex radius in SVG units (data layer constant)
    const SQRT3 = Math.sqrt(3);
    const corners = [];
    for (let i = 0; i < 6; i++){
      const a = (Math.PI / 180) * (60 * i);
      corners.push({ x: center.x + HEX_R*Math.cos(a), y: center.y + HEX_R*Math.sin(a) });
    }
    let minPx = Infinity, minPy = Infinity, maxPx = -Infinity, maxPy = -Infinity;
    for (const c of corners){
      const p = svgToImagePixel(c.x, c.y);
      if (!p) continue;
      minPx = Math.min(minPx, p.px); maxPx = Math.max(maxPx, p.px);
      minPy = Math.min(minPy, p.py); maxPy = Math.max(maxPy, p.py);
    }
    const pad = 6;
    minPx -= pad; minPy -= pad; maxPx += pad; maxPy += pad;
    const srcW = maxPx - minPx, srcH = maxPy - minPy;
    if (srcW <= 0 || srcH <= 0){
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
      return;
    }
    const scale = Math.min(cv.width / srcW, cv.height / srcH);
    const drawW = srcW * scale, drawH = srcH * scale;
    const offX = (cv.width - drawW) / 2, offY = (cv.height - drawH) / 2;
    // Background
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,cv.width,cv.height);
    // Draw the cropped region of the source image.
    ctx.drawImage(ctx2.canvas,
      Math.max(0, minPx), Math.max(0, minPy),
      Math.min(srcW, ctx2.canvas.width - minPx),
      Math.min(srcH, ctx2.canvas.height - minPy),
      offX, offY, drawW, drawH);
    // Overlay each subhex result. Color encodes the resolution path:
    //   solid blue / amber  = definite (passed strict threshold)
    //   medium blue / amber = via-neighbor (definite neighbor evidence)
    //   grey w/ stroke      = via-parent (no signal, parent prior)
    // This gives a visual confidence map: brightest dots are most
    // certain, ambiguous-cells-with-no-evidence look quietest.
    const results = _previewState.results || [];
    for (const r of results){
      const svg = SD.subhexSvgCenter(r.Q, r.R);
      const pix = svgToImagePixel(svg.x, svg.y);
      if (!pix) continue;
      const x = offX + (pix.px - minPx) * scale;
      const y = offY + (pix.py - minPy) * scale;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2*Math.PI);
      switch (r.resolution){
        case 'water':
          ctx.fillStyle = 'rgba(50,160,255,0.65)';
          ctx.strokeStyle = 'rgba(120,200,255,1.0)';
          break;
        case 'land':
          ctx.fillStyle = 'rgba(200,140,60,0.50)';
          ctx.strokeStyle = 'rgba(220,180,100,0.90)';
          break;
        case 'water-via-neighbor':
          ctx.fillStyle = 'rgba(50,160,255,0.30)';
          ctx.strokeStyle = 'rgba(120,200,255,0.85)';
          break;
        case 'land-via-neighbor':
          ctx.fillStyle = 'rgba(200,140,60,0.25)';
          ctx.strokeStyle = 'rgba(220,180,100,0.75)';
          break;
        case 'water-via-parent':
          ctx.fillStyle = 'rgba(220,220,220,0.40)';
          ctx.strokeStyle = 'rgba(120,200,255,0.85)';
          break;
        case 'land-via-parent':
          ctx.fillStyle = 'rgba(220,220,220,0.40)';
          ctx.strokeStyle = 'rgba(220,180,100,0.85)';
          break;
        default:
          ctx.fillStyle = 'rgba(220,220,220,0.40)';
          ctx.strokeStyle = 'rgba(180,180,180,0.85)';
      }
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function onApplyClick(){
    if (!_previewState || !_previewState.results) return;
    const out = applyResults(_previewState.results);
    alert(`Wrote ${out.written} water override${out.written === 1 ? '' : 's'}` +
      (out.skipped ? `, skipped ${out.skipped} already-authored cell${out.skipped === 1 ? '' : 's'}.` : '.'));
    closePreview();
    // Notify the rest of the app that subhex data changed.
    window.dispatchEvent(new CustomEvent('gcc-subhex-changed', { detail: { reason: 'coast-scanner' } }));
  }

  // ── Public surface ──────────────────────────────────────────────────
  window.GCCCoastScanner = {
    DEFAULT_THRESHOLDS,
    DEFAULT_LAND_THRESHOLDS,
    SOURCE_TAG,
    rgbToHsv, isWaterRgb, classifyPixel, svgToImagePixel,
    waterVariantForParent,
    scanParent, applyResults,
    openPreview, closePreview,
  };

  // ── Toolbar button auto-wire ────────────────────────────────────────
  function wireButton(){
    const btn = document.getElementById('btn-coast-scan');
    if (!btn) return false;
    if (btn.dataset.coastWired) return true;
    btn.dataset.coastWired = '1';
    btn.addEventListener('click', () => {
      // greyhawk-map.html exposes its top-level `state` const as
      // window.state for cross-module access.
      const s = window.state;
      const col = s ? s.selectedCol : null;
      const row = s ? s.selectedRow : null;
      if (col == null || row == null){
        alert('Click a parent hex first, then run the Coast Scanner on it.');
        return;
      }
      openPreview(col, row);
    });
    return true;
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireButton);
  } else {
    wireButton();
  }
})();
