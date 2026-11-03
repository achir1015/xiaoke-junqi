// 陸軍棋規則引擎（二人對戰：暗棋裁判制／明棋）
// 棋盤 12 列 × 5 行＝60 個兵站。sq = 列 r × 5 + 行 c；r = 0 在畫面上方（藍軍底線），r = 11 在下方（紅軍底線）。
// 每一方的半邊用「本方列」k 表示：k = 0 底線（大本營）… k = 5 前線（緊鄰山界）。
export const ROWS = 12, COLS = 5, NSQ = 60;
export const GONG = 1, PAI = 2, LIAN = 3, YING = 4, TUAN = 5, LV = 6, SHI = 7, JUN = 8, SI = 9, BOMB = 10, MINE = 11, FLAG = 12, UNK = 15;
export const NAMES = ['', '工兵', '排長', '連長', '營長', '團長', '旅長', '師長', '軍長', '司令', '炸彈', '地雷', '軍旗', '', '', '？'];
export const SHORT = ['', '工', '排', '連', '營', '團', '旅', '師', '軍', '司', '炸', '雷', '旗', '', '', '？'];
export const COUNT = [0, 3, 3, 3, 2, 2, 2, 2, 1, 1, 2, 3, 1];
export const ALL_TYPES = [SI, JUN, SHI, LV, TUAN, YING, LIAN, PAI, GONG, BOMB, MINE, FLAG];
export const SIDE_NAME = ['紅軍', '藍軍'];
export const RED = 0, BLUE = 1;
export const QUIET_LIMIT = 80;   // 連續 80 步（40 回合）沒有交戰判和
export const PLY_LIMIT = 500;    // 總步數上限

export const mk = (side, t) => t | (side << 4);
export const sideOf = (code) => code >> 4;
export const typeOf = (code) => code & 15;
export const rowOf = (sq) => (sq / 5) | 0;
export const colOf = (sq) => sq % 5;
export const SQ = (r, c) => r * 5 + c;
export const halfOf = (sq) => (rowOf(sq) >= 6 ? 0 : 1);
export const movable = (t) => t >= GONG && t <= BOMB;
export const isOfficer = (t) => t >= GONG && t <= SI;

// 本方列（0＝底線…5＝前線）
export const kOf = (sq) => { const r = rowOf(sq); return r >= 6 ? 11 - r : r; };
// 布陣用的本方座標：從該方玩家自己的角度看，左邊是 c = 0
export function localOf(side, sq) { const r = rowOf(sq), c = colOf(sq); return side === 0 ? { k: 11 - r, c } : { k: r, c: 4 - c }; }
export function sqOf(side, k, c) { return side === 0 ? SQ(11 - k, c) : SQ(k, 4 - c); }
export const liOf = (side, sq) => { const { k, c } = localOf(side, sq); return k * 5 + c; };
export const sqOfLi = (side, li) => sqOf(side, (li / 5) | 0, li % 5);

export const isCamp = (sq) => { const k = kOf(sq), c = colOf(sq); return ((k === 2 || k === 4) && (c === 1 || c === 3)) || (k === 3 && c === 2); };
export const isHQ = (sq) => kOf(sq) === 0 && (colOf(sq) === 1 || colOf(sq) === 3);
export const isRail = (sq) => { const k = kOf(sq), c = colOf(sq); return k === 1 || k === 5 || ((c === 0 || c === 4) && k >= 1); };
export const liIsCamp = (li) => isCamp(sqOf(0, (li / 5) | 0, li % 5));
export const liIsHQ = (li) => li === 1 || li === 3;

// 兩個兵站之間是否有鐵路相連
function railEdge(a, b) {
  if (!isRail(a) || !isRail(b)) return false;
  const ra = rowOf(a), rb = rowOf(b), ca = colOf(a), cb = colOf(b);
  if (ra === rb && Math.abs(ca - cb) === 1) { const k = kOf(a); return k === 1 || k === 5; }
  if (ca === cb && Math.abs(ra - rb) === 1) {
    if (halfOf(a) !== halfOf(b)) return ca === 0 || ca === 2 || ca === 4; // 跨越山界的三條鐵路
    return ca === 0 || ca === 4;
  }
  return false;
}

// 公路相鄰（一步）：同半邊的上下左右；山界只有左、中、右三條通道；行營可以斜走
function roadEdge(a, b) {
  const ra = rowOf(a), rb = rowOf(b), ca = colOf(a), cb = colOf(b);
  const dr = Math.abs(ra - rb), dc = Math.abs(ca - cb);
  if (dr + dc === 1) {
    if (halfOf(a) !== halfOf(b)) return ca === cb && (ca === 0 || ca === 2 || ca === 4);
    return true;
  }
  if (dr === 1 && dc === 1) return halfOf(a) === halfOf(b) && (isCamp(a) || isCamp(b));
  return false;
}

export const ADJ = [], RAILN = [], RUNS = [];
for (let s = 0; s < NSQ; s++) {
  ADJ[s] = []; RAILN[s] = []; RUNS[s] = [];
  for (let t = 0; t < NSQ; t++) {
    if (s === t) continue;
    if (roadEdge(s, t)) ADJ[s].push(t);
    if (railEdge(s, t)) RAILN[s].push(t);
  }
  // 鐵路直線：四個方向一路走下去（不轉彎）
  if (isRail(s)) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const run = [];
    let cur = s;
    for (;;) {
      const r = rowOf(cur) + dr, c = colOf(cur) + dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      const nx = SQ(r, c);
      if (!railEdge(cur, nx)) break;
      run.push(nx);
      cur = nx;
    }
    if (run.length > 1) RUNS[s].push(run);
  }
}

// 從 from 到 to 是否在同一條鐵路直線上（中間不論有沒有棋子）
export function onStraightRail(from, to) {
  for (const run of RUNS[from]) if (run.includes(to)) return true;
  return ADJ[from].includes(to) && RAILN[from].includes(to);
}

// 交戰結果（以攻擊方為準）：1 攻方勝、-1 攻方陣亡、0 同歸於盡、2 奪旗
export function fight(at, dt) {
  if (dt === FLAG) return 2;
  if (at === BOMB || dt === BOMB) return 0;
  if (dt === MINE) return at === GONG ? 1 : -1;
  if (at > dt) return 1;
  if (at < dt) return -1;
  return 0;
}

// ---------------- 走法產生（給規則判斷與 AI 共用；board 為 60 格的棋子代碼陣列） ----------------
const mark = new Int32Array(NSQ);
let markGen = 1;
const queue = new Int32Array(NSQ);

// 把 sq 上棋子的所有目的地放進 out（回傳數量）
export function targetsOf(board, sq, out, n = 0) {
  const code = board[sq];
  if (!code) return n;
  const t = code & 15;
  if (t === FLAG || t === MINE) return n;
  if (isHQ(sq)) return n; // 進入大本營的棋子不能再移動
  const side = code >> 4;
  const gen = ++markGen;
  mark[sq] = gen;
  const add = (to) => {
    if (mark[to] === gen) return;
    mark[to] = gen;
    const d = board[to];
    if (!d) out[n++] = to;
    else if ((d >> 4) !== side && !isCamp(to)) out[n++] = to;
  };
  const adj = ADJ[sq];
  for (let i = 0; i < adj.length; i++) add(adj[i]);
  if (isRail(sq)) {
    if (t === GONG) {
      // 工兵：鐵路上可以轉彎，走到任何一個有路相通的兵站（空格才能繼續往前）
      let qh = 0, qt = 0;
      const seen = ++visitGen;
      visit[sq] = seen;
      queue[qt++] = sq;
      while (qh < qt) {
        const rn = RAILN[queue[qh++]];
        for (let i = 0; i < rn.length; i++) {
          const nx = rn[i];
          if (visit[nx] === seen) continue;
          visit[nx] = seen;
          const d = board[nx];
          if (!d) queue[qt++] = nx;
          if (!d || (d >> 4) !== side) add(nx);
        }
      }
    } else {
      const runs = RUNS[sq];
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        for (let j = 0; j < run.length; j++) {
          const to = run[j];
          const d = board[to];
          if (!d) { add(to); continue; }
          if ((d >> 4) !== side) add(to);
          break;
        }
      }
    }
  }
  return n;
}
const visit = new Int32Array(NSQ);
let visitGen = 1;

const tmp = new Int32Array(NSQ);
export function targetList(board, sq) { const n = targetsOf(board, sq, tmp, 0); return Array.from(tmp.subarray(0, n)); }

// 全部走法：m = from * 64 + to
export function genMoves(board, side) {
  const out = [];
  for (let sq = 0; sq < NSQ; sq++) {
    const c = board[sq];
    if (!c || (c >> 4) !== side) continue;
    const n = targetsOf(board, sq, tmp, 0);
    for (let i = 0; i < n; i++) out.push(sq * 64 + tmp[i]);
  }
  return out;
}
export const mvFrom = (m) => m >> 6;
export const mvTo = (m) => m & 63;
export const MV = (f, t) => f * 64 + t;

export function hasMoves(board, side) {
  for (let sq = 0; sq < NSQ; sq++) {
    const c = board[sq];
    if (!c || (c >> 4) !== side) continue;
    if (targetsOf(board, sq, tmp, 0) > 0) return true;
  }
  return false;
}

// ---------------- 座標與記譜 ----------------
// A～E：紅軍左到右；1～12：紅軍底線往上
export const sqName = (sq) => 'ABCDE'[colOf(sq)] + (12 - rowOf(sq));
export const nameToSq = (s) => { const m = /^([A-Ea-e])(\d{1,2})$/.exec(String(s).trim()); if (!m) return -1; const c = 'ABCDE'.indexOf(m[1].toUpperCase()), r = 12 - Number(m[2]); return r >= 0 && r < 12 ? SQ(r, c) : -1; };
export const moveStr = (m) => `${sqName(mvFrom(m))}-${sqName(mvTo(m))}`;
export const strMove = (s) => { const [a, b] = String(s).split('-'); const f = nameToSq(a), t = nameToSq(b); return f >= 0 && t >= 0 ? MV(f, t) : -1; };

// ---------------- 布陣 ----------------
// 布陣陣列 L：30 格（本方列 k × 5 + 行 c），行營位置為 0，其餘放棋子種類
export const LAYOUT_POSTS = [];
for (let li = 0; li < 30; li++) if (!liIsCamp(li)) LAYOUT_POSTS.push(li);

// 回傳錯誤說明，合法時回傳空字串
export function validateLayout(L) {
  if (!Array.isArray(L) && !(L instanceof Int8Array) && !(L instanceof Uint8Array)) return '布陣資料錯誤';
  if (L.length !== 30) return '布陣資料錯誤';
  const cnt = new Array(13).fill(0);
  for (let li = 0; li < 30; li++) {
    const t = L[li];
    const k = (li / 5) | 0;
    if (liIsCamp(li)) { if (t) return '行營一開始必須空著'; continue; }
    if (!(t >= 1 && t <= 12)) return '每個兵站都要放一顆棋子';
    cnt[t]++;
    if (t === FLAG && !liIsHQ(li)) return '軍旗只能放在大本營';
    if (t === MINE && k > 1) return '地雷只能放在最後兩排';
    if (t === BOMB && k === 5) return '炸彈不能放在第一排（前線）';
  }
  for (let t = 1; t <= 12; t++) if (cnt[t] !== COUNT[t]) return `${NAMES[t]}應該有 ${COUNT[t]} 顆`;
  return '';
}

// 某種棋子能不能放在 li
export function canPlace(t, li) {
  const k = (li / 5) | 0;
  if (liIsCamp(li)) return false;
  if (t === FLAG) return liIsHQ(li);
  if (t === MINE) return k <= 1;
  if (t === BOMB) return k !== 5;
  return true;
}

// 經典布陣（本方視角：第 0 列是底線）
const P = (rows) => { const L = []; for (const r of rows) for (const ch of r) L.push(' 工排連營團旅師軍司炸雷旗'.indexOf(ch) > 0 ? ' 工排連營團旅師軍司炸雷旗'.indexOf(ch) : 0); return L; };
export const PRESETS = [
  { name: '穩守中宮', desc: '軍旗左營、三雷護旗，炸彈守中路', L: P(['雷旗雷連排', '工雷炸營連', '團．師．旅', '軍排．司營', '旅．炸．團', '工連師排工'].map((s) => s.replace(/．/g, ' '))) },
  { name: '右翼強攻', desc: '大子集中右路鐵路，快速突破', L: P(['連雷雷旗排', '雷工營炸連', '排．團．司', '營師．旅軍', '工．炸．師', '連排團旅工'].map((s) => s.replace(/．/g, ' '))) },
  { name: '左路疾風', desc: '司令軍長在左路，工兵分散探雷', L: P(['排旗雷雷連', '工雷炸營連', '司．團．旅', '軍排．師營', '師．炸．團', '工旅連排工'].map((s) => s.replace(/．/g, ' '))) },
  { name: '雙炸疑兵', desc: '炸彈放在大子旁邊，誘敵深入', L: P(['雷旗雷連營', '炸雷工排連', '師．司．團', '旅排．軍營', '工．炸．團', '連旅師排工'].map((s) => s.replace(/．/g, ' '))) },
  { name: '鐵壁中軍', desc: '中路厚實，兩側工兵靈活機動', L: P(['雷旗雷排連', '營工雷炸連', '團．軍．旅', '師排．司營', '工．炸．師', '排連團旅工'].map((s) => s.replace(/．/g, ' '))) },
  { name: '虛實雙旗', desc: '兩個大本營都用地雷圍住，讓對手猜不透', L: P(['雷旗雷營雷', '連工炸排連', '團．師．旅', '軍排．司營', '旅．炸．團', '工連師排工'].map((s) => s.replace(/．/g, ' '))) },
];

export function randomLayout(rng = Math.random) {
  for (let tries = 0; tries < 200; tries++) {
    const L = new Array(30).fill(0);
    const posts = LAYOUT_POSTS.slice();
    const take = (pred) => { const c = posts.filter(pred); if (!c.length) return -1; const li = c[Math.floor(rng() * c.length)]; posts.splice(posts.indexOf(li), 1); return li; };
    const place = (t, pred) => { const li = take(pred); if (li < 0) return false; L[li] = t; return true; };
    let ok = place(FLAG, liIsHQ);
    for (let i = 0; i < 3 && ok; i++) ok = place(MINE, (li) => li < 10);
    for (let i = 0; i < 2 && ok; i++) ok = place(BOMB, (li) => li < 25);
    if (!ok) continue;
    const rest = [];
    for (const t of [GONG, PAI, LIAN, YING, TUAN, LV, SHI, JUN, SI]) for (let i = 0; i < COUNT[t]; i++) rest.push(t);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    posts.forEach((li, i) => { L[li] = rest[i]; });
    if (!validateLayout(L)) return L;
  }
  return PRESETS[0].L.slice();
}

// 合法地交換兩格（布陣時使用）
export function canSwap(L, a, b) {
  if (a === b || liIsCamp(a) || liIsCamp(b)) return false;
  return canPlace(L[a], b) && canPlace(L[b], a);
}

// 布陣微調：隨機交換幾對「放得下」的棋子（AI 使用，避免每局都一樣）
export function mutateLayout(L, n = 4, rng = Math.random) {
  const out = L.slice();
  for (let i = 0; i < n * 6 && n > 0; i++) {
    const a = LAYOUT_POSTS[Math.floor(rng() * 25)], b = LAYOUT_POSTS[Math.floor(rng() * 25)];
    if (out[a] === FLAG || out[b] === FLAG) continue;
    if (canSwap(out, a, b) && out[a] !== out[b]) { [out[a], out[b]] = [out[b], out[a]]; n--; }
  }
  return out;
}

// ---------------- 對局（裁判）----------------
export class JunqiGame {
  // layouts：[紅軍布陣, 藍軍布陣]；kind：'dark' 暗棋（看不到對方）｜'open' 明棋；first：先走的一方
  constructor({ layouts, first = 0, kind = 'dark' } = {}) {
    this.kind = kind === 'open' ? 'open' : 'dark';
    this.first = first ? 1 : 0;
    this.layouts = [layouts?.[0] ? Array.from(layouts[0]) : randomLayout(), layouts?.[1] ? Array.from(layouts[1]) : randomLayout()];
    this.board = new Int8Array(NSQ);
    this.pid = new Int8Array(NSQ).fill(-1);
    this.pieces = []; // id → { side, type, home(sq), alive }
    for (const side of [0, 1]) {
      const L = this.layouts[side];
      for (let li = 0; li < 30; li++) {
        if (!L[li]) continue;
        const sq = sqOfLi(side, li);
        const id = this.pieces.length;
        this.pieces.push({ id, side, type: L[li], home: sq, alive: true });
        this.board[sq] = mk(side, L[li]);
        this.pid[sq] = id;
      }
    }
    this.turn = this.first;
    this.moves = [];
    this.log = [];      // 每一步的完整紀錄
    this.quiet = 0;     // 連續沒有交戰的步數
    this.flagShown = [false, false]; // 司令陣亡後亮出軍旗
    this.result = null;
    this.stack = [];
  }

  get plies() { return this.moves.length; }

  legalMoves(side = this.turn) { return this.result ? [] : genMoves(this.board, side); }
  targets(sq) { return targetList(this.board, sq); }
  isLegal(m) { if (this.result) return false; const f = mvFrom(m); const c = this.board[f]; if (!c || (c >> 4) !== this.turn) return false; return targetList(this.board, f).includes(mvTo(m)); }

  flagSq(side) { for (let sq = 0; sq < NSQ; sq++) if (this.board[sq] === mk(side, FLAG)) return sq; return -1; }

  snapshot() { return { board: this.board.slice(), pid: this.pid.slice(), alive: this.pieces.map((p) => p.alive), turn: this.turn, quiet: this.quiet, flagShown: this.flagShown.slice(), result: this.result }; }
  restore(s) { this.board = s.board; this.pid = s.pid; s.alive.forEach((a, i) => { this.pieces[i].alive = a; }); this.turn = s.turn; this.quiet = s.quiet; this.flagShown = s.flagShown; this.result = s.result; }

  // 走一步；回傳這一步的紀錄
  play(m) {
    const from = mvFrom(m), to = mvTo(m);
    this.stack.push(this.snapshot());
    const side = this.turn;
    const a = this.board[from], d = this.board[to];
    const aid = this.pid[from], did = d ? this.pid[to] : -1;
    const ev = { ply: this.moves.length, side, from, to, aid, did, at: a & 15, dt: d ? d & 15 : 0, out: 'move', cmdDead: [], flagSq: [-1, -1] };
    this.board[from] = 0; this.pid[from] = -1;
    if (!d) {
      this.board[to] = a; this.pid[to] = aid;
      this.quiet++;
    } else {
      this.quiet = 0;
      const r = fight(a & 15, d & 15);
      if (r === 1 || r === 2) {
        ev.out = r === 2 ? 'flag' : 'win';
        this.pieces[did].alive = false;
        this.board[to] = a; this.pid[to] = aid;
      } else if (r === -1) {
        ev.out = 'lose';
        this.pieces[aid].alive = false;
      } else {
        ev.out = 'tie';
        this.pieces[aid].alive = false; this.pieces[did].alive = false;
        this.board[to] = 0; this.pid[to] = -1;
      }
      // 司令陣亡：亮出軍旗
      const dead = [];
      if (ev.out === 'lose' || ev.out === 'tie') dead.push(this.pieces[aid]);
      if (ev.out === 'win' || ev.out === 'tie') dead.push(this.pieces[did]);
      for (const p of dead) if (p.type === SI && !this.flagShown[p.side]) {
        this.flagShown[p.side] = true;
        ev.cmdDead.push(p.side);
        ev.flagSq[p.side] = this.flagSq(p.side);
      }
    }
    this.moves.push(m);
    this.log.push(ev);
    this.turn = side ^ 1;
    if (ev.out === 'flag') this.result = { winner: side, reason: '奪下軍旗' };
    else if (!hasMoves(this.board, this.turn)) this.result = { winner: side, reason: `${SIDE_NAME[this.turn]}已經沒有可以走的棋子` };
    else if (this.quiet >= QUIET_LIMIT) this.result = { winner: null, reason: `連續 ${QUIET_LIMIT / 2} 回合沒有交戰` };
    else if (this.moves.length >= PLY_LIMIT) this.result = { winner: null, reason: '步數已達上限' };
    ev.result = this.result;
    return ev;
  }

  countMovable(side) { let n = 0; for (const p of this.pieces) if (p.alive && p.side === side && movable(p.type)) n++; return n; }

  undo() {
    if (!this.stack.length) return false;
    this.restore(this.stack.pop());
    this.moves.pop();
    this.log.pop();
    return true;
  }

  resign(side) { if (!this.result) this.result = { winner: side ^ 1, reason: `${SIDE_NAME[side]}認輸` }; }
  agreeDraw() { if (!this.result) this.result = { winner: null, reason: '雙方同意和棋' }; }
  timeout(side) { if (!this.result) this.result = { winner: side ^ 1, reason: `${SIDE_NAME[side]}超時` }; }

  // 某一方看得到的局面（暗棋：對方棋子只知道位置；明棋：全部看得到）
  viewFor(side) {
    const open = this.kind === 'open' || side == null;
    const board = new Int8Array(NSQ);
    for (let sq = 0; sq < NSQ; sq++) {
      const c = this.board[sq];
      if (!c) continue;
      const s = c >> 4;
      board[sq] = open || s === side || ((c & 15) === FLAG && this.flagShown[s]) ? c : mk(s, UNK);
    }
    const events = this.log.map((e) => publicEvent(e, open ? null : side));
    const homes = this.pieces.map((p) => p.home);
    const known = open ? this.pieces.map((p) => p.type) : this.pieces.map((p) => (p.side === side ? p.type : 0));
    return { side, kind: this.kind, open, turn: this.turn, board, pid: Array.from(this.pid), homes, known, alive: this.pieces.map((p) => p.alive), events, quiet: this.quiet, plies: this.moves.length, flagShown: this.flagShown.slice(), result: this.result };
  }

  toRecord(meta = {}) {
    return {
      app: 'xiaoke-junqi', ver: 1,
      date: new Date().toISOString(),
      ...meta,
      kind: this.kind, first: this.first,
      layouts: this.layouts.map((L) => Array.from(L)),
      moves: this.moves.map(moveStr),
      result: !this.result ? '*' : this.result.winner == null ? 'draw' : this.result.winner === 0 ? 'red' : 'blue',
      reason: (meta && meta.reason) || (this.result ? this.result.reason : ''),
    };
  }
}

// 事件的公開版本：viewer 看不到對方棋子的種類（裁判只公布勝負）
export function publicEvent(e, viewer) {
  const pe = { ply: e.ply, side: e.side, from: e.from, to: e.to, aid: e.aid, did: e.did, out: e.out, cmdDead: e.cmdDead.slice(), flagSq: e.flagSq.slice() };
  if (viewer == null) { pe.at = e.at; pe.dt = e.dt; }
  else {
    pe.at = e.side === viewer ? e.at : 0;
    pe.dt = e.did >= 0 && e.side !== viewer ? e.dt : 0;
    // 司令陣亡時，裁判會公布陣亡的是司令
    if (e.cmdDead.includes(viewer ^ 1)) {
      if (e.side !== viewer && (e.out === 'lose' || e.out === 'tie') && e.at === SI) pe.at = SI;
      if (e.side === viewer && (e.out === 'win' || e.out === 'tie') && e.dt === SI) pe.dt = SI;
    }
  }
  return pe;
}

// 依紀錄重建對局（upto：只走到第幾步）
export function replayRecord(rec, upto = Infinity) {
  const g = new JunqiGame({ layouts: rec.layouts, first: rec.first || 0, kind: rec.kind });
  const list = rec.moves || [];
  for (let i = 0; i < list.length && i < upto; i++) {
    const m = typeof list[i] === 'number' ? list[i] : strMove(list[i]);
    if (m < 0 || !g.isLegal(m)) break;
    g.play(m);
  }
  if (upto >= list.length && !g.result && rec.result && rec.result !== '*') {
    const w = rec.result === 'red' ? 0 : rec.result === 'blue' ? 1 : null;
    g.result = { winner: w, reason: rec.reason || '' };
  }
  return g;
}

// ---------------- 文字說明 ----------------
const OUT_TEXT = { win: '勝', lose: '敗', tie: '同歸於盡', flag: '奪旗！' };
// 一步棋的說明；viewer＝看的人（null 表示全部公開）
export function noteOf(e, viewer = null) {
  const pe = viewer == null ? e : publicEvent(e, viewer);
  const nm = (t, s) => (t ? NAMES[t] : (viewer != null && s !== viewer ? '敵軍' : '？'));
  const a = nm(pe.at, pe.side);
  let s = `${a} ${sqName(pe.from)}→${sqName(pe.to)}`;
  if (pe.out !== 'move') {
    const d = nm(pe.dt, pe.side ^ 1);
    s += pe.out === 'flag' ? `　奪下軍旗！` : pe.out === 'tie' ? `　與${d}同歸於盡` : pe.out === 'win' ? `　吃掉${d}` : `　碰上${d}陣亡`;
  }
  if (pe.cmdDead.length) s += `　（${pe.cmdDead.map((x) => SIDE_NAME[x]).join('、')}司令陣亡，亮出軍旗）`;
  return s;
}
export { OUT_TEXT };

// 走錯時的原因
export function explainIllegal(board, from, to) {
  const a = board[from];
  if (!a) return '這裡沒有棋子';
  const t = a & 15, side = a >> 4;
  if (t === FLAG) return '軍旗不能移動';
  if (t === MINE) return '地雷埋好就不能移動';
  if (isHQ(from)) return '進了大本營的棋子就不能再移動';
  const d = board[to];
  if (d && (d >> 4) === side) return '那裡是自己的棋子';
  if (d && isCamp(to)) return '行營裡的棋子受到保護，不能攻擊';
  if (halfOf(from) !== halfOf(to) && (colOf(from) === 1 || colOf(from) === 3) && colOf(to) === colOf(from)) return '山界擋住了，只能從左、中、右三條鐵路過去';
  if (isRail(from) && isRail(to)) {
    if (onStraightRail(from, to)) return '鐵路上中間有棋子擋住';
    if (t !== GONG) {
      // 看看工兵能不能到：能的話代表要轉彎
      const tryB = Int8Array.from(board); tryB[from] = mk(side, GONG);
      if (targetList(tryB, from).includes(to)) return '只有工兵可以在鐵路上轉彎';
    } else return '鐵路上沒有通路（被棋子擋住）';
  }
  if (Math.abs(rowOf(from) - rowOf(to)) === 1 && Math.abs(colOf(from) - colOf(to)) === 1) return '斜著走只能進出行營';
  return isRail(from) && isRail(to) ? '鐵路走法不對' : '公路一次只能走一步（鐵路上才能走遠）';
}

// 棋盤文字圖（給 AI 軍師）：viewer 的角度
export function boardText(view) {
  const lines = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === 6) lines.push('    ～～～ 山界（只有 A、C、E 三條鐵路可以通過）～～～');
    const cells = [];
    for (let c = 0; c < COLS; c++) {
      const sq = SQ(r, c);
      const code = view.board[sq];
      let s;
      if (!code) s = isCamp(sq) ? '（營）' : isHQ(sq) ? '［本］' : '　．　';
      else {
        const side = code >> 4, t = code & 15;
        const tag = side === 0 ? '紅' : '藍';
        s = `${tag}${t === UNK ? '？？' : NAMES[t]}`;
        s = isCamp(sq) ? `(${s.slice(0, 3)})` : ` ${s.slice(0, 3)} `;
      }
      cells.push(s.padEnd(5, '　'));
    }
    lines.push(`${String(12 - r).padStart(2, ' ')} ${cells.join('')}`);
  }
  lines.push('     A　　　B　　　C　　　D　　　E');
  return lines.join('\n');
}
