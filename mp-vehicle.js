// mp-vehicle.js v1.0.0 — Vehicle state model

class Vehicle {
  constructor() {
    this.name = "";
    this.model = "";
    this.operator = "";
    this.chassisIdx = 6; // default (15) = 16 spaces
    this.techMod = 0;
    this.maneuverMod = 0;
    this.wontExplode = false;
    this.isBase = false;
    this.notes = "";
    this.pictureUrl = "";
    this.systems = [];   // placed system pieces
    this._nextId = 1;
  }

  get chassis() { return MP.CHASSIS[this.chassisIdx]; }
  get totalSpaces() { return this.chassis.sp; }
  get usedSpaces() { return this.systems.reduce((s, p) => s + p.spaces, 0); }
  get remainingSpaces() { return this.totalSpaces - this.usedSpaces; }

  // Add a system (from palette placement on canvas)
  addSystem(typeId, spaces, gx, gy, gw, gh) {
    const type = MP.typeById(typeId);
    if (!type) return null;
    const actualSpaces = type.fixed || spaces || 1;
    const sys = {
      id: this._nextId++,
      typeId,
      spaces: actualSpaces,
      gx, gy, gw, gh,  // grid position and size on canvas
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

  // System CP calculation
  sysCPs(sys) {
    const entry = MP.lookupSys(sys.spaces);
    let cp = entry.cp;
    // Tech mod: +/-5 per tier to each system
    cp += this.techMod;
    // System modifiers
    for (const m of sys.modifiers) {
      const def = MP.MODIFIERS.find(d => d.id === m.id);
      if (!def) continue;
      if (def.cpMod === "half") cp = Math.floor(cp / 2);
      else if (def.cpMod === "quarter") cp = Math.floor(cp / 4);
      else if (typeof def.cpMod === "number") cp += def.cpMod * (m.count || 1);
    }
    return Math.max(0, cp);
  }

  // System hits after bulky/delicate
  sysHits(sys) {
    const entry = MP.lookupSys(sys.spaces);
    let hits = entry.hits;
    for (const m of sys.modifiers) {
      if (m.id === "bulky") hits += Math.ceil(4.3 * (m.count || 1));
      if (m.id === "delicate") hits -= Math.ceil(4.3 * (m.count || 1));
    }
    return Math.max(1, hits);
  }

  // System profile
  sysProfile(sys) {
    return MP.lookupSys(sys.spaces).prof;
  }

  // Profile display (as multiplier like the sheet)
  sysProfileDisplay(sys) {
    const p = this.sysProfile(sys);
    return "x" + (Number.isInteger(p) ? p : p.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }

  // ---- Computed vehicle stats ----

  get baseCost() { return this.chassis.cp; }

  get totalCost() {
    let c = this.baseCost;
    // Tech mod is already a CP adjustment to each system, but also adjusts vehicle cost
    // Per rules: "For each (+5) adjustment to the total cost..."
    c += Math.abs(this.techMod); // tech mod cost is always added as positive adjustment
    if (this.techMod < 0) c -= Math.abs(this.techMod) * 2; // discount = subtract
    c += Math.abs(this.maneuverMod);
    if (this.maneuverMod < 0) c -= Math.abs(this.maneuverMod) * 2;
    if (this.wontExplode) c += 5;
    return this.baseCost + this.techMod + this.maneuverMod + (this.wontExplode ? 5 : 0);
  }

  get st() { return this.chassis.st; }
  get en() { return this.chassis.en; }

  get ag() {
    let ag = 9;
    for (const s of this.systems) {
      if (s.typeId === "automation") ag += this.sysCPs(s);
    }
    return ag;
  }

  get intel() {
    let v = 0;
    for (const s of this.systems) {
      if (s.typeId === "robot-brain") v += this.sysCPs(s);
    }
    return v;
  }

  get cl() {
    let cl = 9;
    for (const s of this.systems) {
      if (s.typeId === "performance") cl += this.sysCPs(s);
    }
    return cl;
  }

  get power() { return this.st + this.en + this.ag + this.intel; }
  get handling() { return MP.save(this.ag) - 10; }
  get turnRate() { return 3 + (this.maneuverMod / 5); }

  get armor() {
    // Base SR = 3 for Kin/Eng/Bio/Ent, 0 for Psychic
    let extra = 0;
    for (const s of this.systems) {
      if (s.typeId === "armor") extra += this.sysCPs(s);
    }
    return { kin: 3 + extra, eng: 3 + extra, bio: 3 + extra, ent: 3 + extra, psy: 0 };
  }

  get explosionDice() {
    if (this.wontExplode) return "None";
    const cp = this.totalCost;
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

  get defense() {
    // Vehicle Defense = pilot AG save - 10 + handling
    // Without pilot, just handling
    return this.handling;
  }

  get spareParts() {
    let pts = 0;
    for (const s of this.systems) {
      if (s.typeId === "spare-parts") pts += s.spaces * 10;
    }
    return pts;
  }

  // ---- Serialization ----

  toJSON() {
    return {
      version: 1, type: "mp-vehicle",
      name: this.name, model: this.model, operator: this.operator,
      chassisIdx: this.chassisIdx, techMod: this.techMod,
      maneuverMod: this.maneuverMod, wontExplode: this.wontExplode,
      isBase: this.isBase, notes: this.notes, pictureUrl: this.pictureUrl,
      systems: this.systems,
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
    this.pictureUrl = data.pictureUrl || "";
    this.systems = data.systems || [];
    this._nextId = Math.max(1, ...this.systems.map(s => s.id)) + 1;
  }

  toCSV() {
    const rows = [];
    rows.push(["Name", this.name]);
    rows.push(["Model", this.model]);
    rows.push(["Operator", this.operator]);
    rows.push(["Base CPs", this.baseCost]);
    rows.push(["Total Cost", this.totalCost]);
    rows.push(["System Spaces", this.totalSpaces]);
    rows.push(["Spaces Used", this.usedSpaces]);
    rows.push(["Remaining", this.remainingSpaces]);
    rows.push(["Profile", "x" + this.chassis.prof]);
    rows.push(["Weight", this.chassis.wt]);
    rows.push(["Mass", this.chassis.mass]);
    rows.push(["Hits", this.chassis.hits]);
    rows.push(["Power", this.power]);
    const a = this.armor;
    rows.push(["Armor Kin/Eng/Bio/Ent/Psy", `${a.kin}/${a.eng}/${a.bio}/${a.ent}/${a.psy}`]);
    rows.push(["Explosion", this.explosionDice]);
    rows.push(["Explosion Area", this.explosionArea + '"']);
    rows.push(["ST", this.st]);
    rows.push(["EN", this.en]);
    rows.push(["AG", this.ag]);
    rows.push(["IN", this.intel]);
    rows.push(["CL", this.cl]);
    rows.push(["Base HTH", MP.hthDamage(this.st)]);
    rows.push(["EN Save", MP.save(this.en)]);
    rows.push(["AG Save", MP.save(this.ag)]);
    rows.push(["Handling", this.handling]);
    rows.push(["IN Save", MP.save(this.intel)]);
    rows.push(["CL Save", MP.save(this.cl)]);
    rows.push(["Turn Rate", this.turnRate]);
    rows.push(["Initiative", MP.initDie(MP.save(this.cl))]);
    rows.push(["Defense", this.defense]);
    rows.push(["Carry", MP.carry(this.st)]);
    rows.push(["Spare Parts", this.spareParts]);
    rows.push([]);
    rows.push(["Cost","Spaces","Profile","Hits","DMG","PTs","Description"]);
    for (const s of this.systems) {
      const type = MP.typeById(s.typeId);
      const dname = s.typeId === "custom" && s.customName ? s.customName : (type?.name || "?");
      rows.push([
        this.sysCPs(s), s.spaces, this.sysProfileDisplay(s),
        this.sysHits(s), s.dmg || "", s.pts || "",
        `${dname}${s.desc ? ", " + s.desc : ""}${s.arc ? ", " + s.arc : ""}`
      ]);
    }
    return rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  }
}
