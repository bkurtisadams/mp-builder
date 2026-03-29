// mp-data.js v1.0.0

const MP = {};

MP.CHASSIS = [
  {cp:0,sp:2,wt:"360 lbs",mass:"d6",prof:1.41,st:15,en:15,hits:13},
  {cp:2.5,sp:3,wt:"540 lbs",mass:"d6+1",prof:1.705,st:16,en:17,hits:15},
  {cp:5,sp:4,wt:"720 lbs",mass:"d6+1",prof:2,st:18,en:18,hits:16},
  {cp:7.5,sp:6,wt:"1,080 lbs",mass:"d8+1",prof:2.415,st:19,en:20,hits:18},
  {cp:10,sp:8,wt:"1,440 lbs",mass:"d8+1",prof:2.83,st:21,en:21,hits:20},
  {cp:12.5,sp:12,wt:"2,160 lbs",mass:"d10+1",prof:3.415,st:22,en:23,hits:23},
  {cp:15,sp:16,wt:"2,880 lbs",mass:"d10+1",prof:4,st:24,en:24,hits:25},
  {cp:17.5,sp:24,wt:"4,320 lbs",mass:"2d6",prof:4.83,st:25,en:26,hits:27},
  {cp:20,sp:32,wt:"5,760 lbs",mass:"2d6",prof:5.66,st:27,en:27,hits:29},
  {cp:22.5,sp:48,wt:"8,640 lbs",mass:"d6+d8",prof:6.83,st:28,en:29,hits:31},
  {cp:25,sp:64,wt:"11,520 lbs",mass:"d6+d8",prof:8,st:30,en:30,hits:33},
  {cp:27.5,sp:96,wt:"17,280 lbs",mass:"2d8",prof:9.655,st:31,en:32,hits:36},
  {cp:30,sp:128,wt:"23,040 lbs",mass:"2d8",prof:11.31,st:33,en:33,hits:38},
  {cp:32.5,sp:192,wt:"34,560 lbs",mass:"d8+d10",prof:13.655,st:34,en:35,hits:40},
  {cp:35,sp:256,wt:"46,080 lbs",mass:"d8+d10",prof:16,st:36,en:36,hits:41},
  {cp:37.5,sp:384,wt:"69,120 lbs",mass:"2d10",prof:19.315,st:37,en:38,hits:44},
  {cp:40,sp:512,wt:"92,160 lbs",mass:"2d10",prof:22.63,st:39,en:39,hits:46},
  {cp:42.5,sp:768,wt:"138,240 lbs",mass:"d10+d12",prof:27.315,st:40,en:41,hits:48},
  {cp:45,sp:1024,wt:"184,320 lbs",mass:"d10+d12",prof:32,st:42,en:42,hits:50},
];

MP.SYS_TABLE = [
  {sp:1,prof:1,hits:8,cp:5},
  {sp:2,prof:1.41,hits:13,cp:10},
  {sp:3,prof:1.705,hits:15,cp:12.5},
  {sp:4,prof:2,hits:16,cp:15},
  {sp:6,prof:2.415,hits:18,cp:17.5},
  {sp:8,prof:2.83,hits:20,cp:20},
  {sp:12,prof:3.415,hits:23,cp:22.5},
  {sp:16,prof:4,hits:25,cp:25},
  {sp:24,prof:4.83,hits:27,cp:27.5},
  {sp:32,prof:5.66,hits:29,cp:30},
  {sp:48,prof:6.83,hits:31,cp:32.5},
  {sp:64,prof:8,hits:33,cp:35},
  {sp:96,prof:9.655,hits:36,cp:37.5},
  {sp:128,prof:11.31,hits:38,cp:40},
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

MP.SYSTEM_TYPES = [
  { id:"control-seat",   cat:"Crew",     name:"Control Seat",      color:"#2a9d8f", fixed:1, abbr:"CS" },
  { id:"passenger-seat", cat:"Crew",     name:"Passenger Seat",    color:"#2a9d8f", fixed:1, abbr:"PS" },
  { id:"bunk",           cat:"Crew",     name:"Bunk (double)",     color:"#2a9d8f", fixed:2, abbr:"BK" },
  { id:"flight",         cat:"Movement", name:"Flight",            color:"#4a90d9", fixed:0, abbr:"FL" },
  { id:"speed",          cat:"Movement", name:"Speed (Ground)",    color:"#4a7ad9", fixed:0, abbr:"SP" },
  { id:"swimming",       cat:"Movement", name:"Swimming",          color:"#3a8abf", fixed:0, abbr:"SW" },
  { id:"tunneling",      cat:"Movement", name:"Tunneling",         color:"#5a6a9f", fixed:0, abbr:"TN" },
  { id:"energy-blast",   cat:"Weapon",   name:"Energy Blast",      color:"#d04820", fixed:0, abbr:"EB" },
  { id:"projectile",     cat:"Weapon",   name:"Projectile",        color:"#c04428", fixed:0, abbr:"PJ" },
  { id:"missile",        cat:"Weapon",   name:"Missile Launcher",  color:"#b03820", fixed:0, abbr:"MS" },
  { id:"armor",          cat:"Defense",  name:"Armor",             color:"#7a7a80", fixed:0, abbr:"AR" },
  { id:"force-field",    cat:"Defense",  name:"Force Field",       color:"#9a7ac0", fixed:0, abbr:"FF" },
  { id:"ecm",            cat:"Defense",  name:"ECM",               color:"#6a8a70", fixed:0, abbr:"EC" },
  { id:"sensors",        cat:"Sensors",  name:"Sensor Suite",      color:"#d0a030", fixed:0, abbr:"SN" },
  { id:"life-support",   cat:"Utility",  name:"Life Support",      color:"#40a070", fixed:0, abbr:"LS" },
  { id:"regeneration",   cat:"Utility",  name:"Regeneration",      color:"#50b060", fixed:0, abbr:"RG" },
  { id:"energy",         cat:"Utility",  name:"Energy (Power)",    color:"#c0a020", fixed:0, abbr:"EN" },
  { id:"robot-brain",    cat:"Utility",  name:"Robot Brain (+IN)", color:"#8080c0", fixed:0, abbr:"RB" },
  { id:"automation",     cat:"Utility",  name:"Automation (+AG)",  color:"#6090b0", fixed:0, abbr:"AU" },
  { id:"performance",    cat:"Utility",  name:"Performance (+CL)", color:"#a07050", fixed:0, abbr:"PF" },
  { id:"custom",         cat:"Custom",   name:"Custom Ability",    color:"#909090", fixed:0, abbr:"??" },
  { id:"cargo",          cat:"Cargo",    name:"Cargo / Empty",     color:"#5a5a50", fixed:0, abbr:"CG" },
  { id:"spare-parts",    cat:"Cargo",    name:"Spare Parts",       color:"#8a6a40", fixed:0, abbr:"PT" },
  { id:"garage",         cat:"Cargo",    name:"Garage / Hangar",   color:"#4a5a60", fixed:0, abbr:"GH" },
  { id:"hands",          cat:"Crew",     name:"Hands",             color:"#7a8a6a", fixed:0, abbr:"HN" },
  { id:"limbs",          cat:"Crew",     name:"Limbs",             color:"#6a7a6a", fixed:0, abbr:"LM" },
];

MP.typeById = function(id) {
  return MP.SYSTEM_TYPES.find(t => t.id === id) || null;
};

MP.CATEGORIES = ["Crew","Movement","Weapon","Defense","Sensors","Utility","Custom","Cargo"];

MP.MODIFIERS = [
  { id:"integral",     name:"Integral",       cpMod:"half",   desc:"Hidden, can't be targeted. Half CPs." },
  { id:"bulky",        name:"Bulky",          cpMod:2.5,      desc:"+4.3 Hits per app. +2.5 CP." },
  { id:"delicate",     name:"Delicate",       cpMod:-2.5,     desc:"-4.3 Hits per app. -2.5 CP." },
  { id:"gear",         name:"Gear",           cpMod:0,        desc:"Removable/breakable." },
  { id:"indep-power",  name:"Indep. Power",   cpMod:0,        desc:"Own 10 Power, independent." },
  { id:"no-arc",       name:"No Arc",         cpMod:-10,      desc:"Straight line only. -10 CP." },
  { id:"wide-240",     name:"Wide 240°",      cpMod:5,        desc:"240° arc. +5 CP." },
  { id:"wide-360",     name:"Wide 360°",      cpMod:10,       desc:"360° arc. +10 CP." },
  { id:"open",         name:"Open System",    cpMod:"quarter", desc:"Passable, 1/4 CPs." },
  { id:"wont-explode", name:"Won't Explode",  cpMod:5,        desc:"+5 CP. Indep won't explode." },
];

MP.ARCS = ["Forward","Back","Fwd/Right","Fwd/Left","Back/Right","Back/Left"];

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
