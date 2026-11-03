# 小柯機器人陸軍棋遊戲

<img src="build/icon.png" width="160" align="right" alt="小柯機器人陸軍棋遊戲">

3D 立體陸軍棋（二人對戰）：暗棋裁判制與明棋、真人對 AI、真人對真人（遠端連線＋語音）、AI 對 AI，
AI 只根據公開資訊推算對方暗子，並從累積的棋譜學習。

**遊戲開發：吳玉柱 先生 與 Claude AI Opus 5.5**

## 下載

**線上版（免安裝）**：https://achir1015.github.io/xiaoke-junqi/online/　．　網站首頁：https://achir1015.github.io/xiaoke-junqi/

到 [Releases](https://github.com/achir1015/xiaoke-junqi/releases/latest) 下載：

| 平台 | 檔案 |
| --- | --- |
| Windows 11 安裝版（建立桌面捷徑） | `XiaokeJunqi-版本-win-x64.exe` |
| Windows 11 免安裝版 | `XiaokeJunqi-版本-win-x64-portable.exe` |
| MacBook Pro（Apple 晶片） | `XiaokeJunqi-版本-mac-arm64.dmg` |
| MacBook Pro（Intel） | `XiaokeJunqi-版本-mac-x64.dmg` |
| Android 手機（直立） | `XiaokeJunqi-版本-android.apk` |
| iPhone（直放）／iPad（橫放） | 用 Safari 開 [安裝頁](https://achir1015.github.io/xiaoke-junqi/ios/) 按「安裝」（限已登記的裝置） |

程式內建「檢查更新」，有新版時按一下就會自動下載安裝。

## 功能

- **三種對戰**：真人對 AI（入門～大師五種難度）、真人對真人（6 位數房號邀約遠端棋友、文字與語音聊天）、AI 對 AI 觀戰。
- **布陣**：點兩顆棋子互換；經典布陣、隨機、AI 軍師推薦；可儲存自己的布陣。不合規則時會說明原因。
- **暗棋裁判制**：看不到對方棋子，只公布交戰勝負；司令陣亡亮出軍旗。也可以選「明棋」練習。
- **敵情推算與速算**：根據起始位置、走法與交戰結果，用多次抽樣推算每顆暗子的機率，在棋盤上標示，並列出敵方剩餘兵力。
  AI 也只用同樣的資訊（絕不偷看），再對每一種可能的布陣做 α-β 搜尋、取平均最好的一步。
- **棋譜累積**：每局自動收錄，可重播、匯出、匯入；AI 從棋譜學習對手常用的布陣位置與打贏過的布陣。
- **AI 軍師陪同**：20 位男英雄、20 位女佳人頭像、30 位男女 AI 軍師。開局前選頭像與軍師；對局中可請教、可換軍師；
  主位可由 AI 軍師代打，之後再交還主位。有 Anthropic API 金鑰時以 Claude 白話解說。
- **教學**：14 課陸軍棋教學（動畫小棋盤＋語音講解＋練習）；系統功能說明（語音＋文字）。
- **3D 場景**：沙盤地形、黑白鐵路、行營、大本營、山界群山、飄揚的軍旗、立體棋子與交戰火花、炸彈爆炸。
- **背景音樂**：20 首原創軍樂風格音樂（每首 3 分多鐘），音樂與音效各有直立音量滑桿（往上大聲）。

## 規則摘要

- 棋子：司令＞軍長＞師長＞旅長＞團長＞營長＞連長＞排長＞工兵；同級同歸於盡。
- 炸彈碰到任何棋子同歸於盡；地雷只有工兵能挖（炸彈與地雷同歸於盡）；軍旗、地雷不能移動。
- 公路一次一步；鐵路直線不限距離；只有工兵能在鐵路上轉彎；山界只有左、中、右三條鐵路可通過。
- 行營裡的棋子不能被攻擊、可斜進斜出；進入大本營的棋子不能再移動。
- 布陣：軍旗在大本營、地雷在最後兩排、炸彈不在第一排、行營空著。
- 奪下軍旗或對方無棋可走即獲勝；連續 40 回合沒有交戰判和。

規則參考：[code-fans/kriegspiel](https://github.com/code-fans/kriegspiel)

## 開發

```bash
npm install
npm start            # 開發模式
npm test             # 規則、AI、推算、教學單元測試
node e2e/smoke.mjs   # 單機端對端測試
node e2e/net.mjs     # 雙實例連線測試（本機配對伺服器）
npm run dist:win     # 建置 Windows 安裝檔
python android/build.py install   # 建置 Android APK 並安裝到 USB 連接的手機（debug：允許實機測試）
node e2e/phone.mjs   # 手機實機測試（除錯版 APK）
node e2e/ios.mjs     # iPhone／iPad 版面測試（Chrome 模擬）
node e2e/web.mjs     # 線上版測試（照網站路徑排好）
```

素材產生：`python scripts/gen_music.py`（背景音樂）、`node scripts/gen_portraits.mjs`（頭像）、`python scripts/make_icon.py`（圖示）。
