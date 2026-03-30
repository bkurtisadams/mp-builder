// mp-data.js v2.2.0 — Full MP abilities from rulebook

const MP = {};

// ---- Chassis Table ----
MP.CHASSIS = [
  {cp:0,    sp:2,      wt:"360 lbs",          mass:"d6",       prof:1.41,   st:15,en:15,hits:13},
  {cp:2.5,  sp:3,      wt:"540 lbs",          mass:"d6+1",     prof:1.705,  st:16,en:17,hits:15},
  {cp:5,    sp:4,      wt:"720 lbs",          mass:"d6+1",     prof:2,      st:18,en:18,hits:16},
  {cp:7.5,  sp:6,      wt:"1,080 lbs",        mass:"d8+1",     prof:2.415,  st:19,en:20,hits:18},
  {cp:10,   sp:8,      wt:"1,440 lbs",        mass:"d8+1",     prof:2.83,   st:21,en:21,hits:20},
  {cp:12.5, sp:12,     wt:"2,160 lbs",        mass:"d10+1",    prof:3.415,  st:22,en:23,hits:23},
  {cp:15,   sp:16,     wt:"2,880 lbs",        mass:"d10+1",    prof:4,      st:24,en:24,hits:25},
  {cp:17.5, sp:24,     wt:"4,320 lbs",        mass:"2d6",      prof:4.83,   st:25,en:26,hits:27},
  {cp:20,   sp:32,     wt:"5,760 lbs",        mass:"2d6",      prof:5.66,   st:27,en:27,hits:29},
  {cp:22.5, sp:48,     wt:"8,640 lbs",        mass:"d6+d8",    prof:6.83,   st:28,en:29,hits:31},
  {cp:25,   sp:64,     wt:"11,520 lbs",       mass:"d6+d8",    prof:8,      st:30,en:30,hits:33},
  {cp:27.5, sp:96,     wt:"17,280 lbs",       mass:"2d8",      prof:9.655,  st:31,en:32,hits:36},
  {cp:30,   sp:128,    wt:"23,040 lbs",       mass:"2d8",      prof:11.31,  st:33,en:33,hits:38},
  {cp:32.5, sp:192,    wt:"34,560 lbs",       mass:"d8+d10",   prof:13.655, st:34,en:35,hits:40},
  {cp:35,   sp:256,    wt:"46,080 lbs",       mass:"d8+d10",   prof:16,     st:36,en:36,hits:41},
  {cp:37.5, sp:384,    wt:"69,120 lbs",       mass:"2d10",     prof:19.315, st:37,en:38,hits:44},
  {cp:40,   sp:512,    wt:"92,160 lbs",       mass:"2d10",     prof:22.63,  st:39,en:39,hits:46},
  {cp:42.5, sp:768,    wt:"138,240 lbs",      mass:"d10+d12",  prof:27.315, st:40,en:41,hits:48},
  {cp:45,   sp:1024,   wt:"184,320 lbs",      mass:"d10+d12",  prof:32,     st:42,en:42,hits:50},
  {cp:47.5, sp:1536,   wt:"276,480 lbs",      mass:"2d12",     prof:38.625, st:43,en:44,hits:52},
  {cp:50,   sp:2048,   wt:"368,640 lbs",      mass:"2d12",     prof:45.25,  st:45,en:45,hits:54},
  {cp:52.5, sp:3072,   wt:"552,960 lbs",      mass:"3d8",      prof:54.625, st:46,en:47,hits:57},
  {cp:55,   sp:4096,   wt:"737,280 lbs",      mass:"3d8",      prof:64,     st:48,en:48,hits:59},
  {cp:57.5, sp:6144,   wt:"1,105,920 lbs",    mass:"2d8+d10",  prof:77.255, st:49,en:50,hits:61},
  {cp:60,   sp:8192,   wt:"1,474,560 lbs",    mass:"2d8+d10",  prof:90.51,  st:51,en:51,hits:63},
  {cp:62.5, sp:12288,  wt:"2,211,840 lbs",    mass:"d8+2d10",  prof:109.255,st:52,en:53,hits:65},
  {cp:65,   sp:16384,  wt:"2,949,120 lbs",    mass:"d8+2d10",  prof:128,    st:54,en:54,hits:66},
  {cp:67.5, sp:24576,  wt:"4,423,680 lbs",    mass:"3d10",     prof:154.51, st:55,en:56,hits:69},
  {cp:70,   sp:32768,  wt:"5,898,240 lbs",    mass:"3d10",     prof:181.02, st:57,en:57,hits:71},
  {cp:72.5, sp:49152,  wt:"8,847,360 lbs",    mass:"2d10+d12", prof:218.51, st:58,en:59,hits:73},
  {cp:75,   sp:65536,  wt:"11,796,480 lbs",   mass:"2d10+d12", prof:256,    st:60,en:60,hits:75},
  {cp:77.5, sp:98304,  wt:"17,694,720 lbs",   mass:"d10+2d12", prof:309.017,st:61,en:62,hits:77},
  {cp:80,   sp:131072, wt:"23,592,960 lbs",   mass:"d10+2d12", prof:362.034,st:63,en:63,hits:79},
  {cp:82.5, sp:196608, wt:"35,389,440 lbs",   mass:"3d12",     prof:437.017,st:64,en:65,hits:82},
  {cp:85,   sp:262144, wt:"47,185,920 lbs",   mass:"3d12",     prof:512,    st:66,en:66,hits:84},
  {cp:87.5, sp:393216, wt:"70,778,880 lbs",   mass:"3d12+1",   prof:618.04, st:67,en:68,hits:86},
  {cp:90,   sp:524288, wt:"94,371,840 lbs",   mass:"3d12+1",   prof:724.08, st:69,en:69,hits:88},
  {cp:92.5, sp:786432, wt:"141,557,760 lbs",  mass:"3d12+2",   prof:874.04, st:70,en:71,hits:90},
  {cp:95,   sp:1048576,wt:"188,743,680 lbs",  mass:"3d12+2",   prof:1024,   st:72,en:72,hits:91},
  {cp:97.5, sp:1572864,wt:"283,115,520 lbs",  mass:"4d10",     prof:1236.075,st:73,en:74,hits:94},
  {cp:100,  sp:2097152,wt:"377,487,360 lbs",  mass:"4d10",     prof:1448.15,st:75,en:75,hits:96},
  {cp:102.5,sp:3145728,wt:"566,231,040 lbs",  mass:"3d10+d12", prof:1748.075,st:76,en:77,hits:98},
  {cp:105,  sp:4194304,wt:"754,974,720 lbs",  mass:"3d10+d12", prof:2048,   st:78,en:78,hits:100},
  {cp:107.5,sp:6291456,wt:"1,132,462,080 lbs",mass:"2d10+2d12",prof:2472.155,st:79,en:80,hits:103},
  {cp:110,  sp:8388608,wt:"1,509,949,440 lbs",mass:"2d10+2d12",prof:2896.31,st:81,en:81,hits:105},
  {cp:112.5,sp:12582912,wt:"2,264,924,160 lbs",mass:"d10+3d12",prof:3496.155,st:82,en:83,hits:107},
  {cp:115,  sp:16777216,wt:"3,019,898,880 lbs",mass:"d10+3d12",prof:4096,   st:84,en:84,hits:109},
  {cp:117.5,sp:25165824,wt:"4,529,848,320 lbs",mass:"4d12",    prof:4944.31,st:85,en:86,hits:111},
  {cp:120,  sp:33554432,wt:"6,039,797,760 lbs",mass:"4d12",    prof:5792.62,st:87,en:87,hits:112},
  {cp:122.5,sp:50331648,wt:"9,059,696,640 lbs",mass:"4d12+1",  prof:6992.31,st:88,en:89,hits:115},
  {cp:125,  sp:67108864,wt:"12,079,595,520 lbs",mass:"4d12+1", prof:8192,   st:90,en:90,hits:117},
  {cp:127.5,sp:100663296,wt:"18,119,393,280 lbs",mass:"5d10",  prof:9888.62,st:91,en:92,hits:119},
  {cp:130,  sp:134217728,wt:"24,159,191,040 lbs",mass:"5d10",  prof:11585.24,st:93,en:93,hits:121},
  {cp:132.5,sp:201326592,wt:"36,238,786,560 lbs",mass:"4d10+d12",prof:14188.96,st:94,en:95,hits:123},
  {cp:135,  sp:268435456,wt:"48,318,382,080 lbs",mass:"4d10+d12",prof:16384, st:96,en:96,hits:125},
  {cp:137.5,sp:402653184,wt:"72,477,573,120 lbs",mass:"3d10+2d12",prof:20066.22,st:97,en:98,hits:127},
  {cp:140,  sp:536870912,wt:"96,636,764,160 lbs",mass:"3d10+2d12",prof:23170.475,st:99,en:99,hits:129},
];

// Lookup chassis row by CP value (find highest CP <= given value)
MP.lookupChassis = function(cp) {
  for (let i = MP.CHASSIS.length - 1; i >= 0; i--) {
    if (MP.CHASSIS[i].cp <= cp) return MP.CHASSIS[i];
  }
  return MP.CHASSIS[0];
};

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

// ---- Ability Details for Insert Dialog ----
// dmg = damage type, pr = PR per use, defCP = suggested default CPs,
// hint = short description, mods = which modifier dropdowns to show
// mods key: ae=Area Effect, ap=Armor Piercing, af=Autofire, gear=Gear, ch=Charges, pr_ch=Power/Charges, rng=Range
MP.ABILITY_DETAILS = {
  // --- Offensive ---
  "absorption":         {dmg:"Special",    pr:0,  defCP:5,   hint:"Absorb dmg types, ¼ damage, gain CPs",       mods:["gear"]},
  "chemical-abilities": {dmg:"Biochem",    pr:2,  defCP:10,  hint:"Chemical Blast or Chemical Body (field)",     mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "death-touch":        {dmg:"Entropy",    pr:12, defCP:15,  hint:"Melee entropy, no roll-with, kill on 0 HP",   mods:["ap","gear","ch","pr_ch"]},
  "devitalization-ray": {dmg:"Entropy",    pr:3,  defCP:10,  hint:"Power damage, range ENx2\"",                  mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "disintegration":     {dmg:"Other",      pr:2,  defCP:10,  hint:"Disintegration Ray or Field",                 mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "emotion-control":    {dmg:"Psychic",    pr:3,  defCP:10,  hint:"Mental save attack, impose emotion",          mods:["ae","gear","ch","pr_ch","rng"]},
  "energy-blast":       {dmg:"Energy",     pr:2,  defCP:10,  hint:"Standard energy attack, range ST\"",          mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "experience-levels":  {dmg:"—",          pr:0,  defCP:10,  hint:"Hit/Defense/Task bonuses",                    mods:["gear"]},
  "flame-abilities":    {dmg:"Energy",     pr:2,  defCP:10,  hint:"Flame Blast (range ST+EN\") or Flame Aura",   mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "force-field":        {dmg:"Special",    pr:16, defCP:15,  hint:"Personal Force Field or Force Bolt",          mods:["ae","gear","ch","pr_ch","rng"]},
  "grapnel":            {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"Snare attack, range (ST+AG)\"",               mods:["ae","af","gear","ch","pr_ch","rng"]},
  "gravity-control":    {dmg:"Other",      pr:2,  defCP:10,  hint:"Gravity Decrease/Increase/Personal Well",     mods:["ae","gear","ch","pr_ch","rng"]},
  "heightened-agility": {dmg:"—",          pr:0,  defCP:10,  hint:"+1 AG per CP",                                mods:["gear"]},
  "heightened-attack":  {dmg:"—",          pr:0,  defCP:10,  hint:"Damage bonus on attacks",                     mods:["gear"]},
  "heightened-expertise":{dmg:"—",         pr:0,  defCP:10,  hint:"Accuracy bonus on attacks",                   mods:["gear"]},
  "heightened-strength":{dmg:"—",          pr:0,  defCP:10,  hint:"+1 ST per CP",                                mods:["gear"]},
  "ice-abilities":      {dmg:"Entropy",    pr:1,  defCP:10,  hint:"Ice Armor, Ice Blast (snare), or Ice Shaping",mods:["ae","af","gear","ch","pr_ch","rng"]},
  "light-control":      {dmg:"Energy",     pr:1,  defCP:10,  hint:"Laser, Flash, Glare, or Glow",               mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "lightning-control":  {dmg:"Energy",     pr:4,  defCP:10,  hint:"Electrical Bolt (ENx2\"), Field, or Gear Ctrl",mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "magnetism":          {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"Magnetic Manipulation, range ST\"",           mods:["ae","gear","ch","pr_ch","rng"]},
  "mind-control":       {dmg:"Psychic",    pr:8,  defCP:10,  hint:"Mental save attack, range IN+CL\"",           mods:["ae","gear","ch","pr_ch","rng"]},
  "natural-weaponry":   {dmg:"Kinetic",    pr:0,  defCP:10,  hint:"Melee: blunt (KB) or sharp (+2 dmg, no KB)",  mods:["gear"]},
  "paralysis-ray":      {dmg:"Entropy",    pr:3,  defCP:10,  hint:"Save attack, range ENx2\", immobilize",       mods:["ae","af","gear","ch","pr_ch","rng"]},
  "poison-venom":       {dmg:"Biochem",    pr:2,  defCP:10,  hint:"Damaging or Paralytic poison",                mods:["gear","ch","pr_ch","rng"]},
  "power-blast":        {dmg:"Energy",     pr:1,  defCP:10,  hint:"Force bolts, range (ST+EN)/2\"",              mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "reflection":         {dmg:"Special",    pr:0,  defCP:10,  hint:"Reflect incoming damage types",               mods:["gear"]},
  "repulsion-blast":    {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"KB only (no hit dmg), range STx2\"",          mods:["ae","af","gear","ch","pr_ch","rng"]},
  "shaping":            {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"Create solid constructs at AG\" range",       mods:["gear","ch","pr_ch"]},
  "siphon":             {dmg:"Entropy",    pr:0,  defCP:10,  hint:"Drain target CPs/BCs/Hits/Power, touch",      mods:["gear","ch","pr_ch","rng"]},
  "sonic-abilities":    {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"Sonic Blast (STx2\") or Sonic Boom (save)",   mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "special-weapon":     {dmg:"Kinetic",    pr:0,  defCP:10,  hint:"Melee or Missile weapon, blunt or sharp",     mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "telekinesis":        {dmg:"Kinetic",    pr:1,  defCP:10,  hint:"Kinetic Manipulation at AG\" range",          mods:["ae","gear","ch","pr_ch","rng"]},
  "transmutation":      {dmg:"Other",      pr:8,  defCP:10,  hint:"Save attack, alter living targets, IN×2\"",   mods:["ae","gear","ch","pr_ch","rng"]},
  "vibration-abilities":{dmg:"Kinetic",    pr:5,  defCP:10,  hint:"Vibratory Blast, AGx2\", no KB",              mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
  "weakness-detection": {dmg:"—",          pr:0,  defCP:5,   hint:"+1 to hit scanned target per 2.5 CPs",       mods:["gear"]},
  "weather-control":    {dmg:"Varies",     pr:5,  defCP:10,  hint:"Change Weather / Command Weather",            mods:["gear"]},
  // --- Defensive ---
  "adaptation":         {dmg:"—",          pr:0,  defCP:5,   hint:"Immune to natural hazard, ½ vs active atk",  mods:["gear"]},
  "armor":              {dmg:"—",          pr:0,  defCP:15,  hint:"Protection: Kin/Eng/Bio/Ent",                 mods:["gear"]},
  "astral-projection":  {dmg:"—",          pr:5,  defCP:10,  hint:"Intangible astral body, leave body behind",   mods:["gear"]},
  "darkness-control":   {dmg:"—",          pr:1,  defCP:10,  hint:"Dampen senses in area, AGx2\" range",         mods:["gear","ch","pr_ch"]},
  "density-change":     {dmg:"—",          pr:2,  defCP:10,  hint:"Increase (prot+ST) or Decrease density",      mods:["gear"]},
  "durability":         {dmg:"—",          pr:0,  defCP:10,  hint:"Extra Hits = CPs spent",                      mods:["gear"]},
  "heightened-defense": {dmg:"—",          pr:0,  defCP:10,  hint:"+1 Phys & Mental Def per 5 CPs",             mods:["gear"]},
  "heightened-endurance":{dmg:"—",         pr:0,  defCP:10,  hint:"+1 EN per CP",                                mods:["gear"]},
  "invisibility":       {dmg:"—",          pr:1,  defCP:10,  hint:"Undetectable by 1+ senses",                   mods:["gear"]},
  "invulnerability":    {dmg:"—",          pr:0,  defCP:10,  hint:"¼ damage from chosen types, +8 vs saves",    mods:["gear"]},
  "life-support":       {dmg:"—",          pr:0,  defCP:10,  hint:"Environmental immunity + protection",         mods:["gear"]},
  "non-corporealness":  {dmg:"—",          pr:16, defCP:15,  hint:"Intangible, immune to non-Mental attacks",    mods:["gear"]},
  "regeneration":       {dmg:"—",          pr:0,  defCP:10,  hint:"Heal HP faster than normal",                  mods:["gear"]},
  "shield":             {dmg:"—",          pr:0,  defCP:10,  hint:"+4 Phys Def, breakpoint bonus",               mods:[]},
  "stretching-abilities":{dmg:"—",         pr:0,  defCP:5,   hint:"Elongation/Flattening/Inflation/Plasticity",  mods:["gear"]},
  // --- Miscellaneous ---
  "animal-plant":       {dmg:"—",          pr:0,  defCP:10,  hint:"Species abilities + BC mods",                 mods:["gear"]},
  "arsenal":            {dmg:"—",          pr:0,  defCP:20,  hint:"Swappable ability slots (utility belt)",      mods:["gear"]},
  "base":               {dmg:"—",          pr:0,  defCP:15,  hint:"Stationary base (vehicle rules, -15 CP)",     mods:[]},
  "communicators":      {dmg:"—",          pr:0,  defCP:5,   hint:"Paired audio comms, 10 mi range, Gear",       mods:["gear"]},
  "companion":          {dmg:"—",          pr:0,  defCP:10,  hint:"Familiar/minion/pet/sidekick",                mods:[]},
  "cosmic-awareness":   {dmg:"—",          pr:12, defCP:10,  hint:"Ask GM yes/no questions about Multiverse",    mods:[]},
  "cybernetics":        {dmg:"—",          pr:0,  defCP:10,  hint:"Mechanical body parts, 2 random abilities",   mods:["gear"]},
  "dimensional-travel": {dmg:"—",          pr:4,  defCP:10,  hint:"Travel between dimensions",                   mods:["gear"]},
  "duplication":        {dmg:"—",          pr:0,  defCP:20,  hint:"Split into identical copies",                  mods:[]},
  "energy":             {dmg:"—",          pr:0,  defCP:10,  hint:"+2 Power per CP",                             mods:["gear"]},
  "flight":             {dmg:"—",          pr:1,  defCP:15,  hint:"Accel/Top Speed, PR=1/hour",                  mods:["gear"]},
  "healing":            {dmg:"Other",      pr:1,  defCP:10,  hint:"Restore Hits, touch range",                   mods:["gear","ch","pr_ch"]},
  "heightened-cool":    {dmg:"—",          pr:0,  defCP:10,  hint:"+1 CL per CP",                                mods:["gear"]},
  "heightened-initiative":{dmg:"—",        pr:0,  defCP:5,   hint:"+1 Initiative per 2.5 CPs",                   mods:["gear"]},
  "heightened-intelligence":{dmg:"—",      pr:0,  defCP:10,  hint:"+1 IN per CP",                                mods:["gear"]},
  "heightened-senses":  {dmg:"—",          pr:0,  defCP:10,  hint:"New or enhanced senses",                      mods:["gear"]},
  "illusions":          {dmg:"—",          pr:1,  defCP:10,  hint:"Intangible sensory semblances",               mods:["gear","ch","pr_ch"]},
  "inventing":          {dmg:"—",          pr:0,  defCP:10,  hint:"1 Inventing Point per CP, Gear default",      mods:["gear"]},
  "knowledge":          {dmg:"—",          pr:0,  defCP:5,   hint:"Careers, languages, cultural background",     mods:[]},
  "luck":               {dmg:"—",          pr:0,  defCP:5,   hint:"+1 Luck save per 2.5 CPs",                   mods:[]},
  "mental-ability":     {dmg:"Psychic",    pr:1,  defCP:10,  hint:"Mental Blast, Photographic Memory, etc.",     mods:["ae","af","gear","ch","pr_ch","rng"]},
  "negation":           {dmg:"—",          pr:1,  defCP:10,  hint:"Reduce duration / improve saves vs effects",  mods:["gear","ch","pr_ch","rng"]},
  "physical-ability":   {dmg:"—",          pr:0,  defCP:5,   hint:"Ambidexterity, Extra Limbs, Wall-Crawling…",  mods:["gear"]},
  "revivification":     {dmg:"—",          pr:24, defCP:10,  hint:"Raise the dead, touch range, task check",     mods:["gear"]},
  "shape-shifting":     {dmg:"—",          pr:0,  defCP:10,  hint:"Change shape: people/creatures/objects",       mods:["gear"]},
  "size-change":        {dmg:"—",          pr:0,  defCP:10,  hint:"Larger (+ST/EN) or Smaller (-Profile)",       mods:["gear"]},
  "speed":              {dmg:"—",          pr:1,  defCP:15,  hint:"Ground movement, Accel/Top Speed, PR=1/hr",   mods:["gear"]},
  "summoning":          {dmg:"—",          pr:2,  defCP:10,  hint:"Summon entity, 5 min, PR=2/hr maintain",      mods:[]},
  "super-speed":        {dmg:"—",          pr:2,  defCP:10,  hint:"+1 extra turn per 10 CPs",                    mods:["gear"]},
  "swimming":           {dmg:"—",          pr:1,  defCP:10,  hint:"Water movement, Accel/Top Speed",             mods:["gear"]},
  "telepathy":          {dmg:"—",          pr:1,  defCP:5,   hint:"Direct mental communication",                 mods:["gear"]},
  "teleportation":      {dmg:"—",          pr:1,  defCP:10,  hint:"Instant transfer, range depends on CPs",      mods:["gear"]},
  "transformation":     {dmg:"—",          pr:0,  defCP:10,  hint:"Change into weaker form",                     mods:[]},
  "tunneling":          {dmg:"—",          pr:1,  defCP:10,  hint:"Burrow through solid matter",                  mods:["gear"]},
  "vehicle":            {dmg:"—",          pr:0,  defCP:15,  hint:"Vehicle (constructed via vehicle rules)",      mods:[]},
  "wealth":             {dmg:"—",          pr:0,  defCP:5,   hint:"Financial resources, Wealth roll",            mods:[]},
  "willpower":          {dmg:"—",          pr:0,  defCP:10,  hint:"Fortitude / Pain Resistance / Self-Control",  mods:[]},
  // --- Vehicle-Specific ---
  "robot-brain":        {dmg:"—",          pr:0,  defCP:10,  hint:"+IN per CP, vehicle AI",                      mods:[]},
  "automation":         {dmg:"—",          pr:0,  defCP:10,  hint:"+AG per CP, autopilot",                       mods:[]},
  "performance":        {dmg:"—",          pr:0,  defCP:10,  hint:"+CL per CP, handling",                        mods:[]},
  "sensor-suite":       {dmg:"—",          pr:0,  defCP:10,  hint:"Heightened Senses for vehicle",               mods:["gear"]},
  // --- Crew & Cargo ---
  "control-seat":       {dmg:"—",          pr:0,  defCP:0,   hint:"Operator seat (1 space)",                     mods:[]},
  "passenger-seat":     {dmg:"—",          pr:0,  defCP:0,   hint:"Passenger seat (1 space each)",               mods:[]},
  "bunk":               {dmg:"—",          pr:0,  defCP:0,   hint:"Sleeping berth (1 space, double)",            mods:[]},
  "hands":              {dmg:"—",          pr:0,  defCP:5,   hint:"Manipulator appendages",                      mods:[]},
  "limbs":              {dmg:"—",          pr:0,  defCP:5,   hint:"Locomotive appendages",                       mods:[]},
  "cargo":              {dmg:"—",          pr:0,  defCP:0,   hint:"Empty / cargo space",                         mods:[]},
  "spare-parts":        {dmg:"—",          pr:0,  defCP:0,   hint:"Repair materials",                            mods:[]},
  "garage":             {dmg:"—",          pr:0,  defCP:0,   hint:"Vehicle bay / hangar",                        mods:[]},
  "custom":             {dmg:"—",          pr:0,  defCP:0,   hint:"Custom system",                               mods:["ae","ap","af","gear","ch","pr_ch","rng"]},
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

// ---- Ability Modifier Tables (from MP rulebook 2.2.4) ----

// Area Effect diameter steps — move down = +2.5 CP, move up = -2.5 CP
// Default (0 CP adj) = ½" / Single Target
MP.AREA_EFFECT_STEPS = [
  {label:'½" / Single', cp:0},
  {label:'1"',  cp:2.5},
  {label:'3"',  cp:5},
  {label:'5"',  cp:7.5},
  {label:'7"',  cp:10},
  {label:'9"',  cp:12.5},
  {label:'11"', cp:15},
  {label:'15"', cp:17.5},
  {label:'19"', cp:20},
  {label:'23"', cp:22.5},
  {label:'27"', cp:25},
  {label:'33"', cp:27.5},
  {label:'39"', cp:30},
  {label:'45"', cp:32.5},
  {label:'51"', cp:35},
  {label:'59"', cp:37.5},
  {label:'67"', cp:40},
  {label:'75"', cp:42.5},
  {label:'83"', cp:45},
  {label:'93"', cp:47.5},
];

// Armor Piercing — each +5 pts ignored costs +2.5 CPs; "all" = +10
MP.ARMOR_PIERCING_STEPS = [
  {label:'None',  cp:0,  val:0},
  {label:'5 pts', cp:2.5, val:5},
  {label:'10 pts',cp:5,   val:10},
  {label:'15 pts',cp:7.5, val:15},
  {label:'20 pts',cp:10,  val:20},
  {label:'25 pts',cp:12.5,val:25},
  {label:'30 pts',cp:15,  val:30},
  {label:'All',   cp:10,  val:'all'},
];

// Autofire — Rate of Fire 2-7, cost adjustment
MP.AUTOFIRE_STEPS = [
  {label:'None', cp:0,   rof:0},
  {label:'RoF 2',cp:7.5, rof:2},
  {label:'RoF 3',cp:15,  rof:3},
  {label:'RoF 4',cp:22.5,rof:4},
  {label:'RoF 5',cp:30,  rof:5},
  {label:'RoF 6',cp:37.5,rof:6},
  {label:'RoF 7',cp:45,  rof:7},
];

// Charges — uses per "adventure" before needing recharge/reload
// Default is unlimited. Fewer charges = negative CP adjustment.
MP.CHARGES_STEPS = [
  {label:'Unlimited', cp:0},
  {label:'32 charges',cp:-2.5},
  {label:'16 charges',cp:-5},
  {label:'8 charges', cp:-7.5},
  {label:'4 charges', cp:-10},
  {label:'2 charges', cp:-12.5},
  {label:'1 charge',  cp:-15},
];

// Power Instead of Charges — replaces Charges with PR cost
// "Each additional application of this modifier doubles the PR"
MP.POWER_CHARGES_STEPS = [
  {label:'None (use Charges)', cp:0, pr:0},
  {label:'PR = 1',  cp:5,   pr:1},
  {label:'PR = 2',  cp:10,  pr:2},
  {label:'PR = 4',  cp:15,  pr:4},
  {label:'PR = 8',  cp:20,  pr:8},
  {label:'PR = 16', cp:25,  pr:16},
  {label:'PR = 32', cp:30,  pr:32},
];

// Range steps — +/-2.5 per step from base 1×BC Carry
MP.RANGE_STEPS = [
  {label:'Self Only', cp:-15},
  {label:'Touch',     cp:-12.5},
  {label:'1"',        cp:-10},
  {label:'2"',        cp:-7.5},
  {label:'4"',        cp:-5},
  {label:'½× Carry',  cp:-2.5},
  {label:'1× Carry (default)', cp:0},
  {label:'2× Carry',  cp:2.5},
  {label:'4× Carry',  cp:5},
  {label:'8× Carry',  cp:7.5},
  {label:'16× Carry', cp:10},
  {label:'32× Carry', cp:12.5},
  {label:'Line of Sight', cp:15},
];

// ---- BC Table (from rulebook 2.1.7.2) ----
// Each entry: [minScore, carry, hth, save, init]
MP.BC_TABLE = [
  [0,  8,             "d2-1",    6,  "d2-1"],
  [1,  10,            "d2-1",    7,  "d2-1"],
  [2,  12,            "d2-1",    7,  "d2-1"],
  [3,  15,            "d2",      8,  "d2"],
  [6,  30,            "d3",      9,  "d3"],
  [9,  60,            "d4",      10, "d4"],
  [12, 120,           "d6",      11, "d6"],
  [15, 240,           "d6+1",    11, "d6+1"],
  [18, 480,           "d8+1",    12, "d8+1"],
  [21, 960,           "d10+1",   12, "d10+1"],
  [24, 1920,          "2d6",     13, "2d6"],
  [27, 3840,          "d6+d8",   13, "d6+d8"],
  [30, 7680,          "2d8",     14, "2d8"],
  [33, 15360,         "d8+d10",  14, "d8+d10"],
  [36, 30720,         "2d10",    15, "2d10"],
  [39, 61440,         "d10+d12", 15, "d10+d12"],
  [42, 122880,        "2d12",    16, "2d12"],
  [45, 245760,        "3d8",     16, "3d8"],
  [48, 491520,        "2d8+d10", 17, "2d8+d10"],
  [51, 983040,        "d8+2d10", 17, "d8+2d10"],
  [54, 1966080,       "3d10",    18, "3d10"],
  [57, 3932160,       "2d10+d12",18, "2d10+d12"],
  [60, 7864320,       "d10+2d12",19, "d10+2d12"],
  [63, 15728640,      "3d12",    19, "3d12"],
  [66, 31457280,      "3d12+1",  20, "3d12+1"],
  [69, 62914560,      "3d12+2",  20, "3d12+2"],
  [72, 125829120,     "4d10",    21, "4d10"],
  [75, 251658240,     "3d10+d12",21, "3d10+d12"],
  [78, 503316480,     "2d10+2d12",22,"2d10+2d12"],
  [81, 1006632960,    "d10+3d12",22, "d10+3d12"],
  [84, 2013265920,    "4d12",    23, "4d12"],
  [87, 4026531840,    "4d12+1",  23, "4d12+1"],
  [90, 8053063680,    "5d10",    24, "5d10"],
  [93, 16106127360,   "4d10+d12",24, "4d10+d12"],
  [96, 32212254720,   "3d10+2d12",25,"3d10+2d12"],
];

MP._bcLookup = function(score) {
  for (let i = MP.BC_TABLE.length - 1; i >= 0; i--) {
    if (score >= MP.BC_TABLE[i][0]) return MP.BC_TABLE[i];
  }
  return MP.BC_TABLE[0];
};

// Save number for any BC score (ST, EN, AG, IN, CL all use same column)
MP.save = function(score) {
  return MP._bcLookup(score)[3];
};

// Base HTH Damage from ST
MP.hthDamage = function(st) {
  return MP._bcLookup(st)[2];
};

// Initiative die from CL score (uses init column, which matches CL save)
MP.initDie = function(cl) {
  return MP._bcLookup(cl)[4];
};

// Carrying Capacity from ST
MP.carry = function(st) {
  const lbs = MP._bcLookup(st)[1];
  if (lbs >= 1000000000) return (lbs / 1000000000).toFixed(1) + "B lbs";
  if (lbs >= 1000000) return (lbs / 1000000).toFixed(1) + "M lbs";
  if (lbs >= 1000) return (lbs / 1000).toFixed(1) + "K lbs";
  return lbs + " lbs";
};

// ---- Vehicle Templates ----
MP.TEMPLATES = [
  {
    name:"Motorcycle", basicCost:10, techMod:0, maneuverMod:5, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:4, desc:"Speed: 64/256, 87 mph, PR=1", extraCPs:0},
      {spaces:1, desc:"Headlight", extraCPs:0},
    ]
  },
  {
    name:"Compact Car", basicCost:15, techMod:0, maneuverMod:0, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:3, desc:"Passenger Seats (3)", extraCPs:0},
      {spaces:4, desc:"Speed: 64/256, 87 mph, PR=1", extraCPs:0},
      {spaces:2, desc:"Cargo / Trunk", extraCPs:0},
      {spaces:1, desc:"Headlights", extraCPs:0},
      {spaces:1, desc:"Radio", extraCPs:0},
    ]
  },
  {
    name:"Sedan", basicCost:17.5, techMod:0, maneuverMod:0, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:4, desc:"Passenger Seats (4)", extraCPs:0},
      {spaces:6, desc:"Speed: 64/256, 87 mph, PR=1", extraCPs:0},
      {spaces:4, desc:"Cargo / Trunk", extraCPs:0},
      {spaces:1, desc:"Headlights", extraCPs:0},
      {spaces:1, desc:"Radio", extraCPs:0},
    ]
  },
  {
    name:"Pickup Truck", basicCost:20, techMod:0, maneuverMod:-5, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:2, desc:"Passenger Seats (2)", extraCPs:0},
      {spaces:6, desc:"Speed: 64/256, 87 mph, PR=1", extraCPs:0},
      {spaces:8, desc:"Cargo / Truck Bed", extraCPs:0},
      {spaces:1, desc:"Headlights", extraCPs:0},
      {spaces:1, desc:"Radio", extraCPs:0},
    ]
  },
  {
    name:"Semi Truck", basicCost:25, techMod:0, maneuverMod:-10, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:1, desc:"Passenger Seat", extraCPs:0},
      {spaces:1, desc:"Bunk", extraCPs:0},
      {spaces:12, desc:"Speed: 48/192, 66 mph, PR=1", extraCPs:0},
      {spaces:32, desc:"Cargo / Trailer", extraCPs:0, open:true},
      {spaces:1, desc:"Headlights", extraCPs:0},
      {spaces:1, desc:"Radio / CB", extraCPs:0},
    ]
  },
  {
    name:"Helicopter", basicCost:20, techMod:5, maneuverMod:5, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat (Pilot)", extraCPs:0},
      {spaces:1, desc:"Control Seat (Co-Pilot)", extraCPs:0},
      {spaces:4, desc:"Passenger Seats (4)", extraCPs:0},
      {spaces:8, desc:"Flight: 48/192, 131 mph, PR=1", extraCPs:0},
      {spaces:4, desc:"Cargo", extraCPs:0},
      {spaces:1, desc:"Sensor Suite (Radar)", extraCPs:0},
      {spaces:1, desc:"Radio / Comms", extraCPs:0},
    ]
  },
  {
    name:"Fighter Jet", basicCost:25, techMod:10, maneuverMod:0, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat (Ejection)", extraCPs:0},
      {spaces:16, desc:"Flight: 384/1536, 523 mph, PR=1", extraCPs:0},
      {spaces:4, desc:"Energy Blast", extraCPs:0},
      {spaces:2, desc:"Sensor Suite (Radar/IR)", extraCPs:0},
      {spaces:1, desc:"Radio / Comms", extraCPs:0},
      {spaces:1, desc:"Countermeasures (Chaff/Flare)", extraCPs:0},
    ]
  },
  {
    name:"Speedboat", basicCost:17.5, techMod:0, maneuverMod:5, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat", extraCPs:0},
      {spaces:3, desc:"Passenger Seats (3)", extraCPs:0},
      {spaces:6, desc:"Swimming: 64/256, 87 mph, PR=1", extraCPs:0},
      {spaces:2, desc:"Cargo", extraCPs:0},
      {spaces:1, desc:"Navigation Lights", extraCPs:0},
      {spaces:1, desc:"Radio", extraCPs:0},
    ]
  },
  {
    name:"Tank", basicCost:30, techMod:5, maneuverMod:-10, wontExplode:true, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat (Driver)", extraCPs:0},
      {spaces:1, desc:"Control Seat (Commander)", extraCPs:0},
      {spaces:1, desc:"Control Seat (Gunner)", extraCPs:0},
      {spaces:1, desc:"Control Seat (Loader)", extraCPs:0},
      {spaces:16, desc:"Speed: 32/128, 44 mph, PR=1", extraCPs:0},
      {spaces:8, desc:"Power Blast, Fwd Arc", extraCPs:0},
      {spaces:2, desc:"Energy Blast, turret 360\u00b0", extraCPs:0},
      {spaces:2, desc:"Sensor Suite (IR/Thermal)", extraCPs:0},
      {spaces:1, desc:"Radio / Comms", extraCPs:0},
      {spaces:4, desc:"Spare Parts", extraCPs:0},
    ]
  },
  {
    name:"APC", basicCost:25, techMod:5, maneuverMod:-5, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat (Driver)", extraCPs:0},
      {spaces:1, desc:"Control Seat (Commander)", extraCPs:0},
      {spaces:8, desc:"Passenger Seats (8 troops)", extraCPs:0},
      {spaces:12, desc:"Speed: 32/128, 44 mph, PR=1", extraCPs:0},
      {spaces:4, desc:"Energy Blast, turret 360\u00b0", extraCPs:0},
      {spaces:2, desc:"Sensor Suite", extraCPs:0},
      {spaces:1, desc:"Radio / Comms", extraCPs:0},
      {spaces:4, desc:"Cargo / Ammo", extraCPs:0},
    ]
  },
  {
    name:"Space Shuttle", basicCost:35, techMod:10, maneuverMod:0, wontExplode:false, isBase:false,
    systems:[
      {spaces:2, desc:"Control Seats (Pilot/Co-Pilot)", extraCPs:0},
      {spaces:4, desc:"Passenger Seats (4 crew)", extraCPs:0},
      {spaces:32, desc:"Flight: 1024/4096, 1393 mph, PR=1", extraCPs:0},
      {spaces:16, desc:"Cargo Bay", extraCPs:0, open:true},
      {spaces:4, desc:"Life Support", extraCPs:0},
      {spaces:4, desc:"Sensor Suite (Full Spectrum)", extraCPs:0},
      {spaces:2, desc:"Radio / Comms Array", extraCPs:0},
      {spaces:2, desc:"Spare Parts", extraCPs:0},
    ]
  },
  {
    name:"Yacht", basicCost:27.5, techMod:5, maneuverMod:0, wontExplode:false, isBase:false,
    systems:[
      {spaces:1, desc:"Control Seat (Helm)", extraCPs:0},
      {spaces:6, desc:"Passenger Seats / Lounge", extraCPs:0},
      {spaces:4, desc:"Bunks (4, double)", extraCPs:0},
      {spaces:12, desc:"Swimming: 24/96, 33 mph, PR=1", extraCPs:0},
      {spaces:8, desc:"Cargo / Storage", extraCPs:0},
      {spaces:2, desc:"Sensor Suite (Radar/Sonar)", extraCPs:0},
      {spaces:1, desc:"Radio / Comms", extraCPs:0},
    ]
  },
];

// ---- System Color Categories (for layout canvas) ----
MP.SYS_COLORS = {
  movement:   { color: "#3a80c0", label: "Movement",    keywords: ["flight","speed","swimming","tunneling","teleport","super speed","gliding"] },
  weapon:     { color: "#c03838", label: "Weapon",       keywords: ["blast","attack","weapon","gun","cannon","missile","torpedo","laser","disintegrat","flame","ice abilit","lightning","sonic","chemical","death touch","natural weapon","grapnel"] },
  crew:       { color: "#c07020", label: "Crew",         keywords: ["control seat","passenger","bunk","seat","pilot","co-pilot","driver","gunner","commander","loader","crew"] },
  sensor:     { color: "#7050a0", label: "Sensor",       keywords: ["sensor","radar","sonar","comms","radio","communicat","countermeasure","navigation"] },
  brain:      { color: "#b060a0", label: "AI/Brain",     keywords: ["robot brain","automation","computer","ai "] },
  defense:    { color: "#c0a820", label: "Defense",      keywords: ["armor","shield","force field","invulnerab","adaptation","reflection","durability"] },
  lifesupport:{ color: "#60b060", label: "Life Support", keywords: ["life support","healing","regenerat","first aid"] },
  cargo:      { color: "#b0b0b0", label: "Cargo",        keywords: ["cargo","trunk","storage","spare part","garage","hangar","trailer","ammo","bay"] },
  misc:       { color: "#606060", label: "Misc",         keywords: ["headlight","light","ejection","wings","performance","chaff","flare"] },
};

MP.sysColor = function(desc) {
  if (!desc) return MP.SYS_COLORS.misc.color;
  const d = desc.toLowerCase();
  for (const cat of Object.values(MP.SYS_COLORS)) {
    for (const kw of cat.keywords) {
      if (d.includes(kw)) return cat.color;
    }
  }
  return MP.SYS_COLORS.misc.color;
};

MP.isSeatSystem = function(desc) {
  if (!desc) return false;
  const d = desc.toLowerCase();
  const seatWords = ["control seat","passenger","bunk","seat","pilot","co-pilot","driver","gunner","commander","loader"];
  return seatWords.some(kw => d.includes(kw));
};

