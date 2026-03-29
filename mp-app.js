// mp-app.js v2.2.0 — System-first placement model

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

// ---- Build palette (ability picker for adding systems) ----
function buildPalette() {
  const scroll = document.getElementById("ed-pal-scroll");
  let html = "";
  for (const cat of MP.CATEGORIES) {
    const items = MP.ABILITY_TYPES.filter(t => t.cat === cat);
    if (!items.length) continue;
    html += `<div class="ed-pal-cat">${cat}</div>`;
    for (const t of items) {
      html += `<div class="ed-pal-item" data-ability="${t.id}" title="${t.name} — click to add system">
        <span class="ed-pal-sw" style="background:${t.color}"></span>
        <span class="ed-pal-nm">${t.name}</span>
      </div>`;
    }
  }
  scroll.innerHTML = html;

  scroll.querySelectorAll(".ed-pal-item").forEach(el => {
    el.addEventListener("click", () => {
      const abilityId = el.dataset.ability;
      addSystemFromPalette(abilityId);
    });
  });
}

// ---- Add system from palette click ----
function addSystemFromPalette(abilityId) {
  const spaces = parseInt(document.getElementById("inp-place-spaces").value) || 1;
  if (spaces > veh.remainingSpaces) {
    alert(`Not enough spaces. ${veh.remainingSpaces} remaining.`);
    return;
  }
  const sys = veh.addSystem(abilityId, spaces);
  if (!sys) return;
  // Auto-select and enter paint mode
  editor.setActiveSys(sys.id);
  updateStats();
}

// ---- Chassis select ----
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

// ---- Weakness select ----
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
  document.getElementById("btn-mode-paint").classList.toggle("active", editor.mode === "paint");
  document.getElementById("btn-mode-erase").classList.toggle("active", editor.mode === "erase");
}

// ---- Stats panel ----
function updateStats() {
  const ch = veh.chassis;
  const a = veh.armor;
  const grid = document.getElementById("ed-stat-grid");
  grid.innerHTML = [
    ["Base CPs", ch.cp],
    ["Total Cost", veh.totalCost],
    ["Spaces", `${veh.allocatedSpaces} / ${ch.sp}`],
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
  countEl.textContent = `(${veh.allocatedSpaces}/${ch.sp} spc)`;
  if (!veh.systems.length) {
    listEl.innerHTML = '<div style="color:var(--tx3);font-style:italic;padding:4px">No systems — click an ability in the palette to add one</div>';
  } else {
    listEl.innerHTML = veh.systems.map(s => {
      const ab = MP.abilityById(s.abilityId);
      const name = s.abilityId === "custom" && s.customName ? s.customName : (ab?.name || "?");
      const cp = veh.sysCPs(s);
      const sel = editor && editor.activeSysId === s.id ? " sel" : "";
      const placed = s.cells.length;
      const budget = s.spaces;
      const status = placed < budget ? ` [${placed}/${budget}]` : "";
      return `<div class="ed-sys-item${sel}" data-id="${s.id}">
        <span><b>${name}</b> ${budget}spc ${veh.sysHits(s)}hp${status}</span>
        <span style="display:flex;align-items:center;gap:4px">
          <span class="ed-sys-cp">${cp}cp</span>
          <span class="ed-sys-del" data-id="${s.id}" title="Remove system" style="color:var(--vr);cursor:pointer;font-weight:700;font-size:11px">×</span>
        </span>
      </div>`;
    }).join("");

    listEl.querySelectorAll(".ed-sys-item").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("ed-sys-del")) return;
        const id = parseInt(el.dataset.id);
        editor.setActiveSys(id);
        updateModeButtons();
        updateStats();
      });
    });

    listEl.querySelectorAll(".ed-sys-del").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(el.dataset.id);
        veh.removeSystem(id);
        if (editor.activeSysId === id) editor.activeSysId = null;
        editor.draw();
        updateStats();
      });
    });
  }

  updateWeaknesses();
  updateModeButtons();
}

// ---- Weaknesses ----
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
      <span class="ed-wk-name">${def?.name || "?"}</span>
      <span><span class="ed-wk-cp">${def?.cpMod || 0}</span>
        <span class="ed-wk-del" data-id="${w.id}" title="Remove">×</span></span>
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

document.getElementById("btn-add-weakness").addEventListener("click", () => {
  const sel = document.getElementById("sel-weakness");
  if (!sel.value) return;
  veh.addWeakness(sel.value);
  updateStats();
});

// ---- Config ----
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

// ---- Toolbar ----
document.getElementById("btn-mode-select").addEventListener("click", () => {
  editor.setMode("select");
  updateModeButtons();
});
document.getElementById("btn-mode-paint").addEventListener("click", () => {
  if (editor.activeSysId) editor.setMode("paint");
  updateModeButtons();
});
document.getElementById("btn-mode-erase").addEventListener("click", () => {
  editor.setMode("erase");
  updateModeButtons();
});
document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());

// ---- Export ----
document.getElementById("btn-save").addEventListener("click", () => {
  veh.notes = document.getElementById("cfg-notes").value;
  const data = JSON.stringify(veh.toJSON(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".json";
  a.click(); URL.revokeObjectURL(url);
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
  const a = document.createElement("a"); a.href = url;
  a.download = (veh.name || "vehicle").replace(/\s+/g, "_") + ".csv";
  a.click(); URL.revokeObjectURL(url);
});

document.getElementById("btn-png").addEventListener("click", () => {
  const c = editor.toImage(600);
  if (!c) { alert("No cells painted."); return; }
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
