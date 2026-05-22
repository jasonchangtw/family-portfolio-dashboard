# 家庭投資儀表板 MVP PRD

文件日期：2026-05-20

## 1. Summary

本文件定義一個家庭共用的投資追蹤 Web App MVP。工具會協助兩位家庭成員追蹤台股、美股複委託、ETF、零股、配息、費用、匯率與整體損益，並用繁體中文提供清楚易懂的 Dashboard。

MVP 目標是先建立可信任的資料基礎與好操作的手動輸入流程。自動匯入、進階報酬率、完整 Google Drive 自動備份與 AI 深度分析會放在後續版本。

## 2. Contacts

| Name | Role | Comment |
|---|---|---|
| Jason | Product owner / primary user | 定義需求、確認投資帳戶與操作流程 |
| Family member | Admin user | 與 Jason 共同使用，擁有完整 app 權限 |
| Codex | Product / engineering assistant | 協助整理需求、設計規格、後續可協助實作 |

## 3. Background

使用者目前投資台股、美股複委託、ETF、零股，並希望與家人共同使用同一個工具查看家庭總投資狀況。現有券商 App 通常偏交易與帳戶查詢，不一定能清楚呈現跨市場、跨標的、配息、費用、匯率與家庭總資產。

這個工具要解決的是「資料分散、損益不易看懂、匯率與費用影響不透明、家庭成員不易共同理解」的問題。

現在適合做 MVP，因為：

- 使用者已明確選擇 Web App + Supabase 的方向。
- 使用者與家人只有兩位主要使用者，權限模型可以保持簡單。
- 第一版可以手動輸入，不需要一開始解決券商自動匯入。
- 每日收盤價與每日匯率更新已足夠，不需要即時交易等級資料。

## 4. Objective

### Objective

建立一個家人可以一起使用、清楚易懂、資料可信任的投資 Dashboard。它要讓使用者快速知道家庭總資產、總報酬率、今日損益、配息收入、本月與今年損益。

### Why It Matters

這個工具不是用來下單，而是用來理解投資狀況。它要幫使用者回答：

- 我們現在總資產是多少？
- 整體是賺還是賠？
- 今天、本月、今年變化如何？
- 配息貢獻多少？
- 費用、稅費、匯率是否影響收益？
- 資料是否可信，是否可以追溯來源？

### Key Results

MVP 成功標準：

- 兩位家庭成員都能用 email 登入。
- 使用者可以在手機與電腦查看同一份家庭總 Dashboard。
- 使用者可以手動新增買入、賣出、配息/配發三種紀錄。
- 常用資料設定完成後，新增一筆交易目標在 30 秒內完成。
- Dashboard 能顯示總資產、總報酬率、今日損益、配息收入、本月/今年損益。
- 所有關鍵數字都能追溯到交易、價格、匯率或配息資料。
- 系統能標示估算值、實際值、缺漏值、過期值。
- 資料可手動匯出成 CSV / JSON。
- 一般刪除採軟刪除，並保留操作紀錄。

## 5. Market Segment(s)

### Primary Segment

台灣家庭投資者。使用者投資台股、美股複委託、ETF、零股，並希望家庭成員能一起看懂投資狀況。

### Jobs To Be Done

- 當我打開工具時，我想快速知道家庭投資目前好不好。
- 當我買進或賣出時，我想用很少欄位完成紀錄。
- 當我查看損益時，我想知道數字是怎麼算出來的。
- 當我投資美股時，我想看懂匯率和匯差對台幣報酬的影響。
- 當我收到配息時，我想區分現金入帳與再投入。
- 當資料可能錯誤時，我想能追蹤、修正、還原。

### Constraints

- MVP 預設只有兩位家庭成員使用。
- 只看家庭總和，不依家庭成員拆分績效。
- 台股券商帳戶兩個。
- 其中一個帳戶有富邦證券複委託美股定期定額。
- 沒有直接美股券商帳戶。
- 有台幣現金帳戶，MVP 沒有美元現金帳戶。
- 價格使用最新可得收盤價，並標示資料日期。
- 匯率來源預設為富邦銀行匯率。
- MVP 不做 CSV 匯入。
- MVP 不做提醒或通知。
- MVP 不做年度所得或稅務報表。

## 6. Value Proposition(s)

### Gains

- 一眼看懂家庭總投資狀況。
- 手動輸入流程簡單，家人也能操作。
- 台股、美股、ETF、零股可以放在同一個視角看。
- 損益可以用台幣作為基本幣別查看。
- 配息、費用、稅費、匯率可以納入真實報酬。
- 資料可以匯出，不被工具綁住。

### Pains Avoided

- 不用在多個券商 App 之間來回查。
- 不用靠試算表手動維護複雜公式。
- 不會因為賣出標的就失去歷史紀錄。
- 不會把估算值誤認為實際值。
- 不會因為誤刪資料就難以還原。

### Differentiation

這個工具優先服務一個小家庭，而不是大眾投資社群。它重視清楚、可信、好操作，而不是塞滿專業圖表。它也會從一開始保留匯率、費用、配息、軟刪除、操作紀錄與資料匯出能力。

## 7. Solution

### 7.1 UX / User Flows

#### Main Navigation

- Dashboard
- Holdings
- Transactions
- Income
- Allocation
- Decisions
- Import / Export
- Settings

#### Dashboard First Screen

第一屏優先顯示：

1. 總資產
2. 總報酬率
3. 今日損益
4. 配息收入
5. 本月 / 今年損益

Dashboard 必須標示資料日期。股價口徑為「最新可得收盤價」。美股要避免台灣日期與美國市場日期混淆。

#### Manual Buy Flow

預設欄位：

- 交易日期
- 帳戶
- 市場：台股 / 美股
- 標的代號
- 交易類型：買入
- 股數
- 成交價

自動帶入：

- 標的名稱
- 幣別
- 股票 / ETF 類型
- 費率規則
- 預估手續費
- 預估總成本
- 美股交易的富邦銀行匯率
- 預估台幣金額

進階欄位：

- 手續費
- 其他費用
- 實際匯率
- 實際台幣扣款
- 決策備註
- 是否定期定額
- 估算 / 實際狀態

#### Manual Sell Flow

預設欄位：

- 交易日期
- 帳戶
- 標的代號
- 交易類型：賣出
- 股數
- 成交價

自動帶入：

- 目前持股
- 可賣出上限
- 平均成本
- 預估已實現損益
- 預估手續費
- 台股交易稅，如適用
- 美股交易的富邦銀行匯率
- 預估入帳金額
- 若賣光，自動標記部位為 closed

進階欄位：

- 手續費
- 交易稅
- 監管費 / 其他費用
- 實際匯率
- 實際入帳金額
- 賣出原因
- 估算 / 實際狀態

#### Dividend / Distribution Flow

預設欄位：

- 入帳日期
- 帳戶
- 標的代號
- 類型：現金入帳 / 再投入
- 淨入帳金額

自動帶入：

- 市場
- 幣別
- 持有股數
- 最近相似配息紀錄，如有
- 美股配息的富邦銀行匯率
- 預估台幣金額

進階欄位：

- 除息日
- 每股配息
- 毛配息
- 預扣稅
- 補充保費 / 其他扣除
- 實際匯率
- 再投入股數
- 再投入價格
- 備註

### 7.2 Key Features

#### Authentication And Household Access

- Email login.
- 不公開註冊。
- 兩位家庭成員都是 app-level admin。
- 使用 Supabase Row Level Security 保護家庭資料。
- 不需要兩步驟驗證。

#### Portfolio Tracking

- 支援台股、台股 ETF、零股、單張股票。
- 支援富邦證券複委託美股與美股定期定額。
- 支援 ETF 與個股。
- 支援家庭總和視角。
- 支援目前持股與已結清部位。

#### Securities And Positions

- 標的主檔與交易紀錄分開。
- 賣出不刪除標的。
- 賣光後部位狀態改為 closed。
- 可隱藏 closed 部位，但仍保留歷史紀錄。

#### Fees And Costs

- 台股與美股費用欄位都可設定。
- 使用者自行設定富邦台股與富邦複委託實際費率。
- 系統可以用規則估算費用。
- 報表優先使用實際費用；沒有實際值才用估算值。

#### FX

- 基本幣別為 TWD。
- 匯率預設使用富邦銀行匯率。
- 每日固定更新一次匯率。
- 同時保留市場參考匯率與實際匯率欄位。
- MVP 無美元現金帳戶，但資料模型保留未來擴充。

#### Dividends And Distributions

- 支援現金入帳與再投入。
- 台股補充保費欄位保留，實際有扣再填。
- 美股配息記毛配息、預扣稅、淨入帳。
- 不做年度所得或稅務報表。

#### Data Quality And Safety

- 不可賣出超過目前持股。
- 標示價格缺漏、匯率缺漏、費用異常、重複交易、未來日期、現金餘額不一致。
- 標示估算值、實際值、缺漏值、過期值。
- 一般刪除使用軟刪除。
- 保留操作紀錄。
- 可還原單筆交易。

#### Export And Backup

- MVP 支援手動匯出。
- 匯出格式包含 CSV / JSON。
- 匯出資料包含交易、標的、帳戶、現金異動、配息、匯率、費用、決策備註、操作紀錄。
- 正式版再做自動 Google Drive 備份。
- 目標備份規則：每週備份一次，保留最近 10 份。

#### Mobile PWA

- 響應式介面。
- 可加到手機主畫面。
- 背景同步可行時納入。

#### AI Access

- AI 可讀完整持股與交易明細。
- AI 不可讀現金餘額。
- AI 可產生提醒或分析。
- AI 不可修改資料。
- MVP 不做提醒通知功能。

### 7.3 Technology

Recommended stack:

- Frontend: Web App with responsive UI and PWA support.
- Database: Supabase PostgreSQL.
- Auth: Supabase Auth with email login.
- Security: Row Level Security by household.
- Storage/export: manual CSV / JSON export in MVP.
- Future backup: Google Drive integration.

Suggested data domains:

- `households`
- `profiles`
- `household_members`
- `accounts`
- `securities`
- `transactions`
- `positions`
- `dividends`
- `fx_rates`
- `price_snapshots`
- `fee_rules`
- `cash_movements`
- `decision_notes`
- `audit_logs`
- `exports`

### 7.4 Assumptions

- 手動輸入在 MVP 階段可以接受。
- 每日收盤價足夠，不需要即時價格。
- 富邦銀行匯率可以作為 MVP 預設參考匯率。
- 兩位家庭成員都能接受 email login。
- 不做提醒通知不會影響 MVP 主要價值。
- MWR / TWR 可等交易、費用、匯率、配息資料穩定後再做。
- 無美元現金帳戶不會阻礙 MVP，因為美股複委託以 TWD 購買。

## 8. Release

### MVP

MVP 包含：

- Email login
- 家庭總 Dashboard
- 手動新增買入、賣出、配息/配發
- 台股、美股複委託、ETF、零股支援
- TWD 基本幣別
- 最新可得收盤價與資料日期顯示
- 富邦銀行匯率欄位與每日匯率資料
- 可設定費率欄位
- 配息毛額、預扣稅、淨額欄位
- 估算 / 實際 / 缺漏 / 過期標示
- 軟刪除與操作紀錄
- 手動 CSV / JSON 匯出
- 響應式介面與手機主畫面安裝

### Later Versions

後續版本可加入：

- 自動 Google Drive 備份
- 券商對帳單匯入
- CSV 匯入模板
- 自動抓富邦銀行匯率
- 自動抓台股與美股收盤價
- 目標配置與再平衡建議
- 提醒通知
- 美元現金帳戶
- 股票分割、反分割、代號變更等 corporate actions
- FIFO / lot matching
- MWR / TWR
- Benchmark comparison
- 更完整的 AI 查詢介面

### Suggested Build Phases

Phase 1: Data model and authentication.

Phase 2: Manual transaction entry and holdings calculation.

Phase 3: Dashboard and reporting.

Phase 4: Export, audit log, soft delete, restore.

Phase 5: PWA polish and mobile usability.

Phase 6: Future automation and integrations.
