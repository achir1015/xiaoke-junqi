'use strict';
// AI 軍師：呼叫 Claude（Anthropic SDK，串流回覆）
const AnthropicMod = require('@anthropic-ai/sdk');
const Anthropic = AnthropicMod.default || AnthropicMod;

const SYSTEM = [
  '你是「小柯軍師」，一位親切又專業的陸軍棋（軍棋）教練，在對局進行中替使用者出主意。',
  '一律使用台灣繁體中文，口吻像坐在旁邊小聲指點的參謀。',
  '每則使用者訊息都附有最新的【局面資訊】：文字棋盤（座標 A～E、1～12）、輪到哪一方、最近的戰況、敵情推算（每顆敵方暗子最可能是什麼、機率多少），以及本機 AI 的候選著法與評分。',
  '暗棋模式下雙方都看不到對方棋子，只知道裁判公布的勝負；敵情推算是根據起始位置、走法與交戰結果算出來的機率，請把它當成「可能」而不是確定的事實。',
  '本機 AI 的候選著法是可靠的計算結果，請以它為主要依據，再用白話說明理由（試探、保護軍旗、工兵挖雷、炸彈換大子、佔行營等）。不要建議不合規則的走法。',
  '走法一律用座標寫，例如「團長 C4→C7」。回答要精簡：先用一句話給結論，再用 2～4 個重點說明；必要時提醒軍旗的安全。',
  '使用者的身分是局面資訊裡標示的「您是紅軍」或「您是藍軍」，只替這一方出主意。',
  '如果使用者聊的不是棋局，可以簡短友善地回應，再自然地拉回棋局。',
].join('\n');

const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

class Advisor {
  constructor({ getKey, getSettings }) {
    this.getKey = getKey;
    this.getSettings = getSettings;
    this.active = new Map(); // id → stream
  }

  client() {
    const apiKey = this.getKey();
    if (!apiKey) return null;
    return new Anthropic({ apiKey, maxRetries: 2, timeout: 120000 });
  }

  params(messages, maxTokens, effort) {
    const s = this.getSettings();
    const model = s.model || 'claude-opus-5-5';
    const p = {
      model,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages,
      output_config: { effort: effort || s.effort || 'low' },
    };
    // 安全分類器拒答時，由伺服器自動改用建議的備援模型重跑
    if (FALLBACK_MODELS.has(model)) {
      p.betas = ['server-side-fallback-2026-07-01'];
      p.fallbacks = 'default';
    }
    return p;
  }

  explain(err) {
    if (err instanceof Anthropic.AuthenticationError) return 'API 金鑰無效，請到「設定」重新輸入 Anthropic API 金鑰。';
    if (err instanceof Anthropic.PermissionDeniedError) return '這把金鑰沒有使用此模型的權限，請到「設定」換一個模型或金鑰。';
    if (err instanceof Anthropic.NotFoundError) return '找不到指定的模型，請到「設定」改用 claude-opus-5-5。';
    if (err instanceof Anthropic.RateLimitError) return '請求太頻繁或額度用完了，請稍後再問。';
    if (err instanceof Anthropic.BadRequestError) return '請求格式有誤：' + (err.message || '');
    if (err instanceof Anthropic.APIConnectionError) return '連不上 Claude 伺服器，請檢查網路。';
    if (err instanceof Anthropic.APIError) return `Claude 回應錯誤（${err.status || ''}）：${err.message || ''}`;
    return String((err && err.message) || err);
  }

  // payload: { messages:[{role, content}], effort? }
  async ask(sender, id, payload) {
    const send = (ch, data) => { if (!sender.isDestroyed()) sender.send(ch, { id, ...data }); };
    const client = this.client();
    if (!client) { send('advisor:done', { error: 'nokey' }); return; }
    let stream;
    try {
      stream = client.beta.messages.stream(this.params(payload.messages, 4000, payload.effort));
      this.active.set(id, stream);
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') send('advisor:delta', { text: ev.delta.text });
      }
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') {
        send('advisor:done', { error: '軍師這題無法回答，換個問法試試看。' });
        return;
      }
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      send('advisor:done', { text, model: msg.model, truncated: msg.stop_reason === 'max_tokens' });
    } catch (err) {
      if (stream && stream.aborted) { send('advisor:done', { error: 'cancelled' }); return; }
      send('advisor:done', { error: this.explain(err) });
    } finally {
      this.active.delete(id);
    }
  }

  cancel(id) {
    const s = this.active.get(id);
    if (s) { try { s.abort(); } catch {} this.active.delete(id); }
  }

  cancelAll() { for (const id of [...this.active.keys()]) this.cancel(id); }

  // 測試金鑰
  async test() {
    const client = this.client();
    if (!client) return { ok: false, error: '尚未設定 API 金鑰' };
    try {
      const p = this.params([{ role: 'user', content: '請用一句話向棋友打招呼。' }], 2000, 'low');
      const msg = await client.beta.messages.create(p);
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { ok: true, text, model: msg.model };
    } catch (err) {
      return { ok: false, error: this.explain(err) };
    }
  }
}

module.exports = { Advisor, SYSTEM, FALLBACK_MODELS };
