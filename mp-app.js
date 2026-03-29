// mp-app.js v2.0.0 — Main app controller with weaknesses

const veh = new Vehicle();
let editor = null;

// ---- Tab navigation ----
document.querySelectorAll(".mp-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mp-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".mp-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "editor" && editor) {
      setTimeout(() => { editor._resize(); editor.draw(); }, 50);
    }
  });
});

// ---- Build palette (full abilities list) ----
function buildPalette() {
  const scroll = document.getElementById("ed-pal-scroll");
  let html = "";
  for (const cat of MP.CATEGORIES) {
    const items = MP.SYSTEM_TYPES.filter(t => t.cat === cat);
    if (!items.length) continue;
    html += `<div class="ed-pal-cat">${cat}</div>`;
    for (const t of items) {
      html += `<div class="ed-pal-item" data-type="${t.id}" title="${t.name}">
        <span class="ed-pal-sw" style="background:${t.color}"></span>
        <span class="ed-pal-nm">${t.name}</span>
      </div>`;
    }
  }
  scroll.innerHTML = html;

  scroll.querySelectorAll(".ed-pal-item").forEach(el => {
    el.addEventListener("click", () => {
      const typeId = el.dataset.type;
      if (editor.pickType === typeId && editor.mode === "place") {
        editor.setMode("select");
        el.classList.remove("active");
        updateModeButtons();
        return;
      }
      scroll.querySelectorAll(".ed-pal-item").forEach(e => e.classList.remove("active"));
      el.classList.add("active");
      const spaces = parseInt(document.getElementById("inp-place-spaces").value) || 1;
      editor.setPick(typeId, spaces);
      updateModeButtons();
      updatePlaceDims();
    });
  });
}

// ---- Populate chassis select ----
function buildChassisSelect() {
  const sel = document.getElementById("cfg-chassis");
  MP.CHASSIS.forEach((ch, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `(${ch.cp}) ${ch.sp} spc — ${ch.wt}`;
    sel.appendChild(opt);
  });
  sel.value = veh.chassisIdx;
}

// ---- Populate weakness select ----
function buildWeaknessSelect() {
  const sel = document.getElementById("sel-weakness");
  sel.innerHTML = "";
  for (const w of MP.WEAKNESSES) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.cpMod})`;
    sel.appendChild(opt);
  }
}

// ---- Mode buttons ----
function updateModeButtons() {
  document.getElementById("btn-mode-select").classList.toggle("active", editor.mode === "select");
  document.getElementById("btn-mode-place").classList.toggle("active", editor.mode === "place");
}

function updatePlaceDims() {
  document.getElementById("lbl-place-dims").textContent = editor.placeW + "×" + editor.placeH;
}

// ---- Stats panel update ----
function updateStats() {
  const ch = veh.chassis;
  const a = veh.armor;
  const grid = document.getElementById("ed-stat-grid");
  grid.innerHTML = [
    ["Base CPs", ch.cp],
    ["Total Cost", veh.totalCost],
    ["Spaces", `${veh.usedSpaces} / ${ch.sp}`],
    ["Remaining", veh.remainingSpaces],
    ["Profile", "x" + ch.prof],
    ["Weight", ch.wt],
    ["Mass", ch.mass],
    ["Hits", veh.hits],
    ["Power", veh.power],
    ["Armor K/E/B/Ent", a.kin],
    ["Psychic", a.psy],
    ["Explosion", veh.explosionDice],
    ["Expl Area", veh.explosionArea + '"'],
    ["ST", veh.st],
    ["Base HTH", MP.hthDamage(veh.st)],
    ["EN", veh.en],
    ["EN Save", MP.save(veh.en)],
    ["AG", veh.ag],
    ["AG Save", MP.save(veh.ag)],
    ["Handling", veh.handling],
    ["IN", veh.intel],
    ["IN Save", MP.save(veh.intel)],
    ["CL", veh.cl],
    ["CL Save", MP.save(veh.cl)],
    ["Turn Rate", veh.turnRate],
    ["Initiative", MP.initDie(MP.save(veh.cl))],
    ["Defense", veh.defense],
    ["Carry", MP.carry(veh.st)],
    ["Spare Parts", veh.spareParts + " Hits"],
  ].map(([l, v]) => `<div class="ed-s"><span class="ed-sl">${l}</span><span class="ed-sv">${v}</span></div>`).join("");

  // Systems list
  const listEl = document.getElementById("ed-sys-list");
  const countEl = document.getElementById("ed-sys-count");
  countEl.textContent = `(${veh.usedSpaces}/${ch.sp} spc)`;
  if (!veh.systems.length) {
    listEl.innerHTML = '<div style="color:var(--tx3);font-style:italic;padding:4px">No systems placed</div>';
  } else {
    listEl.innerHTML = veh.systems.map(s => {
      const type = MP.typeById(s.typeId);
      const name = s.typeId === "custom" && s.customName ? s.customName : (type?.name || "?");
      const cp = veh.sysCPs(s);
      const sel = editor && editor.selected === s.id ? " sel" : "";
      return `<div class="ed-sys-item${sel}" data-id="${s.id}">
        <span><b>${name}</b> ${s.spaces}spc ${veh.sysHits(s)}hp</span>
        <span class="ed-sys-cp">${cp}cp</span>
      </div>`;
    }).join("");

    listEl.querySelectorAll(".ed-sys-item").forEach(el => {
      el.addEventListener("click", () => {
        editor.selected = parseInt(el.dataset.id);
        editor.setMode("select");
        editor.draw();
        updateModeButtons();
        updateStats();
      });
    });
  }

  // Weaknesses list
  updateWeaknesses();
}

// ---- Weaknesses panel ----
function updateWeaknesses() {
  const listEl = document.getElementById("ed-wk-list");
  const totalEl = document.getElementById("ed-wk-total");
  const wkCPs = veh.weaknessCPs;
  totalEl.textContent = wkCPs ? `(${wkCPs} CPs)` : "";

  if (!veh.weaknesses.length) {
    listEl.innerHTML = '<div style="color:var(--tx3);font-style:italic;padding:4px">No weaknesses</div>';
    return;
  }
  listEl.innerHTML = veh.weaknesses.map(w => {
    const def = MP.WEAKNESSES.find(d => d.id === w.weakId);
    return `<div class="ed-wk-item" data-id="${w.id}">
      <span class="ed-wk-name">${def?.name || "?"} ${w.notes ? "(" + w.notes + ")" : ""}</span>
      <span>
        <span class="ed-wk-cp">${def?.cpMod || 0}</span>
        <span class="ed-wk-del" data-id="${w.id}" title="Remove">×</span>
      </span>
    </div>`;
  }).join("");

  listEl.querySelectorAll(".ed-wk-del").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      veh.removeWeakness(parseInt(el.dataset.id));
      updateStats();
    });
  });
}

// ---- Add weakness button ----
document.getElementById("btn-add-weakness").addEventListener("click", () => {
  const sel = document.getElementById("sel-weakness");
  const weakId = sel.value;
  if (!weakId) return;
  veh.addWeakness(weakId);
  updateStats();
});

// ---- Config change handlers ----
function onConfigChange() {
  veh.name = document.getElementById("cfg-name").value;
  veh.model = document.getElementById("cfg-model").value;
  veh.operator = document.getElementById("cfg-operator").value;
  veh.chassisIdx = parseInt(document.getElementById("cfg-chassis").value);
  veh.techMod = parseInt(document.getElementById("cfg-tech").value);
  veh.maneuverMod = parseInt(document.getElementById("cfg-maneuver").value);
  veh.wontExplode = document.getElementById("cfg-noexplode").checked;
  veh.isBase = document.getElementById("cfg-base").checked;
  veh.notes = document.getElementById("cfg-notes").value;
  updateStats();
}

["cfg-name","cfg-model","cfg-operator","cfg-notes"].forEach(id => {
  document.getElementById(id).addEventListener("input", onConfigChange);
});
["cfg-chassis","cfg-tech","cfg-maneuver"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
});
["cfg-noexplode","cfg-base"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
});

// ---- Toolbar buttons ----
document.getElementById("btn-mode-select").addEventListener("click", () => {
  editor.setMode("select");
  document.querySelectorAll(".ed-pal-item").forEach(e => e.classList.remove("active"));
  updateModeButtons();
});
document.getElementById("btn-mode-place").addEventListener("click", () => {
  if (editor.pickType) {
    editor.mode = "place";
    editor.canvas.style.cursor = "crosshair";
  }
  updateModeButtons();
});
document.getElementById("inp-place-spaces").addEventListener("change", e => {
  const val = parseInt(e.target.value) || 1;
  editor.setPlaceSpaces(val);
  updatePlaceDims();
});
document.getElementById("btn-rotate").addEventListener("click", () => {
  editor.rotatePlacement();
  updatePlaceDims();
});
document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());
document.getElementById("btn-delete").addEventListener("click", () => editor.deleteSelected());
document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("Clear all placed systems?")) editor.clearAll();
});

// ---- Export ----
document.getElementById("btn-save").addEventListener("click", () => {
  veh.notes = document.getElementById("cfg-notes").value;
  const data = JSON.stringify(veh.toJSON(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-load").addEventListener("click", () => {
  document.getElementById("inp-json").click();
});
document.getElementById("inp-json").addEventListener("change", e => {
  if (!e.target.files.length) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      veh.fromJSON(JSON.parse(ev.target.result));
      document.getElementById("cfg-name").value = veh.name;
      document.getElementById("cfg-model").value = veh.model;
      document.getElementById("cfg-operator").value = veh.operator;
      document.getElementById("cfg-chassis").value = veh.chassisIdx;
      document.getElementById("cfg-tech").value = veh.techMod;
      document.getElementById("cfg-maneuver").value = veh.maneuverMod;
      document.getElementById("cfg-noexplode").checked = veh.wontExplode;
      document.getElementById("cfg-base").checked = veh.isBase;
      document.getElementById("cfg-notes").value = veh.notes;
      editor.draw();
      updateStats();
    } catch (err) { alert("Invalid JSON: " + err.message); }
  };
  reader.readAsText(e.target.files[0]);
  e.target.value = "";
});

document.getElementById("btn-csv").addEventListener("click", () => {
  veh.notes = document.getElementById("cfg-notes").value;
  const csv = veh.toCSV();
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-png").addEventListener("click", () => {
  const c = editor.toImage(600);
  if (!c) { alert("No systems placed."); return; }
  const a = document.createElement("a");
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + "_floorplan.png";
  a.href = c.toDataURL("image/png");
  a.click();
});

// ---- Init ----
buildPalette();
buildChassisSelect();
buildWeaknessSelect();

const canvasEl = document.getElementById("ed-canvas");
const wrapEl = document.getElementById("ed-canvas-wrap");
editor = new FloorPlanEditor(canvasEl, wrapEl, veh);
editor.onUpdate = updateStats;
editor.panX = 40;
editor.panY = 40;
editor.draw();
updateStats();
