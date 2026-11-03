import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/renderer/js/junqi.js';
import { LESSONS, HELP } from '../src/renderer/js/guide.js';

const SHORTS = '工排連營團旅師軍司炸雷旗';
function boardOf(spec) {
  const b = new Int8Array(60);
  if (spec === 'preset') { J.PRESETS[0].L.forEach((t, li) => { if (t) b[J.sqOfLi(0, li)] = J.mk(0, t); }); J.PRESETS[1].L.forEach((t, li) => { if (t) b[J.sqOfLi(1, li)] = J.mk(1, t); }); return b; }
  for (const tok of String(spec || '').trim().split(/\s+/).filter(Boolean)) {
    const m = /^([RB])(.):([A-E]\d{1,2})$/.exec(tok);
    assert.ok(m, `擺子格式錯誤：${tok}`);
    const sq = J.nameToSq(m[3]);
    assert.ok(sq >= 0, tok);
    b[sq] = J.mk(m[1] === 'R' ? 0 : 1, m[2] === '?' ? J.PAI : SHORTS.indexOf(m[2]) + 1);
  }
  return b;
}

test('每一課的示範走法都合乎規則', () => {
  for (const lesson of LESSONS) {
    let b = new Int8Array(60);
    for (const st of lesson.steps) {
      if (st.pieces != null) b = boardOf(st.pieces);
      assert.ok(st.say && st.say.length > 4, lesson.title);
      if (st.move) {
        const f = J.nameToSq(st.move[0]), t = J.nameToSq(st.move[1]);
        assert.ok(J.targetList(b, f).includes(t), `${lesson.title}：${st.move.join('→')} 不合規則`);
      }
      if (st.bad) {
        const sel = J.nameToSq(st.sel);
        for (const s of st.bad) assert.ok(!J.targetList(b, sel).includes(J.nameToSq(s)), `${lesson.title}：${st.sel}→${s} 其實可以走`);
      }
      if (st.practice) {
        const f = J.nameToSq(st.practice.piece);
        const tg = J.targetList(b, f);
        assert.ok(tg.length, `${lesson.title}：練習的棋子沒有路走`);
        if (st.practice.goal) assert.ok(tg.includes(J.nameToSq(st.practice.goal)), `${lesson.title}：練習答案不合規則`);
      }
      if (st.path) {
        for (let i = 1; i < st.path.length; i++) assert.ok(J.onStraightRail(J.nameToSq(st.path[i - 1]), J.nameToSq(st.path[i])), `${lesson.title}：路線不是鐵路`);
      }
    }
  }
  assert.ok(LESSONS.length >= 12 && HELP.length >= 8);
});
