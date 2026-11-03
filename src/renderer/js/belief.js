// 敵情推算：只根據「看得到的資訊」（起始位置、走過的路線、裁判公布的勝負）推算對方每顆暗子是什麼
import * as J from './junqi.js';

const { GONG, PAI, SI, BOMB, MINE, FLAG, COUNT } = J;
const BIT = (t) => 1 << t;
const RANGE = (a, b) => { let m = 0; for (let t = a; t <= b; t++) m |= BIT(t); return m; };
export const MOVABLE = RANGE(1, 10);
export const ALL = RANGE(1, 12);
const OFFICERS = RANGE(1, 9);
const popcount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

// 預設的布陣習慣（每個本方位置 li 放各種棋子的相對可能性）
export function defaultPrior(li, t) {
  if (!J.canPlace(t, li)) return 0;
  const k = (li / 5) | 0, c = li % 5;
  switch (t) {
    case FLAG: return 1;
    case MINE: return k === 0 ? (c === 1 || c === 3 ? 1.4 : 2.4) : (c >= 1 && c <= 3 ? 1.8 : 1.0);
    case BOMB: return k === 1 || k === 2 ? 1.3 : k === 3 || k === 4 ? 1.15 : 0.7;
    case SI: case J.JUN: return k >= 3 ? 1.5 : k === 2 ? 1.0 : 0.45;
    case J.SHI: case J.LV: return k >= 2 ? 1.25 : 0.7;
    case GONG: return k === 5 ? 1.35 : k <= 1 ? 1.05 : 0.9;
    case PAI: return k === 5 ? 1.25 : 1;
    default: return 1;
  }
}

// 學習到的布陣統計＋預設習慣 → 每個位置每種棋子的權重
export function priorTable(learnedCnt) {
  const W = new Float64Array(30 * 13);
  for (let li = 0; li < 30; li++) {
    let sd = 0, n = 0;
    for (let t = 1; t <= 12; t++) { sd += defaultPrior(li, t) * COUNT[t]; if (learnedCnt) n += learnedCnt[li * 13 + t] || 0; }
    const A = 8;
    for (let t = 1; t <= 12; t++) {
      const pd = sd ? (defaultPrior(li, t) * COUNT[t]) / sd : 0;
      const pl = learnedCnt && n ? (learnedCnt[li * 13 + t] || 0) / n : 0;
      const p = learnedCnt && n ? (n * pl + A * pd) / (n + A) : pd;
      // 抽樣時會再乘上剩餘數量，這裡除掉數量避免重複計算
      W[li * 13 + t] = J.canPlace(t, li) ? Math.max(1e-4, p) / COUNT[t] : 0;
    }
  }
  return W;
}

const adjacent = (a, b) => J.ADJ[a].includes(b);

// 由局面與事件推出每顆敵子可能的種類（位元遮罩）
export function buildBelief(view, learnedCnt) {
  const me = view.side, en = me ^ 1;
  const ids = [];
  for (let id = 0; id < view.homes.length; id++) if ((id < 25 ? 0 : 1) === en) ids.push(id);
  const mask = new Map();
  const W = priorTable(learnedCnt);
  for (const id of ids) {
    const li = J.liOf(en, view.homes[id]);
    let m = 0;
    for (let t = 1; t <= 12; t++) if (J.canPlace(t, li)) m |= BIT(t);
    if (view.open && view.known[id]) m = BIT(view.known[id]);
    mask.set(id, m);
  }
  const and = (id, m) => { if (mask.has(id)) mask.set(id, mask.get(id) & m); };
  for (const e of view.events) {
    const deadEnemy = [];
    if (e.side === en) {
      and(e.aid, MOVABLE);
      if (!adjacent(e.from, e.to) && !J.onStraightRail(e.from, e.to)) and(e.aid, BIT(GONG)); // 鐵路轉彎＝工兵
      const d = e.dt; // 我被攻擊的棋子
      if (e.out === 'win') and(e.aid, d === MINE ? BIT(GONG) : RANGE(d + 1, 9));
      else if (e.out === 'lose') { and(e.aid, d === MINE ? RANGE(2, 9) : RANGE(1, d - 1)); deadEnemy.push(e.aid); }
      else if (e.out === 'tie') { and(e.aid, d === BOMB ? MOVABLE : d === MINE ? BIT(BOMB) : BIT(d) | BIT(BOMB)); deadEnemy.push(e.aid); }
    } else if (e.did >= 0) {
      const a = e.at; // 我攻擊用的棋子
      if (e.out === 'win') { and(e.did, (a > 1 ? RANGE(1, a - 1) : 0) | (a === GONG ? BIT(MINE) : 0)); deadEnemy.push(e.did); }
      else if (e.out === 'lose') and(e.did, RANGE(a + 1, 9) | (a !== GONG ? BIT(MINE) : 0));
      else if (e.out === 'tie') { and(e.did, a === BOMB ? RANGE(1, 11) : BIT(a) | BIT(BOMB)); deadEnemy.push(e.did); }
      else if (e.out === 'flag') and(e.did, BIT(FLAG));
    }
    // 司令陣亡會公布；沒公布就不是司令
    for (const id of deadEnemy) and(id, e.cmdDead.includes(en) ? BIT(SI) : ~BIT(SI));
    if (e.flagSq[en] >= 0) {
      for (const id of ids) and(id, view.homes[id] === e.flagSq[en] ? BIT(FLAG) : ~BIT(FLAG));
    }
  }
  // 亮出來的軍旗
  for (let sq = 0; sq < 60; sq++) {
    const c = view.board[sq];
    if (c && (c >> 4) === en && (c & 15) === FLAG) { const id = view.pid[sq]; for (const x of ids) and(x, x === id ? BIT(FLAG) : ~BIT(FLAG)); }
  }
  const w = new Map();
  for (const id of ids) {
    const li = J.liOf(en, view.homes[id]);
    const arr = new Float64Array(13);
    for (let t = 1; t <= 12; t++) arr[t] = mask.get(id) & BIT(t) ? W[li * 13 + t] : 0;
    w.set(id, arr);
  }
  const b = { side: me, en, ids, mask, w, alive: ids.filter((id) => view.alive[id]) };
  if (!feasible(b, null)) relax(b, view);
  return b;
}

// 規則限制互相矛盾（理論上不會發生）時，退回只用起始位置的限制
function relax(b, view) {
  for (const id of b.ids) {
    const li = J.liOf(b.en, view.homes[id]);
    let m = 0;
    for (let t = 1; t <= 12; t++) if (J.canPlace(t, li)) m |= BIT(t);
    b.mask.set(id, m);
    const arr = b.w.get(id);
    for (let t = 1; t <= 12; t++) if (!arr[t] && m & BIT(t)) arr[t] = 0.05;
  }
}

// 二分圖配對：剩下的棋子能不能分配到剩下的種類（每種有固定數量）
function feasible(b, fixed) {
  const ids = b.ids.filter((id) => !fixed || !fixed.has(id));
  const rem = COUNT.slice();
  if (fixed) for (const t of fixed.values()) rem[t]--;
  if (rem.some((x) => x < 0)) return false;
  const slots = [];
  for (let t = 1; t <= 12; t++) for (let i = 0; i < rem[t]; i++) slots.push(t);
  const owner = new Array(slots.length).fill(-1);
  const tryAssign = (ii, seen) => {
    const m = b.mask.get(ids[ii]);
    for (let s = 0; s < slots.length; s++) {
      if (seen[s] || !(m & BIT(slots[s]))) continue;
      seen[s] = 1;
      if (owner[s] < 0 || tryAssign(owner[s], seen)) { owner[s] = ii; return true; }
    }
    return false;
  };
  for (let ii = 0; ii < ids.length; ii++) if (!tryAssign(ii, new Uint8Array(slots.length))) return false;
  return true;
}

// 抽一組「跟所有資訊都不矛盾」的對方布陣：回傳 Map id → 種類
export function sample(b, rng = Math.random) {
  const order = b.ids.slice().sort((x, y) => popcount(b.mask.get(x)) - popcount(b.mask.get(y)) || rng() - 0.5);
  const pick = (id, rem, exclude = 0) => {
    const arr = b.w.get(id), m = b.mask.get(id) & ~exclude;
    let tot = 0;
    for (let t = 1; t <= 12; t++) if (m & BIT(t) && rem[t] > 0) tot += arr[t] * rem[t];
    if (tot <= 0) return 0;
    let r = rng() * tot;
    for (let t = 1; t <= 12; t++) if (m & BIT(t) && rem[t] > 0) { r -= arr[t] * rem[t]; if (r <= 0) return t; }
    for (let t = 12; t >= 1; t--) if (m & BIT(t) && rem[t] > 0) return t;
    return 0;
  };
  // 先用快速的貪婪抽樣，多數情況都會成功
  for (let tries = 0; tries < 12; tries++) {
    const rem = COUNT.slice();
    const out = new Map();
    let ok = true;
    for (const id of order) {
      const t = pick(id, rem);
      if (!t) { ok = false; break; }
      rem[t]--; out.set(id, t);
    }
    if (ok) return out;
  }
  // 限制很多時：每一步都確認剩下的還分配得完
  const rem = COUNT.slice();
  const out = new Map();
  for (const id of order) {
    let excl = 0, t = 0;
    for (let k = 0; k < 12; k++) {
      t = pick(id, rem, excl);
      if (!t) break;
      out.set(id, t);
      if (feasible(b, out)) break;
      out.delete(id);
      excl |= BIT(t);
      t = 0;
    }
    if (!t) return null;
    rem[t]--;
  }
  return out;
}

// 推算結果：每顆活著的敵子最可能是什麼（給玩家的「敵情推算」與 AI 軍師）
export function marginals(b, n = 160, rng = Math.random) {
  const probs = new Map(b.alive.map((id) => [id, new Float64Array(13)]));
  const remain = new Float64Array(13);
  let got = 0;
  for (let i = 0; i < n; i++) {
    const s = sample(b, rng);
    if (!s) continue;
    got++;
    for (const id of b.alive) { const t = s.get(id); probs.get(id)[t]++; remain[t]++; }
  }
  const res = {};
  for (const [id, arr] of probs) {
    const p = Array.from(arr, (x) => (got ? x / got : 0));
    let best = 1;
    for (let t = 1; t <= 12; t++) if (p[t] > p[best]) best = t;
    res[id] = { p, top: best, pTop: p[best], mask: b.mask.get(id) };
  }
  return { pieces: res, remain: Array.from(remain, (x) => (got ? x / got : 0)), samples: got };
}

// 遮罩的白話說明（例如「師長以上」「工兵或地雷」）
export function maskText(m) {
  const types = [];
  for (let t = 1; t <= 12; t++) if (m & BIT(t)) types.push(t);
  if (types.length === 1) return J.NAMES[types[0]];
  if (types.length >= 11) return '未知';
  const offs = types.filter((t) => t <= 9), rest = types.filter((t) => t > 9);
  let s = '';
  if (offs.length) {
    const lo = offs[0], hi = offs[offs.length - 1];
    const contiguous = hi - lo + 1 === offs.length;
    if (contiguous && offs.length > 2) s = hi === 9 ? `${J.NAMES[lo]}以上` : lo === 1 ? `${J.NAMES[hi]}以下` : `${J.NAMES[lo]}～${J.NAMES[hi]}`;
    else s = offs.map((t) => J.SHORT[t]).join('、');
  }
  if (rest.length) s += (s ? '或' : '') + rest.map((t) => J.NAMES[t]).join('、');
  return s;
}
export { BIT, popcount };
