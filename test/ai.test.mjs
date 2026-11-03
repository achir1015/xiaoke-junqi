import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/renderer/js/junqi.js';
import { buildBelief, sample, marginals, maskText } from '../src/renderer/js/belief.js';
import { chooseMove, LEVELS, chooseLayout, infer } from '../src/renderer/js/ai.js';

test('推算：抽樣一定符合數量與位置規則', () => {
  const g = new J.JunqiGame({ layouts: [J.PRESETS[0].L, J.PRESETS[2].L] });
  const b = buildBelief(g.viewFor(0), null);
  for (let i = 0; i < 50; i++) {
    const s = sample(b);
    assert.ok(s);
    const cnt = new Array(13).fill(0);
    for (const [id, t] of s) { cnt[t]++; const li = J.liOf(1, g.pieces[id].home); assert.ok(J.canPlace(t, li)); }
    for (let t = 1; t <= 12; t++) assert.equal(cnt[t], J.COUNT[t]);
  }
});

test('推算：交戰結果會縮小範圍', () => {
  const g = new J.JunqiGame({ layouts: [J.PRESETS[0].L, J.PRESETS[2].L] });
  // 隨機走到有交戰為止
  let n = 0;
  while (!g.result && n < 300) {
    const ms = g.legalMoves();
    const cap = ms.filter((m) => g.board[J.mvTo(m)]);
    g.play((cap.length && n % 3 === 0 ? cap : ms)[(n * 13) % (cap.length && n % 3 === 0 ? cap.length : ms.length)]);
    n++;
  }
  const v = g.viewFor(0);
  const b = buildBelief(v, null);
  // 每一顆敵子的真實種類都要在推算範圍內
  for (const id of b.ids) assert.ok(b.mask.get(id) & (1 << g.pieces[id].type), `棋子 ${id} 實際是 ${J.NAMES[g.pieces[id].type]}，推算為 ${maskText(b.mask.get(id))}`);
  const m = marginals(b, 60);
  assert.ok(m.samples > 0);
});

test('AI 會吃掉送上門的軍旗', () => {
  const b0 = J.PRESETS[0].L.slice();
  const g = new J.JunqiGame({ layouts: [b0, J.PRESETS[0].L.slice()], kind: 'open' });
  // 清空藍軍軍旗周圍，放紅司令在旁邊
  const f = g.flagSq(1);
  for (const sq of J.ADJ[f]) { if (g.board[sq] && (g.board[sq] >> 4) === 1) { g.board[sq] = 0; g.pid[sq] = -1; } }
  const near = J.ADJ[f].find((sq) => !g.board[sq]);
  const si = g.board.findIndex((c) => c === J.mk(0, J.SI));
  g.board[near] = J.mk(0, J.SI); g.pid[near] = g.pid[si]; g.board[si] = 0; g.pid[si] = -1;
  const r = chooseMove(g.viewFor(0), 2);
  assert.equal(J.mvTo(r.move), f);
});

test('AI 各難度都能在時間內走完一盤', () => {
  for (const lv of [0, 2]) {
    const g = new J.JunqiGame({ layouts: [chooseLayout(lv), chooseLayout(lv)] });
    let n = 0;
    const t0 = Date.now();
    while (!g.result && n < 120) {
      const r = chooseMove(g.viewFor(g.turn), lv);
      assert.ok(g.isLegal(r.move), '合法著法');
      g.play(r.move);
      n++;
    }
    assert.ok(Date.now() - t0 < 120 * LEVELS[lv].timeMs * 2.5 + 3000);
  }
});

test('敵情推算可以跑', () => {
  const g = new J.JunqiGame({});
  const r = infer(g.viewFor(1), null, 40);
  assert.equal(Object.keys(r.pieces).length, 25);
});
