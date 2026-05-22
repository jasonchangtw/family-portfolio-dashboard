# ETF / Stock Portfolio Dashboard Requirements Notes

Date: 2026-05-18
Latest update: 2026-05-20
Base currency: TWD
Default interface language: Traditional Chinese

## Product Direction

Build a cross-device Web App with a cloud database for tracking Taiwan stocks, US stocks, fractional shares, and ETFs.

Recommended architecture direction:

- Web App
- Supabase cloud database
- Google Drive / CSV export as backup
- Family admin access
- Future support for read-only AI query access

## Confirmed Requirements

### Users And Permissions

- The user and family members should both have full app-level admin permissions.
- The expected number of active users is small, likely two family members.
- Admins can view, add, edit, delete, import, export, back up, and restore household investment data.
- App-level admin permissions should not expose Supabase `service_role` keys to the frontend or third-party tools.
- External AI tools should use read-only access or controlled API endpoints.
- AI tools may generate reminders and analysis but must not modify data.
- AI tools may read holdings and transaction details.
- AI tools must not read cash account balances in MVP.
- Because both users have full permissions, responsibility boundaries do not need to be complex in MVP.
- Still keep operation history so mistaken edits can be traced and restored.

### Account Scope

- Two Taiwan brokerage accounts.
- One Taiwan brokerage account has sub-brokerage access for US stocks.
- No direct US brokerage account.
- One TWD cash account.
- No USD cash account in MVP.
- Dashboard should show household total only, not split by family member.
- Taiwan broker: Fubon Securities.
- US stocks are purchased through Fubon Securities sub-brokerage using TWD.
- US stock investing uses Fubon Securities sub-brokerage recurring investment / dollar-cost averaging.
- Taipei Fubon Bank trust-based US stock recurring investment is not part of MVP.
- Taiwan stocks include odd-lot and board-lot purchases.

### Backup And Error Prevention

- Keep automatic backups of core data.
- Backup weekly to Google Drive.
- Keep the latest 10 backup versions.
- Support restoring a single transaction.
- Support downloadable CSV / JSON where useful.
- MVP backup/export approach: support manual export first. Automated Google Drive backup should be added in a later production version.
- Maintain audit logs for important changes.
- Use soft delete instead of hard delete for normal deletion.
- Support restore from backup or audit history.
- Create backup snapshots before bulk imports or risky operations.

### Investment Securities And Positions

- Separate securities from transactions and positions.
- Selling an asset should create a sell transaction, not delete the security.
- Fully sold positions should become closed or archived, while historical transactions remain available.
- Deletion should only be used for mistaken data and should be recoverable by default.

Suggested status values:

- `active`
- `closed`
- `archived`
- `deleted`

### Trading Fees And Costs

- Track transaction costs separately instead of using a single fee field.
- Support Taiwan stock and ETF fees.
- Support US stock and ETF fees.
- Use actual fee values when available.
- Use estimated fee rules when actual values are not available.
- Allow manual override or statement import for actual fees.
- Fubon Securities fee rules should be configurable and manually overridable.
- For Taiwan stock trades, keep configurable fields for commission rate, discount, and minimum commission. Users will set the actual values themselves.
- For US sub-brokerage recurring investment through Fubon, use public fee information as a default estimate and broker statements as the source of truth.
- As of research on 2026-05-20, Fubon Securities' public US recurring stock investment page states the original posted buy fee is 0.2%, with a promotional reduction to 0.1% from 2025-11-01 to 2026-12-31, with no minimum commission. Sell fee follows the original sub-brokerage fee schedule.
- For US sub-brokerage sell fees and any actual applied fees, keep configurable fields. Users will set actual values themselves.
- Because actual fees can vary by account, promotion, channel, and product, reports should prefer actual statement fees over estimated fee rules.

Suggested fee fields:

- `commission`
- `tax`
- `regulatory_fee`
- `exchange_fee`
- `other_fee`
- `fee_currency`
- `estimated_total_fee`
- `actual_total_fee`

### FX And Currency

- Base currency is TWD.
- The interface should clearly distinguish TWD values from original-currency values.
- Track both market FX rates and actual exchange rates.
- Default FX reference source: Fubon Bank exchange rate.
- Support USD cash accounts for US stock and ETF investing.
- In MVP, there is no separate USD cash account. US sub-brokerage purchases are paid from TWD and converted through the broker/bank process.
- The data model should still keep room for future USD cash account support.
- Distinguish original-currency performance from TWD performance.
- Separate stock price gains from FX impact where possible.

Suggested FX fields:

- `market_fx_rate`
- `actual_fx_rate`
- `source`
- `rate_date`

### Dividends And Distributions

- Track dividends and ETF distributions.
- Support Taiwan and US distributions.
- Track withholding tax and other deductions.
- Support reinvested dividends in the future.
- Distinguish cash dividend/distribution income from reinvested dividends/distributions.
- No annual income tax or tax filing report is required in MVP.
- Taiwan dividend/distribution supplemental premium fields should be available but optional. Users will fill them only if actually deducted.
- US dividends/distributions should track gross amount, withholding tax, and net amount.

Suggested dividend fields:

- `ex_dividend_date`
- `payment_date`
- `amount_per_share`
- `gross_amount`
- `withholding_tax`
- `other_deductions`
- `net_amount`
- `currency`
- `fx_rate_to_twd`

### Corporate Actions

- Data model should leave room for corporate actions.
- First version can support manual entry.

Examples:

- Stock split
- Reverse split
- Ticker change
- Merger
- ETF restructuring

### Cost Basis

- Keep every transaction so different cost basis methods can be calculated later.
- First version can use average cost for simpler decision tracking.
- Future versions can support FIFO or lot matching.

### Target Allocation And Rebalancing

- Support target allocation by market, asset type, account, and security.
- Show drift from target allocation.
- Add alerts when drift exceeds a configured threshold.
- Provide rebalancing suggestions later.
- Alerts should distinguish Taiwan holdings and US holdings.
- ETF and individual stocks do not need separate alert rules in MVP.
- No target allocation, single holding cap, cash ratio floor, or recurring investment reminder is required in MVP unless added later.
- MVP does not need reminder rules or alert notifications.

### Import And Reconciliation

- Support manual entry first.
- Automation and broker imports can be added later.
- CSV import is not required in MVP.
- Broker statement import can be added later.
- Show import preview before writing data.
- Detect duplicate transactions.
- Allow rollback after import.
- Reconcile cash balances, holdings, prices, fees, and FX rates.
- Include a monthly reconciliation flow.
- Reconciliation should compare app data against broker balances, cash balances, dividends, transaction fees, and FX records.

### Security And Privacy

- Use login and household-based access control.
- Consider two-factor authentication if available.
- Two-factor authentication is not required in MVP.
- Website is private for family use only and should not allow public self-registration.
- Login should use email.
- The app should support install-to-home-screen behavior on mobile if feasible.
- MVP mobile support should include install-to-home-screen behavior, responsive UI, and background sync where feasible.
- Use Row Level Security for household data.
- Do not store service keys in frontend code.
- Keep audit logs for sensitive operations.

### Data Quality Checks

- Prevent selling more shares than currently held.
- Prevent negative holdings unless explicitly supported.
- Flag missing prices.
- Flag missing FX rates.
- Flag abnormal fees.
- Flag duplicated transactions.
- Flag transaction dates later than today.
- Flag cash balance mismatches.
- Flag stale prices or outdated FX rates.
- Account for different Taiwan and US market calendars and time zones.

### Estimate Versus Actual Values

- The product should clearly label whether numbers are estimated, actual, missing, or outdated.
- Estimated values may include current prices, current FX rates, and estimated transaction fees.
- Actual values may include broker statement fees, executed trade prices, actual FX conversion rates, and settled dividend payments.
- Reports should prefer actual values when available and fall back to estimated values when necessary.
- Users should be able to identify which dashboard totals rely on estimated data.

### Decision Journal

- Each buy/sell decision can include a reason.
- Track investment thesis and planned exit conditions.
- Support later review of whether decisions matched the original thesis.

Suggested fields:

- `decision_reason`
- `strategy`
- `expected_holding_period`
- `exit_condition`
- `notes`

### Time Zone And Market Calendar

- Taiwan and US markets have different trading days, holidays, and settlement timing.
- The app should avoid confusing Taiwan calendar dates with US market dates.
- Store transaction timestamps and market dates carefully.
- Dashboard labels should clarify whether values are based on Taiwan date, US market close, latest available price, or manually entered data.
- MVP price update frequency: daily closing prices.
- FX update frequency: once per day.
- The app should explain "latest available price" versus "previous closing price" in Traditional Chinese.
- Confirmed price display rule: use the latest available closing price and always show the data date.

### Cash Accounts

- Track cash as part of total assets.
- At minimum, support TWD cash and USD cash accounts.
- MVP has one TWD cash account and no USD cash account.
- Cash transactions should include deposits, withdrawals, FX conversion, dividends, fees, and trade settlements.
- Cash balances should be reconcilable against broker or bank statements.

### Data Portability

- Users must be able to export all core data.
- Export formats should include CSV and JSON.
- Export should include transactions, securities, accounts, cash movements, dividends, FX rates, fees, decisions, audit logs, and backup metadata where appropriate.
- Avoid locking data into a format that only this app can understand.

### Product Language And Tone

- Default interface language should be Traditional Chinese.
- Labels should be clear and familiar for Taiwan-based users.
- Financial terms should use common Taiwanese wording where appropriate.
- Avoid showing advanced terms first unless users explicitly open details.
- Decision support should avoid presenting itself as direct investment advice.
- Prefer wording such as "偏離目標配置", "達到你設定的提醒條件", "資料待對帳", and "估算值" over directive buy/sell language.

## Reporting And Dashboard

Core dashboard should include:

- Total assets in TWD
- Total return
- Today's gain/loss
- Dividend/distribution income
- Month-to-date and year-to-date gain/loss
- TWD and USD views
- Total invested principal
- Unrealized gains/losses
- Realized gains/losses
- Total return including dividends, fees, taxes, and FX
- Allocation by market
- Allocation by asset type
- Allocation by security
- Cash ratio
- Fee totals
- Tax totals
- FX impact
- Dividend income
- Top gainers / losers
- Largest holdings
- Rebalancing alerts

Confirmed first-screen priority:

1. Total assets
2. Total return
3. Today's gain/loss
4. Dividend/distribution income
5. Month-to-date / year-to-date gain/loss

## UX And Interface Requirements

Because the tool will be shared with family members, the interface must be highly clear, approachable, and easy to operate. The design should prioritize everyday comprehension over dense financial complexity.

Key principles:

- The first screen should answer "How are we doing?" without requiring financial knowledge.
- Use plain labels and avoid professional jargon unless a short explanation is available.
- Show the most important family-level summary first, then allow drill-down into accounts, securities, and transactions.
- Separate "viewing status" from "making changes" so users do not accidentally edit data while browsing.
- Use guided flows for important actions such as adding a transaction, selling a position, importing data, deleting data, and restoring backups.
- Use confirmation and preview screens for risky operations.
- Make error messages actionable and specific.
- Design for both desktop and mobile from the beginning.
- Make numbers scannable with consistent formatting, currency labels, and color usage.
- Avoid overwhelming users with too many charts on the first screen.

Primary family-friendly flows:

- View household portfolio summary
- View each member or account's assets
- Add a buy transaction
- Add a sell transaction
- Add dividend / distribution income
- Check whether allocation has drifted from target
- Review recent changes made by family members
- Import broker data with preview
- Back up and restore data
- Hide closed positions without deleting history
- Complete a manual transaction within roughly 30 seconds once common defaults are configured
- Use mobile to quickly view total assets, today's change, holdings, alerts, and add simple notes

Suggested navigation:

- Dashboard
- Holdings
- Transactions
- Income
- Allocation
- Decisions
- Import / Export
- Settings

Interface safeguards:

- Prominent "Preview before save" for imports and bulk changes
- Clear "Undo / restore" path after risky edits
- Soft delete by default
- Visual badges for estimated vs actual fees and FX rates
- Missing data alerts shown as tasks, not silent calculation errors
- Audit log visible to admins in a human-readable format
- Dashboard totals should be clickable or explorable so users can understand the source of each number

## Manual Transaction Entry

MVP should support three transaction entry flows:

- Buy
- Sell
- Dividend / Distribution

The form strategy should be simple by default and expandable for advanced details:

- Default view should show only the fields needed to complete the transaction quickly.
- Fees, taxes, FX, and notes should be editable in an advanced section.
- Values auto-filled by the system should be clearly marked as estimated until confirmed or manually overridden.
- Save flow should show a summary before writing the transaction.

### Buy Entry

Required fields:

- Trade date
- Account
- Market: Taiwan / US
- Security ticker
- Transaction type: buy
- Quantity
- Execution price

Auto-filled fields:

- Security name
- Currency
- Security type: stock / ETF
- Fee rule
- Estimated commission
- Estimated total cost
- Fubon Bank FX rate for US trades
- Estimated TWD amount

Advanced editable fields:

- Commission
- Other fees
- Actual FX rate
- Actual TWD payment amount
- Decision note
- Recurring investment flag
- Estimated / actual status

### Sell Entry

Required fields:

- Trade date
- Account
- Security ticker
- Transaction type: sell
- Quantity
- Execution price

Auto-filled fields:

- Current held quantity
- Maximum sellable quantity
- Average cost
- Estimated realized gain/loss
- Estimated commission
- Taiwan securities transaction tax where applicable
- Fubon Bank FX rate for US trades
- Estimated net proceeds
- Closed position status when the remaining quantity becomes zero

Advanced editable fields:

- Commission
- Transaction tax
- Regulatory fee / other fee
- Actual FX rate
- Actual net proceeds
- Sell reason
- Estimated / actual status

### Dividend / Distribution Entry

Required fields:

- Payment date
- Account
- Security ticker
- Type: cash received / reinvested
- Net amount received

Auto-filled fields:

- Market
- Currency
- Held quantity
- Latest similar dividend/distribution record if available
- Fubon Bank FX rate for US distributions
- Estimated TWD amount

Advanced editable fields:

- Ex-dividend date
- Amount per share
- Gross amount
- Withholding tax
- Supplemental premium / other deductions
- Actual FX rate
- Reinvested quantity
- Reinvestment price
- Notes

## Return Calculation Decision

First version should include:

- Total gain/loss
- Total return
- Realized gain/loss
- Unrealized gain/loss
- Dividend-inclusive return
- Fee-adjusted return
- TWD-based return
- Original-currency return

MWR and TWR are important but should be implemented after the core transaction, cash, fee, FX, and dividend model is stable.

Reasons:

- MWR/TWR depend heavily on accurate cash flow timing.
- Incorrect transaction, fee, FX, or dividend handling will make MWR/TWR misleading.
- Partial sells, deposits, withdrawals, dividends, and currency conversions add complexity.
- First version should establish trustworthy data before introducing advanced performance metrics.

Future versions should support:

- Money-weighted return
- Time-weighted return
- Period comparisons
- Benchmark comparison

## Open Questions

- None for current MVP requirements discussion.
