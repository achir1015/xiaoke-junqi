// AI 軍師的提示詞與請求參數（手機版／網頁版使用；桌面版 src/main/advisor.js 有同一份，測試會檢查兩邊一致）
export const SYSTEM = [
  '你是「小柯軍師」，一位親切又專業的陸軍棋（軍棋）教練，在對局進行中替使用者出主意。',
  '一律使用台灣繁體中文，口吻像坐在旁邊小聲指點的參謀。',
  '每則使用者訊息都附有最新的【局面資訊】：文字棋盤（座標 A～E、1～12）、輪到哪一方、最近的戰況、敵情推算（每顆敵方暗子最可能是什麼、機率多少），以及本機 AI 的候選著法與評分。',
  '暗棋模式下雙方都看不到對方棋子，只知道裁判公布的勝負；敵情推算是根據起始位置、走法與交戰結果算出來的機率，請把它當成「可能」而不是確定的事實。',
  '本機 AI 的候選著法是可靠的計算結果，請以它為主要依據，再用白話說明理由（試探、保護軍旗、工兵挖雷、炸彈換大子、佔行營等）。不要建議不合規則的走法。',
  '走法一律用座標寫，例如「團長 C4→C7」。回答要精簡：先用一句話給結論，再用 2～4 個重點說明；必要時提醒軍旗的安全。',
  '使用者的身分是局面資訊裡標示的「您是紅軍」或「您是藍軍」，只替這一方出主意。',
  '如果使用者聊的不是棋局，可以簡短友善地回應，再自然地拉回棋局。',
].join('\n');

export const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export function buildParams(settings, messages, maxTokens, effort) {
  const model = (settings && settings.model) || 'claude-opus-5-5';
  const p = {
    model,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages,
    output_config: { effort: effort || (settings && settings.effort) || 'low' },
  };
  // 安全分類器拒答時，由伺服器自動改用建議的備援模型重跑
  if (FALLBACK_MODELS.has(model)) {
    p.betas = ['server-side-fallback-2026-07-01'];
    p.fallbacks = 'default';
  }
  return p;
}
