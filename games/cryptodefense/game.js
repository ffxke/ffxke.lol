/* CRYPTO DEFENSE — mainstream coins vs memecoins. Endless lane defense.
   Mouse / touch: click a card then a tile to place · drag a coin onto an identical coin (same level) to MERGE ·
   click a placed coin to UPGRADE or SELL · click $ drops to collect them.
   Keys: 1-6 pick a card · Esc cancel · Space pause · F game speed                                         */
(() => {
"use strict";

/* ---------- ✏️ tuning ---------- */
const VW = 960, VH = 540, TOP = 78;                       // view size, height of the top bar
const COLS = 9, ROWS = 5, CW = 94, CH = 88, GX = 96, GY = 96;   // grid
const MAX_LVL = 10;
const DEF = {   // defenders (mainstream coins). dmg / rate are level-1 values
  usdc: { name: "USDC", cost: 50,  cd: 5,  hp: 300,  c1: "#2775ca", c2: "#8fc0ff", income: 25, every: 9, desc: "mints $ over time",
          role: "CASH GENERATOR", ability: "Mints $ every 9s. Higher levels and nearby USDC mint more." },
  btc:  { name: "BTC",  cost: 100, cd: 5,  hp: 300,  c1: "#f7931a", c2: "#ffd08a", dmg: 20, rate: 1.4,  desc: "steady shots",
          role: "DAMAGE · SINGLE TARGET", ability: "Fires at the first memecoin in its lane." },
  sol:  { name: "SOL",  cost: 150, cd: 8,  hp: 300,  c1: "#9945ff", c2: "#14f195", dmg: 7,  rate: .42,  desc: "rapid fire",
          role: "DAMAGE · RAPID FIRE", ability: "Sprays fast, low-damage shots down its lane." },
  eth:  { name: "ETH",  cost: 175, cd: 10, hp: 300,  c1: "#6f6fe8", c2: "#d0d0ff", dmg: 18, rate: 2.2,  desc: "orbs pierce the whole lane",
          role: "DAMAGE · PIERCING", ability: "Orbs pass through and hit every memecoin in the lane." },
  bnb:  { name: "BNB",  cost: 75,  cd: 14, hp: 1600, c1: "#f3ba2f", c2: "#fff0b8", desc: "tough wall",
          role: "WALL", ability: "Blocks the lane and soaks up bites. Doesn't attack. Nearby BNB make it tougher." },
  link: { name: "LINK", cost: 200, cd: 12, hp: 300,  c1: "#2a5ada", c2: "#a8c0ff", dmg: 24, rate: 2,    desc: "chain zap · slows",
          role: "DAMAGE · CHAIN + SLOW", ability: "Zaps the nearest memecoin in any lane (3.5 tiles), jumps to more and slows them 45%." },
};
const ORDER = ["usdc", "btc", "sol", "eth", "bnb", "link"];
const ENEMY = {   // memecoins. speed in px/s, dps = damage per second to defenders, cost = wave budget points
  doge:  { name: "DOGE",  hp: 120, speed: 18, dps: 25, cost: 1, from: 1, c: "#c2a633", reward: 4, role: "BASIC", ability: "Walks in and bites whatever is in the way." },
  shib:  { name: "SHIB",  hp: 80,  speed: 34, dps: 20, cost: 1, from: 2, c: "#e4572e", reward: 4, role: "FAST", ability: "Low health but moves almost twice as fast." },
  bonk:  { name: "BONK",  hp: 150, speed: 30, dps: 25, cost: 2, from: 3, c: "#f5a524", reward: 7, leap: true, role: "JUMPER", ability: "Leaps over the first coin it reaches, then slows down." },
  pepe:  { name: "PEPE",  hp: 420, speed: 13, dps: 40, cost: 3, from: 4, c: "#4caf50", reward: 10, role: "TANK", ability: "Slow, with lots of health and a hard bite." },
  wif:   { name: "WIF",   hp: 170, speed: 18, dps: 25, cost: 3, from: 6, c: "#c48b5c", reward: 10, shield: 240, role: "SHIELDED", ability: "Its hat soaks up damage before its health goes down." },
  floki: { name: "FLOKI", hp: 240, speed: 20, dps: 30, cost: 3, from: 8, c: "#e0a44a", reward: 10, split: true, role: "SPLITTER", ability: "Splits into 2 small FLK coins when rugged." },
  mini:  { name: "FLK",   hp: 60,  speed: 32, dps: 15, c: "#e0a44a", reward: 2, r: 17, role: "MINI", ability: "Small and quick. Comes from a FLOKI." },
  rug:   { name: "RUG",   hp: 2600, speed: 8, dps: 110, c: "#ff2438", reward: 250, r: 50, boss: true, role: "BOSS",
           ability: "Every 5 waves. Summons memecoins (RUG PULL!), and gets much stronger each time it returns." },
};
const BOSS_EVERY = 5;                                     // boss every 5th wave, stronger each time
const DIFF = {
  easy:   { label: "EASY",   hp: .75, money: 250, budget: .8,  grow: .9 },   // grow = how fast memecoins toughen up per wave
  normal: { label: "NORMAL", hp: 1,   money: 150, budget: 1,   grow: 1 },
  hard:   { label: "HARD",   hp: 1.3, money: 100, budget: 1.25, grow: 1.12 },
};
const AUTO = {                                            // upgrades tab: auto-collect for $ drops
  max: 10,
  cost: l => Math.round(100 * Math.pow(1.6, l)),          // price of the NEXT level (l = current level): $100, $160, $256 … ~$6.9k for lv 10
  delay: l => 8 * Math.pow(.83, l - 1),                   // seconds before a drop is auto-collected: 8s at lv 1 → 1.5s at lv 10
  expire: 12,                                             // with no auto-collect, uncollected drops vanish after 12s
};
const lvlDmg = l => Math.pow(1.6, l - 1);                 // damage / income multiplier per level
const lvlHp = l => Math.pow(1.5, l - 1);
const waveHp = w => 1 + .12 * (w - 1) + .004 * (w - 1) * (w - 1);   // enemy health growth per wave
const upgradeCost = d => Math.round(DEF[d.type].cost * .75 * Math.pow(1.65, d.lvl - 1));   // gets steep at high levels

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
                set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };
const rand = (a, b) => a + Math.random() * (b - a);
const cellX = c => GX + c * CW + CW / 2, cellY = r => GY + r * CH + CH / 2;
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const money$ = n => "$" + Math.floor(n).toLocaleString();

/* ---------- state ---------- */
let G = null;
function newGame(diff){
  G = {
    state: "play", diff, D: DIFF[diff], money: DIFF[diff].money, wave: 0, phase: "grace", phaseT: 14,
    queue: [], spawnT: 0, spawnGap: 2, bosses: 0, kills: 0, t: 0, speed: 1,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    enemies: [], projs: [], drops: [], zaps: [], parts: [], floats: [], wallets: Array(ROWS).fill(true), walletRuns: [],
    cards: Object.fromEntries(ORDER.map(k => [k, 0])), tab: "def", autoLvl: 0, sel: null, selDef: null, drag: null, hover: null, skyT: 8,
  };
  window.cryptodefense = G;
  hideScreen();
}

/* ---------- defenders ---------- */
function defenders(){ const out = []; for (const row of G.grid) for (const d of row) if (d) out.push(d); return out; }
function bonus(d){            // network effect: +8% per matching neighbour, +2% per extra matching coin anywhere (max +40%)
  let n = 0, g = 0;
  for (let r = d.row - 1; r <= d.row + 1; r++) for (let c = d.col - 1; c <= d.col + 1; c++)
    if (inGrid(c, r) && (r !== d.row || c !== d.col) && G.grid[r][c] && G.grid[r][c].type === d.type) n++;
  for (const o of defenders()) if (o.type === d.type) g++;
  return .08 * n + Math.min(.4, .02 * (g - 1));
}
const power = d => lvlDmg(d.lvl) * (1 + bonus(d));
function maxHp(d){ return DEF[d.type].hp * lvlHp(d.lvl) * (d.type === "bnb" ? 1 + bonus(d) : 1); }
function place(type, c, r){
  const d = { type, col: c, row: r, lvl: 1, hp: 0, cd: type === "usdc" ? 4 : .3, flash: 0, bob: Math.random() * 6 };
  d.hp = maxHp(d); G.grid[r][c] = d;
  G.money -= DEF[type].cost; G.cards[type] = DEF[type].cd;
  burst(cellX(c), cellY(r), DEF[type].c1, 12); sfx.place();
  return d;
}
function levelUp(d){
  const ratio = d.hp / maxHp(d);
  d.lvl = Math.min(MAX_LVL, d.lvl + 1); d.hp = Math.max(ratio, .6) * maxHp(d); d.flash = .5;
  burst(cellX(d.col), cellY(d.row), DEF[d.type].c2, 24); sfx.up();
  floatText(cellX(d.col), cellY(d.row) - 30, "LV " + d.lvl, DEF[d.type].c2);
}
function removeDef(d){ if (G.grid[d.row][d.col] === d) G.grid[d.row][d.col] = null; if (G.selDef === d) G.selDef = null; }
function updateDefender(d, dt){
  const S = DEF[d.type], x = cellX(d.col), y = cellY(d.row);
  d.flash = Math.max(0, d.flash - dt); d.hp = Math.min(d.hp, maxHp(d));
  if (d.type === "bnb") return;
  d.cd -= dt;
  if (d.cd > 0) return;
  if (d.type === "usdc") {
    G.drops.push({ x: x + rand(24, 36), y: y - 16, vy: -80, ground: y + 22, val: Math.round(S.income * power(d)), t: 0 });
    d.cd = S.every; return;
  }
  if (d.type === "link") {
    const range = CW * 3.6, near = G.enemies.filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) < range && e.x < VW + 10)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    if (!near.length) return;
    const chain = [near[0]], dmg = S.dmg * power(d);
    for (let i = 0; i < 2 + Math.floor(d.lvl / 2); i++) {      // more jumps at higher levels
      const last = chain[chain.length - 1];
      const nx = G.enemies.filter(e => !e.dead && !chain.includes(e) && Math.hypot(e.x - last.x, e.y - last.y) < CW * 1.7)
        .sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y))[0];
      if (!nx) break; chain.push(nx);
    }
    let px = x, py = y;
    chain.forEach((e, i) => { G.zaps.push({ x1: px, y1: py, x2: e.x, y2: e.y, t: .18, c: S.c2 }); px = e.x; py = e.y;
      hurt(e, dmg * (i ? .7 : 1)); e.slow = Math.max(e.slow, 1.6); });
    d.cd = S.rate; sfx.zap(); return;
  }
  // lane shooters: only fire if a memecoin is in this lane, ahead of the coin, and on screen
  if (!G.enemies.some(e => !e.dead && e.row === d.row && e.x > x - 20 && e.x < VW + 10)) return;
  const dmg = S.dmg * power(d);
  if (d.type === "eth") G.projs.push({ x: x + 22, y, row: d.row, dmg, v: 300, r: 9, pierce: true, hit: new Set(), c: S.c2 });
  else G.projs.push({ x: x + 22, y: y + (d.type === "sol" ? rand(-6, 6) : 0), row: d.row, dmg, v: 460, r: d.type === "sol" ? 4 : 6, c: S.c1 });
  d.cd = S.rate; d.flash = Math.max(d.flash, .08);
  if (d.type === "btc") sfx.shoot(); else if (d.type === "eth") sfx.orb(); else if (Math.random() < .4) sfx.tick();
}

/* ---------- memecoins ---------- */
function spawn(type, row, x){
  const S = ENEMY[type], hpMul = (S.boss ? 1 : Math.pow(waveHp(G.wave), G.D.grow)) * G.D.hp;
  let hp = S.hp * hpMul, dps = S.dps;
  if (S.boss) { const k = G.bosses; hp = S.hp * Math.pow(1.6, k - 1) * G.D.hp * Math.pow(1 + .05 * G.wave, G.D.grow); dps = S.dps * Math.pow(1.25, k - 1); }
  const e = { type, row, x: x != null ? x : VW + 40 + rand(0, 30), y: cellY(row), hp, maxHp: hp, speed: S.speed * rand(.92, 1.08), dps,
    r: S.r || 26, slow: 0, flash: 0, walk: Math.random() * 6, shield: S.shield ? S.shield * hpMul : 0, leapt: false, eating: null,
    boss: !!S.boss, summonT: 5, level: S.boss ? G.bosses : 0, dead: false, jump: 0 };
  G.enemies.push(e); return e;
}
function hurt(e, dmg){
  if (e.dead) return;
  if (e.shield > 0) { const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a; if (e.shield <= 0) burst(e.x, e.y - e.r, "#ff7eb6", 10); }
  e.hp -= dmg; e.flash = .08;
  if (e.hp <= 0) kill(e);
}
function kill(e){
  e.dead = true; G.kills++;
  const S = ENEMY[e.type], reward = Math.round(S.reward * (e.boss ? e.level : 1) * (1 + G.wave * .03));
  G.money += reward; floatText(e.x, e.y - e.r - 6, "+" + money$(reward), "#7dffa8");
  burst(e.x, e.y, S.c, e.boss ? 60 : 16);
  if (S.split) for (const off of [-14, 14]) spawn("mini", e.row, e.x + off);
  if (e.boss) { sfx.boss(); shake = .5; } else sfx.pop();
}
function updateEnemy(e, dt){
  const S = ENEMY[e.type];
  e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt);
  if (e.jump > 0) { e.jump -= dt; e.x -= CW * 1.25 * dt / .45; return; }
  const sp = e.speed * (e.slow > 0 ? .55 : 1);
  if (e.boss) {
    e.summonT -= dt;
    if (e.summonT <= 0) { e.summonT = Math.max(3.5, 7 - e.level * .4);
      for (let i = 0; i < 1 + e.level; i++) spawn(Math.random() < .5 ? "doge" : "shib", Math.floor(Math.random() * ROWS), e.x - 30 + rand(-10, 10));
      floatText(e.x, e.y - e.r - 14, "RUG PULL!", "#ff2438"); sfx.summon(); }
  }
  // find a coin in the way
  let block = null;
  for (let c = 0; c < COLS; c++) { const d = G.grid[e.row][c]; if (!d) continue;
    const dx = cellX(c); if (e.x - e.r < dx + 28 && e.x > dx - 10) { block = d; break; } }
  if (block && S.leap && !e.leapt) { e.leapt = true; e.jump = .45; e.speed *= .6; return; }
  e.eating = block;
  if (block) { block.hp -= e.dps * dt; block.flash = Math.max(block.flash, .05); if (Math.random() < dt * 3) sfx.chomp();
    if (block.hp <= 0) { burst(cellX(block.col), cellY(block.row), "#888", 18); removeDef(block); } }
  else { e.x -= sp * dt; e.walk += sp * dt * .15; }
  if (e.x < GX - 12) {                                       // reached your wallet
    if (G.wallets[e.row]) { G.wallets[e.row] = false; G.walletRuns.push({ row: e.row, x: GX - 46 }); sfx.wallet(); }
    else if (!G.walletRuns.some(w => w.row === e.row)) gameOver();
  }
}

/* ---------- waves ---------- */
function startWave(){
  G.wave++;
  const w = G.wave, types = Object.keys(ENEMY).filter(k => ENEMY[k].from <= w);
  let budget = (3 + w * 2.4) * G.D.budget;
  const list = [];
  while (budget > 0) {
    const pool = types.filter(t => ENEMY[t].cost <= Math.max(1, budget));
    const t = pool[Math.floor(Math.random() * pool.length)];
    list.push(t); budget -= ENEMY[t].cost;
  }
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if (w % BOSS_EVERY === 0) { G.bosses++; list.splice(Math.floor(list.length * .6), 0, "rug"); }
  G.queue = list; G.spawnGap = Math.max(.7, Math.min(4, (18 + w * .8) / list.length)); G.spawnT = 1;
  G.phase = "spawning";
  banner(w % BOSS_EVERY === 0 ? "WAVE " + w + " · BOSS: RUG LV " + G.bosses : "WAVE " + w, w % BOSS_EVERY === 0);
}
function updateWaves(dt){
  if (G.phase === "grace" || G.phase === "break") { if ((G.phaseT -= dt) <= 0) startWave(); return; }
  if (G.queue.length) {
    if ((G.spawnT -= dt) <= 0) {
      const t = G.queue.shift(); spawn(t, Math.floor(Math.random() * ROWS));
      if (t === "rug") sfx.bossIn();
      G.spawnT = G.spawnGap * rand(.6, 1.3) * (G.queue.length < 4 ? .6 : 1);
    }
  } else if (!G.enemies.length) {
    G.phase = "break"; G.phaseT = 7;
    const bonusCash = Math.round(25 + G.wave * 6); G.money += bonusCash;
    floatText(VW / 2, GY + 40, "WAVE CLEARED +" + money$(bonusCash), "#7dffa8", 1.6);
  }
}

/* ---------- main update ---------- */
let shake = 0, bannerT = 0, bannerTxt = "", bannerBoss = false;
function banner(t, boss){ bannerTxt = t; bannerT = 2.6; bannerBoss = boss; }
function update(dt){
  G.t += dt;
  for (const k of ORDER) G.cards[k] = Math.max(0, G.cards[k] - dt);
  updateWaves(dt);
  for (const d of defenders()) updateDefender(d, dt);
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  if (G.state !== "play") return;
  for (const p of G.projs) {
    p.x += p.v * dt;
    for (const e of G.enemies) {
      if (e.dead || e.row !== p.row || Math.abs(e.x - p.x) > e.r + p.r) continue;
      if (p.pierce) { if (!p.hit.has(e)) { p.hit.add(e); hurt(e, p.dmg); } }
      else { hurt(e, p.dmg); p.done = true; burst(p.x, p.y, p.c, 4); break; }
    }
  }
  G.projs = G.projs.filter(p => !p.done && p.x < VW + 30);
  for (const w of G.walletRuns) {                            // cold-wallet sweep down the lane
    w.x += 620 * dt;
    for (const e of G.enemies) if (!e.dead && e.row === w.row && Math.abs(e.x - w.x) < 40) { if (e.boss) { if (!e.wHit) { e.wHit = 1; hurt(e, e.maxHp * .35); } } else kill(e); }
  }
  G.walletRuns = G.walletRuns.filter(w => w.x < VW + 60);
  G.enemies = G.enemies.filter(e => !e.dead);
  // money: drops from USDC, plus random airdrops from the sky
  if ((G.skyT -= dt) <= 0) { G.skyT = rand(9, 13); const x = rand(GX + 30, GX + COLS * CW - 30);
    G.drops.push({ x, y: TOP + 10, vy: 40, ground: rand(GY + 40, GY + ROWS * CH - 30), val: 25, t: 0, sky: true }); }
  for (const m of G.drops) {
    m.t += dt;
    if (m.fly) { m.x += (40 - m.x) * Math.min(1, dt * 7); m.y += (36 - m.y) * Math.min(1, dt * 7);
      if (Math.abs(m.x - 40) < 6 && Math.abs(m.y - 36) < 6) { m.done = true; G.money += m.val; } continue; }
    if (m.y < m.ground) { m.vy += (m.sky ? 0 : 260) * dt; m.y = Math.min(m.ground, m.y + m.vy * dt); }
    if (G.autoLvl ? m.t > AUTO.delay(G.autoLvl) : m.t > AUTO.expire) { if (G.autoLvl) collect(m); else { m.done = true; burst(m.x, m.y, "#555", 6); } }
  }
  G.drops = G.drops.filter(m => !m.done);
}
function collect(m){ if (!m.fly) { m.fly = true; sfx.coin(); } }
function gameOver(){
  G.state = "over";
  const key = "cryptodefense_best_" + G.diff, best = +store.get(key) || 0;
  if (G.wave > best) store.set(key, G.wave);
  sfx.over();
  setTimeout(() => showOver(G.wave > best, best), 900);
}

/* ---------- particles / floating text ---------- */
function burst(x, y, c, n){ for (let i = 0; i < n; i++) { const a = rand(0, 6.28), s = rand(40, 220);
  G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(.3, .8), c }); } }
function floatText(x, y, t, c, life = 1){ G.floats.push({ x, y, t, c, life, max: life }); }

/* ---------- input ---------- */
const cv = $("cv"), ctx = cv.getContext("2d"), wrap = $("wrap");
function toLogical(ev){ const b = cv.getBoundingClientRect(); return { x: (ev.clientX - b.left) / b.width * VW, y: (ev.clientY - b.top) / b.height * VH }; }
function cellAt(p){ const c = Math.floor((p.x - GX) / CW), r = Math.floor((p.y - GY) / CH); return inGrid(c, r) ? { c, r } : null; }
const CARD = i => ({ x: 160 + i * 70, y: 8, w: 64, h: 62 });
const TAB = { def: { x: 110, y: 8, w: 44, h: 30, label: "DEFENSE" }, up: { x: 110, y: 40, w: 44, h: 30, label: "UPGRADES" } };
const UPCARD = { x: 160, y: 8, w: 230, h: 62 };
function buyAuto(){
  if (G.autoLvl >= AUTO.max) { sfx.nope(); return; }
  const cost = AUTO.cost(G.autoLvl); if (G.money < cost) { sfx.nope(); return; }
  G.money -= cost; G.autoLvl++; sfx.up(); floatText(UPCARD.x + UPCARD.w / 2, UPCARD.y + UPCARD.h + 16, "AUTO-COLLECT LV " + G.autoLvl, "#7dffa8");
}
const BTN = { pause: { x: 878, y: 20, w: 34, h: 34 }, speed: { x: 918, y: 20, w: 34, h: 34 } };
const inside = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
let panel = null;   // upgrade/sell panel geometry for the selected coin

function canAfford(k){ return G.money >= DEF[k].cost && G.cards[k] <= 0; }
function tryPlace(cell){
  const k = G.sel, cur = G.grid[cell.r][cell.c];
  if (!canAfford(k)) { sfx.nope(); return; }
  if (!cur) { place(k, cell.c, cell.r); if (!keyShift) G.sel = null; return; }
  if (cur.type === k && cur.lvl === 1) {                    // buy a fresh coin straight into a level-1 coin = merge
    G.money -= DEF[k].cost; G.cards[k] = DEF[k].cd; levelUp(cur); if (!keyShift) G.sel = null; return;
  }
  sfx.nope();
}
let keyShift = false;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("pointerdown", ev => {
  audioInit();
  if (!G || G.state !== "play") return;
  const p = toLogical(ev);
  if (ev.button === 2) { G.sel = null; G.selDef = null; return; }
  // money drops first (easy to grab)
  const m = G.drops.find(m => !m.fly && Math.hypot(m.x - p.x, m.y - p.y) < 24);
  if (m) { collect(m); return; }
  if (inside(p, BTN.pause)) { pause(); return; }
  if (inside(p, BTN.speed)) { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; return; }
  for (const [t, b] of Object.entries(TAB)) if (inside(p, b)) { G.tab = t; G.sel = null; return; }
  if (G.tab === "def") { for (let i = 0; i < ORDER.length; i++) if (inside(p, CARD(i))) { G.sel = G.sel === ORDER[i] ? null : ORDER[i]; G.selDef = null; return; } }
  else if (inside(p, UPCARD)) { buyAuto(); return; }
  if (panel && G.selDef) {
    if (inside(p, panel.up)) { const d = G.selDef, cost = upgradeCost(d);
      if (d.lvl < MAX_LVL && G.money >= cost) { G.money -= cost; levelUp(d); } else sfx.nope(); return; }
    if (inside(p, panel.sell)) { const d = G.selDef; G.money += sellValue(d); burst(cellX(d.col), cellY(d.row), "#aaa", 12); removeDef(d); sfx.coin(); return; }
    if (inside(p, panel.box)) return;
  }
  const cell = cellAt(p);
  if (!cell) { G.selDef = null; return; }
  if (G.sel) { tryPlace(cell); return; }
  const d = G.grid[cell.r][cell.c];
  if (d) { G.drag = { d, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false }; cv.setPointerCapture(ev.pointerId); }
  else G.selDef = null;
});
cv.addEventListener("pointermove", ev => {
  if (!G) return;
  const p = toLogical(ev); G.hover = p;
  if (G.drag) { G.drag.x = p.x; G.drag.y = p.y; if (Math.hypot(p.x - G.drag.x0, p.y - G.drag.y0) > 8) G.drag.moved = true; }
});
cv.addEventListener("pointerleave", () => { if (G) G.hover = null; });
cv.addEventListener("pointerup", ev => {
  if (!G || !G.drag) return;
  const dr = G.drag; G.drag = null;
  if (!dr.moved) { G.selDef = G.selDef === dr.d ? null : dr.d; return; }
  const cell = cellAt(toLogical(ev)); if (!cell) return;
  const d = dr.d, t = G.grid[cell.r][cell.c];
  if (!t) { G.grid[d.row][d.col] = null; d.col = cell.c; d.row = cell.r; G.grid[cell.r][cell.c] = d; sfx.place(); return; }   // move
  if (t === d) return;
  if (t.type === d.type && t.lvl === d.lvl && t.lvl < MAX_LVL) { removeDef(d); levelUp(t); G.selDef = t; return; }          // merge
  sfx.nope();
});
const sellValue = d => Math.round(DEF[d.type].cost * (.5 + .4 * (d.lvl - 1)));
addEventListener("keydown", e => {
  if (e.key === "Shift") keyShift = true;
  if (!G) { if (e.key === "Enter") newGame("normal"); return; }
  if (e.code === "Space") { e.preventDefault(); if (G.state === "play" || G.state === "paused") pause(); return; }
  if (G.state !== "play") return;
  const n = +e.key; if (n >= 1 && n <= ORDER.length) { G.tab = "def"; G.sel = G.sel === ORDER[n - 1] ? null : ORDER[n - 1]; G.selDef = null; }
  if (e.key === "Tab") { e.preventDefault(); G.tab = G.tab === "def" ? "up" : "def"; G.sel = null; }
  if (e.key === "Escape") { G.sel = null; G.selDef = null; }
  if (e.key === "f" || e.key === "F") G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1;
  if (e.key === "u" && G.selDef) { const d = G.selDef, cost = upgradeCost(d); if (d.lvl < MAX_LVL && G.money >= cost) { G.money -= cost; levelUp(d); } }
});
addEventListener("keyup", e => { if (e.key === "Shift") keyShift = false; });
function pause(){ if (G.state === "play") { G.state = "paused"; showPause(); } else if (G.state === "paused") { G.state = "play"; hideScreen(); } }
addEventListener("blur", () => { keyShift = false; if (G && G.state === "play") pause(); });

/* ---------- sound ---------- */
let ac = null, muted = store.get("cryptodefense_mute") === "1";
function audioInit(){ if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} if (ac && ac.state === "suspended") ac.resume(); }
function tone(f, d, type = "square", vol = .04, slide = 0){
  if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
}
const sfx = {
  shoot: () => tone(520, .06, "square", .015, 300), tick: () => tone(900, .03, "square", .008), orb: () => tone(300, .2, "sine", .03, 600),
  zap: () => tone(1400, .12, "sawtooth", .02, 200), pop: () => tone(260, .12, "triangle", .04, 120), chomp: () => tone(90, .05, "square", .02),
  coin: () => { tone(1100, .06, "triangle", .04); setTimeout(() => tone(1650, .1, "triangle", .04), 50); },
  place: () => tone(330, .08, "triangle", .05, 500), up: () => [523, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .12, "triangle", .05), i * 70)),
  nope: () => tone(140, .12, "square", .03), wallet: () => tone(200, .5, "sawtooth", .05, 900), summon: () => tone(120, .4, "sawtooth", .04, 60),
  bossIn: () => tone(70, 1, "sawtooth", .07, 40), boss: () => [400, 300, 500, 800].forEach((f, i) => setTimeout(() => tone(f, .2, "triangle", .06), i * 90)),
  over: () => tone(300, 1.2, "sawtooth", .06, 40),
};
addEventListener("keydown", e => { if (e.key === "m" || e.key === "M") { muted = !muted; store.set("cryptodefense_mute", muted ? "1" : "0"); } });

/* ---------- drawing ---------- */
let scale = 1, k = 1;
function resize(){
  scale = Math.min(innerWidth / VW, innerHeight / VH);
  wrap.style.width = VW * scale + "px"; wrap.style.height = VH * scale + "px"; wrap.style.setProperty("--s", scale);
  k = scale * Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(VW * k); cv.height = Math.round(VH * k);
}
addEventListener("resize", resize); resize();

const candles = Array.from({ length: 60 }, (_, i) => { const o = 300 + Math.sin(i * .5) * 60 + rand(-30, 30); return { o, c: o + rand(-40, 40), h: rand(10, 40) }; });
function drawBg(){
  ctx.fillStyle = "#08080c"; ctx.fillRect(0, 0, VW, VH);
  // faint price chart behind the board
  ctx.save(); ctx.globalAlpha = .07;
  candles.forEach((c, i) => { const x = 10 + i * 16, up = c.c > c.o; ctx.fillStyle = ctx.strokeStyle = up ? "#14f195" : "#ff2438";
    ctx.fillRect(x, Math.min(c.o, c.c), 8, Math.max(2, Math.abs(c.c - c.o))); ctx.fillRect(x + 3.5, Math.min(c.o, c.c) - c.h / 2, 1, Math.abs(c.c - c.o) + c.h); });
  ctx.restore();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.018)";
    ctx.fillRect(GX + c * CW, GY + r * CH, CW, CH);
  }
  ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1; ctx.strokeRect(GX + .5, GY + .5, COLS * CW, ROWS * CH);
}
function coinBody(x, y, r, c1, c2, label, glow = 14){
  ctx.save();
  ctx.shadowColor = c1; ctx.shadowBlur = glow;
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, c2); g.addColorStop(.55, c1); g.addColorStop(1, shade(c1, -.45));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1.5, r * .09); ctx.strokeStyle = shade(c1, -.55); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(x, y, r * .78, 0, 7); ctx.stroke();
  if (label) { ctx.fillStyle = "rgba(10,10,14,.85)"; ctx.font = `700 ${Math.round(r * (label.length > 3 ? .52 : .62))}px "Space Mono", monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, y + 1); }
  ctx.restore();
}
function shade(hex, f){ const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
function drawDefender(d, x, y, ghost){
  const S = DEF[d.type], bob = Math.sin(G.t * 2 + d.bob) * 2, r = 25 + Math.min(d.lvl, 7) * 1.6;
  ctx.save(); if (ghost) ctx.globalAlpha = .55;
  // level halo rings
  for (let i = 1; i < Math.min(d.lvl, 6); i++) { ctx.strokeStyle = S.c2; ctx.globalAlpha = (ghost ? .3 : .55) - i * .06; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y + bob, r + 4 + i * 3.5, G.t * (i % 2 ? 1 : -1) + i, G.t * (i % 2 ? 1 : -1) + i + 4.2); ctx.stroke(); }
  ctx.globalAlpha = ghost ? .55 : 1;
  coinBody(x, y + bob, r, d.flash > 0 ? "#ffffff" : S.c1, S.c2, S.name, 10 + d.lvl * 4);
  if (d.type === "bnb") { ctx.strokeStyle = "rgba(10,10,14,.6)"; ctx.lineWidth = 2; ctx.strokeRect(x - r * .55, y + bob - r * .55, r * 1.1, r * 1.1); }
  // stars
  ctx.fillStyle = S.c2; ctx.font = "700 11px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(d.lvl <= 5 ? "★".repeat(d.lvl) : "★ " + d.lvl, x, y + bob + r + 13);
  if (!ghost && d.hp < maxHp(d) - 1) bar(x - 26, y - r - 12, 52, d.hp / maxHp(d), "#7dffa8");
  ctx.restore();
}
function bar(x, y, w, f, c){ ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x, y, w, 4); ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, f), 4); }
function drawEnemy(e){
  const S = ENEMY[e.type], r = e.r, hop = e.jump > 0 ? -Math.sin((1 - e.jump / .45) * Math.PI) * 40 : 0;
  const x = e.x, y = e.y + hop + (e.eating ? Math.sin(G.t * 18) * 1.5 : Math.abs(Math.sin(e.walk)) * -3);
  ctx.save();
  // legs
  ctx.strokeStyle = shade(S.c, -.5); ctx.lineWidth = Math.max(2, r * .12); ctx.lineCap = "round";
  const sw = Math.sin(e.walk * 2) * r * .3;
  ctx.beginPath(); ctx.moveTo(x - r * .3, y + r * .8); ctx.lineTo(x - r * .35 + sw, y + r * 1.25);
  ctx.moveTo(x + r * .3, y + r * .8); ctx.lineTo(x + r * .35 - sw, y + r * 1.25); ctx.stroke();
  coinBody(x, y, r, e.flash > 0 ? "#ffffff" : e.slow > 0 ? "#7fb2ff" : S.c, shade(S.c, .45), null, e.boss ? 30 : 8);
  // face: googly eyes looking left + mouth
  const ey = y - r * .28, er = r * .2;
  for (const s of [-1, 1]) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + s * r * .32, ey, er, 0, 7); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x + s * r * .32 - er * .4, ey + er * .15, er * .5, 0, 7); ctx.fill(); }
  if (e.boss) { ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x - r * .55, ey - er * 1.6); ctx.lineTo(x - r * .12, ey - er * .9); ctx.moveTo(x + r * .55, ey - er * 1.6); ctx.lineTo(x + r * .12, ey - er * .9); ctx.stroke(); }
  ctx.fillStyle = "#111"; ctx.beginPath();
  if (e.eating) ctx.ellipse(x - r * .05, y + r * .45, r * .22, r * .16 * (1 + Math.sin(G.t * 18)), 0, 0, 7); else ctx.ellipse(x - r * .05, y + r * .48, r * .2, r * .06, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(10,10,14,.85)"; ctx.font = `700 ${Math.round(r * (S.name.length > 4 ? .34 : .4))}px "Space Mono", monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(S.name, x, y + r * .15);
  if (e.shield > 0) {                                        // knit hat soaks damage
    ctx.fillStyle = "#ff7eb6"; ctx.beginPath(); ctx.ellipse(x, y - r * .78, r * .72, r * .42, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(x - r * .76, y - r * .82, r * 1.52, r * .2); ctx.beginPath(); ctx.arc(x, y - r * 1.22, r * .14, 0, 7); ctx.fill();
  }
  if (e.boss) {                                              // crown + level
    ctx.fillStyle = "#ffd700"; ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 12; ctx.beginPath();
    const cy = y - r * .95; ctx.moveTo(x - r * .5, cy); ctx.lineTo(x - r * .5, cy - r * .35); ctx.lineTo(x - r * .25, cy - r * .15);
    ctx.lineTo(x, cy - r * .45); ctx.lineTo(x + r * .25, cy - r * .15); ctx.lineTo(x + r * .5, cy - r * .35); ctx.lineTo(x + r * .5, cy); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#ffd700"; ctx.font = "700 12px 'Space Mono', monospace"; ctx.fillText("LV " + e.level, x, y + r + 26);
  }
  if (e.hp < e.maxHp) bar(x - r, y - r - (e.shield > 0 ? 24 : 10) - (e.boss ? 18 : 0), r * 2, e.hp / e.maxHp, e.boss ? "#ff2438" : "#ffb020");
  ctx.restore();
}
function drawTop(){
  ctx.fillStyle = "rgba(10,10,14,.92)"; ctx.fillRect(0, 0, VW, TOP); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, TOP - 1, VW, 1);
  // money
  ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillRect(8, 8, 96, 62); ctx.strokeStyle = "rgba(125,255,168,.4)"; ctx.strokeRect(8.5, 8.5, 95, 61);
  ctx.textAlign = "center"; ctx.fillStyle = "#7d7d88"; ctx.font = "700 9px 'Space Mono', monospace"; ctx.fillText("BALANCE", 56, 24);
  ctx.fillStyle = "#7dffa8"; ctx.font = `700 ${G.money >= 10000 ? 14 : 17}px 'Space Mono', monospace`; ctx.fillText(money$(G.money), 56, 50);
  // tabs
  for (const [t, b] of Object.entries(TAB)) { const on = G.tab === t;
    ctx.fillStyle = on ? "rgba(247,147,26,.16)" : "rgba(255,255,255,.03)"; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = on ? "#f7931a" : "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    ctx.fillStyle = on ? "#f7931a" : "#7d7d88"; ctx.font = "700 7.5px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(b.label, b.x + b.w / 2, b.y + 18);
    if (t === "up" && G.autoLvl < AUTO.max && G.money >= AUTO.cost(G.autoLvl) && !on) { ctx.fillStyle = "#7dffa8"; ctx.beginPath(); ctx.arc(b.x + b.w - 5, b.y + 5, 3, 0, 7); ctx.fill(); }
  }
  if (G.tab === "def") {
    ORDER.forEach((key, i) => {
      const S = DEF[key], b = CARD(i), ok = canAfford(key), sel = G.sel === key;
      ctx.fillStyle = sel ? "rgba(247,147,26,.16)" : "rgba(255,255,255,.04)"; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = sel ? "#f7931a" : "rgba(255,255,255,.14)"; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
      ctx.globalAlpha = ok ? 1 : .4; coinBody(b.x + b.w / 2, b.y + 24, 15, S.c1, S.c2, S.name, ok ? 8 : 0); ctx.globalAlpha = 1;
      ctx.fillStyle = G.money >= S.cost ? "#e9e9ee" : "#ff5a6a"; ctx.font = "700 11px 'Space Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText("$" + S.cost, b.x + b.w / 2, b.y + b.h - 8);
      ctx.fillStyle = "#555"; ctx.font = "9px 'Space Mono', monospace"; ctx.textAlign = "left"; ctx.fillText(i + 1, b.x + 4, b.y + 12);
      if (G.cards[key] > 0) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(b.x, b.y, b.w, b.h * G.cards[key] / S.cd); }
    });
  } else drawUpgradeCard();
  // wave / boss info
  ctx.textAlign = "left"; ctx.fillStyle = "#7d7d88"; ctx.font = "700 9px 'Space Mono', monospace"; ctx.fillText("WAVE", 600, 24);
  ctx.fillStyle = "#e9e9ee"; ctx.font = "700 20px 'Space Mono', monospace"; ctx.fillText(G.wave || "-", 600, 48);
  ctx.fillStyle = "#7d7d88"; ctx.font = "9px 'Space Mono', monospace";
  const next = BOSS_EVERY - (G.wave % BOSS_EVERY);
  ctx.fillText(G.phase === "spawning" ? G.queue.length + " incoming" : "next in " + Math.ceil(G.phaseT) + "s", 600, 64);
  ctx.fillText(G.wave % BOSS_EVERY === 0 && G.phase === "spawning" ? "BOSS WAVE" : "boss in " + next + (next === 1 ? " wave" : " waves"), 700, 24);
  ctx.fillText(G.kills + " rugged", 700, 40); ctx.fillText(G.D.label, 700, 56);
  // buttons
  for (const [name, b] of Object.entries(BTN)) {
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    ctx.fillStyle = "#e9e9ee"; ctx.textAlign = "center"; ctx.font = "700 12px 'Space Mono', monospace";
    ctx.fillText(name === "pause" ? "II" : G.speed + "x", b.x + b.w / 2, b.y + 22);
  }
}
function drawUpgradeCard(){
  const b = UPCARD, l = G.autoLvl, max = l >= AUTO.max, cost = max ? 0 : AUTO.cost(l), ok = !max && G.money >= cost;
  ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = ok ? "#7dffa8" : "rgba(255,255,255,.14)"; ctx.lineWidth = ok ? 1.5 : 1; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
  coinBody(b.x + 26, b.y + 31, 16, "#1f9d55", "#a6ffcb", "$", ok ? 10 : 0);
  ctx.textAlign = "left"; ctx.fillStyle = "#e9e9ee"; ctx.font = "700 11px 'Space Mono', monospace"; ctx.fillText("AUTO-COLLECT", b.x + 50, b.y + 20);
  ctx.fillStyle = "#7d7d88"; ctx.font = "9px 'Space Mono', monospace";
  ctx.fillText(l ? "collects $ after " + AUTO.delay(l).toFixed(1) + "s" : "off · drops vanish after " + AUTO.expire + "s", b.x + 50, b.y + 34);
  ctx.fillText(max ? "max level" : "next: " + AUTO.delay(l + 1).toFixed(1) + "s", b.x + 50, b.y + 47);
  for (let i = 0; i < AUTO.max; i++) { ctx.fillStyle = i < l ? "#7dffa8" : "rgba(255,255,255,.12)"; ctx.fillRect(b.x + 50 + i * 9, b.y + 53, 7, 4); }
  ctx.textAlign = "right"; ctx.font = "700 11px 'Space Mono', monospace"; ctx.fillStyle = max ? "#7dffa8" : ok ? "#e9e9ee" : "#ff5a6a";
  ctx.fillText(max ? "MAX" : money$(cost), b.x + b.w - 8, b.y + 20);
  ctx.fillStyle = "#7d7d88"; ctx.font = "9px 'Space Mono', monospace"; ctx.fillText("LV " + l + "/" + AUTO.max, b.x + b.w - 8, b.y + 34);
  ctx.textAlign = "center"; ctx.fillStyle = "#555"; ctx.font = "9px 'Space Mono', monospace"; ctx.fillText("more upgrades coming soon", b.x + b.w + 100, b.y + 36);
}
function drawPanel(){
  panel = null; const d = G.selDef; if (!d || !G.grid[d.row][d.col]) return;
  const S = DEF[d.type], x = cellX(d.col), y = cellY(d.row), w = 196, h = 104;
  const bx = Math.max(4, Math.min(VW - w - 4, x - w / 2)), by = d.row === 0 ? y + 46 : y - h - 44;
  ctx.save(); ctx.fillStyle = "rgba(12,12,18,.96)"; ctx.fillRect(bx, by, w, h); ctx.strokeStyle = S.c1; ctx.strokeRect(bx + .5, by + .5, w - 1, h - 1);
  ctx.textAlign = "left"; ctx.fillStyle = S.c2; ctx.font = "700 12px 'Space Mono', monospace"; ctx.fillText(S.name + "  LV " + d.lvl + (d.lvl >= MAX_LVL ? " (MAX)" : ""), bx + 10, by + 18);
  const b = bonus(d), pw = power(d);
  ctx.fillStyle = "#b8b8c4"; ctx.font = "10px 'Space Mono', monospace";
  const stat = d.type === "usdc" ? "mints " + money$(S.income * pw) + " / " + S.every + "s" : d.type === "bnb" ? "health " + Math.round(maxHp(d)) : "damage " + (S.dmg * pw).toFixed(1);
  ctx.fillText(stat, bx + 10, by + 34);
  ctx.fillText("network bonus +" + Math.round(b * 100) + "%", bx + 10, by + 48);
  const up = { x: bx + 8, y: by + 60, w: 112, h: 34 }, sell = { x: bx + 126, y: by + 60, w: 62, h: 34 };
  const cost = upgradeCost(d), canUp = d.lvl < MAX_LVL && G.money >= cost;
  ctx.fillStyle = canUp ? "rgba(125,255,168,.14)" : "rgba(255,255,255,.04)"; ctx.fillRect(up.x, up.y, up.w, up.h);
  ctx.strokeStyle = canUp ? "#7dffa8" : "rgba(255,255,255,.2)"; ctx.strokeRect(up.x + .5, up.y + .5, up.w - 1, up.h - 1);
  ctx.fillStyle = canUp ? "#7dffa8" : "#666"; ctx.textAlign = "center"; ctx.font = "700 10px 'Space Mono', monospace";
  ctx.fillText(d.lvl >= MAX_LVL ? "MAX LEVEL" : "UPGRADE " + money$(cost), up.x + up.w / 2, up.y + 21);
  ctx.strokeStyle = "rgba(255,90,106,.6)"; ctx.strokeRect(sell.x + .5, sell.y + .5, sell.w - 1, sell.h - 1);
  ctx.fillStyle = "#ff8a96"; ctx.fillText("SELL " + money$(sellValue(d)), sell.x + sell.w / 2, sell.y + 21);
  ctx.restore();
  panel = { box: { x: bx, y: by, w, h }, up, sell };
}

/* ---------- hover info (stats + what it does) ---------- */
const fmt1 = n => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString();
function defLines(type, d){                    // d = a placed coin, or null for the shop card (level 1)
  const S = DEF[type], pw = d ? power(d) : 1, lines = [];
  const hp = d ? maxHp(d) : S.hp;
  if (type === "usdc") { const per = S.income * pw; lines.push(["Mints", money$(per) + " every " + S.every + "s"], ["Per minute", money$(per * 60 / S.every)]); }
  else if (S.dmg) {
    const dmg = S.dmg * pw;
    lines.push(["Damage", fmt1(dmg) + " per hit"], ["Fire rate", fmt1(1 / S.rate) + " / sec"], ["DPS", fmt1(dmg / S.rate) + (type === "link" ? " (+70% per chain jump)" : type === "eth" ? " to every coin hit" : "")]);
    if (type === "link") lines.push(["Chain", "hits " + (1 + 2 + Math.floor((d ? d.lvl : 1) / 2)) + " memecoins"]);
  }
  lines.push(["Health", fmt1(hp)]);
  if (d) { lines.push(["Level", d.lvl + " / " + MAX_LVL + "  (x" + fmt1(lvlDmg(d.lvl)) + ")"], ["Network", "+" + Math.round(bonus(d) * 100) + "%"]);
    lines.push(["Upgrade", d.lvl >= MAX_LVL ? "max level" : money$(upgradeCost(d))]); }
  else lines.push(["Cost", money$(S.cost)], ["Recharge", S.cd + "s"]);
  return lines;
}
function enemyLines(e){
  const S = ENEMY[e.type], lines = [["Health", fmt1(Math.max(0, e.hp)) + " / " + fmt1(e.maxHp)]];
  if (e.shield > 0) lines.push(["Hat", fmt1(e.shield) + " shield left"]);
  lines.push(["Speed", fmt1(e.speed / CW * 10) + " tiles / 10s"], ["Bite", fmt1(e.dps) + " dmg / sec"], ["Reward", money$(S.reward * (e.boss ? e.level : 1) * (1 + G.wave * .03))]);
  if (e.boss) lines.push(["Boss level", e.level]);
  return lines;
}
function hoverTarget(){
  const p = G.hover; if (!p || G.drag) return null;
  if (G.tab === "up" && inside(p, UPCARD)) { const l = G.autoLvl;
    return { title: "AUTO-COLLECT", c: "#7dffa8", role: "UPGRADE · " + (l ? "LV " + l + "/" + AUTO.max : "NOT OWNED"),
      ability: "Automatically grabs $ drops so you don't have to click them. Each level collects them faster (never instant). Lasts the whole run.",
      lines: [["Now", l ? AUTO.delay(l).toFixed(1) + "s" : "off (drops vanish after " + AUTO.expire + "s)"], ["Next level", l >= AUTO.max ? "max" : AUTO.delay(l + 1).toFixed(1) + "s"],
        ["Max (lv " + AUTO.max + ")", AUTO.delay(AUTO.max).toFixed(1) + "s"], ["Cost", l >= AUTO.max ? "-" : money$(AUTO.cost(l))]], x: p.x, y: UPCARD.y + UPCARD.h + 6 }; }
  if (G.tab === "def") for (let i = 0; i < ORDER.length; i++) if (inside(p, CARD(i))) return { title: DEF[ORDER[i]].name, c: DEF[ORDER[i]].c1, role: DEF[ORDER[i]].role, ability: DEF[ORDER[i]].ability, lines: defLines(ORDER[i], null), x: p.x, y: CARD(i).y + CARD(i).h + 6 };
  if (panel && inside(p, panel.box)) return null;
  for (const e of G.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 4) { const S = ENEMY[e.type];
    return { title: S.name, c: S.c, role: S.role, ability: S.ability, lines: enemyLines(e), x: p.x + 16, y: p.y + 16 }; }
  const cell = cellAt(p), d = cell && G.grid[cell.r][cell.c];
  if (d && !G.sel) { const S = DEF[d.type]; return { title: S.name + "  LV " + d.lvl, c: S.c1, role: S.role, ability: S.ability, lines: defLines(d.type, d), x: p.x + 16, y: p.y + 16 }; }
  return null;
}
function wrapText(t, w){ const words = t.split(" "), out = []; let line = "";
  for (const wd of words) { const test = line ? line + " " + wd : wd; if (ctx.measureText(test).width > w && line) { out.push(line); line = wd; } else line = test; }
  if (line) out.push(line); return out; }
function drawTooltip(){
  const h = G && hoverTarget(); if (!h) return;
  const W = 236, pad = 10;
  ctx.save(); ctx.font = "10px 'Space Mono', monospace";
  const ab = wrapText(h.ability, W - pad * 2), H = pad * 2 + 18 + 14 + ab.length * 13 + 6 + h.lines.length * 14;
  let x = h.x, y = h.y;
  if (x + W > VW - 4) x = Math.max(4, h.x - W - 24); if (y + H > VH - 4) y = Math.max(4, VH - H - 4);
  ctx.fillStyle = "rgba(10,10,16,.97)"; ctx.fillRect(x, y, W, H); ctx.strokeStyle = h.c; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, W - 1, H - 1);
  ctx.fillStyle = h.c; ctx.fillRect(x, y, 3, H);
  let ty = y + pad + 11; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e9e9ee"; ctx.font = "700 13px 'Space Mono', monospace"; ctx.fillText(h.title, x + pad, ty);
  ty += 16; ctx.fillStyle = h.c; ctx.font = "700 9px 'Space Mono', monospace"; ctx.fillText(h.role, x + pad, ty);
  ctx.fillStyle = "#b8b8c4"; ctx.font = "10px 'Space Mono', monospace";
  for (const l of ab) { ty += 13; ctx.fillText(l, x + pad, ty); }
  ty += 6; ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(x + pad, ty, W - pad * 2, 1);
  for (const [kk, v] of h.lines) { ty += 14; ctx.fillStyle = "#7d7d88"; ctx.textAlign = "left"; ctx.fillText(kk, x + pad, ty);
    ctx.fillStyle = "#e9e9ee"; ctx.textAlign = "right"; ctx.fillText(String(v), x + W - pad, ty); }
  ctx.restore();
}
function render(dt){
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (!G) { drawBg(); return; }
  const sh = shake > 0 ? (shake -= dt, rand(-4, 4) * shake * 2) : 0;
  ctx.save(); ctx.translate(sh, sh * .6);
  drawBg();
  // wallets (one-time lane clear)
  for (let r = 0; r < ROWS; r++) if (G.wallets[r]) {
    const x = GX - 46, y = cellY(r);
    ctx.fillStyle = "#1b1b24"; ctx.fillRect(x - 22, y - 16, 44, 32); ctx.strokeStyle = "#7dffa8"; ctx.lineWidth = 1.5; ctx.strokeRect(x - 22, y - 16, 44, 32);
    ctx.fillStyle = "#7dffa8"; ctx.font = "700 8px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("COLD", x, y - 2); ctx.fillText("WALLET", x, y + 8);
  }
  for (const w of G.walletRuns) { const y = cellY(w.row); ctx.save(); ctx.shadowColor = "#7dffa8"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#7dffa8"; ctx.fillRect(w.x - 24, y - 18, 48, 36); ctx.restore(); }
  // placement preview
  const hc = G.hover && cellAt(G.hover);
  if (hc && (G.sel || (G.drag && G.drag.moved))) {
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(GX + hc.c * CW, GY + hc.r * CH, CW, CH);
    const t = G.grid[hc.r][hc.c], src = G.drag ? G.drag.d : null;
    const merge = t && (src ? t !== src && t.type === src.type && t.lvl === src.lvl && t.lvl < MAX_LVL : t.type === G.sel && t.lvl === 1);
    if (merge) { ctx.strokeStyle = "#7dffa8"; ctx.lineWidth = 2; ctx.strokeRect(GX + hc.c * CW + 3, GY + hc.r * CH + 3, CW - 6, CH - 6);
      ctx.fillStyle = "#7dffa8"; ctx.font = "700 10px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("MERGE → LV " + (t.lvl + 1), cellX(hc.c), GY + hc.r * CH + 14); }
    else if (G.sel && !t) drawDefender({ type: G.sel, lvl: 1, bob: 0, flash: 0, hp: 1 }, cellX(hc.c), cellY(hc.r), true);
  }
  // selected coin outline
  if (G.selDef && G.grid[G.selDef.row][G.selDef.col] === G.selDef) { ctx.strokeStyle = DEF[G.selDef.type].c1; ctx.lineWidth = 2;
    ctx.strokeRect(GX + G.selDef.col * CW + 3, GY + G.selDef.row * CH + 3, CW - 6, CH - 6); }
  for (const d of defenders()) { if (G.drag && G.drag.moved && G.drag.d === d) continue; drawDefender(d, cellX(d.col), cellY(d.row)); }
  const es = G.enemies.slice().sort((a, b) => a.row - b.row);
  for (const e of es) drawEnemy(e);
  for (const p of G.projs) { ctx.save(); ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.restore(); }
  for (const z of G.zaps) {
    z.t -= dt; ctx.save(); ctx.strokeStyle = z.c; ctx.shadowColor = z.c; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.globalAlpha = Math.max(0, z.t / .18);
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
    for (let i = 1; i < 6; i++) { const f = i / 6; ctx.lineTo(z.x1 + (z.x2 - z.x1) * f + rand(-6, 6), z.y1 + (z.y2 - z.y1) * f + rand(-6, 6)); }
    ctx.lineTo(z.x2, z.y2); ctx.stroke(); ctx.restore();
  }
  G.zaps = G.zaps.filter(z => z.t > 0);
  for (const m of G.drops) { const pulse = 1 + Math.sin(G.t * 6 + m.x) * .06;
    coinBody(m.x, m.y, 15 * pulse, "#1f9d55", "#a6ffcb", "$", 16);
    if (!m.fly) { const total = G.autoLvl ? AUTO.delay(G.autoLvl) : AUTO.expire, f = Math.min(1, m.t / total);
      if (!G.autoLvl && total - m.t < 3 && Math.floor(m.t * 6) % 2) { ctx.globalAlpha = .35; coinBody(m.x, m.y, 15, "#000000", "#000000", null, 0); }
      ctx.globalAlpha = .6; ctx.strokeStyle = G.autoLvl ? "#7dffa8" : "#ff8a96"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, 20, -1.57, -1.57 + 6.28 * f); ctx.stroke(); ctx.globalAlpha = 1; } }
  for (const q of G.parts) { q.life -= dt; q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); ctx.fillStyle = q.c; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  ctx.globalAlpha = 1; G.parts = G.parts.filter(q => q.life > 0);
  for (const f of G.floats) { f.life -= dt; f.y -= 28 * dt; ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 2));
    ctx.fillStyle = f.c; ctx.font = "700 12px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1; G.floats = G.floats.filter(f => f.life > 0);
  if (G.drag && G.drag.moved) drawDefender(G.drag.d, G.drag.x, G.drag.y, true);
  drawPanel();
  if (bannerT > 0) { bannerT -= dt; ctx.save(); ctx.globalAlpha = Math.min(1, bannerT); ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, VH / 2 - 34, VW, 68);
    ctx.fillStyle = bannerBoss ? "#ff2438" : "#f7931a"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16;
    ctx.font = "700 30px 'Space Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(bannerTxt, VW / 2, VH / 2); ctx.restore(); }
  ctx.restore();
  drawTop();
  if (G.phase === "grace" && G.wave === 0) { ctx.fillStyle = "#7d7d88"; ctx.font = "11px 'Space Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("place USDC to mint money, then shooters to defend · memecoins arrive in " + Math.ceil(G.phaseT) + "s", VW / 2, VH - 10); }
  drawTooltip();
}

/* ---------- screens ---------- */
const scr = $("screen");
function show(html){ scr.innerHTML = html; scr.classList.remove("off"); }
function hideScreen(){ scr.classList.add("off"); }
const bestOf = d => +store.get("cryptodefense_best_" + d) || 0;
function diffButtons(){
  return `<div class="row">${Object.entries(DIFF).map(([k, d]) =>
    `<button data-diff="${k}">${d.label}<small>${bestOf(k) ? "best wave " + bestOf(k) : "start " + money$(d.money)}</small></button>`).join("")}</div>`;
}
function wireButtons(){ scr.querySelectorAll("[data-diff]").forEach(b => b.onclick = () => { audioInit(); newGame(b.dataset.diff); });
  const r = scr.querySelector("[data-resume]"); if (r) r.onclick = pause; const q = scr.querySelector("[data-quit]"); if (q) q.onclick = showTitle; }
function showTitle(){
  G = null;
  show(`<h1>CRYPTO <span>DEFENSE</span></h1>
    <div class="muted">mainstream coins vs memecoins · endless waves · a RUG boss every ${BOSS_EVERY} waves that keeps getting stronger</div>
    <div class="cards">${ORDER.map(k => `<div><b style="color:${DEF[k].c1}">${DEF[k].name}</b> ${DEF[k].desc}</div>`).join("")}</div>
    <div class="muted">drag a coin onto an identical coin to <b>merge</b> · click a coin to <b>upgrade</b> or sell<br>
      matching coins next to each other boost each other (network effect) · click the $ drops to collect, or buy AUTO-COLLECT in the upgrades tab</div>
    ${diffButtons()}
    <div class="muted">1-6 pick coin · tab switch shop tab · shift+click place many · space pause · F speed · M mute</div>
    <a href="../../">← ffxke.lol</a>`);
  wireButtons();
}
function showPause(){ show(`<h2>PAUSED</h2><div class="row"><button data-resume>RESUME</button><button data-quit>QUIT</button></div>`); wireButtons(); }
function showOver(pb, best){
  show(`<div class="rekt">REKT</div><h2>SURVIVED ${G.wave} WAVE${G.wave === 1 ? "" : "S"}</h2>
    <div class="muted">${G.kills} memecoins rugged · ${G.bosses} boss${G.bosses === 1 ? "" : "es"} faced · ${G.D.label}</div>
    <div class="${pb ? "" : "muted"}" style="${pb ? "color:#f7931a" : ""}">${pb ? "new best!" : "best wave " + best}</div>
    ${diffButtons()}<a href="#" data-quit>menu</a>`);
  wireButtons();
}

/* ---------- loop ---------- */
let last = performance.now();
const STEP = 1 / 60;
function frame(now){
  const dt = Math.min((now - last) / 1000, .1); last = now;
  if (G && G.state === "play") { let left = dt * G.speed; while (left > 0 && G.state === "play") { const s = Math.min(STEP, left); update(s); left -= s; } }
  render(G && G.state === "play" ? dt * G.speed : 0);
  requestAnimationFrame(frame);
}
window.__def = k => DEF[k]; window.cryptodefenseDebug = { newGame, update, spawn, place, levelUp, bonus, power, get G(){ return G; } };
showTitle();
requestAnimationFrame(frame);
})();
