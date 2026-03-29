// mp-app.js v2.3.0 — Record Sheet as primary, Floor Plan as secondary

const veh = new Vehicle();
let editor = null;
let layoutEditor = null; // mini canvas on the record sheet

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

// ---- Populate chassis select ----
function buildChassisSelect() {
  const sel = document.getElementById("vs-chassis");
  MP.CHASSIS.forEach((ch, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `(${ch.cp} CP) ${ch.sp} spc — ${ch.wt}`;
    sel.appendChild(opt);
  });
  sel.value = veh.chassisIdx;
}

// ---- Populate ability select for adding systems ----
function buildAbilitySelect() {
  const sel = document.getElementById("vs-add-ability");
  sel.innerHTML = "";
  for (const cat of MP.CATEGORIES) {
    const items = MP.ABILITY_TYPES.filter(t => t.cat === cat);
    if (!items.length) continue;
    const grp = document.createElement("optgroup");
    grp.label = cat;
    for (const t of items) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      grp.appendChild(opt);
    }
    sel.appendChild(grp);
  }
}

// ---- Populate weakness select ----
function buildWeaknessSelect() {
  const sel = document.getElementById("vs-add-weakness");
  sel.innerHTML = "";
  for (const w of MP.WEAKNESSES) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.cpMod})`;
    sel.appendChild(opt);
  }
}

// ---- Build palette for floor plan tab ----
function buildPalette() {
  const scroll = document.getElementById("ed-pal-scroll");
  let html = '<div style="padding:6px 8px;font-size:9px;color:var(--tx3);font-style:italic">Systems are added on the Record Sheet tab. Select a system there, then paint its cells here.</div>';
  // Show current systems as selectable items
  html += '<div class="ed-pal-cat">Current Systems</div>';
  for (const sys of veh.systems) {
    const ab = MP.abilityById(sys.abilityId);
    const name = sys.abilityId === "custom" && sys.customName ? sys.customName : (ab?.name || "?");
    const active = editor && editor.activeSysId === sys.id;
    html += `<div class="ed-pal-item${active ? " active" : ""}" data-sysid="${sys.id}">
      <span class="ed-pal-sw" style="background:${ab?.color || "#707070"}"></span>
      <span class="ed-pal-nm">${name} (${sys.cells.length}/${sys.spaces})</span>
    </div>`;
  }
  scroll.innerHTML = html;

  scroll.querySelectorAll(".ed-pal-item[data-sysid]").forEach(el => {
    el.addEventListener("click", () => {
      const id = parseInt(el.dataset.sysid);
      editor.setActiveSys(id);
      updateModeButtons();
      buildPalette(); // refresh active state
    });
  });
}

// ---- Update all computed displays ----
function updateAll() {
  const ch = veh.chassis;
  const a = veh.armor;

  // Chassis row
  document.getElementById("vs-sys-spaces").textContent = ch.sp;
  document.getElementById("vs-profile").textContent = "x" + ch.prof;
  document.getElementById("vs-weight").textContent = ch.wt.replace(" lbs", "");
  document.getElementById("vs-mass").textContent = ch.mass;

  // Hits/Power
  document.getElementById("vs-basic-cost").textContent = veh.baseCost;
  document.getElementById("vs-hits").textContent = veh.hits;
  document.getElementById("vs-power").textContent = veh.power;
  document.getElementById("vs-explosion").textContent = veh.explosionDice;
  document.getElementById("vs-area").textContent = veh.explosionArea;

  // Armor (auto from chassis base + armor systems)
  document.getElementById("vs-armor-kin").value = a.kin;
  document.getElementById("vs-armor-eng").value = a.eng;
  document.getElementById("vs-armor-bio").value = a.bio;
  document.getElementById("vs-armor-ent").value = a.ent;
  document.getElementById("vs-armor-psy").value = a.psy;

  // Totals
  document.getElementById("vs-total-cost").textContent = veh.totalCost;
  document.getElementById("vs-spaces-used").textContent = veh.allocatedSpaces;
  document.getElementById("vs-spaces-remain").textContent = veh.remainingSpaces;
  document.getElementById("vs-spare-parts").textContent = veh.spareParts;

  // Stats
  document.getElementById("vs-st").textContent = veh.st;
  document.getElementById("vs-hth").textContent = MP.hthDamage(veh.st);
  document.getElementById("vs-en").textContent = veh.en;
  document.getElementById("vs-en-save").textContent = MP.save(veh.en);
  document.getElementById("vs-ag").textContent = veh.ag;
  document.getElementById("vs-ag-save").textContent = MP.save(veh.ag);
  document.getElementById("vs-handling").textContent = veh.handling;
  document.getElementById("vs-in").textContent = veh.intel;
  document.getElementById("vs-in-save").textContent = MP.save(veh.intel);
  document.getElementById("vs-cl").textContent = veh.cl;
  document.getElementById("vs-cl-save").textContent = MP.save(veh.cl);
  document.getElementById("vs-turn-rate").textContent = veh.turnRate;
  document.getElementById("vs-init").textContent = MP.initDie(MP.save(veh.cl));
  document.getElementById("vs-defense").textContent = veh.defense;
  document.getElementById("vs-carry").textContent = MP.carry(veh.st);

  // Systems table
  renderSystemsTable();
  renderWeaknesses();
  renderKey();
  if (editor) { editor.draw(); buildPalette(); }
  if (layoutEditor) layoutEditor.draw();
}

// ---- Systems table ----
function renderSystemsTable() {
  const el = document.getElementById("vs-sys-rows");
  if (!veh.systems.length) {
    el.innerHTML = '<div style="padding:6px;font-size:9px;color:var(--tx3);font-style:italic">No systems added yet</div>';
    return;
  }
  el.innerHTML = veh.systems.map(s => {
    const ab = MP.abilityById(s.abilityId);
    const name = s.abilityId === "custom" && s.customName ? s.customName : (ab?.name || "?");
    const cp = veh.sysCPs(s);
    const hits = veh.sysHits(s);
    const prof = veh.sysProfileDisplay(s);
    const active = editor && editor.activeSysId === s.id ? " active" : "";
    return `<div class="vs-sys-row${active}" data-id="${s.id}">
      <span class="vs-sys-val">${cp}</span>
      <span class="vs-sys-val">${s.spaces}</span>
      <span class="vs-sys-val">${prof}</span>
      <span class="vs-sys-val">${hits}</span>
      <input type="text" value="${s.dmg || ""}" data-field="dmg" data-id="${s.id}" placeholder="" title="Damage">
      <input type="text" value="${s.pts || ""}" data-field="pts" data-id="${s.id}" placeholder="" title="PTs">
      <input type="text" class="vs-sys-desc" value="${s.desc || name}" data-field="desc" data-id="${s.id}" title="Description, arc, facing">
      <span class="vs-sys-del" data-id="${s.id}" title="Remove">×</span>
    </div>`;
  }).join("");

  // Wire editable fields
  el.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("change", () => {
      const sys = veh.findSystem(parseInt(inp.dataset.id));
      if (sys) sys[inp.dataset.field] = inp.value;
    });
  });

  // Wire delete
  el.querySelectorAll(".vs-sys-del").forEach(del => {
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(del.dataset.id);
      veh.removeSystem(id);
      if (editor && editor.activeSysId === id) editor.activeSysId = null;
      updateAll();
    });
  });

  // Wire row click to select for painting
  el.querySelectorAll(".vs-sys-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.classList.contains("vs-sys-del")) return;
      const id = parseInt(row.dataset.id);
      if (editor) editor.setActiveSys(id);
      updateAll();
    });
  });
}

// ---- Weaknesses ----
function renderWeaknesses() {
  const el = document.getElementById("vs-wk-rows");
  if (!veh.weaknesses.length) {
    el.innerHTML = '<div style="padding:3px;font-size:9px;color:var(--tx3);font-style:italic">None</div>';
    return;
  }
  el.innerHTML = veh.weaknesses.map(w => {
    const def = MP.WEAKNESSES.find(d => d.id === w.weakId);
    return `<div class="vs-wk-row">
      <span>${def?.name || "?"}</span>
      <span><span class="vs-wk-cp">${def?.cpMod || 0}</span>
        <span class="vs-wk-del" data-id="${w.id}">×</span></span>
    </div>`;
  }).join("");
  el.querySelectorAll(".vs-wk-del").forEach(del => {
    del.addEventListener("click", () => {
      veh.removeWeakness(parseInt(del.dataset.id));
      updateAll();
    });
  });
}

// ---- Vehicle Key (legend for floor plan) ----
function renderKey() {
  const el = document.getElementById("vs-key");
  if (!veh.systems.length) {
    el.innerHTML = '<div style="font-size:9px;color:var(--tx3);font-style:italic">No systems</div>';
    return;
  }
  el.innerHTML = veh.systems.map(s => {
    const ab = MP.abilityById(s.abilityId);
    const name = s.abilityId === "custom" && s.customName ? s.customName : (ab?.name || "?");
    return `<div class="vs-key-item">
      <span class="vs-key-sw" style="background:${ab?.color || "#707070"}"></span>
      <span>${name} — ${s.spaces} spc, ${veh.sysCPs(s)} CPs</span>
    </div>`;
  }).join("");
}

// ---- Add system button ----
document.getElementById("btn-add-system").addEventListener("click", () => {
  const abilityId = document.getElementById("vs-add-ability").value;
  const spaces = parseInt(document.getElementById("vs-add-spaces").value) || 1;
  if (spaces > veh.remainingSpaces) {
    alert(`Not enough spaces. ${veh.remainingSpaces} remaining.`);
    return;
  }
  const sys = veh.addSystem(abilityId, spaces);
  if (sys) {
    // Pre-fill description with ability name
    const ab = MP.abilityById(abilityId);
    sys.desc = ab?.name || "";
  }
  updateAll();
});

// ---- Add weakness button ----
document.getElementById("btn-add-weakness-vs").addEventListener("click", () => {
  const weakId = document.getElementById("vs-add-weakness").value;
  if (!weakId) return;
  veh.addWeakness(weakId);
  updateAll();
});

// ---- Config change handlers ----
function onConfigChange() {
  veh.name = document.getElementById("vs-name").value;
  veh.model = document.getElementById("vs-model").value;
  veh.operator = document.getElementById("vs-operator").value;
  veh.chassisIdx = parseInt(document.getElementById("vs-chassis").value);
  veh.techMod = parseInt(document.getElementById("vs-tech").value);
  veh.maneuverMod = parseInt(document.getElementById("vs-maneuver").value);
  veh.wontExplode = document.getElementById("vs-noexplode").checked;
  veh.isBase = document.getElementById("vs-base").checked;
  veh.notes = document.getElementById("vs-notes").value;
  updateAll();
}

["vs-name","vs-model","vs-operator","vs-notes"].forEach(id => {
  document.getElementById(id).addEventListener("input", onConfigChange);
});
["vs-chassis","vs-tech","vs-maneuver"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
});
["vs-noexplode","vs-base"].forEach(id => {
  document.getElementById(id).addEventListener("change", onConfigChange);
});

// ---- Mode buttons (floor plan tab) ----
function updateModeButtons() {
  if (!editor) return;
  document.getElementById("btn-mode-select").classList.toggle("active", editor.mode === "select");
  document.getElementById("btn-mode-paint").classList.toggle("active", editor.mode === "paint");
  document.getElementById("btn-mode-erase").classList.toggle("active", editor.mode === "erase");
}

document.getElementById("btn-mode-select").addEventListener("click", () => {
  editor.setMode("select"); updateModeButtons();
});
document.getElementById("btn-mode-paint").addEventListener("click", () => {
  if (editor.activeSysId) editor.setMode("paint"); updateModeButtons();
});
document.getElementById("btn-mode-erase").addEventListener("click", () => {
  editor.setMode("erase"); updateModeButtons();
});
document.getElementById("btn-zoom-in").addEventListener("click", () => editor.zoomIn());
document.getElementById("btn-zoom-out").addEventListener("click", () => editor.zoomOut());
document.getElementById("btn-zoom-reset").addEventListener("click", () => editor.resetView());

// ---- Export ----
document.getElementById("btn-save").addEventListener("click", () => {
  veh.notes = document.getElementById("vs-notes").value;
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
      document.getElementById("vs-name").value = veh.name;
      document.getElementById("vs-model").value = veh.model;
      document.getElementById("vs-operator").value = veh.operator;
      document.getElementById("vs-chassis").value = veh.chassisIdx;
      document.getElementById("vs-tech").value = veh.techMod;
      document.getElementById("vs-maneuver").value = veh.maneuverMod;
      document.getElementById("vs-noexplode").checked = veh.wontExplode;
      document.getElementById("vs-base").checked = veh.isBase;
      document.getElementById("vs-notes").value = veh.notes;
      updateAll();
    } catch (err) { alert("Invalid JSON: " + err.message); }
  };
  reader.readAsText(e.target.files[0]);
  e.target.value = "";
});

document.getElementById("btn-csv").addEventListener("click", () => {
  veh.notes = document.getElementById("vs-notes").value;
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
buildChassisSelect();
buildAbilitySelect();
buildWeaknessSelect();

// Floor plan editor (full-size, on editor tab)
const canvasEl = document.getElementById("ed-canvas");
const wrapEl = document.getElementById("ed-canvas-wrap");
editor = new FloorPlanEditor(canvasEl, wrapEl, veh);
editor.onUpdate = () => { updateAll(); };
editor.panX = 40;
editor.panY = 40;

// Mini layout canvas on record sheet
const layoutCanvasEl = document.getElementById("vs-layout-canvas");
const layoutWrapEl = document.getElementById("vs-layout-wrap");
layoutEditor = new FloorPlanEditor(layoutCanvasEl, layoutWrapEl, veh);
layoutEditor.onUpdate = () => { updateAll(); };
layoutEditor.panX = 20;
layoutEditor.panY = 20;

updateAll();
