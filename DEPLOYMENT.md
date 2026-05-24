# 部署檢查清單

GitHub repository:

https://github.com/jasonchangtw/family-portfolio-dashboard

## 1. 匯入 Vercel

1. 開啟 https://vercel.com/new
2. 選擇 `jasonchangtw/family-portfolio-dashboard`
3. Framework Preset 選 `Other`
4. Build Command 使用：

```bash
sh scripts/build-config.sh
```

5. Output Directory 使用：

```text
.
```

## 2. 設定 Vercel Environment Variables

請在 Vercel 專案設定加入：

```text
PUBLIC_SUPABASE_URL=https://luverejlzrijjufkpgnv.supabase.co
PUBLIC_SUPABASE_ANON_KEY=貼上 Supabase anon public key
```

不要使用 Supabase `service_role` key。

## 3. 更新 Supabase Auth URL

部署完成後會得到正式網址，例如：

```text
https://family-portfolio-dashboard.vercel.app
```

到 Supabase Dashboard > Authentication > URL Configuration：

1. Site URL 設成正式網址。
2. Redirect URLs 加上：

```text
https://你的正式網址/**
http://localhost:5173/**
http://127.0.0.1:5173/**
```

## 4. 驗證

1. 用正式網址開啟網站。
2. 用 email / 密碼登入。
3. 到設定頁確認顯示 `已同步 Supabase 資料庫`。
4. 新增一筆測試交易或配息。
5. 用另一台電腦或手機登入同一個網址，確認看得到同一份資料。

## 5. 手機加到主畫面

用手機瀏覽器開正式網址後：

- iPhone Safari：分享 > 加入主畫面
- Android Chrome：選單 > 新增至主畫面
