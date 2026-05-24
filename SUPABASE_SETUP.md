# Supabase 設定指南

這份指南協助你從沒有 Supabase 帳號開始，建立家庭投資儀表板需要的資料庫與登入功能。

## 1. 建立 Supabase 帳號

1. 開啟 [Supabase](https://supabase.com/)。
2. 點選 `Start your project` 或 `Sign in`。
3. 使用 email 或 GitHub 建立帳號。
4. 完成 email 驗證。

Supabase 官方文件也說明前端可使用 `@supabase/supabase-js@2`，並用 Supabase Auth 與 Row Level Security 保護資料。

## 2. 建立 Project

1. 進入 Supabase Dashboard。
2. 點選 `New project`。
3. Organization 可用預設值。
4. Project name 建議填：`family-portfolio-dashboard`。
5. Database password 請用密碼管理器保存。
6. Region 可選離台灣較近的區域。
7. Plan 先用 Free 即可。

## 3. 建立資料表

1. 在 Supabase Project 左側選單進入 `SQL Editor`。
2. 開啟本專案的 `supabase-schema.sql`。
3. 複製全部內容貼到 SQL Editor。
4. 執行 SQL。

這會建立：

- 家庭與成員
- 帳戶
- 投資標的
- 交易
- 配息
- 匯率
- 收盤價
- 費率規則
- 操作紀錄
- 匯出紀錄
- Row Level Security policies

## 4. 建立兩個登入使用者

MVP 只給家人私用，不開放公開註冊。最簡單的方式是先在 Supabase Auth 建立兩個使用者：

1. 進入 `Authentication`。
2. 進入 `URL Configuration`。
3. 將 `Site URL` 設為 `http://localhost:5173`。
4. 將 `Redirect URLs` 加入 `http://localhost:5173/**`。
5. 進入 `Users`。
6. 點 `Add user`。
7. 用 `Send invitation` 邀請 Jason 的 email 使用者。
8. 用 `Send invitation` 邀請家人的 email 使用者。
9. 複製兩個 user id。

接受邀請後，網站會提示在密碼欄輸入新密碼，按「設定密碼」。完成後即可用 email 與密碼登入。

## 5. 建立家庭資料與預設帳戶

1. 開啟 `supabase-bootstrap-template.sql`。
2. 將：
   - `REPLACE_WITH_FIRST_AUTH_USER_ID`
   - `REPLACE_WITH_SECOND_AUTH_USER_ID`
   換成剛剛複製的兩個 Supabase Auth user id。
3. 貼到 Supabase SQL Editor。
4. 執行 SQL。

這會建立：

- 一個家庭
- 兩位 admin 成員
- 富邦台股帳戶 A
- 富邦台股帳戶 B
- 富邦複委託美股
- 台幣現金帳戶
- 台股與美股預設費率規則

## 6. 取得 Project URL 與 anon key

1. 在 Supabase Project 進入 `Project Settings`。
2. 進入 `API`。
3. 複製：
   - Project URL
   - anon public key

不要複製或貼上 `service_role` key。前端只應使用 anon public key，資料安全由 Row Level Security 控制。

## 7. 建立本機 Supabase 設定檔

在專案資料夾複製範例檔：

```bash
cp supabase-config.example.js supabase-config.js
```

然後編輯 `supabase-config.js`：

```js
export default {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

完成後重新整理網站。設定頁的 `Supabase 連線` 應該會從「尚未設定」變成「可登入」。

## 8. 本機啟動

```bash
python3 -m http.server 5173
```

開啟：

```text
http://localhost:5173
```

## 9. 資料同步狀態

目前 App 已可偵測 Supabase 設定並使用 Supabase Auth 登入。登入後會從 Supabase 讀取家庭帳戶、標的、交易、配息與費率設定；新增、編輯、刪除交易或配息時，也會同步寫回 Supabase。

若設定頁顯示 `Supabase 資料同步失敗`，通常代表：

- 使用者尚未加入 `household_members`
- schema 尚未完整執行
- Auth 使用者沒有對應的 `profiles` 資料
- Supabase URL 或 anon key 設定錯誤

## 10. 部署到其他電腦與手機使用

部署到 GitHub Pages 時，設定 repository secrets：

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

收盤價更新由 Supabase Edge Function `latest-prices` 處理。

部署完成後，到 Supabase Dashboard 的 Authentication > URL Configuration：

1. Site URL 改成正式網址。
2. Redirect URLs 加上正式網址與萬用路徑，例如 `https://jasonchangtw.github.io/family-portfolio-dashboard/**`。
3. 若仍要本機測試，也保留 `http://localhost:5173/**` 與 `http://127.0.0.1:5173/**`。
