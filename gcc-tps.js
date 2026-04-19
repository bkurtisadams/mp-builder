// gcc-tps.js v0.1.0 — 2026-04-19
// Thin-Plate Spline warping for 2D point alignment.
//
// Given N control points (source → target), solves the TPS linear system for
// the smoothest warp that passes exactly through every control point. Used by
// greyhawk-map.html to align the canonical hex grid to the hand-drawn Darlene
// map when a uniform affine transform can't represent the local distortion.
//
// Math:
//   f(x,y) = a + bx·x + by·y + Σ wi · U(|(x,y) − pi|)
//   U(r)   = r² · ln(r)         (TPS radial basis, U(0)=0 by convention)
//
// Subject to side conditions Σwi = 0, Σwi·pi.x = 0, Σwi·pi.y = 0 which ensure
// the warp has bounded bending energy and is affine at infinity.
//
// Solved as two independent (N+3)×(N+3) linear systems — one for the x output,
// one for y — via Gaussian elimination with partial pivoting.

(function(){
  function U(r){ return r < 1e-9 ? 0 : r*r*Math.log(r); }

  // Solve square linear system A·x = b with partial pivoting. Destroys A, b.
  function solveLinear(A, b){
    const n = A.length;
    for (let i = 0; i < n; i++){
      let piv = i;
      for (let k = i+1; k < n; k++){
        if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      }
      if (piv !== i){
        const tr = A[i]; A[i] = A[piv]; A[piv] = tr;
        const tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      }
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (let k = i+1; k < n; k++){
        const f = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n-1; i >= 0; i--){
      let s = b[i];
      for (let j = i+1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // Build TPS from control points. Each entry: {sx, sy, tx, ty}.
  // Returns TPS descriptor usable with apply(), or null on failure.
  function build(controlPoints){
    const n = controlPoints.length;
    if (n < 3) return null;
    const src = controlPoints.map(p => ({x: +p.sx, y: +p.sy}));
    const tx = controlPoints.map(p => +p.tx);
    const ty = controlPoints.map(p => +p.ty);

    const size = n + 3;
    const buildL = () => {
      const L = [];
      for (let i = 0; i < size; i++) L.push(new Array(size).fill(0));
      for (let i = 0; i < n; i++){
        for (let j = 0; j < n; j++){
          if (i === j) continue;
          const dx = src[i].x - src[j].x;
          const dy = src[i].y - src[j].y;
          L[i][j] = U(Math.sqrt(dx*dx + dy*dy));
        }
        L[i][n]   = 1; L[i][n+1] = src[i].x; L[i][n+2] = src[i].y;
        L[n][i]   = 1; L[n+1][i] = src[i].x; L[n+2][i] = src[i].y;
      }
      return L;
    };
    const buildRhs = (targets) => {
      const b = new Array(size).fill(0);
      for (let i = 0; i < n; i++) b[i] = targets[i];
      return b;
    };

    const solX = solveLinear(buildL(), buildRhs(tx));
    const solY = solveLinear(buildL(), buildRhs(ty));
    if (!solX || !solY) return null;

    return {
      n,
      sources: src,
      weightsX: solX.slice(0, n),
      affineX:  solX.slice(n, n+3),   // [a0, ax, ay]
      weightsY: solY.slice(0, n),
      affineY:  solY.slice(n, n+3),
    };
  }

  function apply(tps, x, y){
    if (!tps) return {x, y};
    let fx = tps.affineX[0] + tps.affineX[1]*x + tps.affineX[2]*y;
    let fy = tps.affineY[0] + tps.affineY[1]*x + tps.affineY[2]*y;
    const src = tps.sources, wx = tps.weightsX, wy = tps.weightsY, n = tps.n;
    for (let i = 0; i < n; i++){
      const dx = x - src[i].x;
      const dy = y - src[i].y;
      const u = U(Math.sqrt(dx*dx + dy*dy));
      fx += wx[i] * u;
      fy += wy[i] * u;
    }
    return {x: fx, y: fy};
  }

  // Serialize/restore for localStorage. TPS is already plain data.
  function toJSON(tps){ return tps; }
  function fromJSON(obj){
    if (!obj || typeof obj !== 'object') return null;
    if (!Array.isArray(obj.sources) || !Array.isArray(obj.weightsX)) return null;
    return {
      n: obj.n,
      sources:  obj.sources.map(p => ({x: +p.x, y: +p.y})),
      weightsX: obj.weightsX.slice(),
      affineX:  obj.affineX.slice(),
      weightsY: obj.weightsY.slice(),
      affineY:  obj.affineY.slice(),
    };
  }

  window.GCCTps = { build, apply, toJSON, fromJSON };
})();
