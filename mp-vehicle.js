// mp-vehicle.js v2.3.0 — Systems with space budgets, extra CPs, no weaknesses

class Vehicle {
  constructor() {
    this.name = "";
    this.model = "";
    this.operator = "";
    this.chassisIdx = 6;
    this.techMod = 0;
    this.maneuverMod = 0;
    this.wontExplode = false;
    this.isBase = false;
    this.notes = "";
    this.systems = [];   // {id, abilityId, spaces, extraCPs, cells:[{gx,gy}], modifiers, arc, desc, customName, dmg, pts}
    this.keyEntries = []; // {id, label, desc}
    this._nextId = 1;
    this._nextKeyId = 1;
  }

  get chassis() { return MP.CHASSIS[this.chassisIdx]; }
  get totalSpaces() { return this.chassis.sp; }
  get allocatedSpaces() { return this.systems.reduce((s, sys) => s + sys.spaces, 0); }
  get placedCells() { return this.systems.reduce((s, sys) => s + sys.cells.length, 0); }
  get remainingSpaces() { return this.totalSpaces - this.allocatedSpaces; }

  addSystem(abilityId, spaces, extraCPs) {
    const ability = MP.abilityById(abilityId);
    if (!ability) return null;
    const sys = {
      id: this._nextId++,
      abilityId,
      spaces,
      extraCPs: extraCPs || 0,
      cells: [],
      modifiers: [],
      arc: "Forward",
      desc: "",
      customName: "",
      dmg: "",
      pts: "",
    };
    this.systems.push(sys);
    return sys;
  }

  removeSystem(id) {
    this.systems = this.systems.filter(s => s.id !== id);
  }

  findSystem(id) {
    return this.systems.find(s => s.id === id) || null;
  }

  paintCell(sysId, gx, gy) {
    const sys = this.findSystem(sysId);
    if (!sys) return false;
    if (sys.cells.length >= sys.spaces) return false;
    if (this.cellAt(gx, gy)) return false;
    sys.cells.push({ gx, gy });
    return true;
  }

  unpaintCell(gx, gy) {
    for (const sys of this.systems) {
      const idx = sys.cells.findIndex(c => c.gx === gx && c.gy === gy);
      if (idx >= 0) {
        sys.cells.splice(idx, 1);
        return sys;
      }
    }
    return null;
  }

  cellAt(gx, gy) {
    for (const sys of this.systems) {
      if (sys.cells.some(c => c.gx === gx && c.gy === gy)) return sys;
    }
    return null;
  }

  // Vehicle Key
  addKeyEntry(label, desc) {
    const entry = { id: this._nextKeyId++, label: label || "", desc: desc || "" };
    this.keyEntries.push(entry);
    return entry;
  }

  removeKeyEntry(id) {
    this.keyEntries = this.keyEntries.filter(k => k.id !== id);
  }

  // System CPs from space allocation + extra CPs + tech mod + modifiers
  sysCPs(sys) {
    const entry = MP.lookupSys(sys.spaces);
    let cp = entry.cp;
    cp += (sys.extraCPs || 0);
    cp += this.techMod;
    for (const m of sys.modifiers) {
      const def = MP.MODIFIERS.find(d => d.id === m.id);
      if (!def) continue;
      if (def.cpMod === "half") cp = Math.floor(cp / 2);
      else if (def.cpMod === "quarter") cp = Math.floor(cp / 4);
      else if (typeof def.cpMod === "number") cp += def.cpMod * (m.count || 1);
    }
    return Math.max(0, cp);
  }

  // System cost = extra CPs only (what goes in the COST column)
  sysCost(sys) {
    return sys.extraCPs || 0;
  }

  sysHits(sys) {
    const entry = MP.lookupSys(sys.spaces);
    let hits = entry.hits;
    for (const m of sys.modifiers) {
      if (m.id === "bulky") hits += Math.ceil(4.3 * (m.count || 1));
      if (m.id === "delicate") hits -= Math.ceil(4.3 * (m.count || 1));
    }
    return Math.max(1, hits);
  }

  sysProfile(sys) { return MP.lookupSys(sys.spaces).prof; }

  sysProfileDisplay(sys) {
    const p = this.sysProfile(sys);
    return "x" + (Number.isInteger(p) ? p : p.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }

  // ---- Computed vehicle stats ----
  get baseCost() { return this.chassis.cp; }

  get systemExtraCPs() {
    return this.systems.reduce((sum, s) => sum + (s.extraCPs || 0), 0);
  }

  get totalCost() {
    return this.baseCost + this.systemExtraCPs + this.techMod + this.maneuverMod + (this.wontExplode ? 5 : 0);
  }

  get st() { return this.chassis.st; }
  get en() { return this.chassis.en; }
  get ag() {
    let ag = 9;
    for (const s of this.systems) if (s.abilityId === "automation") ag += this.sysCPs(s);
    return ag;
  }
  get intel() {
    let v = 0;
    for (const s of this.systems) if (s.abilityId === "robot-brain") v += this.sysCPs(s);
    return v;
  }
  get cl() {
    let cl = 9;
    for (const s of this.systems) if (s.abilityId === "performance") cl += this.sysCPs(s);
    return cl;
  }
  get hits() { return this.chassis.hits; }
  get power() { return this.st + this.en + this.ag + this.intel; }
  get handling() { return MP.save(this.ag) - 10; }
  get turnRate() { return 3 + (this.maneuverMod / 5); }
  get armor() {
    let extra = 0;
    for (const s of this.systems) if (s.abilityId === "armor") extra += this.sysCPs(s);
    return { kin: 3 + extra, eng: 3 + extra, bio: 3 + extra, ent: 3 + extra, psy: 0 };
  }
  get explosionDice() {
    if (this.wontExplode) return "None";
    const cp = Math.max(0, this.totalCost);
    const d8s = 1 + Math.floor(cp / 5);
    const rem = cp % 5;
    let dice = d8s + "d8";
    if (rem > 0) dice += "+1d4";
    return dice;
  }
  get explosionArea() {
    const p = this.chassis.prof;
    const r = Math.ceil(p);
    return r % 2 === 0 ? r + 1 : r;
  }
  get defense() { return this.handling; }
  get spareParts() {
    let pts = 0;
    for (const s of this.systems) if (s.abilityId === "spare-parts") pts += s.spaces * 10;
    return pts;
  }

  // ---- Serialization ----
  toJSON() {
    return {
      version: 4, type: "mp-vehicle",
      name: this.name, model: this.model, operator: this.operator,
      chassisIdx: this.chassisIdx, techMod: this.techMod,
      maneuverMod: this.maneuverMod, wontExplode: this.wontExplode,
      isBase: this.isBase, notes: this.notes,
      systems: this.systems, keyEntries: this.keyEntries,
    };
  }

  fromJSON(data) {
    this.name = data.name || "";
    this.model = data.model || "";
    this.operator = data.operator || "";
    this.chassisIdx = data.chassisIdx ?? 6;
    this.techMod = data.techMod || 0;
    this.maneuverMod = data.maneuverMod || 0;
    this.wontExplode = data.wontExplode || false;
    this.isBase = data.isBase || false;
    this.notes = data.notes || "";
    this.systems = (data.systems || []).map(s => {
      s.cells = s.cells || [];
      s.extraCPs = s.extraCPs || 0;
      return s;
    });
    this.keyEntries = data.keyEntries || [];
    this._nextId = Math.max(1, ...this.systems.map(s => s.id), 0) + 1;
    this._nextKeyId = Math.max(1, ...this.keyEntries.map(k => k.id), 0) + 1;
  }

  toCSV() {
    const rows = [];
    rows.push(["Name", this.name]);
    rows.push(["Model", this.model]);
    rows.push(["Operator", this.operator]);
    rows.push(["Base CPs", this.baseCost]);
    rows.push(["Total Cost", this.totalCost]);
    rows.push(["System Spaces", this.totalSpaces]);
    rows.push(["Allocated", this.allocatedSpaces]);
    rows.push(["Remaining", this.remainingSpaces]);
    rows.push(["Profile", "x" + this.chassis.prof]);
    rows.push(["Weight", this.chassis.wt]);
    rows.push(["Mass", this.chassis.mass]);
    rows.push(["Hits", this.hits]);
    rows.push(["Power", this.power]);
    const a = this.armor;
    rows.push(["Armor K/E/B/Ent/Psy", `${a.kin}/${a.eng}/${a.bio}/${a.ent}/${a.psy}`]);
    rows.push(["Explosion", this.explosionDice]);
    rows.push(["Area", this.explosionArea + '"']);
    rows.push(["ST", this.st]); rows.push(["EN", this.en]);
    rows.push(["AG", this.ag]); rows.push(["IN", this.intel]); rows.push(["CL", this.cl]);
    rows.push(["Base HTH", MP.hthDamage(this.st)]);
    rows.push(["EN Save", MP.save(this.en)]); rows.push(["AG Save", MP.save(this.ag)]);
    rows.push(["Handling", this.handling]);
    rows.push(["IN Save", MP.save(this.intel)]); rows.push(["CL Save", MP.save(this.cl)]);
    rows.push(["Turn Rate", this.turnRate]);
    rows.push(["Initiative", MP.initDie(MP.save(this.cl))]);
    rows.push(["Defense", this.defense]); rows.push(["Carry", MP.carry(this.st)]);
    rows.push(["Spare Parts", this.spareParts]);
    rows.push([]);
    rows.push(["Extra CPs","Spaces","Profile","Hits","CPs from Spaces","DMG","PTs","Description"]);
    for (const s of this.systems) {
      const ab = MP.abilityById(s.abilityId);
      const dname = s.abilityId === "custom" && s.customName ? s.customName : (ab?.name || "?");
      const spaceCPs = MP.lookupSys(s.spaces).cp;
      rows.push([s.extraCPs || 0, s.spaces, this.sysProfileDisplay(s), this.sysHits(s),
        spaceCPs, s.dmg || "", s.pts || "",
        `${dname}${s.desc ? ", " + s.desc : ""}${s.arc ? ", " + s.arc : ""}`]);
    }
    if (this.keyEntries.length) {
      rows.push([]); rows.push(["Vehicle Key"]);
      for (const k of this.keyEntries) {
        rows.push([k.label, k.desc]);
      }
    }
    return rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  }
}
