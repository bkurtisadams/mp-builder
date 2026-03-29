// mp-data.js v2.0.0 — Mighty Protectors Vehicle Builder data

const MP = {};

// ---- Chassis Table (Vehicle Construction Rules 3.3.1) ----
MP.CHASSIS = [
  {cp:0,   sp:2,   wt:"360 lbs",     mass:"d6",      prof:1.41,  st:15,en:15,hits:13},
  {cp:2.5, sp:3,   wt:"540 lbs",     mass:"d6+1",    prof:1.705, st:16,en:17,hits:15},
  {cp:5,   sp:4,   wt:"720 lbs",     mass:"d6+1",    prof:2,     st:18,en:18,hits:16},
  {cp:7.5, sp:6,   wt:"1,080 lbs",   mass:"d8+1",    prof:2.415, st:19,en:20,hits:18},
  {cp:10,  sp:8,   wt:"1,440 lbs",   mass:"d8+1",    prof:2.83,  st:21,en:21,hits:20},
  {cp:12.5,sp:12,  wt:"2,160 lbs",   mass:"d10+1",   prof:3.415, st:22,en:23,hits:23},
  {cp:15,  sp:16,  wt:"2,880 lbs",   mass:"d10+1",   prof:4,     st:24,en:24,hits:25},
  {cp:17.5,sp:24,  wt:"4,320 lbs",   mass:"2d6",     prof:4.83,  st:25,en:26,hits:27},
  {cp:20,  sp:32,  wt:"5,760 lbs",   mass:"2d6",     prof:5.66,  st:27,en:27,hits:29},
  {cp:22.5,sp:48,  wt:"8,640 lbs",   mass:"d6+d8",   prof:6.83,  st:28,en:29,hits:31},
  {cp:25,  sp:64,  wt:"11,520 lbs",  mass:"d6+d8",   prof:8,     st:30,en:30,hits:33},
  {cp:27.5,sp:96,  wt:"17,280 lbs",  mass:"2d8",     prof:9.655, st:31,en:32,hits:36},
  {cp:30,  sp:128, wt:"23,040 lbs",  mass:"2d8",     prof:11.31, st:33,en:33,hits:38},
  {cp:32.5,sp:192, wt:"34,560 lbs",  mass:"d8+d10",  prof:13.655,st:34,en:35,hits:40},
  {cp:35,  sp:256, wt:"46,080 lbs",  mass:"d8+d10",  prof:16,    st:36,en:36,hits:41},
  {cp:37.5,sp:384, wt:"69,120 lbs",  mass:"2d10",    prof:19.315,st:37,en:38,hits:44},
  {cp:40,  sp:512, wt:"92,160 lbs",  mass:"2d10",    prof:22.63, st:39,en:39,hits:46},
  {cp:42.5,sp:768, wt:"138,240 lbs", mass:"d10+d12", prof:27.315,st:40,en:41,hits:48},
  {cp:45,  sp:1024,wt:"184,320 lbs", mass:"d10+d12", prof:32,    st:42,en:42,hits:50},
];

// ---- System Spaces → CPs/Hits/Profile Table (full from rules) ----
// System spaces are allocated to an ability; lookup yields the CPs generated.
MP.SYS_TABLE = [
  {sp:1,      prof:1,       hits:8,  cp:5},
  {sp:2,      prof:1.41,    hits:13, cp:10},
  {sp:3,      prof:1.705,   hits:15, cp:12.5},
  {sp:4,      prof:2,       hits:16, cp:15},
  {sp:6,      prof:2.415,   hits:18, cp:17.5},
  {sp:8,      prof:2.83,    hits:20, cp:20},
  {sp:12,     prof:3.415,   hits:23, cp:22.5},
  {sp:16,     prof:4,       hits:25, cp:25},
  {sp:24,     prof:4.83,    hits:27, cp:27.5},
  {sp:32,     prof:5.66,    hits:29, cp:30},
  {sp:48,     prof:6.83,    hits:31, cp:32.5},
  {sp:64,     prof:8,       hits:33, cp:35},
  {sp:96,     prof:9.655,   hits:36, cp:37.5},
  {sp:128,    prof:11.31,   hits:38, cp:40},
  {sp:192,    prof:13.655,  hits:40, cp:42.5},
  {sp:256,    prof:16,      hits:41, cp:45},
  {sp:384,    prof:19.315,  hits:44, cp:47.5},
  {sp:512,    prof:22.63,   hits:46, cp:50},
  {sp:768,    prof:27.315,  hits:48, cp:52.5},
  {sp:1024,   prof:32,      hits:50, cp:55},
  {sp:1536,   prof:38.625,  hits:52, cp:57.5},
  {sp:2048,   prof:45.25,   hits:54, cp:60},
  {sp:3072,   prof:54.625,  hits:57, cp:62.5},
  {sp:4096,   prof:64,      hits:59, cp:65},
  {sp:6144,   prof:77.255,  hits:61, cp:67.5},
  {sp:8192,   prof:90.51,   hits:63, cp:70},
  {sp:12288,  prof:109.255, hits:65, cp:72.5},
  {sp:16384,  prof:128,     hits:66, cp:75},
  {sp:24576,  prof:154.51,  hits:69, cp:77.5},
  {sp:32768,  prof:181.02,  hits:71, cp:80},
  {sp:49152,  prof:218.51,  hits:73, cp:82.5},
  {sp:65536,  prof:256,     hits:75, cp:85},
  {sp:98304,  prof:309.017, hits:77, cp:87.5},
  {sp:131072, prof:362.034, hits:79, cp:90},
  {sp:196608, prof:437.017, hits:82, cp:92.5},
  {sp:262144, prof:512,     hits:84, cp:95},
  {sp:393216, prof:618.04,  hits:86, cp:97.5},
  {sp:524288, prof:724.08,  hits:88, cp:100},
];

MP.VALID_SPACES = MP.SYS_TABLE.map(s => s.sp);

MP.lookupSys = function(spaces) {
  for (let i = MP.SYS_TABLE.length - 1; i >= 0; i--) {
    if (MP.SYS_TABLE[i].sp <= spaces) return MP.SYS_TABLE[i];
  }
  return MP.SYS_TABLE[0];
};

MP.snapSpaces = function(val) {
  let best = MP.VALID_SPACES[0];
  for (const v of MP.VALID_SPACES) {
    if (Math.abs(v - val) < Math.abs(best - val)) best = v;
  }
  return best;
};

// ---- Full Abilities List (from MP rulebook) ----
// Each ability can be installed as a vehicle system.
// cat = palette category, color = canvas swatch,
// abbr = 2-char canvas label, fixed = fixed space count (0 = user picks)
MP.SYSTEM_TYPES = [
  // Crew & Structure
  { id:"control-seat",    cat:"Crew",       name:"Control Seat",       color:"#2a7a6a", fixed:1, abbr:"CS" },
  { id:"passenger-seat",  cat:"Crew",       name:"Passenger Seat",     color:"#2a7a6a", fixed:1, abbr:"PS" },
  { id:"bunk",            cat:"Crew",       name:"Bunk (double)",      color:"#2a7a6a", fixed:2, abbr:"BK" },
  { id:"hands",           cat:"Crew",       name:"Hands",              color:"#5a7a5a", fixed:0, abbr:"HN" },
  { id:"limbs",           cat:"Crew",       name:"Limbs",              color:"#4a6a4a", fixed:0, abbr:"LM" },

  // Movement
  { id:"flight",          cat:"Movement",   name:"Flight",             color:"#3a80c0", fixed:0, abbr:"FL" },
  { id:"speed",           cat:"Movement",   name:"Speed (Ground)",     color:"#3070b0", fixed:0, abbr:"SP" },
  { id:"swimming",        cat:"Movement",   name:"Swimming",           color:"#2a6a9a", fixed:0, abbr:"SW" },
  { id:"tunneling",       cat:"Movement",   name:"Tunneling",          color:"#4a5a80", fixed:0, abbr:"TN" },
  { id:"teleportation",   cat:"Movement",   name:"Teleportation",      color:"#6a50a0", fixed:0, abbr:"TP" },
  { id:"dimensional-travel", cat:"Movement",name:"Dimensional Travel", color:"#7a40a0", fixed:0, abbr:"DT" },

  // Offensive
  { id:"energy-blast",    cat:"Offensive",  name:"Energy Blast",       color:"#c03818", fixed:0, abbr:"EB" },
  { id:"projectile",      cat:"Offensive",  name:"Projectile",         color:"#a03020", fixed:0, abbr:"PJ" },
  { id:"missile",         cat:"Offensive",  name:"Missile Launcher",   color:"#902818", fixed:0, abbr:"MS" },
  { id:"disintegration",  cat:"Offensive",  name:"Disintegration Ray", color:"#b02040", fixed:0, abbr:"DR" },
  { id:"sonic-blast",     cat:"Offensive",  name:"Sonic Blast",        color:"#8a4080", fixed:0, abbr:"SB" },
  { id:"magnetic-blast",  cat:"Offensive",  name:"Magnetic Blast",     color:"#607090", fixed:0, abbr:"MB" },
  { id:"mind-control",    cat:"Offensive",  name:"Mind Control",       color:"#8060a0", fixed:0, abbr:"MC" },
  { id:"paralysis",       cat:"Offensive",  name:"Paralysis Ray",      color:"#705090", fixed:0, abbr:"PR" },
  { id:"devitalization",  cat:"Offensive",  name:"Devitalization Ray", color:"#604880", fixed:0, abbr:"DV" },
  { id:"chemical-power",  cat:"Offensive",  name:"Chemical Power",     color:"#508040", fixed:0, abbr:"CP" },
  { id:"tractor-beam",    cat:"Offensive",  name:"Tractor Beam",       color:"#506090", fixed:0, abbr:"TB" },

  // Defensive
  { id:"armor",           cat:"Defensive",  name:"Armor",              color:"#606068", fixed:0, abbr:"AR" },
  { id:"force-field",     cat:"Defensive",  name:"Force Field",        color:"#7060a0", fixed:0, abbr:"FF" },
  { id:"ecm",             cat:"Defensive",  name:"ECM",                color:"#506050", fixed:0, abbr:"EC" },
  { id:"adaptation",      cat:"Defensive",  name:"Adaptation",         color:"#508060", fixed:0, abbr:"AD" },
  { id:"reflection",      cat:"Defensive",  name:"Reflection",         color:"#607080", fixed:0, abbr:"RF" },
  { id:"absorption",      cat:"Defensive",  name:"Absorption",         color:"#606090", fixed:0, abbr:"AB" },
  { id:"invisibility",    cat:"Defensive",  name:"Invisibility",       color:"#505070", fixed:0, abbr:"IV" },
  { id:"phasing",         cat:"Defensive",  name:"Phasing",            color:"#606080", fixed:0, abbr:"PH" },

  // Sensors & Detection
  { id:"sensors",         cat:"Sensors",    name:"Sensor Suite",       color:"#a08020", fixed:0, abbr:"SN" },
  { id:"heightened-senses",cat:"Sensors",   name:"Heightened Senses",  color:"#908020", fixed:0, abbr:"HS" },
  { id:"radar",           cat:"Sensors",    name:"Radar/Sonar",        color:"#807020", fixed:0, abbr:"RD" },
  { id:"targeting",       cat:"Sensors",    name:"Targeting Computer", color:"#907030", fixed:0, abbr:"TC" },

  // Utility
  { id:"life-support",    cat:"Utility",    name:"Life Support",       color:"#308060", fixed:0, abbr:"LS" },
  { id:"regeneration",    cat:"Utility",    name:"Regeneration",       color:"#409050", fixed:0, abbr:"RG" },
  { id:"energy",          cat:"Utility",    name:"Energy (Power)",     color:"#a08020", fixed:0, abbr:"EN" },
  { id:"robot-brain",     cat:"Utility",    name:"Robot Brain (+IN)",  color:"#6060a0", fixed:0, abbr:"RB" },
  { id:"automation",      cat:"Utility",    name:"Automation (+AG)",   color:"#507090", fixed:0, abbr:"AU" },
  { id:"performance",     cat:"Utility",    name:"Performance (+CL)", color:"#806050", fixed:0, abbr:"PF" },
  { id:"size-change",     cat:"Utility",    name:"Size Change",        color:"#607050", fixed:0, abbr:"SC" },
  { id:"transformation",  cat:"Utility",    name:"Transformation",     color:"#707050", fixed:0, abbr:"TF" },
  { id:"healing",         cat:"Utility",    name:"Healing",            color:"#409060", fixed:0, abbr:"HL" },

  // Cargo & Custom
  { id:"cargo",           cat:"Cargo",      name:"Cargo / Empty",      color:"#4a4a42", fixed:0, abbr:"CG" },
  { id:"spare-parts",     cat:"Cargo",      name:"Spare Parts",        color:"#6a5a38", fixed:0, abbr:"PT" },
  { id:"garage",          cat:"Cargo",      name:"Garage / Hangar",    color:"#3a4a50", fixed:0, abbr:"GH" },
  { id:"custom",          cat:"Custom",     name:"Custom Ability",     color:"#707070", fixed:0, abbr:"??" },
];

MP.typeById = function(id) {
  return MP.SYSTEM_TYPES.find(t => t.id === id) || null;
};

MP.CATEGORIES = ["Crew","Movement","Offensive","Defensive","Sensors","Utility","Cargo","Custom"];

// ---- Weaknesses (cost reductions) ----
MP.WEAKNESSES = [
  { id:"diminished-senses",  name:"Diminished Senses",  cpMod:-5,  desc:"Reduced sensory capability" },
  { id:"distinctive",        name:"Distinctive",        cpMod:-5,  desc:"Easily identified or tracked" },
  { id:"low-self-control",   name:"Low Self-Control",   cpMod:-5,  desc:"Compulsive behavior or berserking" },
  { id:"reduced-ag",         name:"Reduced Agility",    cpMod:-2.5,desc:"-1 AG per application" },
  { id:"reduced-cl",         name:"Reduced Cool",       cpMod:-2.5,desc:"-1 CL per application" },
  { id:"reduced-en",         name:"Reduced Endurance",  cpMod:-2.5,desc:"-1 EN per application" },
  { id:"reduced-st",         name:"Reduced Strength",   cpMod:-2.5,desc:"-1 ST per application" },
  { id:"special-requirement",name:"Special Requirement",cpMod:-5,  desc:"Needs fuel, sunlight, etc." },
  { id:"susceptibility",     name:"Susceptibility",     cpMod:-5,  desc:"Takes extra damage from a source" },
  { id:"vulnerability",      name:"Vulnerability",      cpMod:-10, desc:"Major weakness to a damage type" },
  { id:"physical-disability",name:"Physical Disability",cpMod:-5,  desc:"Structural flaw or limitation" },
  { id:"no-hands",           name:"No Hands",           cpMod:-10, desc:"Cannot manipulate objects" },
  { id:"low-ground",         name:"Low Ground Speed",   cpMod:-5,  desc:"Ground speed reduced or absent" },
  { id:"custom-weakness",    name:"Custom Weakness",    cpMod:-5,  desc:"GM-defined weakness" },
];

// ---- System Modifiers ----
MP.MODIFIERS = [
  { id:"integral",     name:"Integral",       cpMod:"half",    desc:"Hidden, can't be targeted. Half CPs." },
  { id:"bulky",        name:"Bulky",          cpMod:2.5,       desc:"+4.3 Hits per app. +2.5 CP." },
  { id:"delicate",     name:"Delicate",       cpMod:-2.5,      desc:"-4.3 Hits per app. -2.5 CP." },
  { id:"gear",         name:"Gear",           cpMod:0,         desc:"Removable/breakable." },
  { id:"indep-power",  name:"Indep. Power",   cpMod:0,         desc:"Own 10 Power, independent." },
  { id:"no-arc",       name:"No Arc",         cpMod:-10,       desc:"Straight line only. -10 CP." },
  { id:"wide-240",     name:"Wide 240°",      cpMod:5,         desc:"240° arc. +5 CP." },
  { id:"wide-360",     name:"Wide 360°",      cpMod:10,        desc:"360° arc. +10 CP." },
  { id:"open",         name:"Open System",    cpMod:"quarter",  desc:"Passable, 1/4 CPs." },
  { id:"wont-explode", name:"Won't Explode",  cpMod:5,         desc:"+5 CP. Indep won't explode." },
];

MP.ARCS = ["Forward","Back","Fwd/Right","Fwd/Left","Back/Right","Back/Left"];

// ---- Derived Stat Functions ----
MP.save = function(score) { return Math.floor(score / 2) + 10; };

MP.hthDamage = function(st) {
  if (st <= 9) return "1";
  if (st <= 14) return "1d4";
  if (st <= 19) return "1d6";
  if (st <= 24) return "1d8";
  if (st <= 29) return "1d8+1";
  if (st <= 34) return "2d8";
  if (st <= 39) return "2d8+1";
  if (st <= 44) return "3d8";
  return "3d8+1";
};

MP.initDie = function(clSave) {
  if (clSave <= 10) return "d12";
  if (clSave <= 11) return "d10";
  if (clSave <= 12) return "d10+1";
  if (clSave <= 13) return "d8+1";
  if (clSave <= 14) return "d8+2";
  return "d6+3";
};

MP.carry = function(st) {
  const base = st * st * 2;
  if (base >= 1000000) return (base / 1000000).toFixed(1) + "M lbs";
  if (base >= 1000) return (base / 1000).toFixed(1) + "K lbs";
  return base + " lbs";
};
