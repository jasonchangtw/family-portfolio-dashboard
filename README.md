# 家庭投資儀表板

這是依據 `PRD-family-portfolio-dashboard.md` 建立的 MVP 雛形。

## 目前內容

- 靜態 Web App，可直接用瀏覽器開啟
- 繁體中文介面
- Dashboard：總資產、總報酬率、今日損益、配息收入、本月/今年損益
- 持股、交易、配息、設定頁
- 手動新增買入、賣出、配息
- localStorage 暫存資料
- JSON 手動匯出
- PWA manifest 與 service worker
- Supabase schema 草案
- Supabase 帳號與專案設定指南
- Supabase Auth 連線 UI，未設定時仍使用本機資料
- 登入後可從 Supabase 讀取並同步帳戶、標的、交易、配息與費率設定

## 本機執行

```bash
python3 -m http.server 5173
```

然後開啟：

```text
http://localhost:5173
```

## 重要檔案

- `index.html`：App 介面
- `styles.css`：視覺與響應式版面
- `app.js`：示範資料、計算與互動
- `manifest.webmanifest`：PWA 設定
- `service-worker.js`：離線快取基礎
- `supabase-schema.sql`：Supabase PostgreSQL schema 草案
- `supabase-bootstrap-template.sql`：建立家庭、成員、預設帳戶的 SQL 模板
- `supabase-config.example.js`：Supabase 前端設定範例
- `SUPABASE_SETUP.md`：Supabase 帳號、專案、資料庫設定步驟
- `PRD-family-portfolio-dashboard.md`：產品規格
- `requirements-notes.md`：需求討論紀錄

## 下一步

1. 部署到 Vercel 或 Netlify，並設定 `SUPABASE_URL`、`SUPABASE_ANON_KEY`。
2. 到 Supabase Auth URL 設定加入正式網址。
3. 根據實際富邦成交明細校正費率。
4. 接每日收盤價與富邦銀行匯率資料來源。

## 部署設定

這是純靜態網站。部署時不要把 `service_role` key 放到前端；只需要 Supabase Project URL 與 anon public key。

Vercel / Netlify 可設定：

- Build command：`sh scripts/build-config.sh`
- Output directory：專案根目錄
- Environment variables：
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

本專案也已內建：

- `package.json`：部署時 `npm run build` 會產生 `supabase-config.js`
- `vercel.json`：Vercel 部署設定
- `netlify.toml`：Netlify 部署設定
- `.env.example`：環境變數範例

本機若已經有 `supabase-config.js`，`npm run build` 不會覆寫它。若真的要用環境變數重產本機設定，可執行：

```bash
FORCE_BUILD_CONFIG=1 npm run build
```

部署完成後，進入 Supabase Dashboard：

1. Authentication > URL Configuration
2. Site URL 填正式網址
3. Redirect URLs 加上正式網址與萬用路徑，例如 `https://your-domain.vercel.app/**`
