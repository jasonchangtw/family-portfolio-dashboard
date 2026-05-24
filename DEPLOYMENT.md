# 部署檢查清單

GitHub repository:

https://github.com/jasonchangtw/family-portfolio-dashboard

## 1. GitHub Pages

本專案使用 GitHub Actions 發佈到 GitHub Pages。Workflow 位於：

```text
.github/workflows/pages.yml
```

Repository secrets 需要設定：

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
PUBLIC_SUPABASE_ANON_KEY=貼上 Supabase anon public key
```

Workflow 只會發佈前端需要的檔案，並在發佈時產生 `supabase-config.js`。

## 2. Supabase Edge Function

收盤價更新由 Supabase Edge Function 處理：

```text
supabase/functions/latest-prices
```

這個 function 會：

- 驗證目前登入使用者
- 找到使用者所屬家庭
- 從 TWSE 抓台股 / 台股 ETF 最新收盤價
- 寫入 `price_snapshots`
- 回傳更新結果給前端

## 3. 更新 Supabase Auth URL

GitHub Pages 正式網址預期為：

```text
https://jasonchangtw.github.io/family-portfolio-dashboard/
```

到 Supabase Dashboard > Authentication > URL Configuration：

1. Site URL 設成正式網址。
2. Redirect URLs 加上：

```text
https://jasonchangtw.github.io/family-portfolio-dashboard/**
http://localhost:5173/**
http://127.0.0.1:5173/**
```

## 4. 驗證

1. 用正式網址開啟網站。
2. 用 email / 密碼登入。
3. 到設定頁確認顯示 `已同步 Supabase 資料庫`。
4. 按「更新收盤價」，確認 2330 / 00878 等台股標的會更新。
5. 用另一台電腦或手機登入同一個網址，確認看得到同一份資料。

## 5. 手機加到主畫面

用手機瀏覽器開正式網址後：

- iPhone Safari：分享 > 加入主畫面
- Android Chrome：選單 > 新增至主畫面
