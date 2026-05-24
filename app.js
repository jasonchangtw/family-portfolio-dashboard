const storageKey = "family-portfolio-v1";
const supabaseCdn = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const knownSecurities = {
  "0050": { name: "元大台灣50", market: "TW", currency: "TWD", type: "ETF" },
  "00878": { name: "國泰永續高股息", market: "TW", currency: "TWD", type: "ETF" },
  "2330": { name: "台積電", market: "TW", currency: "TWD", type: "股票" },
  VOO: { name: "Vanguard S&P 500 ETF", market: "US", currency: "USD", type: "ETF" }
};

const initialState = {
  settings: {
    baseCurrency: "TWD",
    fxSource: "富邦銀行匯率",
    latestPriceDate: "2026-05-20",
    twCommissionRate: 0.001425,
    twCommissionDiscount: 0.6,
    twMinimumCommission: 20,
    usBuyCommissionRate: 0.001,
    usdTwdRate: 31.2
  },
  accounts: [
    { id: "fubon-tw-1", name: "富邦台股帳戶 A", currency: "TWD" },
    { id: "fubon-tw-2", name: "富邦台股帳戶 B", currency: "TWD" },
    { id: "fubon-us-sub", name: "富邦複委託美股", currency: "TWD" }
  ],
  securities: [
    { ticker: "0050", name: "元大台灣50", market: "TW", currency: "TWD", type: "ETF", latestPrice: 184.25, priceDate: "2026-05-20" },
    { ticker: "00878", name: "國泰永續高股息", market: "TW", currency: "TWD", type: "ETF", latestPrice: 0, priceDate: "2026-05-20" },
    { ticker: "2330", name: "台積電", market: "TW", currency: "TWD", type: "股票", latestPrice: 1060, priceDate: "2026-05-20" },
    { ticker: "VOO", name: "Vanguard S&P 500 ETF", market: "US", currency: "USD", type: "ETF", latestPrice: 505.4, priceDate: "2026-05-19" }
  ],
  transactions: [
    { id: "tx-1", date: "2026-04-08", type: "buy", accountId: "fubon-tw-1", ticker: "0050", market: "TW", quantity: 20, price: 176.1, commission: 20, tax: 0, otherFee: 0, fxRate: 1, actualTwdAmount: 3542, status: "actual" },
    { id: "tx-2", date: "2026-04-15", type: "buy", accountId: "fubon-tw-2", ticker: "2330", market: "TW", quantity: 3, price: 1015, commission: 20, tax: 0, otherFee: 0, fxRate: 1, actualTwdAmount: 3065, status: "actual" },
    { id: "tx-3", date: "2026-05-02", type: "buy", accountId: "fubon-us-sub", ticker: "VOO", market: "US", quantity: 0.8, price: 493.8, commission: 0.4, tax: 0, otherFee: 0, fxRate: 31.05, actualTwdAmount: 12275, status: "actual" }
  ],
  dividends: [
    { id: "div-1", paymentDate: "2026-05-10", accountId: "fubon-tw-1", ticker: "0050", type: "cash", grossAmount: 160, withholdingTax: 0, otherDeductions: 0, netAmount: 160, currency: "TWD", fxRate: 1, status: "actual" },
    { id: "div-2", paymentDate: "2026-05-18", accountId: "fubon-us-sub", ticker: "VOO", type: "cash", grossAmount: 1.45, withholdingTax: 0.44, otherDeductions: 0, netAmount: 1.01, currency: "USD", fxRate: 31.2, status: "estimated" }
  ]
};

let state = loadState();
let entryType = "buy";
let editingEntry = null;
let isSavingEntry = false;
let supabaseClient = null;
let supabaseConfig = null;
let currentUser = null;
let hasAutoRefreshedPrices = false;
const pendingCloudWrites = {
  transactions: new Map(),
  dividends: new Map()
};
let pendingPasswordSetupType = "";
let cloudContext = {
  householdId: null,
  syncStatus: "local",
  lastError: ""
};

ensureKnownSecurityMetadata();

const formatTwd = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const formatUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const formatNumber = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 4
});

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(initialState);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  requestBackgroundSync();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function toSecurityKind(type) {
  return type === "ETF" ? "etf" : type === "股票" ? "stock" : "other";
}

function fromSecurityKind(kind) {
  return kind === "etf" ? "ETF" : kind === "stock" ? "股票" : "其他";
}

function numberOrZero(value) {
  return Number(value || 0);
}

function knownSecurityFor(ticker) {
  return knownSecurities[ticker.toUpperCase()];
}

function ensureKnownSecurityMetadata() {
  let didUpdate = false;
  for (const security of state.securities) {
    const known = knownSecurityFor(security.ticker);
    if (!known) continue;
    if (security.name === security.ticker || !security.name || security.name !== known.name) {
      security.name = known.name;
      didUpdate = true;
    }
    security.market = security.market || known.market;
    security.currency = security.currency || known.currency;
    security.type = security.type || known.type;
  }
  if (!state.securities.some((security) => security.ticker === "00878")) {
    state.securities.push({
      ticker: "00878",
      ...knownSecurities["00878"],
      latestPrice: 0,
      priceDate: state.settings.latestPriceDate
    });
    didUpdate = true;
  }
  if (didUpdate) saveState();
}

function securityFor(ticker) {
  return state.securities.find((security) => security.ticker.toUpperCase() === ticker.toUpperCase());
}

function accountFor(id) {
  return state.accounts.find((account) => account.id === id);
}

async function loadCloudData() {
  if (!supabaseClient || !currentUser) return;
  cloudContext.syncStatus = "syncing";
  cloudContext.lastError = "";
  renderSupabaseStatus();
  const localStateBeforeCloudLoad = structuredClone(state);

  try {
    const { data: membership, error: membershipError } = await supabaseClient
      .from("household_members")
      .select("household_id")
      .eq("user_id", currentUser.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.household_id) throw new Error("找不到家庭成員資料，請確認 Supabase 已完成 household_members 設定。");

    cloudContext.householdId = membership.household_id;

    const [
      accountsResult,
      securitiesResult,
      transactionsResult,
      dividendsResult,
      pricesResult,
      feeRulesResult
    ] = await Promise.all([
      supabaseClient.from("accounts").select("*").eq("household_id", cloudContext.householdId).is("deleted_at", null).order("created_at"),
      supabaseClient.from("securities").select("*").eq("household_id", cloudContext.householdId).is("deleted_at", null).order("ticker"),
      supabaseClient.from("transactions").select("*, securities(ticker, market, currency)").eq("household_id", cloudContext.householdId).is("deleted_at", null).order("trade_date", { ascending: false }),
      supabaseClient.from("dividends").select("*, securities(ticker, market, currency)").eq("household_id", cloudContext.householdId).is("deleted_at", null).order("payment_date", { ascending: false }),
      supabaseClient.from("price_snapshots").select("*").eq("household_id", cloudContext.householdId).order("price_date", { ascending: false }),
      supabaseClient.from("fee_rules").select("*").eq("household_id", cloudContext.householdId).eq("is_default", true)
    ]);

    for (const result of [accountsResult, securitiesResult, transactionsResult, dividendsResult, pricesResult, feeRulesResult]) {
      if (result.error) throw result.error;
    }

    const latestPriceBySecurity = new Map();
    for (const price of pricesResult.data || []) {
      if (!latestPriceBySecurity.has(price.security_id)) latestPriceBySecurity.set(price.security_id, price);
    }

    const cloudSecurities = (securitiesResult.data || []).map((security) => {
      const latestPrice = latestPriceBySecurity.get(security.id);
      return {
        id: security.id,
        ticker: security.ticker,
        name: security.name,
        market: security.market,
        currency: security.currency,
        type: fromSecurityKind(security.kind),
        latestPrice: numberOrZero(latestPrice?.close_price),
        priceDate: latestPrice?.price_date || state.settings.latestPriceDate
      };
    });

    const feeSettings = { ...state.settings };
    for (const feeRule of feeRulesResult.data || []) {
      if (feeRule.market === "TW") {
        feeSettings.twCommissionRate = numberOrZero(feeRule.commission_rate);
        feeSettings.twCommissionDiscount = numberOrZero(feeRule.commission_discount) || 1;
        feeSettings.twMinimumCommission = numberOrZero(feeRule.minimum_commission);
      }
      if (feeRule.market === "US") feeSettings.usBuyCommissionRate = numberOrZero(feeRule.commission_rate);
    }

    const cloudTransactions = dedupeRecords((transactionsResult.data || []).map((transaction) => ({
      id: transaction.id,
      date: transaction.trade_date,
      type: transaction.kind,
      accountId: transaction.account_id,
      ticker: transaction.securities?.ticker || "",
      market: transaction.securities?.market || "TW",
      quantity: numberOrZero(transaction.quantity),
      price: numberOrZero(transaction.price),
      commission: numberOrZero(transaction.commission),
      tax: numberOrZero(transaction.tax),
      otherFee: numberOrZero(transaction.other_fee),
      fxRate: numberOrZero(transaction.fx_rate_to_twd) || 1,
      actualTwdAmount: numberOrZero(transaction.actual_twd_amount),
      status: transaction.value_status,
      note: transaction.note || ""
    })), transactionFingerprint);

    const cloudDividends = (dividendsResult.data || []).map((dividend) => ({
      id: dividend.id,
      paymentDate: dividend.payment_date,
      accountId: dividend.account_id,
      ticker: dividend.securities?.ticker || "",
      type: dividend.kind,
      grossAmount: numberOrZero(dividend.gross_amount),
      withholdingTax: numberOrZero(dividend.withholding_tax),
      otherDeductions: numberOrZero(dividend.other_deductions),
      netAmount: numberOrZero(dividend.net_amount),
      currency: dividend.currency,
      fxRate: numberOrZero(dividend.fx_rate_to_twd) || 1,
      status: dividend.value_status,
      note: dividend.note || ""
    }));

    state = {
      ...state,
      settings: feeSettings,
      accounts: (accountsResult.data || []).map((account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency
      })),
      securities: cloudSecurities.length ? cloudSecurities : state.securities,
      transactions: cloudTransactions,
      dividends: cloudDividends
    };
    mergePendingCloudWrites(localStateBeforeCloudLoad);

    ensureKnownSecurityMetadata();
    if (!cloudTransactions.length && !cloudDividends.length) {
      await migrateLocalRecordsToCloud(localStateBeforeCloudLoad);
    }
    await retryPendingCloudWrites();
    saveState();
    cloudContext.syncStatus = "synced";
    cloudContext.lastError = "";
    render();
    autoRefreshLatestPrices();
  } catch (error) {
    cloudContext.syncStatus = "error";
    cloudContext.lastError = error.message;
    renderSupabaseStatus();
  }
}

function mergePendingCloudWrites(localState = null) {
  for (const transaction of localState?.transactions || []) {
    if (transaction._pendingCloudSync && !hasRecord(state.transactions, transaction, transactionFingerprint)) state.transactions.unshift(transaction);
  }
  for (const dividend of localState?.dividends || []) {
    if (dividend._pendingCloudSync && !hasRecord(state.dividends, dividend, dividendFingerprint)) state.dividends.unshift(dividend);
  }
  for (const transaction of pendingCloudWrites.transactions.values()) {
    if (!hasRecord(state.transactions, transaction, transactionFingerprint)) state.transactions.unshift(transaction);
  }
  for (const dividend of pendingCloudWrites.dividends.values()) {
    if (!hasRecord(state.dividends, dividend, dividendFingerprint)) state.dividends.unshift(dividend);
  }
  state.transactions = dedupeRecords(state.transactions, transactionFingerprint);
  state.dividends = dedupeRecords(state.dividends, dividendFingerprint);
  state.transactions.sort((a, b) => b.date.localeCompare(a.date));
  state.dividends.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

function hasRecord(collection, record, fingerprint) {
  return collection.some((item) => item.id === record.id || fingerprint(item) === fingerprint(record));
}

function dedupeRecords(records, fingerprint) {
  const seen = new Set();
  return records.filter((record) => {
    const key = fingerprint(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function transactionFingerprint(transaction) {
  return [
    transaction.date,
    transaction.type,
    transaction.accountId,
    transaction.ticker,
    transaction.market,
    Number(transaction.quantity || 0),
    Number(transaction.price || 0),
    Number(transaction.commission || 0),
    Number(transaction.tax || 0),
    Number(transaction.otherFee || 0),
    Number(transaction.fxRate || 0),
    Number(transaction.actualTwdAmount || 0),
    transaction.note || ""
  ].join("|");
}

function dividendFingerprint(dividend) {
  return [
    dividend.paymentDate,
    dividend.accountId,
    dividend.ticker,
    dividend.type,
    Number(dividend.grossAmount || 0),
    Number(dividend.withholdingTax || 0),
    Number(dividend.otherDeductions || 0),
    Number(dividend.netAmount || 0),
    dividend.currency || "",
    Number(dividend.fxRate || 0),
    dividend.note || ""
  ].join("|");
}

function rememberPendingCloudWrite(kind, record) {
  record._pendingCloudSync = true;
  if (kind === "transaction") pendingCloudWrites.transactions.set(record.id, structuredClone(record));
  if (kind === "dividend") pendingCloudWrites.dividends.set(record.id, structuredClone(record));
}

function forgetPendingCloudWrite(kind, id) {
  if (kind === "transaction") pendingCloudWrites.transactions.delete(id);
  if (kind === "dividend") pendingCloudWrites.dividends.delete(id);
  const collection = kind === "transaction" ? state.transactions : state.dividends;
  const record = collection.find((item) => item.id === id);
  if (record) delete record._pendingCloudSync;
}

async function retryPendingCloudWrites() {
  for (const transaction of state.transactions.filter((item) => item._pendingCloudSync)) {
    try {
      rememberPendingCloudWrite("transaction", transaction);
      await syncTransactionToCloud(transaction);
      forgetPendingCloudWrite("transaction", transaction.id);
    } catch {
      rememberPendingCloudWrite("transaction", transaction);
    }
  }
  for (const dividend of state.dividends.filter((item) => item._pendingCloudSync)) {
    try {
      rememberPendingCloudWrite("dividend", dividend);
      await syncDividendToCloud(dividend);
      forgetPendingCloudWrite("dividend", dividend.id);
    } catch {
      rememberPendingCloudWrite("dividend", dividend);
    }
  }
}

async function ensureCloudSecurity(ticker, market = "TW") {
  if (!supabaseClient || !currentUser || !cloudContext.householdId) return null;
  const normalizedTicker = ticker.toUpperCase();
  const existing = state.securities.find((security) => security.ticker.toUpperCase() === normalizedTicker && security.market === market);
  if (existing?.id && isUuid(existing.id)) return existing.id;

  const known = knownSecurityFor(normalizedTicker);
  const localSecurity = existing || {
    ticker: normalizedTicker,
    name: known?.name || normalizedTicker,
    market: known?.market || market,
    currency: known?.currency || (market === "US" ? "USD" : "TWD"),
    type: known?.type || "股票",
    latestPrice: 0,
    priceDate: state.settings.latestPriceDate
  };

  const { data, error } = await supabaseClient
    .from("securities")
    .upsert({
      household_id: cloudContext.householdId,
      ticker: normalizedTicker,
      name: localSecurity.name,
      market: localSecurity.market,
      currency: localSecurity.currency,
      kind: toSecurityKind(localSecurity.type),
      status: "active",
      deleted_at: null
    }, { onConflict: "household_id,market,ticker" })
    .select()
    .single();
  if (error) throw error;

  if (existing) existing.id = data.id;
  else state.securities.push({ ...localSecurity, id: data.id });
  return data.id;
}

async function syncTransactionToCloud(transaction) {
  if (!supabaseClient || !currentUser || !cloudContext.householdId) return;
  if (!isUuid(transaction.accountId)) throw new Error("帳戶尚未完成雲端同步，請重新登入後再新增交易。");
  const securityId = await ensureCloudSecurity(transaction.ticker, transaction.market);
  const security = securityFor(transaction.ticker);
  const payload = {
    id: transaction.id,
    household_id: cloudContext.householdId,
    account_id: transaction.accountId,
    security_id: securityId,
    trade_date: transaction.date,
    kind: transaction.type,
    quantity: transaction.quantity,
    price: transaction.price,
    trade_currency: security?.currency || (transaction.market === "US" ? "USD" : "TWD"),
    commission: transaction.commission || 0,
    tax: transaction.tax || 0,
    other_fee: transaction.otherFee || 0,
    fee_currency: security?.currency || "TWD",
    fx_rate_to_twd: transaction.fxRate || 1,
    actual_twd_amount: transaction.actualTwdAmount || null,
    value_status: transaction.status || "estimated",
    note: transaction.note || "",
    created_by: currentUser.id,
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
  const { error } = await supabaseClient.from("transactions").upsert(payload).select("id").single();
  if (error) throw error;
}

async function syncDividendToCloud(dividend) {
  if (!supabaseClient || !currentUser || !cloudContext.householdId) return;
  if (!isUuid(dividend.accountId)) throw new Error("帳戶尚未完成雲端同步，請重新登入後再新增配息。");
  const security = securityFor(dividend.ticker);
  const securityId = await ensureCloudSecurity(dividend.ticker, security?.market || "TW");
  const { error } = await supabaseClient.from("dividends").upsert({
    id: dividend.id,
    household_id: cloudContext.householdId,
    account_id: dividend.accountId,
    security_id: securityId,
    payment_date: dividend.paymentDate,
    kind: dividend.type,
    gross_amount: dividend.grossAmount || 0,
    withholding_tax: dividend.withholdingTax || 0,
    other_deductions: dividend.otherDeductions || 0,
    net_amount: dividend.netAmount || 0,
    currency: dividend.currency || security?.currency || "TWD",
    fx_rate_to_twd: dividend.fxRate || 1,
    value_status: dividend.status || "estimated",
    note: dividend.note || "",
    created_by: currentUser.id,
    updated_at: new Date().toISOString(),
    deleted_at: null
  }).select("id").single();
  if (error) throw error;
}

async function syncPriceSnapshotToCloud(price) {
  if (!supabaseClient || !currentUser || !cloudContext.householdId || price.status !== "actual") return;
  const securityId = await ensureCloudSecurity(price.ticker, price.market);
  const { error } = await supabaseClient.from("price_snapshots").upsert({
    household_id: cloudContext.householdId,
    security_id: securityId,
    price_date: price.priceDate,
    close_price: price.price,
    currency: price.currency || (price.market === "US" ? "USD" : "TWD"),
    source: price.source || "manual",
    value_status: "actual"
  }, { onConflict: "household_id,security_id,price_date,source" }).select("id").single();
  if (error) throw error;
}

async function softDeleteCloudRecord(tableName, id) {
  if (!supabaseClient || !currentUser || !cloudContext.householdId || !isUuid(id)) return;
  const { error } = await supabaseClient
    .from(tableName)
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", cloudContext.householdId);
  if (error) throw error;
}

async function syncFeeSettingsToCloud() {
  if (!supabaseClient || !currentUser || !cloudContext.householdId) return;
  const feeRules = [
    {
      market: "TW",
      name: "富邦台股預設費率",
      commission_rate: state.settings.twCommissionRate,
      commission_discount: state.settings.twCommissionDiscount,
      minimum_commission: state.settings.twMinimumCommission,
      sell_tax_rate: 0.003,
      currency: "TWD"
    },
    {
      market: "US",
      name: "富邦複委託美股定期定額買進",
      commission_rate: state.settings.usBuyCommissionRate,
      commission_discount: 1,
      minimum_commission: 0,
      sell_tax_rate: 0,
      currency: "USD"
    }
  ];

  for (const feeRule of feeRules) {
    const { data: existing, error: findError } = await supabaseClient
      .from("fee_rules")
      .select("id")
      .eq("household_id", cloudContext.householdId)
      .eq("market", feeRule.market)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { error } = await supabaseClient.from("fee_rules").update(feeRule).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("fee_rules").insert({
        ...feeRule,
        household_id: cloudContext.householdId,
        is_default: true
      });
      if (error) throw error;
    }
  }
}

function symbolsForPriceRefresh() {
  const symbols = new Map();
  for (const holding of calculateHoldings().filter((item) => item.quantity > 0)) {
    const security = holding.security || securityFor(holding.ticker);
    symbols.set(`${holding.ticker}:${holding.market}`, {
      ticker: holding.ticker,
      market: holding.market,
      name: security?.name || holding.ticker,
      currency: security?.currency || (holding.market === "US" ? "USD" : "TWD"),
      type: security?.type || "股票"
    });
  }
  if (symbols.size) return Array.from(symbols.values());
  return state.securities.map((security) => ({
    ticker: security.ticker,
    market: security.market || "TW",
    name: security.name,
    currency: security.currency,
    type: security.type
  }));
}

function applyPriceUpdates(prices) {
  let latestDate = state.settings.latestPriceDate;
  let updatedCount = 0;
  for (const price of prices) {
    if (price.status !== "actual" || !price.priceDate || !Number(price.price)) continue;
    let security = state.securities.find((item) => item.ticker.toUpperCase() === price.ticker.toUpperCase() && item.market === price.market);
    if (!security) {
      const known = knownSecurityFor(price.ticker);
      security = {
        ticker: price.ticker,
        name: known?.name || price.ticker,
        market: price.market,
        currency: price.currency || known?.currency || (price.market === "US" ? "USD" : "TWD"),
        type: known?.type || "股票",
        latestPrice: 0,
        priceDate: price.priceDate
      };
      state.securities.push(security);
    }
    security.latestPrice = Number(price.price);
    security.priceDate = price.priceDate;
    security.currency = price.currency || security.currency;
    if (price.priceDate > latestDate) latestDate = price.priceDate;
    updatedCount += 1;
  }
  state.settings.latestPriceDate = latestDate;
  return updatedCount;
}

async function refreshLatestPrices() {
  const button = document.querySelector("#refresh-prices-button");
  const originalText = button?.textContent || "更新收盤價";
  const symbols = symbolsForPriceRefresh();
  if (!symbols.length) return;
  if (!supabaseClient || !currentUser || !supabaseConfig?.url || !supabaseConfig?.anonKey) {
    document.querySelector("#auth-message").textContent = "請先登入 Supabase，才能更新收盤價。";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "更新中...";
  }
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("登入狀態已失效，請重新登入。");

    const response = await fetch(`${supabaseConfig.url}/functions/v1/latest-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ symbols })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `價格 API 回應 ${response.status}`);
    const updatedCount = applyPriceUpdates(payload.prices || []);
    const missing = (payload.prices || []).filter((price) => price.status !== "actual");
    saveState();

    cloudContext.syncStatus = "synced";
    cloudContext.lastError = "";

    const suffix = missing.length ? `；${missing.length} 個標的尚未支援自動更新` : "";
    const message = updatedCount ? `已更新 ${updatedCount} 個收盤價${suffix}。` : `沒有可更新的收盤價${suffix}。`;
    render();
    document.querySelector("#auth-message").textContent = message;
  } catch (error) {
    document.querySelector("#auth-message").textContent = `收盤價更新失敗：${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function shouldAutoRefreshPrices() {
  return calculateHoldings().some((holding) => {
    const latestPrice = Number(holding.security?.latestPrice || 0);
    return currentUser && cloudContext.syncStatus === "synced" && !hasAutoRefreshedPrices && holding.quantity > 0 && holding.market === "TW" && latestPrice === 0;
  });
}

async function autoRefreshLatestPrices() {
  if (!shouldAutoRefreshPrices()) return;
  hasAutoRefreshedPrices = true;
  await refreshLatestPrices();
}

async function migrateLocalRecordsToCloud(localState) {
  const accountIdByPreviousId = new Map();
  for (const previousAccount of localState.accounts || []) {
    const cloudAccount = state.accounts.find((account) => account.id === previousAccount.id || account.name === previousAccount.name);
    if (cloudAccount) accountIdByPreviousId.set(previousAccount.id, cloudAccount.id);
  }

  const localTransactions = (localState.transactions || [])
    .filter((transaction) => isUuid(transaction.id))
    .map((transaction) => ({
      ...transaction,
      accountId: accountIdByPreviousId.get(transaction.accountId) || transaction.accountId
    }))
    .filter((transaction) => isUuid(transaction.accountId));

  const localDividends = (localState.dividends || [])
    .filter((dividend) => isUuid(dividend.id))
    .map((dividend) => ({
      ...dividend,
      accountId: accountIdByPreviousId.get(dividend.accountId) || dividend.accountId
    }))
    .filter((dividend) => isUuid(dividend.accountId));

  for (const transaction of localTransactions) {
    if (!state.transactions.some((item) => item.id === transaction.id)) state.transactions.push(transaction);
    await syncTransactionToCloud(transaction);
  }

  for (const dividend of localDividends) {
    if (!state.dividends.some((item) => item.id === dividend.id)) state.dividends.push(dividend);
    await syncDividendToCloud(dividend);
  }

  if (localTransactions.length || localDividends.length) {
    state.transactions.sort((a, b) => b.date.localeCompare(a.date));
    state.dividends.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }
}

function transactionCashFlowTwd(transaction) {
  const security = securityFor(transaction.ticker);
  const fxRate = Number(transaction.fxRate || (security?.market === "US" ? state.settings.usdTwdRate : 1));
  const gross = Number(transaction.quantity || 0) * Number(transaction.price || 0);
  const fees = Number(transaction.commission || 0) + Number(transaction.tax || 0) + Number(transaction.otherFee || 0);
  if (Number(transaction.actualTwdAmount) > 0) return Number(transaction.actualTwdAmount);
  return security?.market === "US" ? (gross + fees) * fxRate : gross + fees;
}

function dividendTwd(dividend) {
  const fxRate = Number(dividend.fxRate || (dividend.currency === "USD" ? state.settings.usdTwdRate : 1));
  return Number(dividend.netAmount || 0) * fxRate;
}

function calculateHoldings() {
  const positions = new Map();
  for (const tx of state.transactions) {
    if (!["buy", "sell"].includes(tx.type)) continue;
    const key = `${tx.accountId}:${tx.ticker.toUpperCase()}`;
    const security = securityFor(tx.ticker);
    const position = positions.get(key) || {
      accountId: tx.accountId,
      ticker: tx.ticker.toUpperCase(),
      market: tx.market || security?.market || "TW",
      quantity: 0,
      costTwd: 0,
      realizedTwd: 0
    };
    const quantity = Number(tx.quantity || 0);
    const cashTwd = transactionCashFlowTwd(tx);
    if (tx.type === "buy") {
      position.quantity += quantity;
      position.costTwd += cashTwd;
    } else {
      const averageCost = position.quantity > 0 ? position.costTwd / position.quantity : 0;
      const soldCost = averageCost * quantity;
      position.quantity -= quantity;
      position.costTwd -= soldCost;
      position.realizedTwd += cashTwd - soldCost;
    }
    positions.set(key, position);
  }
  return Array.from(positions.values()).map((position) => {
    const security = securityFor(position.ticker);
    const price = Number(security?.latestPrice || 0);
    const fxRate = security?.market === "US" ? state.settings.usdTwdRate : 1;
    const marketValueTwd = position.quantity * price * fxRate;
    return {
      ...position,
      security,
      averageCostTwd: position.quantity > 0 ? position.costTwd / position.quantity : 0,
      marketValueTwd,
      unrealizedTwd: marketValueTwd - position.costTwd,
      status: position.quantity > 0 ? "active" : "closed"
    };
  });
}

function calculateSummary() {
  const holdings = calculateHoldings();
  const activeHoldings = holdings.filter((holding) => holding.quantity > 0);
  const totalMarketValue = activeHoldings.reduce((sum, holding) => sum + holding.marketValueTwd, 0);
  const totalCost = activeHoldings.reduce((sum, holding) => sum + holding.costTwd, 0);
  const realized = holdings.reduce((sum, holding) => sum + holding.realizedTwd, 0);
  const dividends = state.dividends.reduce((sum, dividend) => sum + dividendTwd(dividend), 0);
  const totalReturn = totalMarketValue - totalCost + realized + dividends;
  const totalReturnRate = totalCost > 0 ? totalReturn / totalCost : 0;
  const todayGain = activeHoldings.reduce((sum, holding) => {
    const simulatedPreviousClose = holding.security?.market === "US" ? holding.security.latestPrice * 0.994 : holding.security.latestPrice * 0.997;
    const fxRate = holding.security?.market === "US" ? state.settings.usdTwdRate : 1;
    return sum + (holding.security.latestPrice - simulatedPreviousClose) * holding.quantity * fxRate;
  }, 0);
  return {
    totalAssets: totalMarketValue,
    totalReturn,
    totalReturnRate,
    todayGain,
    dividends,
    monthGain: totalReturn * 0.62,
    yearGain: totalReturn
  };
}

function render() {
  state.transactions = dedupeRecords(state.transactions, transactionFingerprint);
  state.dividends = dedupeRecords(state.dividends, dividendFingerprint);
  renderSummary();
  renderTrend();
  renderAllocation();
  renderStatus();
  renderHoldings();
  renderTransactions();
  renderIncome();
  renderSettings();
  renderEntryOptions();
  renderSupabaseStatus();
  document.querySelector("#price-date-label").textContent = state.settings.latestPriceDate;
}

function renderSummary() {
  const summary = calculateSummary();
  const metrics = [
    { label: "總資產", value: formatTwd.format(summary.totalAssets), note: "家庭總和" },
    { label: "總報酬率", value: `${(summary.totalReturnRate * 100).toFixed(2)}%`, note: formatTwd.format(summary.totalReturn), tone: summary.totalReturn >= 0 ? "positive" : "negative" },
    { label: "今日損益", value: formatTwd.format(summary.todayGain), note: "依最新收盤價估算", tone: summary.todayGain >= 0 ? "positive" : "negative" },
    { label: "配息收入", value: formatTwd.format(summary.dividends), note: "含台股與美股" },
    { label: "本月 / 今年", value: `${formatTwd.format(summary.monthGain)} / ${formatTwd.format(summary.yearGain)}`, note: "示範期間損益", tone: summary.yearGain >= 0 ? "positive" : "negative" }
  ];
  document.querySelector("#summary-metrics").innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <div class="metric-label">${metric.label}</div>
      <div class="metric-value ${metric.tone || ""}">${metric.value}</div>
      <div class="metric-footnote">${metric.note}</div>
    </article>
  `).join("");
}

function renderTrend() {
  const summary = calculateSummary();
  const values = [0.88, 0.91, 0.9, 0.94, 0.96, 0.98, 1, 1.02].map((factor) => summary.totalAssets * factor);
  const max = Math.max(...values);
  document.querySelector("#trend-chart").innerHTML = values.map((value, index) => `
    <div class="bar" style="height:${Math.max(8, (value / max) * 100)}%">
      <span>${index + 1}月</span>
    </div>
  `).join("");
}

function renderAllocation() {
  const holdings = calculateHoldings().filter((holding) => holding.quantity > 0);
  const total = holdings.reduce((sum, holding) => sum + holding.marketValueTwd, 0);
  const byMarket = holdings.reduce((groups, holding) => {
    groups[holding.market] = (groups[holding.market] || 0) + holding.marketValueTwd;
    return groups;
  }, {});
  document.querySelector("#market-allocation").innerHTML = Object.entries(byMarket).map(([market, value]) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    const label = market === "TW" ? "台股" : "美股";
    return `
      <div class="allocation-row">
        <div class="allocation-label"><span>${label}</span><strong>${percent.toFixed(1)}%</strong></div>
        <div class="allocation-track"><div class="allocation-fill" style="width:${percent}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderStatus() {
  const items = [
    { label: "價格資料", value: `最新收盤價 ${state.settings.latestPriceDate}`, status: "actual" },
    { label: "匯率", value: `富邦銀行 USD/TWD ${state.settings.usdTwdRate}`, status: "estimated" },
    { label: "手續費", value: "實際值優先，缺值時估算", status: "estimated" }
  ];
  document.querySelector("#data-status").innerHTML = items.map((item) => `
    <div class="status-item">
      <div><strong>${item.label}</strong><br><span class="muted">${item.value}</span></div>
      <span class="status-pill ${item.status}">${item.status === "actual" ? "實際" : "估算"}</span>
    </div>
  `).join("");
}

function renderHoldings() {
  const holdings = calculateHoldings();
  document.querySelector("#holding-count").textContent = `${holdings.filter((holding) => holding.quantity > 0).length} 個持有中標的`;
  document.querySelector("#holdings-table").innerHTML = holdings.map((holding) => {
    const security = holding.security || { name: "未命名標的", latestPrice: 0, currency: "TWD" };
    const price = security.currency === "USD" ? formatUsd.format(security.latestPrice) : formatTwd.format(security.latestPrice);
    return `
      <tr>
        <td><div class="ticker"><strong>${holding.ticker}</strong><span>${security.name}</span></div></td>
        <td>${holding.market === "TW" ? "台股" : "美股"}</td>
        <td>${formatNumber.format(holding.quantity)}</td>
        <td>${formatTwd.format(holding.averageCostTwd)}</td>
        <td>${price}<br><span class="muted">${security.priceDate || state.settings.latestPriceDate}</span></td>
        <td>${formatTwd.format(holding.marketValueTwd)}</td>
        <td class="${holding.unrealizedTwd >= 0 ? "positive" : "negative"}">${formatTwd.format(holding.unrealizedTwd)}</td>
        <td><span class="status-pill ${holding.status === "active" ? "actual" : "missing"}">${holding.status === "active" ? "持有中" : "已結清"}</span></td>
      </tr>
    `;
  }).join("");
}

function renderTransactions() {
  document.querySelector("#transactions-table").innerHTML = state.transactions.map((tx) => {
    const account = accountFor(tx.accountId);
    const fees = Number(tx.commission || 0) + Number(tx.tax || 0) + Number(tx.otherFee || 0);
    return `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.type === "buy" ? "買入" : "賣出"}</td>
        <td>${account?.name || "未指定"}</td>
        <td>${tx.ticker}</td>
        <td>${formatNumber.format(tx.quantity)}</td>
        <td>${formatNumber.format(tx.price)}</td>
        <td>${formatNumber.format(fees)}</td>
        <td>${formatTwd.format(transactionCashFlowTwd(tx))}</td>
        <td class="actions-cell">
          <div class="row-actions">
            <button type="button" class="small-button" data-action="edit-transaction" data-id="${tx.id}">編輯</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderIncome() {
  document.querySelector("#income-table").innerHTML = state.dividends.map((dividend) => `
    <tr>
      <td>${dividend.paymentDate}</td>
      <td>${dividend.ticker}</td>
      <td>${dividend.type === "cash" ? "現金入帳" : "再投入"}</td>
      <td>${formatMoney(dividend.grossAmount, dividend.currency)}</td>
      <td>${formatMoney(dividend.withholdingTax, dividend.currency)}</td>
      <td>${formatMoney(dividend.netAmount, dividend.currency)}</td>
      <td>${formatTwd.format(dividendTwd(dividend))}</td>
      <td class="actions-cell">
        <div class="row-actions">
          <button type="button" class="small-button" data-action="edit-dividend" data-id="${dividend.id}">編輯</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderSettings() {
  const form = document.querySelector("#fee-form");
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
}

function renderSupabaseStatus() {
  const mode = document.querySelector("#supabase-mode");
  const connection = document.querySelector("#connection-status");
  const message = document.querySelector("#auth-message");
  const signedInSummary = document.querySelector("#signed-in-summary");
  const signedInEmail = document.querySelector("#signed-in-email");
  const signedOutElements = document.querySelectorAll("[data-auth-signed-out]");
  const passwordElements = document.querySelectorAll("[data-auth-needs-password]");
  const passwordSetupElements = document.querySelectorAll("[data-auth-password-setup]");
  const signOutButton = document.querySelector("#sign-out-button");

  function setAuthControls({ isSignedIn, needsPasswordSetup = false }) {
    signedInSummary.hidden = !isSignedIn;
    signedInEmail.textContent = currentUser?.email || "--";
    signedOutElements.forEach((element) => { element.hidden = isSignedIn; });
    passwordElements.forEach((element) => { element.hidden = isSignedIn && !needsPasswordSetup; });
    passwordSetupElements.forEach((element) => { element.hidden = !needsPasswordSetup; });
    signOutButton.hidden = !isSignedIn;
  }

  if (!supabaseClient) {
    mode.textContent = "尚未設定";
    mode.className = "status-pill estimated";
    connection.textContent = "本機模式";
    message.textContent = "目前使用本機資料。建立 Supabase 專案後，新增 supabase-config.js 即可啟用登入。";
    setAuthControls({ isSignedIn: false });
    return;
  }
  if (currentUser) {
    const needsPasswordSetup = Boolean(pendingPasswordSetupType);
    mode.textContent = "已登入";
    mode.className = "status-pill actual";
    connection.textContent = `Supabase：${currentUser.email}`;
    if (pendingPasswordSetupType) {
      message.textContent = "請在密碼欄輸入新密碼，按「設定密碼」。";
    } else if (cloudContext.syncStatus === "syncing") {
      message.textContent = "正在同步 Supabase 投資資料...";
    } else if (cloudContext.syncStatus === "synced") {
      message.textContent = "已同步 Supabase 資料庫。其他裝置登入後會看到同一份家庭資料。";
    } else if (cloudContext.syncStatus === "error") {
      message.textContent = `Supabase 資料同步失敗：${cloudContext.lastError}`;
    } else {
      message.textContent = "已連到 Supabase Auth，等待資料同步。";
    }
    setAuthControls({ isSignedIn: true, needsPasswordSetup });
    return;
  }
  mode.textContent = "可登入";
  mode.className = "status-pill estimated";
  connection.textContent = "Supabase 可用";
  message.textContent = "請使用 email 與密碼註冊或登入。";
  setAuthControls({ isSignedIn: false });
}

function renderEntryOptions({ resetDate = false } = {}) {
  const accountSelect = document.querySelector("[name='accountId']");
  const selectedAccount = accountSelect.value;
  accountSelect.innerHTML = state.accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join("");
  if (selectedAccount && state.accounts.some((account) => account.id === selectedAccount)) accountSelect.value = selectedAccount;
  const dateInput = document.querySelector("[name='date']");
  if (resetDate || !dateInput.value) dateInput.valueAsDate = new Date();
  updateEntrySummary();
}

function formatMoney(value, currency) {
  return currency === "USD" ? formatUsd.format(value || 0) : formatTwd.format(value || 0);
}

function estimateCommission(market, gross) {
  if (market === "US") return gross * state.settings.usBuyCommissionRate;
  return Math.max(gross * state.settings.twCommissionRate * state.settings.twCommissionDiscount, state.settings.twMinimumCommission);
}

function updateEntryMode(type) {
  entryType = type;
  document.querySelectorAll(".segment").forEach((button) => button.classList.toggle("active", button.dataset.entryType === type));
  const isDividend = type === "dividend";
  document.querySelectorAll("[data-dividend-only]").forEach((element) => { element.hidden = !isDividend; });
  document.querySelectorAll("[data-trade-only]").forEach((element) => { element.hidden = isDividend; });
  updateEntrySummary();
}

function readEntryForm() {
  const form = document.querySelector("#entry-form");
  return Object.fromEntries(new FormData(form).entries());
}

function updateEntrySummary() {
  const data = readEntryForm();
  const market = data.market || "TW";
  const quantity = Number(data.quantity || 0);
  const price = Number(data.price || 0);
  const gross = quantity * price;
  const commission = Number(data.commission || estimateCommission(market, gross));
  const tax = Number(data.tax || 0);
  const otherFee = Number(data.otherFee || 0);
  const fxRate = Number(data.fxRate || (market === "US" ? state.settings.usdTwdRate : 1));
  const estimatedTwd = market === "US" ? (gross + commission + tax + otherFee) * fxRate : gross + commission + tax + otherFee;
  const summary = document.querySelector("#entry-summary");
  if (entryType === "dividend") {
    const net = Number(data.netAmount || 0);
    const dividendTwdValue = net * fxRate;
    summary.innerHTML = `<strong>儲存前摘要</strong><span>淨入帳估算：${formatTwd.format(dividendTwdValue)}</span><span>狀態：估算，儲存後仍可修改</span>`;
    return;
  }
  summary.innerHTML = `<strong>儲存前摘要</strong><span>${entryType === "buy" ? "預估總成本" : "預估入帳"}：${formatTwd.format(estimatedTwd)}</span><span>手續費估算：${formatNumber.format(commission)}</span>`;
}

function updateEntryDialogState() {
  const isEditing = Boolean(editingEntry);
  document.querySelector("#entry-dialog-title").textContent = isEditing ? "編輯紀錄" : "新增紀錄";
  document.querySelector("#save-entry").textContent = isEditing ? "儲存變更" : "儲存紀錄";
  document.querySelector("#delete-entry").hidden = !isEditing;
}

async function saveEntry() {
  if (isSavingEntry) return;
  isSavingEntry = true;
  document.querySelector("#save-entry").disabled = true;
  const data = readEntryForm();
  const ticker = data.ticker.trim().toUpperCase();
  if (!ticker || !data.date || !data.accountId) {
    isSavingEntry = false;
    document.querySelector("#save-entry").disabled = false;
    return;
  }
  const security = securityFor(ticker);
  let savedEntry = null;
  let savedEntryKind = "";
  if (!security) {
    const known = knownSecurityFor(ticker);
    state.securities.push({
      ticker,
      name: known?.name || ticker,
      market: known?.market || data.market || "TW",
      currency: known?.currency || (data.market === "US" ? "USD" : "TWD"),
      type: known?.type || "股票",
      latestPrice: Number(data.price || 0),
      priceDate: state.settings.latestPriceDate
    });
  } else {
    const known = knownSecurityFor(ticker);
    if (known && (security.name === ticker || !security.name)) {
      security.name = known.name;
      security.market = security.market || known.market;
      security.currency = security.currency || known.currency;
      security.type = security.type || known.type;
    }
  }

  if (entryType === "dividend") {
    const found = securityFor(ticker);
    const dividend = {
      id: editingEntry?.kind === "dividend" ? editingEntry.id : crypto.randomUUID(),
      paymentDate: data.date,
      accountId: data.accountId,
      ticker,
      type: data.dividendType,
      grossAmount: Number(data.netAmount || 0) + Number(data.tax || 0) + Number(data.otherFee || 0),
      withholdingTax: Number(data.tax || 0),
      otherDeductions: Number(data.otherFee || 0),
      netAmount: Number(data.netAmount || 0),
      currency: found?.currency || "TWD",
      fxRate: Number(data.fxRate || (found?.market === "US" ? state.settings.usdTwdRate : 1)),
      status: data.fxRate ? "actual" : "estimated",
      note: data.note || ""
    };
    if (editingEntry?.kind === "dividend") {
      state.dividends = state.dividends.map((item) => item.id === editingEntry.id ? dividend : item);
    } else {
      state.dividends.unshift(dividend);
    }
    savedEntry = dividend;
    savedEntryKind = "dividend";
  } else {
    const market = data.market || securityFor(ticker)?.market || "TW";
    const quantity = Number(data.quantity || 0);
    const price = Number(data.price || 0);
    const gross = quantity * price;
    const transaction = {
      id: editingEntry?.kind === "transaction" ? editingEntry.id : crypto.randomUUID(),
      date: data.date,
      type: entryType,
      accountId: data.accountId,
      ticker,
      market,
      quantity,
      price,
      commission: Number(data.commission || estimateCommission(market, gross)),
      tax: Number(data.tax || 0),
      otherFee: Number(data.otherFee || 0),
      fxRate: Number(data.fxRate || (market === "US" ? state.settings.usdTwdRate : 1)),
      actualTwdAmount: Number(data.actualTwdAmount || 0),
      status: data.commission || data.fxRate ? "actual" : "estimated",
      note: data.note || ""
    };
    if (editingEntry?.kind === "transaction") {
      state.transactions = state.transactions.map((item) => item.id === editingEntry.id ? transaction : item);
    } else {
      const existingDuplicate = state.transactions.find((item) => transactionFingerprint(item) === transactionFingerprint(transaction));
      if (existingDuplicate) transaction.id = existingDuplicate.id;
      else state.transactions.unshift(transaction);
    }
    savedEntry = transaction;
    savedEntryKind = "transaction";
  }
  if (supabaseClient && currentUser) {
    rememberPendingCloudWrite(savedEntryKind, savedEntry);
  }
  saveState();
  if (supabaseClient && currentUser) {
    try {
      cloudContext.syncStatus = "syncing";
      renderSupabaseStatus();
      if (savedEntryKind === "transaction") await syncTransactionToCloud(savedEntry);
      if (savedEntryKind === "dividend") await syncDividendToCloud(savedEntry);
      forgetPendingCloudWrite(savedEntryKind, savedEntry.id);
      saveState();
      cloudContext.syncStatus = "synced";
      cloudContext.lastError = "";
    } catch (error) {
      cloudContext.syncStatus = "error";
      cloudContext.lastError = error.message;
    }
  }
  document.querySelector("#entry-dialog").close();
  document.querySelector("#entry-form").reset();
  editingEntry = null;
  updateEntryDialogState();
  render();
  isSavingEntry = false;
  document.querySelector("#save-entry").disabled = false;
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-portfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function closeEntryDialog() {
  document.querySelector("#entry-dialog").close();
  document.querySelector("#entry-form").reset();
  editingEntry = null;
  updateEntryMode("buy");
  updateEntryDialogState();
}

function openNewEntryDialog() {
  editingEntry = null;
  document.querySelector("#entry-form").reset();
  renderEntryOptions({ resetDate: true });
  updateEntryMode("buy");
  updateEntryDialogState();
  document.querySelector("#entry-dialog").showModal();
}

function setEntryFormValues(values) {
  const form = document.querySelector("#entry-form");
  Object.entries(values).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  updateEntrySummary();
}

function editTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  editingEntry = { kind: "transaction", id };
  renderEntryOptions();
  updateEntryMode(transaction.type);
  updateEntryDialogState();
  setEntryFormValues({
    date: transaction.date,
    accountId: transaction.accountId,
    market: transaction.market,
    ticker: transaction.ticker,
    quantity: transaction.quantity,
    price: transaction.price,
    commission: transaction.commission,
    tax: transaction.tax,
    otherFee: transaction.otherFee,
    fxRate: transaction.fxRate,
    actualTwdAmount: transaction.actualTwdAmount,
    note: transaction.note
  });
  document.querySelector("#entry-dialog").showModal();
}

function editDividend(id) {
  const dividend = state.dividends.find((item) => item.id === id);
  if (!dividend) return;
  editingEntry = { kind: "dividend", id };
  renderEntryOptions();
  updateEntryMode("dividend");
  updateEntryDialogState();
  setEntryFormValues({
    date: dividend.paymentDate,
    accountId: dividend.accountId,
    ticker: dividend.ticker,
    dividendType: dividend.type,
    netAmount: dividend.netAmount,
    tax: dividend.withholdingTax,
    otherFee: dividend.otherDeductions,
    fxRate: dividend.fxRate,
    note: dividend.note
  });
  document.querySelector("#entry-dialog").showModal();
}

async function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return false;
  const confirmed = window.confirm(`刪除 ${transaction.date} ${transaction.ticker} 的${transaction.type === "buy" ? "買入" : "賣出"}紀錄？`);
  if (!confirmed) return false;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  saveState();
  if (supabaseClient && currentUser) {
    try {
      await softDeleteCloudRecord("transactions", id);
      cloudContext.syncStatus = "synced";
      cloudContext.lastError = "";
    } catch (error) {
      cloudContext.syncStatus = "error";
      cloudContext.lastError = error.message;
    }
  }
  render();
  return true;
}

async function deleteDividend(id) {
  const dividend = state.dividends.find((item) => item.id === id);
  if (!dividend) return false;
  const confirmed = window.confirm(`刪除 ${dividend.paymentDate} ${dividend.ticker} 的配息紀錄？`);
  if (!confirmed) return false;
  state.dividends = state.dividends.filter((item) => item.id !== id);
  saveState();
  if (supabaseClient && currentUser) {
    try {
      await softDeleteCloudRecord("dividends", id);
      cloudContext.syncStatus = "synced";
      cloudContext.lastError = "";
    } catch (error) {
      cloudContext.syncStatus = "error";
      cloudContext.lastError = error.message;
    }
  }
  render();
  return true;
}

async function deleteEditingEntry() {
  if (!editingEntry) return;
  const didDelete = editingEntry.kind === "transaction" ? await deleteTransaction(editingEntry.id) : await deleteDividend(editingEntry.id);
  if (!didDelete) return;
  document.querySelector("#entry-dialog").close();
  document.querySelector("#entry-form").reset();
  editingEntry = null;
  updateEntryMode("buy");
  updateEntryDialogState();
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit-transaction") editTransaction(id);
  if (action === "edit-dividend") editDividend(id);
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}-view`).classList.add("active");
      document.querySelector("#page-title").textContent = button.textContent === "總覽" ? "家庭總覽" : button.textContent;
    });
  });

  document.querySelector("#open-entry").addEventListener("click", openNewEntryDialog);
  document.querySelector("#refresh-prices-button").addEventListener("click", refreshLatestPrices);
  document.querySelector("#export-button").addEventListener("click", exportJson);
  document.querySelector("#save-entry").addEventListener("click", saveEntry);
  document.querySelector("#delete-entry").addEventListener("click", deleteEditingEntry);
  document.querySelector("#close-entry").addEventListener("click", closeEntryDialog);
  document.querySelector("#cancel-entry").addEventListener("click", closeEntryDialog);
  document.querySelector("#transactions-table").addEventListener("click", handleTableAction);
  document.querySelector("#income-table").addEventListener("click", handleTableAction);
  document.querySelectorAll(".segment").forEach((button) => button.addEventListener("click", () => updateEntryMode(button.dataset.entryType)));
  document.querySelector("#entry-form").addEventListener("input", updateEntrySummary);
  document.querySelector("#fee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    for (const [key, value] of formData.entries()) state.settings[key] = Number(value);
    saveState();
    if (supabaseClient && currentUser) {
      try {
        await syncFeeSettingsToCloud();
        cloudContext.syncStatus = "synced";
        cloudContext.lastError = "";
      } catch (error) {
        cloudContext.syncStatus = "error";
        cloudContext.lastError = error.message;
      }
    }
    render();
  });
  document.querySelector("#sign-up-button").addEventListener("click", signUp);
  document.querySelector("#sign-in-button").addEventListener("click", signIn);
  document.querySelector("#update-password-button").addEventListener("click", updatePassword);
  document.querySelector("#reset-password-button").addEventListener("click", resetPasswordEmail);
  document.querySelector("#sign-out-button").addEventListener("click", signOut);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration || !("sync" in registration)) return;
  registration.sync.register("portfolio-data-sync").catch(() => {});
}

async function initSupabase() {
  const config = await loadSupabaseConfig();
  if (!config?.url || !config?.anonKey) {
    renderSupabaseStatus();
    return;
  }
  try {
    supabaseConfig = config;
    const { createClient } = await import(supabaseCdn);
    supabaseClient = createClient(config.url, config.anonKey);
    const authHash = new URLSearchParams(window.location.hash.slice(1));
    pendingPasswordSetupType = ["invite", "recovery"].includes(authHash.get("type")) ? authHash.get("type") : "";
    const { data: sessionData } = await supabaseClient.auth.getSession();
    currentUser = sessionData?.session?.user || null;
    if (!currentUser) {
      const { data } = await supabaseClient.auth.getUser();
      currentUser = data?.user || null;
    }
    if (pendingPasswordSetupType && currentUser) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      if (currentUser && !pendingPasswordSetupType) {
        hasAutoRefreshedPrices = false;
        loadCloudData();
      } else if (!currentUser) {
        hasAutoRefreshedPrices = false;
        cloudContext = { householdId: null, syncStatus: "local", lastError: "" };
      }
      renderSupabaseStatus();
    });
  } catch (error) {
    document.querySelector("#auth-message").textContent = `Supabase 載入失敗：${error.message}`;
  }
  renderSupabaseStatus();
  if (currentUser && !pendingPasswordSetupType) await loadCloudData();
}

async function loadSupabaseConfig() {
  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (response.ok) {
        const config = await response.json();
        if (config?.url && config?.anonKey) return config;
      }
    } catch {
      // GitHub Pages is static, so /api/config is optional and only used by legacy hosts.
    }
  }
  try {
    const module = await import(`./supabase-config.js?v=${Date.now()}`);
    return module.default || module.SUPABASE_CONFIG;
  } catch (error) {
    document.querySelector("#auth-message").textContent = `Supabase 設定載入失敗：${error.message}`;
    return null;
  }
}

function readAuthForm() {
  const form = document.querySelector("#auth-form");
  return Object.fromEntries(new FormData(form).entries());
}

async function signUp() {
  if (!supabaseClient) return renderSupabaseStatus();
  const { email, password } = readAuthForm();
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (!error && data?.user) currentUser = data.user;
  document.querySelector("#auth-message").textContent = error ? error.message : "註冊完成。若 Supabase 要求驗證 email，請先到信箱完成驗證。";
  renderSupabaseStatus();
  if (!error && currentUser) await loadCloudData();
}

async function signIn() {
  if (!supabaseClient) return renderSupabaseStatus();
  const { email, password } = readAuthForm();
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    document.querySelector("#auth-message").textContent = error.message;
    renderSupabaseStatus();
    return;
  }
  currentUser = data?.user || data?.session?.user || null;
  if (!currentUser) {
    const { data: userData } = await supabaseClient.auth.getUser();
    currentUser = userData?.user || null;
  }
  document.querySelector("#auth-message").textContent = "登入成功。";
  renderSupabaseStatus();
  hasAutoRefreshedPrices = false;
  await loadCloudData();
}

async function updatePassword() {
  if (!supabaseClient) return renderSupabaseStatus();
  if (!currentUser) {
    document.querySelector("#auth-message").textContent = "請先從邀請信連結進入，或先登入後再設定密碼。";
    return;
  }
  const { password } = readAuthForm();
  if (!password || password.length < 8) {
    document.querySelector("#auth-message").textContent = "請輸入至少 8 碼的新密碼。";
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password });
  pendingPasswordSetupType = "";
  document.querySelector("#auth-message").textContent = error ? error.message : "密碼已設定完成，之後可用 email 與密碼登入。";
  renderSupabaseStatus();
}

async function resetPasswordEmail() {
  if (!supabaseClient) return renderSupabaseStatus();
  const { email } = readAuthForm();
  if (!email) {
    document.querySelector("#auth-message").textContent = "請先輸入 email，再寄送重設密碼信。";
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  document.querySelector("#auth-message").textContent = error ? error.message : "已寄送重設密碼信，請到信箱點擊連結後回來設定密碼。";
}

async function signOut() {
  if (!supabaseClient) return renderSupabaseStatus();
  await supabaseClient.auth.signOut();
  pendingPasswordSetupType = "";
  cloudContext = { householdId: null, syncStatus: "local", lastError: "" };
  document.querySelector("#auth-message").textContent = "已登出。";
}

bindEvents();
render();
initSupabase();
