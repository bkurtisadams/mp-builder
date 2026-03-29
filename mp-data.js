// mp-data.js v2.2.0 — Full MP abilities from rulebook

const MP = {};

// ---- Chassis Table ----
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

// ---- System Spaces → CPs/Hits/Profile (full table from rules) ----
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

// ---- Ability Types (from MP rulebook 2.1.15) ----
// cat matches the three rulebook tables plus vehicle-specific and structural
// color = canvas cell color, abbr = 2-char label on canvas
MP.ABILITY_TYPES = [
  // --- Offensive Abilities ---
  { id:"absorption",           cat:"Offensive",  name:"Absorption",           color:"#6060a0", abbr:"AB" },
  { id:"chemical-abilities",   cat:"Offensive",  name:"Chemical Abilities",   color:"#508040", abbr:"CH" },
  { id:"death-touch",          cat:"Offensive",  name:"Death Touch",          color:"#802040", abbr:"DT" },
  { id:"devitalization-ray",   cat:"Offensive",  name:"Devitalization Ray",   color:"#604880", abbr:"DV" },
  { id:"disintegration",       cat:"Offensive",  name:"Disintegration",       color:"#b02040", abbr:"DI" },
  { id:"emotion-control",      cat:"Offensive",  name:"Emotion Control",      color:"#9060a0", abbr:"EC" },
  { id:"energy-blast",         cat:"Offensive",  name:"Energy Blast",         color:"#c03818", abbr:"EB" },
  { id:"experience-levels",    cat:"Offensive",  name:"Experience Levels",    color:"#707050", abbr:"XL" },
  { id:"flame-abilities",      cat:"Offensive",  name:"Flame Abilities",      color:"#c06020", abbr:"FL" },
  { id:"force-field",          cat:"Offensive",  name:"Force Field",          color:"#7060a0", abbr:"FF" },
  { id:"grapnel",              cat:"Offensive",  name:"Grapnel",              color:"#706050", abbr:"GR" },
  { id:"gravity-control",      cat:"Offensive",  name:"Gravity Control",      color:"#505080", abbr:"GC" },
  { id:"heightened-agility",   cat:"Offensive",  name:"Heightened Agility",   color:"#408080", abbr:"HA" },
  { id:"heightened-attack",    cat:"Offensive",  name:"Heightened Attack",    color:"#a04030", abbr:"HK" },
  { id:"heightened-expertise", cat:"Offensive",  name:"Heightened Expertise", color:"#806040", abbr:"HX" },
  { id:"heightened-strength",  cat:"Offensive",  name:"Heightened Strength",  color:"#804030", abbr:"HS" },
  { id:"ice-abilities",        cat:"Offensive",  name:"Ice Abilities",        color:"#4090b0", abbr:"IC" },
  { id:"light-control",        cat:"Offensive",  name:"Light Control",        color:"#b0a030", abbr:"LC" },
  { id:"lightning-control",    cat:"Offensive",  name:"Lightning Control",    color:"#6080c0", abbr:"LN" },
  { id:"magnetism",            cat:"Offensive",  name:"Magnetism",            color:"#607090", abbr:"MG" },
  { id:"mind-control",         cat:"Offensive",  name:"Mind Control",         color:"#8060a0", abbr:"MC" },
  { id:"natural-weaponry",     cat:"Offensive",  name:"Natural Weaponry",     color:"#706040", abbr:"NW" },
  { id:"paralysis-ray",        cat:"Offensive",  name:"Paralysis Ray",        color:"#705090", abbr:"PR" },
  { id:"poison-venom",         cat:"Offensive",  name:"Poison/Venom",         color:"#608030", abbr:"PV" },
  { id:"power-blast",          cat:"Offensive",  name:"Power Blast",          color:"#b04040", abbr:"PB" },
  { id:"reflection",           cat:"Offensive",  name:"Reflection",           color:"#607080", abbr:"RF" },
  { id:"repulsion-blast",      cat:"Offensive",  name:"Repulsion Blast",      color:"#5070a0", abbr:"RB" },
  { id:"shaping",              cat:"Offensive",  name:"Shaping",              color:"#607050", abbr:"SH" },
  { id:"siphon",               cat:"Offensive",  name:"Siphon",               color:"#804060", abbr:"SI" },
  { id:"sonic-abilities",      cat:"Offensive",  name:"Sonic Abilities",      color:"#8a4080", abbr:"SO" },
  { id:"special-weapon",       cat:"Offensive",  name:"Special Weapon",       color:"#806050", abbr:"SW" },
  { id:"telekinesis",          cat:"Offensive",  name:"Telekinesis",          color:"#6060a0", abbr:"TK" },
  { id:"transmutation",        cat:"Offensive",  name:"Transmutation",        color:"#607060", abbr:"TM" },
  { id:"vibration-abilities",  cat:"Offensive",  name:"Vibration Abilities",  color:"#708060", abbr:"VB" },
  { id:"weakness-detection",   cat:"Offensive",  name:"Weakness Detection",   color:"#806060", abbr:"WD" },
  { id:"weather-control",      cat:"Offensive",  name:"Weather Control",      color:"#507090", abbr:"WC" },

  // --- Defensive Abilities ---
  { id:"adaptation",           cat:"Defensive",  name:"Adaptation",           color:"#508060", abbr:"AD" },
  { id:"armor",                cat:"Defensive",  name:"Armor",                color:"#606068", abbr:"AR" },
  { id:"astral-projection",    cat:"Defensive",  name:"Astral Projection",    color:"#706090", abbr:"AP" },
  { id:"darkness-control",     cat:"Defensive",  name:"Darkness Control",     color:"#404060", abbr:"DC" },
  { id:"density-change",       cat:"Defensive",  name:"Density Change",       color:"#606070", abbr:"DN" },
  { id:"durability",           cat:"Defensive",  name:"Durability",           color:"#607058", abbr:"DU" },
  { id:"heightened-defense",   cat:"Defensive",  name:"Heightened Defense",   color:"#407060", abbr:"HD" },
  { id:"heightened-endurance", cat:"Defensive",  name:"Heightened Endurance", color:"#406050", abbr:"HE" },
  { id:"invisibility",         cat:"Defensive",  name:"Invisibility",         color:"#505070", abbr:"IV" },
  { id:"invulnerability",      cat:"Defensive",  name:"Invulnerability",      color:"#506068", abbr:"IN" },
  { id:"life-support",         cat:"Defensive",  name:"Life Support",         color:"#308060", abbr:"LS" },
  { id:"non-corporealness",    cat:"Defensive",  name:"Non-Corporealness",    color:"#606080", abbr:"NC" },
  { id:"regeneration",         cat:"Defensive",  name:"Regeneration",         color:"#409050", abbr:"RG" },
  { id:"shield",               cat:"Defensive",  name:"Shield",               color:"#506070", abbr:"SD" },
  { id:"stretching-abilities", cat:"Defensive",  name:"Stretching Abilities", color:"#607058", abbr:"ST" },

  // --- Miscellaneous Abilities ---
  { id:"animal-plant",         cat:"Miscellaneous", name:"Animal/Plant Abilities", color:"#508040", abbr:"AP" },
  { id:"arsenal",              cat:"Miscellaneous", name:"Arsenal",                color:"#706050", abbr:"AS" },
  { id:"base",                 cat:"Miscellaneous", name:"Base",                   color:"#505860", abbr:"BA" },
  { id:"communicators",        cat:"Miscellaneous", name:"Communicators",          color:"#507070", abbr:"CM" },
  { id:"companion",            cat:"Miscellaneous", name:"Companion",              color:"#607050", abbr:"CO" },
  { id:"cosmic-awareness",     cat:"Miscellaneous", name:"Cosmic Awareness",       color:"#6050a0", abbr:"CA" },
  { id:"cybernetics",          cat:"Miscellaneous", name:"Cybernetics",            color:"#606878", abbr:"CY" },
  { id:"dimensional-travel",   cat:"Miscellaneous", name:"Dimensional Travel",     color:"#7a40a0", abbr:"DM" },
  { id:"duplication",          cat:"Miscellaneous", name:"Duplication",            color:"#606070", abbr:"DP" },
  { id:"energy",               cat:"Miscellaneous", name:"Energy",                 color:"#a08020", abbr:"EN" },
  { id:"flight",               cat:"Miscellaneous", name:"Flight",                 color:"#3a80c0", abbr:"FT" },
  { id:"healing",              cat:"Miscellaneous", name:"Healing",                color:"#409060", abbr:"HL" },
  { id:"heightened-cool",      cat:"Miscellaneous", name:"Heightened Cool",        color:"#406080", abbr:"HC" },
  { id:"heightened-initiative",cat:"Miscellaneous", name:"Heightened Initiative",  color:"#507060", abbr:"HI" },
  { id:"heightened-intelligence",cat:"Miscellaneous",name:"Heightened Intelligence",color:"#506080",abbr:"HQ" },
  { id:"heightened-senses",    cat:"Miscellaneous", name:"Heightened Senses",      color:"#908020", abbr:"HS" },
  { id:"illusions",            cat:"Miscellaneous", name:"Illusions",              color:"#806090", abbr:"IL" },
  { id:"inventing",            cat:"Miscellaneous", name:"Inventing",              color:"#607050", abbr:"IV" },
  { id:"knowledge",            cat:"Miscellaneous", name:"Knowledge",              color:"#606048", abbr:"KN" },
  { id:"luck",                 cat:"Miscellaneous", name:"Luck",                   color:"#a09030", abbr:"LK" },
  { id:"mental-ability",       cat:"Miscellaneous", name:"Mental Ability",         color:"#6060a0", abbr:"MA" },
  { id:"negation",             cat:"Miscellaneous", name:"Negation",               color:"#705060", abbr:"NG" },
  { id:"physical-ability",     cat:"Miscellaneous", name:"Physical Ability",       color:"#607048", abbr:"PA" },
  { id:"revivification",       cat:"Miscellaneous", name:"Revivification",         color:"#408050", abbr:"RV" },
  { id:"shape-shifting",       cat:"Miscellaneous", name:"Shape-Shifting",         color:"#607060", abbr:"SS" },
  { id:"size-change",          cat:"Miscellaneous", name:"Size Change",            color:"#607050", abbr:"SC" },
  { id:"speed",                cat:"Miscellaneous", name:"Speed",                  color:"#3070b0", abbr:"SP" },
  { id:"summoning",            cat:"Miscellaneous", name:"Summoning",              color:"#706060", abbr:"SU" },
  { id:"super-speed",          cat:"Miscellaneous", name:"Super Speed",            color:"#3060c0", abbr:"SS" },
  { id:"swimming",             cat:"Miscellaneous", name:"Swimming",               color:"#2a6a9a", abbr:"SM" },
  { id:"telepathy",            cat:"Miscellaneous", name:"Telepathy",              color:"#7060a0", abbr:"TP" },
  { id:"teleportation",        cat:"Miscellaneous", name:"Teleportation",          color:"#6a50a0", abbr:"TL" },
  { id:"transformation",       cat:"Miscellaneous", name:"Transformation",         color:"#707050", abbr:"TF" },
  { id:"tunneling",            cat:"Miscellaneous", name:"Tunneling",              color:"#4a5a80", abbr:"TU" },
  { id:"vehicle",              cat:"Miscellaneous", name:"Vehicle",                color:"#606058", abbr:"VH" },
  { id:"wealth",               cat:"Miscellaneous", name:"Wealth",                 color:"#a09040", abbr:"WL" },
  { id:"willpower",            cat:"Miscellaneous", name:"Willpower",              color:"#605080", abbr:"WP" },

  // --- Vehicle-Specific Systems (from vehicle construction rules) ---
  { id:"robot-brain",     cat:"Vehicle",  name:"Robot Brain (+IN)",  color:"#6060a0", abbr:"RB" },
  { id:"automation",      cat:"Vehicle",  name:"Automation (+AG)",   color:"#507090", abbr:"AU" },
  { id:"performance",     cat:"Vehicle",  name:"Performance (+CL)", color:"#806050", abbr:"PF" },
  { id:"sensor-suite",    cat:"Vehicle",  name:"Sensor Suite",       color:"#a08020", abbr:"SN" },

  // --- Crew & Structure ---
  { id:"control-seat",    cat:"Crew",     name:"Control Seat",       color:"#2a7a6a", abbr:"CS" },
  { id:"passenger-seat",  cat:"Crew",     name:"Passenger Seat",     color:"#2a7a6a", abbr:"PS" },
  { id:"bunk",            cat:"Crew",     name:"Bunk (double)",      color:"#2a7a6a", abbr:"BK" },
  { id:"hands",           cat:"Crew",     name:"Hands",              color:"#5a7a5a", abbr:"HN" },
  { id:"limbs",           cat:"Crew",     name:"Limbs",              color:"#4a6a4a", abbr:"LM" },

  // --- Cargo ---
  { id:"cargo",           cat:"Cargo",    name:"Cargo / Empty",      color:"#4a4a42", abbr:"CG" },
  { id:"spare-parts",     cat:"Cargo",    name:"Spare Parts",        color:"#6a5a38", abbr:"PT" },
  { id:"garage",          cat:"Cargo",    name:"Garage / Hangar",    color:"#3a4a50", abbr:"GH" },

  // --- Custom ---
  { id:"custom",          cat:"Custom",   name:"Custom",             color:"#707070", abbr:"??" },
];

MP.abilityById = function(id) {
  return MP.ABILITY_TYPES.find(t => t.id === id) || null;
};

MP.CATEGORIES = ["Offensive","Defensive","Miscellaneous","Vehicle","Crew","Cargo","Custom"];

// ---- Weaknesses (from MP rulebook 2.1.15) ----
MP.WEAKNESSES = [
  { id:"diminished-senses",  name:"Diminished Senses",  cpMod:-5,  desc:"Reduced sensory capability" },
  { id:"distinctive",        name:"Distinctive",        cpMod:-5,  desc:"Easily identified or tracked" },
  { id:"low-self-control",   name:"Low Self-Control",   cpMod:-5,  desc:"Compulsive behavior" },
  { id:"lowered-intelligence",name:"Lowered Intelligence",cpMod:-2.5,desc:"-1 IN per application" },
  { id:"nemesis",            name:"Nemesis",            cpMod:-5,  desc:"Recurring enemy" },
  { id:"personal-problem",   name:"Personal Problem",   cpMod:-5,  desc:"Ongoing personal issue" },
  { id:"phobia",             name:"Phobia",             cpMod:-5,  desc:"Irrational fear" },
  { id:"physical-disability",name:"Physical Disability",cpMod:-5,  desc:"Structural flaw or limitation" },
  { id:"poverty",            name:"Poverty",            cpMod:-5,  desc:"Lack of resources" },
  { id:"prejudice",          name:"Prejudice",          cpMod:-5,  desc:"Discriminated against" },
  { id:"psychosis",          name:"Psychosis",          cpMod:-5,  desc:"Mental disorder" },
  { id:"reduced-ag",         name:"Reduced Agility",    cpMod:-2.5,desc:"-1 AG per application" },
  { id:"reduced-cl",         name:"Reduced Cool",       cpMod:-2.5,desc:"-1 CL per application" },
  { id:"reduced-en",         name:"Reduced Endurance",  cpMod:-2.5,desc:"-1 EN per application" },
  { id:"reduced-st",         name:"Reduced Strength",   cpMod:-2.5,desc:"-1 ST per application" },
  { id:"special-requirement",name:"Special Requirement",cpMod:-5,  desc:"Needs fuel, sunlight, etc." },
  { id:"susceptibility",     name:"Susceptibility",     cpMod:-5,  desc:"Takes extra damage from a source" },
  { id:"uneducated",         name:"Uneducated",         cpMod:-5,  desc:"Lack of formal education" },
  { id:"unliving",           name:"Unliving",           cpMod:-5,  desc:"Not alive (construct, undead)" },
  { id:"vulnerability",      name:"Vulnerability",      cpMod:-10, desc:"Major weakness to a damage type" },
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
