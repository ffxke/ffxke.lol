/* STICKBOY — two-player co-op puzzle platformer.
   red: WASD   blue: arrow keys   R: restart level   Esc/P: pause   M: mute
   URL options: ?seed=1234 (replay a run)   ?chunk=gate (test one segment on a 2-floor level) */
(() => {
"use strict";

/* ---------- tuning ---------- */
const T = 36, VW = 960, VH = 540, HUD_H = 38;  // tile size, view size (logical px), space kept for the HUD
const RUN_LENGTH = 10;                          // levels per run
const GRAV = 2200, JUMP = 760, MAXFALL = 900;
const SPEED = 230, PUSH_SPEED = 0.55;
const ACC_GROUND = 2600, ACC_STOP = 3200, ACC_AIR = 1700;
const COYOTE = 0.09, BUFFER = 0.12;
const STEP = 1 / 120;
const COL = { red: "#ff2438", blue: "#2f8cff", green: "#39e75f", amber: "#ffb020" };

/* ---------- helpers ---------- */
function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(a, b){ let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 0x632be59b) >>> 0, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x27d4eb2d); return (h ^ h >>> 15) >>> 0; }
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
function fmt(ms){ const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(c).padStart(2, "0"); }
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
                set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };

/* ---------- level generation ----------
   A level is a stack of floors, zigzagging upwards (like Fireboy & Watergirl):
   floor 0 (bottom) runs left → right, floor 1 right → left, ... doors are on the top floor.
   Each floor = wall | entry hole (4) | ~30 tiles of random segments | climb ledge (4) | wall      */
const CHUNKS = window.STICKBOY_CHUNKS;
const FW = 40, BAND = 6, MID = FW - 10;            // floor width, rows per floor, space for segments
const floorCount = lvl => lvl <= 3 ? 3 : 4;
const SWAP = { R: "B", B: "R", r: "b", b: "r", "{": "}", "}": "{" };
function transform(rows, mirror, swap){
  return rows.map(row => {
    let s = mirror ? row.split("").reverse().join("") : row;
    if (swap) s = s.replace(/[RBrb{}]/g, c => SWAP[c]);
    return s;
  });
}
CHUNKS.forEach(c => { if (c.rows.length !== BAND || c.rows.some(r => r.length !== c.rows[0].length)) console.warn("segment '" + c.name + "' must be " + BAND + " equal-length rows"); });

function buildLevel(num, seed, only){
  const rng = mulberry32(hash(seed, num));
  const N = only ? 2 : floorCount(num), rows = 1 + N * BAND;
  const maxTier = num <= 2 ? 1 : 2, pool = CHUNKS.filter(c => c.tier <= maxTier);
  const topTier = pool.filter(c => c.tier === maxTier), forceFloor = Math.floor(rng() * N);
  const map = Array.from({ length: rows }, () => Array(FW).fill("#"));
  const grp = Array.from({ length: rows }, () => Array(FW).fill(0));
  const L = { map, grp, w: FW, rows, boxes: [], gems: [], buttons: [], groups: [{ tiles: [], active: false }], exits: {}, spawn: {}, parts: [], segs: [] };

  for (let f = 0; f < N; f++) {
    const top = f === N - 1, flip = f % 2 === 1;
    const cols = [];                                       // list of [5 chars (top→floor), group]
    const add = (segRows, gi) => { for (let i = 0; i < segRows[0].length; i++) cols.push([segRows.map(r => r[i]), gi]); };
    const filler = n => { for (let i = 0; i < n; i++) {
      const c = [".", ".", ".", ".", ".", "#"]; if (rng() < .07) c[3] = rng() < .5 ? "r" : "b"; cols.push([c, 0]); } };
    const wall = ["#", "#", "#", "#", "#", "#"];
    add(wall, 0);                                                                      // outer wall
    add(["....", "....", "....", "....", "....", f === 0 ? "####" : "...#"], 0);       // entry (hole up from the floor below)
    // random segments for the middle
    let left = MID, first = true;
    while (true) {
      let cand = only ? (f === 0 && first ? [only] : []) : pool.filter(c => c.rows[0].length + 1 <= left);
      if (first && f === forceFloor && !only) cand = topTier.filter(c => c.rows[0].length + 1 <= left);
      if (!cand.length || (!first && rng() < .12)) break;
      const c = cand[Math.floor(rng() * cand.length)], m = c.mirror && rng() < .5, s = rng() < .5;
      const gap = 1 + Math.floor(rng() * Math.min(2, left - c.rows[0].length));
      filler(gap); left -= gap;
      L.groups.push({ tiles: [], active: false });
      L.segs.push({ name: c.name, floor: f, x0: flip ? FW - cols.length - c.rows[0].length : cols.length, w: c.rows[0].length, mirror: m !== flip, swap: s });
      add(transform(c.rows, m, s), L.groups.length - 1); left -= c.rows[0].length;
      L.parts.push("floor " + (f + 1) + ": " + c.name + (m ? " (flipped)" : "") + (s ? " (swapped)" : ""));
      first = false;
    }
    filler(left);
    if (top) add(transform(["....", "....", "....", "....", ".{.}", "####"], false, rng() < .5), 0);   // exit doors
    else add(["....", ".---", "....", ".---", "....", "####"], 0);   // two ledges under the hole: climb up to the next floor
    add(wall, 0);
    if (flip) cols.reverse();
    const y0 = 1 + (N - 1 - f) * BAND;
    cols.forEach(([c, gi], x) => c.forEach((ch, r) => { map[y0 + r][x] = ch; grp[y0 + r][x] = gi; }));
  }
  // turn markers into objects
  for (let y = 0; y < rows; y++) for (let x = 0; x < FW; x++) {
    const c = map[y][x], gi = grp[y][x];
    if (c === "x") { L.boxes.push({ kind: "box", x: x * T + 1, y: y * T + 2, w: T - 2, h: T - 2, vx: 0, vy: 0, ground: false }); map[y][x] = "."; }
    else if (c === "r" || c === "b") { L.gems.push({ x, y, color: c === "r" ? "red" : "blue", got: false, ph: rng() * 6 }); map[y][x] = "."; }
    else if (c === "^") { L.buttons.push({ x, y, g: gi, down: false }); map[y][x] = "."; }
    else if (c === "{" || c === "}") { L.exits[c === "{" ? "red" : "blue"] = { x, y }; map[y][x] = "."; }
    else if (c === "|" || c === "=") L.groups[gi].tiles.push({ x, y, c });
  }
  L.spawn = { red: { x: 1, y: rows - 1 }, blue: { x: 3, y: rows - 1 } };
  L.pw = FW * T; L.ph = rows * T;
  return L;
}

/* ---------- state ---------- */
const params = new URLSearchParams(location.search);
const onlyChunk = params.get("chunk") ? CHUNKS.find(c => c.name === params.get("chunk")) : null;
const G = {
  state: "title", seed: 0, level: 1, L: null, players: [], parts: [],
  levelMs: 0, totalMs: 0, splits: [], deaths: 0, gems: { red: 0, blue: 0 }, levelGems: { red: 0, blue: 0 },
  cam: 0, timer: 0, started: false, muted: store.get("stickboy_mute") === "1",
};
window.stickboy = G;   // handy for debugging in the console

function makePlayer(color, s){
  return { kind: "p", color, x: s.x * T + (T - 20) / 2, y: s.y * T - 50, w: 20, h: 50, vx: 0, vy: 0,
    ground: false, coyote: 0, buffer: 0, on: null, face: 1, walk: 0, pushing: false, drop: false, dx: 0, atExit: false };
}
function loadLevel(){
  G.L = buildLevel(G.level, G.seed, onlyChunk);
  G.players = [ makePlayer("red", G.L.spawn.red), makePlayer("blue", G.L.spawn.blue) ];
  G.levelGems = { red: 0, blue: 0 };
  G.parts = []; G.cam = 0;
}
function newRun(seed){
  G.seed = seed != null ? seed : (Math.random() * 1e9) >>> 0;
  G.level = 1; G.levelMs = 0; G.totalMs = 0; G.splits = []; G.deaths = 0; G.gems = { red: 0, blue: 0 };
  loadLevel(); G.state = "play"; pressed.clear(); hideScreen(); hud.classList.remove("hidden");
}

/* ---------- input ---------- */
const down = new Set(), pressed = new Set();
const CTRL = { red: { l: "KeyA", r: "KeyD", j: "KeyW", d: "KeyS" },
               blue: { l: "ArrowLeft", r: "ArrowRight", j: "ArrowUp", d: "ArrowDown" } };
addEventListener("keydown", e => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
  audioInit();
  if (e.repeat) return;
  if (e.code === "KeyM") { G.muted = !G.muted; store.set("stickboy_mute", G.muted ? "1" : "0"); }
  if (G.state === "title" || G.state === "done") { if (e.code === "Enter" || e.code === "Space") newRun(G.state === "title" && params.get("seed") ? +params.get("seed") >>> 0 : null); return; }
  if (e.code === "Escape" || e.code === "KeyP") {
    if (G.state === "play") { G.state = "paused"; showPause(); }
    else if (G.state === "paused") { G.state = "play"; hideScreen(); }
    return;
  }
  if (G.state === "paused" && e.code === "KeyQ") { showTitle(); return; }
  if (e.code === "KeyR" && G.state === "play") { G.deaths++; restartLevel(); }
});
addEventListener("keyup", e => down.delete(e.code));
addEventListener("blur", () => { down.clear(); if (G.state === "play") { G.state = "paused"; showPause(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") { G.state = "paused"; showPause(); } });

/* ---------- sound (tiny synth) ---------- */
let ac = null;
function audioInit(){ if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} if (ac && ac.state === "suspended") ac.resume(); }
function tone(f, d, type = "square", vol = .05, slide = 0){
  if (!ac || G.muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
}
const sfx = {
  jump: () => tone(320, .12, "square", .03, 560),
  gem: () => { tone(880, .08, "triangle", .06); setTimeout(() => tone(1320, .12, "triangle", .06), 60); },
  die: () => tone(200, .5, "sawtooth", .07, 40),
  click: () => tone(140, .06, "square", .04),
  clear: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .18, "triangle", .06), i * 90)),
};

/* ---------- world queries ---------- */
// 0 = empty, 1 = solid, 2 = one-way platform
function solidAt(tx, ty){
  const L = G.L;
  if (tx < 0 || tx >= L.w || ty < 0 || ty >= L.rows) return 1;
  const c = L.map[ty][tx];
  if (c === "#" || c === "R" || c === "B" || c === "G") return 1;
  if (c === "-") return 2;
  if (c === "|") return L.groups[L.grp[ty][tx]].active ? 0 : 1;
  if (c === "=") return L.groups[L.grp[ty][tx]].active ? 1 : 0;
  return 0;
}
const tileAt = (tx, ty) => (tx < 0 || tx >= G.L.w || ty < 0 || ty >= G.L.rows) ? "#" : G.L.map[ty][tx];
const entities = () => G.players.concat(G.L.boxes);

/* ---------- movement / collision ---------- */
function moveX(e, dx){
  if (!dx) return;
  const L = G.L, s = Math.sign(dx), x0 = e.x;
  e.x += dx;
  const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - .001) / T);
  const tx = s > 0 ? Math.floor((e.x + e.w - .001) / T) : Math.floor(e.x / T);
  for (let ty = y0; ty <= y1; ty++) if (solidAt(tx, ty) === 1) { e.x = s > 0 ? tx * T - e.w : (tx + 1) * T; e.vx = 0; break; }
  for (const b of L.boxes) {
    if (b === e || !overlap(e, b)) continue;
    if (e.kind === "p") {
      const pen = s > 0 ? e.x + e.w - b.x : b.x + b.w - e.x;
      moveX(b, s * pen); e.pushing = true;
      if (overlap(e, b)) e.x = s > 0 ? b.x - e.w : b.x + b.w;
    } else { e.x = s > 0 ? b.x - e.w : b.x + b.w; }
  }
  if (e.kind === "box") for (const p of G.players)     // only players in front of the box block it (not the pusher)
    if (overlap(e, p) && (p.x + p.w / 2 - (e.x + e.w / 2)) * s > 0) e.x = s > 0 ? p.x - e.w : p.x + p.w;
  e.dx += e.x - x0;
}
function moveY(e, dy){
  if (!dy) return;
  const L = G.L, prevBottom = e.y + e.h;
  e.y += dy;
  const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - .001) / T);
  if (dy > 0) {
    const ty = Math.floor((e.y + e.h - .001) / T), top = ty * T;
    for (let tx = x0; tx <= x1; tx++) {
      const s = solidAt(tx, ty);
      if (s === 1 || (s === 2 && prevBottom <= top + .01 && !e.drop)) { e.y = top - e.h; e.vy = 0; e.ground = true; e.on = null; break; }
    }
  } else {
    const ty = Math.floor(e.y / T);
    for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, ty) === 1) { e.y = (ty + 1) * T; e.vy = 0; break; }
  }
  for (const b of L.boxes) {
    if (b === e || !overlap(e, b)) continue;
    if (dy > 0) { e.y = b.y - e.h; e.vy = 0; e.ground = true; e.on = b; } else { e.y = b.y + b.h; e.vy = 0; }
  }
  for (const p of G.players) {
    if (p === e || !overlap(e, p) || dy < 0) continue;
    if (e.kind === "box" || prevBottom <= p.y + .5) { e.y = p.y - e.h; e.vy = 0; e.ground = true; e.on = p; }
  }
}

/* ---------- simulation ---------- */
function updateGroups(){
  const L = G.L, ents = entities();
  const held = new Set();
  for (const b of L.buttons) {
    const r = { x: b.x * T + 4, y: b.y * T + T - 8, w: T - 8, h: 8 };
    const was = b.down; b.down = ents.some(e => overlap(e, r));
    if (b.down) held.add(b.g);
    if (b.down && !was) sfx.click();
  }
  L.groups.forEach((g, i) => {
    const want = held.has(i);
    if (want === g.active || !g.tiles.length) { g.active = want; return; }
    // never close a gate / open a bridge on top of someone
    const solidify = g.tiles.filter(t => t.c === (want ? "=" : "|"));
    if (!solidify.some(t => ents.some(e => overlap(e, { x: t.x * T, y: t.y * T, w: T, h: T })))) g.active = want;
  });
}
function updatePlayer(p){
  const c = CTRL[p.color];
  const dir = (down.has(c.r) ? 1 : 0) - (down.has(c.l) ? 1 : 0);
  if (dir) p.face = dir;
  const max = SPEED * (p.pushing ? PUSH_SPEED : 1);
  p.vx = approach(p.vx, dir * max, (p.ground ? (dir ? ACC_GROUND : ACC_STOP) : ACC_AIR) * STEP);
  if (pressed.has(c.j)) p.buffer = BUFFER; else p.buffer -= STEP;
  p.coyote = p.ground ? COYOTE : p.coyote - STEP;
  if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.buffer = p.coyote = 0; p.ground = false; sfx.jump(); }
  const rising = p.vy < 0, cut = rising && !down.has(c.j);
  p.vy = Math.min(p.vy + GRAV * (cut ? 2.4 : 1) * STEP, MAXFALL);
  p.drop = down.has(c.d);
  p.pushing = false; p.ground = false; p.on = null;
  moveX(p, p.vx * STEP);
  moveY(p, p.vy * STEP);
  if (p.ground && Math.abs(p.vx) > 10) p.walk += Math.abs(p.vx) * STEP;
}
function hazard(p){
  if (!p.ground || p.on) return false;
  const ty = Math.floor((p.y + p.h + 1) / T);
  for (let tx = Math.floor((p.x + 4) / T); tx <= Math.floor((p.x + p.w - 4) / T); tx++) {
    const c = tileAt(tx, ty);
    if (c === "G" || (c === "B" && p.color === "red") || (c === "R" && p.color === "blue")) return true;
  }
  return false;
}
function step(){
  const L = G.L, [a, b] = G.players;
  updateGroups();
  for (const e of entities()) e.dx = 0;
  G.players.forEach(updatePlayer);
  for (const bx of L.boxes) { bx.vy = Math.min(bx.vy + GRAV * STEP, MAXFALL); bx.ground = false; moveY(bx, bx.vy * STEP); }
  // ride whatever you're standing on (box being pushed, or the other stickman)
  for (const p of G.players) if (p.on && p.on.dx) moveX(p, p.on.dx);
  pressed.clear();

  for (const p of G.players) {
    if (hazard(p)) return die(p);
    for (const g of L.gems) {
      if (g.got || g.color !== p.color) continue;
      if (overlap(p, { x: g.x * T + 4, y: g.y * T + 4, w: T - 8, h: T - 8 })) { g.got = true; G.levelGems[p.color]++; sfx.gem(); burst(g.x * T + T / 2, g.y * T + T / 2, COL[g.color], 10); }
    }
    const ex = L.exits[p.color], cx = p.x + p.w / 2;
    p.atExit = p.ground && cx > ex.x * T + 4 && cx < (ex.x + 1) * T - 4 && Math.abs(p.y + p.h - (ex.y + 1) * T) < 2;
  }
  if (a.atExit && b.atExit) levelClear();
}
function die(p){
  G.state = "dying"; G.timer = .9; G.deaths++; sfx.die();
  burst(p.x + p.w / 2, p.y + p.h / 2, COL[p.color], 40);
  p.dead = true;
}
function restartLevel(){ loadLevel(); G.state = "play"; }
function levelClear(){
  G.state = "clear"; G.timer = 1.6; sfx.clear();
  G.gems.red += G.levelGems.red; G.gems.blue += G.levelGems.blue;
  G.splits.push(G.levelMs);
  showClear();
}
function nextLevel(){
  if (G.level >= RUN_LENGTH || onlyChunk) return runDone();
  G.level++; G.levelMs = 0; loadLevel(); G.state = "play"; hideScreen();
}
function runDone(){
  G.state = "done";
  const best = +store.get("stickboy_best") || 0, pb = !onlyChunk && (!best || G.totalMs < best);
  if (pb) store.set("stickboy_best", Math.round(G.totalMs));
  showDone(pb, best);
}

/* ---------- particles ---------- */
function burst(x, y, color, n){
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: .5 + Math.random() * .6, color }); }
}

/* ---------- drawing ---------- */
const cv = document.getElementById("cv"), ctx = cv.getContext("2d"), wrap = document.getElementById("wrap");
let scale = 1, k = 1;
function resize(){
  scale = Math.min(innerWidth / VW, innerHeight / VH);
  wrap.style.width = VW * scale + "px"; wrap.style.height = VH * scale + "px";
  wrap.style.setProperty("--s", scale);
  k = scale * Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(VW * k); cv.height = Math.round(VH * k);
}
addEventListener("resize", resize); resize();

function drawBg(t){
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, "#0d0d12"); g.addColorStop(1, "#15121a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = "rgba(255,255,255,.035)";
  const off = -(G.cam * .3) % 48;
  for (let x = off; x < VW; x += 48) for (let y = 24; y < VH; y += 48) ctx.fillRect(x, y, 2, 2);
}
function drawTiles(t){
  const L = G.L;
  for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.w; tx++) {
    const c = L.map[ty][tx], x = tx * T, y = ty * T;
    if (c === "#" || c === "R" || c === "B" || c === "G") {
      ctx.fillStyle = "#18181f"; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#1f1f28"; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
      if (solidAt(tx, ty - 1) !== 1 && c === "#") { ctx.fillStyle = "#3a3a48"; ctx.fillRect(x, y, T, 3); }
      if (c !== "#") {
        const col = c === "R" ? COL.red : c === "B" ? COL.blue : COL.green;
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.globalAlpha = .9;
        ctx.beginPath(); ctx.moveTo(x, y + 14);
        for (let i = 0; i <= T; i += 4) ctx.lineTo(x + i, y + 3 + Math.sin(t * 3 + (x + i) * .15) * 1.6);
        ctx.lineTo(x + T, y + 14); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    } else if (c === "-") {
      ctx.fillStyle = "#3a3a48"; ctx.fillRect(x, y, T, 5);
      ctx.fillStyle = "#24242e"; ctx.fillRect(x + 4, y + 5, 3, 5); ctx.fillRect(x + T - 7, y + 5, 3, 5);
    } else if (c === "|" || c === "=") {
      const solid = solidAt(tx, ty) === 1;
      ctx.save(); ctx.strokeStyle = COL.amber; ctx.fillStyle = COL.amber;
      if (solid) {
        ctx.shadowColor = COL.amber; ctx.shadowBlur = 10; ctx.globalAlpha = .85;
        if (c === "|") { for (let i = 6; i < T; i += 10) ctx.fillRect(x + i, y, 4, T); }
        else { ctx.fillRect(x, y, T, 7); ctx.globalAlpha = .3; ctx.fillRect(x, y + 7, T, 4); }
      } else {
        ctx.globalAlpha = .25; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        c === "|" ? ctx.strokeRect(x + 6, y, T - 12, T) : ctx.strokeRect(x, y, T, 7);
      }
      ctx.restore();
    }
  }
  for (const b of L.buttons) {
    const x = b.x * T, y = b.y * T + T, h = b.down ? 3 : 7;
    ctx.save(); ctx.fillStyle = COL.amber; ctx.shadowColor = COL.amber; ctx.shadowBlur = b.down ? 16 : 4; ctx.globalAlpha = b.down ? 1 : .7;
    ctx.fillRect(x + 6, y - h, T - 12, h); ctx.restore();
  }
  for (const color of ["red", "blue"]) {
    const ex = L.exits[color], x = ex.x * T, y = (ex.y - 1) * T, on = G.players.find(p => p.color === color).atExit;
    ctx.save(); ctx.strokeStyle = COL[color]; ctx.lineWidth = 3; ctx.shadowColor = COL[color]; ctx.shadowBlur = on ? 24 : 8;
    ctx.fillStyle = on ? COL[color] + "55" : COL[color] + "18";
    ctx.beginPath(); ctx.moveTo(x + 3, y + 2 * T); ctx.lineTo(x + 3, y + 10); ctx.arc(x + T / 2, y + 10, T / 2 - 3, Math.PI, 0); ctx.lineTo(x + T - 3, y + 2 * T);
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  for (const g of L.gems) {
    if (g.got) continue;
    const x = g.x * T + T / 2, y = g.y * T + T / 2 + Math.sin(t * 3 + g.ph) * 3, s = 8;
    ctx.save(); ctx.fillStyle = COL[g.color]; ctx.shadowColor = COL[g.color]; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .75, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * .75, y); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .3, y - 2); ctx.lineTo(x, y); ctx.fill(); ctx.restore();
  }
  for (const b of L.boxes) {
    ctx.fillStyle = "#3b2d22"; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#6b5040"; ctx.lineWidth = 3; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + 4); ctx.lineTo(b.x + b.w - 4, b.y + b.h - 4);
    ctx.moveTo(b.x + b.w - 4, b.y + 4); ctx.lineTo(b.x + 4, b.y + b.h - 4); ctx.stroke();
  }
}
/* stickman animation — Minecraft / Roblox R6 style:
   arms and legs are straight rigid limbs that rotate from the shoulder / hip,
   and each leg swings in sync with the OPPOSITE arm (left leg + right arm forward together). */
const ANIM = {
  stride: 62,      // px walked per full walk cycle (bigger = slower, longer steps)
  legSwing: .75,   // max leg angle in radians (~43°)
  armSwing: .8,    // max arm angle in radians
  ease: 12,        // how fast the swing fades in / out when starting or stopping
  legLen: 20, armLen: 17,
};
const lerp = (a, b, t) => a + (b - a) * t;
function drawStick(p, dt){
  if (p.dead) return;
  // smoothed animation blends (frame-rate independent easing)
  const e = 1 - Math.exp(-ANIM.ease * dt), eAir = 1 - Math.exp(-10 * dt);
  p.amp = lerp(p.amp || 0, p.ground ? Math.min(1, Math.abs(p.vx) / SPEED) : 0, e);   // 0 = standing, 1 = full run
  p.airT = lerp(p.airT || 0, p.ground ? 0 : 1, eAir);                                 // 0 = grounded, 1 = jump pose
  p.pushT = lerp(p.pushT || 0, p.pushing && p.ground ? 1 : 0, eAir);                  // arms forward while pushing

  const phase = p.walk / ANIM.stride * Math.PI * 2, sw = Math.sin(phase) * p.amp;
  const bob = Math.abs(Math.cos(phase)) * 1.6 * p.amp;      // body rises slightly as the legs pass each other
  const col = COL[p.color], cx = p.x + p.w / 2, foot = p.y + p.h, f = p.face;
  const hip = foot - ANIM.legLen - bob * .3, shoulder = p.y + 19 - bob, head = p.y + 8 - bob;

  // limb angles: 0 = hanging straight down, positive = swung forward (towards facing direction)
  // limb A = near side (drawn bright), limb B = far side (drawn dim). Leg A pairs with arm B, leg B with arm A.
  const legA = lerp(sw * ANIM.legSwing, .45, p.airT), legB = lerp(-sw * ANIM.legSwing, -.3, p.airT);
  let armA = lerp(-sw * ANIM.armSwing, -.5, p.airT), armB = lerp(sw * ANIM.armSwing, .9, p.airT);
  armA = lerp(armA, 1.35, p.pushT); armB = lerp(armB, 1.2, p.pushT);
  const idle = Math.sin(performance.now() / 600 + (p.color === "red" ? 0 : 2)) * .07 * (1 - p.amp) * (1 - p.airT);
  armA += .06 + idle; armB -= .06 + idle;                    // gentle idle sway so arms sit just off the body

  const limb = (x, y, ang, len, dim) => {
    ctx.globalAlpha = dim ? .5 : 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ang) * len * f, y + Math.cos(ang) * len); ctx.stroke();
  };
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = col; ctx.shadowBlur = 12;
  limb(cx, hip, legB, ANIM.legLen, true);                 // far limbs first so they sit behind the body
  limb(cx, shoulder, armB, ANIM.armLen, true);
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx, head, 7, 0, Math.PI * 2); ctx.stroke();      // head
  ctx.beginPath(); ctx.moveTo(cx, head + 7); ctx.lineTo(cx, hip); ctx.stroke(); // body
  limb(cx, hip, legA, ANIM.legLen, false);
  limb(cx, shoulder, armA, ANIM.armLen, false);
  ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.shadowBlur = 0; ctx.fillRect(cx + f * 3 - 1, head - 2, 2, 2);  // eye
  ctx.restore();
}
function render(t, dt){
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawBg(t);
  if (!G.L) return;
  // whole level on one screen: zoom to fit below the HUD
  const L = G.L, z = Math.min(VW / L.pw, (VH - HUD_H - 6) / L.ph);
  G.view = { z, ox: (VW - L.pw * z) / 2, oy: HUD_H + (VH - HUD_H - L.ph * z) / 2 };
  ctx.save(); ctx.translate(G.view.ox, G.view.oy); ctx.scale(z, z);
  drawTiles(t);
  G.players.forEach(p => drawStick(p, dt));
  for (const q of G.parts) {
    q.life -= dt; q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); ctx.fillStyle = q.color; ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1; G.parts = G.parts.filter(q => q.life > 0);
  ctx.restore();
}

/* ---------- HUD + screens ---------- */
const hud = document.getElementById("hud"), scr = document.getElementById("screen");
const $ = id => document.getElementById(id);
function updateHud(){
  $("lt").textContent = fmt(G.levelMs); $("tt").textContent = fmt(G.totalMs);
  $("lvl").textContent = onlyChunk ? "TEST: " + onlyChunk.name.toUpperCase() : "LEVEL " + G.level + "/" + RUN_LENGTH;
  $("gr").textContent = G.gems.red + G.levelGems.red; $("gb").textContent = G.gems.blue + G.levelGems.blue; $("dc").textContent = G.deaths;
}
function show(html){ scr.innerHTML = html; scr.classList.remove("off"); }
function hideScreen(){ scr.classList.add("off"); }
const keysHtml = `<div class="keys"><div class="red"><b>RED</b><span>W A S D</span></div><div class="blue"><b>BLUE</b><span>↑ ← ↓ →</span></div></div>`;
function showTitle(){
  G.state = "title"; hud.classList.add("hidden"); G.L = null;
  const best = +store.get("stickboy_best");
  show(`<h1>STICKBOY</h1>
    <div class="muted">get both stickmen to their doors · ${RUN_LENGTH} random levels · one run</div>
    ${keysHtml}
    <div class="muted">red pools kill blue · blue pools kill red · green kills both<br>hold buttons to open gates · push boxes · grab your colour's gems</div>
    <div class="blink">[ press enter ]</div>
    <div class="muted">${best ? "best run " + fmt(best) + " · " : ""}R restart · Esc pause · M mute</div>
    <a href="../../">← ffxke.lol</a>`);
}
function showPause(){ show(`<h2>PAUSED</h2>${keysHtml}<div class="muted">Esc / P resume · R restart level · Q quit to title</div>`); }
function showClear(){ show(`<h2>LEVEL ${G.level} CLEAR</h2><div class="big">${fmt(G.levelMs)}</div><div class="muted">total ${fmt(G.totalMs)}</div>`); }
function showDone(pb, best){
  const rows = G.splits.map((ms, i) => `<tr><td>level ${i + 1}</td><td>${fmt(ms)}</td></tr>`).join("");
  show(`<h2>${onlyChunk ? "ROOM CLEAR" : "RUN COMPLETE"}</h2>
    <div class="big">${fmt(G.totalMs)}</div>
    <div class="${pb ? "red" : "muted"}">${pb ? "new best!" : best ? "best " + fmt(best) : ""}</div>
    <table class="muted">${rows}</table>
    <div class="muted"><span class="red">◆ ${G.gems.red}</span> · <span class="blue">◆ ${G.gems.blue}</span> · ☠ ${G.deaths} · seed ${G.seed}</div>
    <div class="blink">[ press enter for a new run ]</div>`);
}

/* ---------- main loop ---------- */
let last = performance.now(), acc = 0;
function frame(now){
  const dt = Math.min((now - last) / 1000, .1); last = now;
  // timers run while playing and during the death animation (deaths cost time); they freeze on pause / level clear
  if (G.state === "play" || G.state === "dying") { G.levelMs += dt * 1000; G.totalMs += dt * 1000; }
  if (G.state === "play") {
    acc += dt;
    while (acc >= STEP && G.state === "play") { step(); acc -= STEP; }
  } else acc = 0;
  if (G.state === "dying" && (G.timer -= dt) <= 0) restartLevel();
  if (G.state === "clear" && (G.timer -= dt) <= 0) nextLevel();
  render(now / 1000, dt);
  if (G.L) updateHud();
  requestAnimationFrame(frame);
}
G.debug = { step, down, pressed, loadLevel, buildLevel, T };   // console / test hooks
showTitle();
requestAnimationFrame(frame);
})();
