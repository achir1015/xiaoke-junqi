import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/renderer/js/junqi.js';

const { SQ, mk, GONG, PAI, SI, JUN, SHI, BOMB, MINE, FLAG, LIAN } = J;
const empty = () => new Int8Array(60);
const tg = (b, sq) => J.targetList(b, sq).map(J.sqName).sort();

test('經典布陣都合法', () => {
  for (const p of J.PRESETS) assert.equal(J.validateLayout(p.L), '', p.name);
  for (let i = 0; i < 50; i++) assert.equal(J.validateLayout(J.randomLayout()), '');
});

test('棋盤：行營、大本營、鐵路', () => {
  assert.equal(J.LAYOUT_POSTS.length, 25);
  const camps = []; for (let s = 0; s < 60; s++) if (J.isCamp(s)) camps.push(J.sqName(s));
  assert.equal(camps.length, 10);
  assert.deepEqual(camps.filter((n) => Number(n.slice(1)) <= 6).sort(), ['B3', 'B5', 'C4', 'D3', 'D5']);
  const hq = []; for (let s = 0; s < 60; s++) if (J.isHQ(s)) hq.push(J.sqName(s));
  assert.deepEqual(hq.sort(), ['B1', 'B12', 'D1', 'D12']);
});

test('一般棋子在鐵路上走直線，不能轉彎', () => {
  const b = empty();
  const s = J.nameToSq('A2');
  b[s] = mk(0, SHI);
  const t = tg(b, s);
  assert.ok(t.includes('A11'), '左路鐵路直通對方');
  assert.ok(t.includes('E2'), '第二排鐵路橫走');
  assert.ok(!t.includes('C6'), '不能轉彎');
  assert.ok(t.includes('A1') && t.includes('B3') && !t.includes('B1'), '公路一步＋斜進行營');
});

test('工兵在鐵路上可以轉彎', () => {
  const b = empty();
  const s = J.nameToSq('A2');
  b[s] = mk(0, GONG);
  const t = tg(b, s);
  assert.ok(t.includes('C6') && t.includes('C7') && t.includes('E11'));
  // 擋住
  b[J.nameToSq('B2')] = mk(0, PAI);
  b[J.nameToSq('A3')] = mk(0, PAI);
  assert.ok(!tg(b, s).includes('C6'));
});

test('山界：B、D 兩行不能過', () => {
  const b = empty();
  const s = J.nameToSq('B6');
  b[s] = mk(0, SI);
  assert.ok(!tg(b, s).includes('B7'));
  const s2 = J.nameToSq('C6'); b[s2] = mk(0, SI);
  assert.ok(tg(b, s2).includes('C7'));
});

test('行營裡的棋子不能被攻擊；大本營的棋子不能動', () => {
  const b = empty();
  b[J.nameToSq('B3')] = mk(1, SI);
  b[J.nameToSq('B2')] = mk(0, SI);
  assert.ok(!tg(b, J.nameToSq('B2')).includes('B3'));
  b[J.nameToSq('B1')] = mk(0, SHI);
  assert.deepEqual(tg(b, J.nameToSq('B1')), []);
});

test('交戰規則', () => {
  assert.equal(J.fight(SI, JUN), 1);
  assert.equal(J.fight(LIAN, LIAN), 0);
  assert.equal(J.fight(PAI, LIAN), -1);
  assert.equal(J.fight(SI, BOMB), 0);
  assert.equal(J.fight(BOMB, MINE), 0);
  assert.equal(J.fight(GONG, MINE), 1);
  assert.equal(J.fight(SI, MINE), -1);
  assert.equal(J.fight(GONG, FLAG), 2);
});

test('對局：奪旗、司令陣亡亮旗、悔棋、重播', () => {
  const g = new J.JunqiGame({ layouts: [J.PRESETS[0].L, J.PRESETS[1].L], kind: 'dark' });
  let n = 0;
  while (!g.result && n < 400) {
    const ms = g.legalMoves();
    // 優先交戰，讓對局快點結束
    const cap = ms.filter((m) => g.board[J.mvTo(m)]);
    g.play((cap.length ? cap : ms)[n * 7 % (cap.length || ms.length)]);
    n++;
  }
  assert.ok(g.result, '對局有結果');
  const rec = g.toRecord();
  const r = J.replayRecord(rec);
  assert.deepEqual(Array.from(r.board), Array.from(g.board));
  const before = Array.from(g.board);
  if (!g.result) { g.play(g.legalMoves()[0]); g.undo(); assert.deepEqual(Array.from(g.board), before); }
  // 暗棋：看不到對方
  const g2 = new J.JunqiGame({ layouts: [J.PRESETS[0].L, J.PRESETS[1].L] });
  const v = g2.viewFor(0);
  for (let s = 0; s < 30; s++) if (v.board[s]) assert.equal(v.board[s] & 15, J.UNK);
});

test('司令陣亡亮出軍旗', () => {
  const L0 = J.PRESETS[0].L.slice(), L1 = J.PRESETS[0].L.slice();
  const g = new J.JunqiGame({ layouts: [L0, L1] });
  // 把雙方司令擺到相鄰位置，紅司令撞藍司令
  const rs = g.board.findIndex((c) => c === mk(0, SI));
  const bs = g.board.findIndex((c) => c === mk(1, SI));
  g.board[rs] = 0; g.board[bs] = 0;
  const a = J.nameToSq('C6'), d = J.nameToSq('C7');
  g.board[a] = mk(0, SI); g.pid[a] = g.pid[rs]; g.pid[rs] = -1;
  g.board[d] = mk(1, SI); g.pid[d] = g.pid[bs]; g.pid[bs] = -1;
  const ev = g.play(J.MV(a, d));
  assert.equal(ev.out, 'tie');
  assert.deepEqual(ev.cmdDead.sort(), [0, 1]);
  assert.ok(g.flagShown[0] && g.flagShown[1]);
  const v = g.viewFor(0);
  assert.equal(v.board[g.flagSq(1)], mk(1, FLAG));
});
