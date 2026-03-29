// mp-canvas.js v2.0.0 — Floor plan canvas editor (light theme, 5' grid)

const CELL_PX = 28;

class FloorPlanEditor {
  constructor(canvasEl, wrapEl, vehicle) {
    this.canvas = canvasEl;
    this.wrap = wrapEl;
    this.ctx = canvasEl.getContext("2d");
    this.veh = vehicle;

    this.mode = "select";
    this.pickType = null;
    this.placeSpaces = 1;
    this.placeW = 1;
    this.placeH = 1;

    this.selected = null;
    this.dragging = null;
    this.ghost = null;

    this.panX = 0;
    this.panY = 0;
    this.panStart = null;
    this.zoom = 1.0;

    this.onUpdate = null;

    this._bind();
    this._resize();
    this.draw();
  }

  _bind() {
    this.canvas.addEventListener("mousemove", e => this._onMouseMove(e));
    this.canvas.addEventListener("mousedown", e => this._onMouseDown(e));
    this.canvas.addEventListener("mouseup", e => this._onMouseUp(e));
    this.canvas.addEventListener("mouseleave", () => {
      this.ghost = null;
      this.panStart = null;
      this.draw();
    });
    this.canvas.addEventListener("wheel", e => this._onWheel(e), { passive: false });
    this.canvas.addEventListener("contextmenu", e => e.preventDefault());
    this._keyHandler = e => this._onKey(e);
    window.addEventListener("keydown", this._keyHandler);
    this._resizeObs = new ResizeObserver(() => { this._resize(); this.draw(); });
    this._resizeObs.observe(this.wrap);
  }

  destroy() {
    if (this._keyHandler) window.removeEventListener("keydown", this._keyHandler);
    if (this._resizeObs) this._resizeObs.disconnect();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.wrap.clientWidth * dpr);
    const h = Math.round(this.wrap.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.canvas.style.width = this.wrap.clientWidth + "px";
    this.canvas.style.height = this.wrap.clientHeight + "px";
    this.ctx = this.canvas.getContext("2d");
  }

  _canvasPos(ev) {
    const rect = this.canvas.getBoundingClientRect();
    return { cx: ev.clientX - rect.left, cy: ev.clientY - rect.top };
  }

  _cssToGrid(cx, cy) {
    const cell = CELL_PX * this.zoom;
    return {
      gx: Math.floor((cx - this.panX) / cell),
      gy: Math.floor((cy - this.panY) / cell)
    };
  }

  _gridToCSS(gx, gy) {
    const cell = CELL_PX * this.zoom;
    return { px: this.panX + gx * cell, py: this.panY + gy * cell };
  }

  setMode(mode) {
    this.mode = mode;
    this.ghost = null;
    if (mode === "select") this.pickType = null;
    this.canvas.style.cursor = mode === "place" ? "crosshair" : "default";
    this.draw();
  }

  setPick(typeId, spaces) {
    this.pickType = typeId;
    const type = MP.typeById(typeId);
    this.placeSpaces = type?.fixed || spaces || 1;
    this._calcPlaceSize();
    this.mode = "place";
    this.canvas.style.cursor = "crosshair";
    this.draw();
  }

  _calcPlaceSize() {
    const sp = this.placeSpaces;
    const sqrt = Math.ceil(Math.sqrt(sp));
    for (let w = sqrt; w >= 1; w--) {
      if (sp % w === 0) {
        this.placeW = w;
        this.placeH = sp / w;
        return;
      }
    }
    this.placeW = sp;
    this.placeH = 1;
  }

  setPlaceSpaces(spaces) {
    const type = this.pickType ? MP.typeById(this.pickType) : null;
    if (type?.fixed) {
      this.placeSpaces = type.fixed;
    } else {
      this.placeSpaces = Math.max(1, spaces);
    }
    this._calcPlaceSize();
  }

  rotatePlacement() {
    const tmp = this.placeW;
    this.placeW = this.placeH;
    this.placeH = tmp;
    this.draw();
  }

  _systemAt(cx, cy) {
    const { gx, gy } = this._cssToGrid(cx, cy);
    for (let i = this.veh.systems.length - 1; i >= 0; i--) {
      const s = this.veh.systems[i];
      if (gx >= s.gx && gx < s.gx + s.gw && gy >= s.gy && gy < s.gy + s.gh) return s;
    }
    return null;
  }

  _onMouseMove(ev) {
    const { cx, cy } = this._canvasPos(ev);
    if (this.panStart) {
      this.panX = this.panStart.panX + (ev.clientX - this.panStart.clientX);
      this.panY = this.panStart.panY + (ev.clientY - this.panStart.clientY);
      this.draw();
      return;
    }
    if (this.dragging) {
      const s = this.veh.findSystem(this.dragging.id);
      if (s) {
        const { gx, gy } = this._cssToGrid(cx, cy);
        s.gx = gx - this.dragging.offGx;
        s.gy = gy - this.dragging.offGy;
      }
      this.draw();
      return;
    }
    if (this.mode === "place" && this.pickType) {
      const { gx, gy } = this._cssToGrid(cx, cy);
      this.ghost = { gx, gy, gw: this.placeW, gh: this.placeH, typeId: this.pickType };
      this.draw();
    }
  }

  _onMouseDown(ev) {
    if (ev.button === 2 || ev.button === 1) {
      this.panStart = { clientX: ev.clientX, clientY: ev.clientY, panX: this.panX, panY: this.panY };
      ev.preventDefault();
      return;
    }
    if (ev.button !== 0) return;
    ev.preventDefault();
    const { cx, cy } = this._canvasPos(ev);

    if (this.mode === "place" && this.pickType) {
      const { gx, gy } = this._cssToGrid(cx, cy);
      this.veh.addSystem(this.pickType, this.placeSpaces, gx, gy, this.placeW, this.placeH);
      this.ghost = { gx, gy, gw: this.placeW, gh: this.placeH, typeId: this.pickType };
      this.draw();
      if (this.onUpdate) this.onUpdate();
      return;
    }

    if (this.mode === "select") {
      const hit = this._systemAt(cx, cy);
      if (hit) {
        this.selected = hit.id;
        const { gx, gy } = this._cssToGrid(cx, cy);
        this.dragging = { id: hit.id, offGx: gx - hit.gx, offGy: gy - hit.gy };
      } else {
        this.selected = null;
      }
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
  }

  _onMouseUp(ev) {
    if (ev.button === 2 || ev.button === 1) { this.panStart = null; return; }
    if (this.dragging) {
      this.dragging = null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
    }
  }

  _onWheel(ev) {
    ev.preventDefault();
    const { cx, cy } = this._canvasPos(ev);
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * (ev.deltaY < 0 ? 1.12 : 0.89)));
    if (this.zoom === oldZoom) return;
    const ratio = this.zoom / oldZoom;
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.draw();
  }

  _onKey(ev) {
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if (ev.key === "r" || ev.key === "R") { ev.preventDefault(); this.rotatePlacement(); return; }
    if ((ev.key === "Delete" || ev.key === "Backspace") && this.selected) {
      ev.preventDefault();
      this.veh.removeSystem(this.selected);
      this.selected = null;
      this.draw();
      if (this.onUpdate) this.onUpdate();
      return;
    }
    if (ev.key === "s" || ev.key === "S") { ev.preventDefault(); this.setMode("select"); return; }
    if (ev.key === "Escape") {
      if (this.mode === "place") this.setMode("select");
      else { this.selected = null; this.draw(); }
    }
  }

  zoomIn() { this._zoomBy(1.25); }
  zoomOut() { this._zoomBy(0.8); }
  resetView() { this.zoom = 1; this.panX = 40; this.panY = 40; this.draw(); }

  _zoomBy(factor) {
    const cx = this.wrap.clientWidth / 2;
    const cy = this.wrap.clientHeight / 2;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * factor));
    const ratio = this.zoom / oldZoom;
    this.panX = cx - (cx - this.panX) * ratio;
    this.panY = cy - (cy - this.panY) * ratio;
    this.draw();
  }

  deleteSelected() {
    if (!this.selected) return;
    this.veh.removeSystem(this.selected);
    this.selected = null;
    this.draw();
    if (this.onUpdate) this.onUpdate();
  }

  clearAll() {
    this.veh.systems = [];
    this.selected = null;
    this.draw();
    if (this.onUpdate) this.onUpdate();
  }

  // ---- Drawing (Light Theme) ----

  draw() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cell = CELL_PX * this.zoom * dpr;
    const ox = this.panX * dpr;
    const oy = this.panY * dpr;

    // Light background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e8e8e4";
    ctx.fillRect(0, 0, W, H);

    const startGx = Math.floor(-ox / cell);
    const endGx = Math.ceil((W - ox) / cell);
    const startGy = Math.floor(-oy / cell);
    const endGy = Math.ceil((H - oy) / cell);

    // Grid lines — light lines for individual cells, heavy for every 4 (movement space)
    for (let gx = startGx; gx <= endGx; gx++) {
      const isOrigin = gx === 0;
      const isHeavy = gx % 4 === 0;
      ctx.strokeStyle = isOrigin ? "#c04820" : isHeavy ? "#a0a098" : "#ccccc6";
      ctx.lineWidth = isOrigin ? 2 : isHeavy ? 1.5 : 0.5;
      const x = ox + gx * cell;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let gy = startGy; gy <= endGy; gy++) {
      const isOrigin = gy === 0;
      const isHeavy = gy % 4 === 0;
      ctx.strokeStyle = isOrigin ? "#c04820" : isHeavy ? "#a0a098" : "#ccccc6";
      ctx.lineWidth = isOrigin ? 2 : isHeavy ? 1.5 : 0.5;
      const y = oy + gy * cell;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Feet labels every 4 cells (1 movement space = 5')
    const labelSize = Math.max(8, Math.round(9 * this.zoom * dpr));
    ctx.fillStyle = "#70706a";
    ctx.font = `${labelSize}px monospace`;
    ctx.textBaseline = "top";
    for (let gx = 0; gx <= endGx; gx += 4) {
      const x = ox + gx * cell;
      const feet = (gx / 4) * 5;
      if (x > 0 && x < W) ctx.fillText(`${feet}'`, x + 3, 3);
    }
    ctx.textBaseline = "middle";
    for (let gy = 4; gy <= endGy; gy += 4) {
      const y = oy + gy * cell;
      const feet = (gy / 4) * 5;
      if (y > 0 && y < H) ctx.fillText(`${feet}'`, 3, y + 2);
    }
    ctx.textBaseline = "alphabetic";

    // Placed systems
    for (const s of this.veh.systems) {
      this._drawSystem(ctx, s, s.id === this.selected, cell, ox, oy, dpr);
    }

    // Ghost
    if (this.mode === "place" && this.ghost && this.pickType) {
      this._drawGhost(ctx, this.ghost, cell, ox, oy, dpr);
    }
  }

  _drawSystem(ctx, s, selected, cell, ox, oy, dpr) {
    const type = MP.typeById(s.typeId);
    const x = ox + s.gx * cell;
    const y = oy + s.gy * cell;
    const w = s.gw * cell;
    const h = s.gh * cell;

    ctx.globalAlpha = 0.88;
    ctx.fillStyle = type?.color || "#888";
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    ctx.strokeStyle = selected ? "#c04820" : "#00000044";
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    if (selected) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#c04820";
      ctx.fillRect(x + w - 7, y + 1, 6, 6);
      ctx.fillRect(x + 1, y + h - 7, 6, 6);
    }

    ctx.globalAlpha = 1;
    const cssPw = w / dpr, cssPh = h / dpr;
    if (cssPw > 14 && cssPh > 10) {
      const fontSize = Math.max(8, Math.min(13, cssPw * 0.12)) * dpr;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "#ffffffee";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const abbr = type?.abbr || "??";
      const label = cssPw > 40 ? (type?.name || abbr) : abbr;
      ctx.fillText(label, x + w / 2, y + h / 2);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawGhost(ctx, g, cell, ox, oy, dpr) {
    const type = MP.typeById(g.typeId);
    const x = ox + g.gx * cell;
    const y = oy + g.gy * cell;
    const w = g.gw * cell;
    const h = g.gh * cell;

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = type?.color || "#888";
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = "#c04820";
    ctx.lineWidth = 2;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);

    const cssPw = w / dpr;
    if (cssPw > 14) {
      const fontSize = Math.max(8, Math.min(13, cssPw * 0.12)) * dpr;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "#000000aa";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(type?.abbr || "??", x + w / 2, y + h / 2);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  toImage(maxWidth) {
    if (!this.veh.systems.length) return null;
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const s of this.veh.systems) {
      minGx = Math.min(minGx, s.gx);
      minGy = Math.min(minGy, s.gy);
      maxGx = Math.max(maxGx, s.gx + s.gw);
      maxGy = Math.max(maxGy, s.gy + s.gh);
    }
    const gw = maxGx - minGx;
    const gh = maxGy - minGy;
    const cellPx = maxWidth ? Math.min(28, Math.floor(maxWidth / gw)) : 28;
    const w = gw * cellPx + 2;
    const h = gh * cellPx + 2;

    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e8e8e4";
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x <= gw; x++) {
      ctx.strokeStyle = x % 4 === 0 ? "#a0a098" : "#ccccc6";
      ctx.lineWidth = x % 4 === 0 ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(x * cellPx + 1, 0); ctx.lineTo(x * cellPx + 1, h); ctx.stroke();
    }
    for (let y = 0; y <= gh; y++) {
      ctx.strokeStyle = y % 4 === 0 ? "#a0a098" : "#ccccc6";
      ctx.lineWidth = y % 4 === 0 ? 1.5 : 0.5;
      ctx.beginPath(); ctx.moveTo(0, y * cellPx + 1); ctx.lineTo(w, y * cellPx + 1); ctx.stroke();
    }

    for (const s of this.veh.systems) {
      const type = MP.typeById(s.typeId);
      const sx = (s.gx - minGx) * cellPx + 1;
      const sy = (s.gy - minGy) * cellPx + 1;
      const sw = s.gw * cellPx;
      const sh = s.gh * cellPx;
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = type?.color || "#888";
      ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.strokeStyle = "#00000044";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.globalAlpha = 1;
      if (sw > 14 && sh > 10) {
        ctx.font = `bold ${Math.max(8, Math.min(12, sw * 0.12))}px sans-serif`;
        ctx.fillStyle = "#ffffffee";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(type?.abbr || "??", sx + sw / 2, sy + sh / 2);
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return c;
  }
}
