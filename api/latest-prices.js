const twseStockDayUrl = "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY";

function parseSymbols(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [ticker, market = "TW"] = item.split(":");
      return {
        ticker: (ticker || "").trim().toUpperCase(),
        market: (market || "TW").trim().toUpperCase()
      };
    })
    .filter((item) => item.ticker);
}

function parseRocDate(value) {
  const [rocYear, month, day] = String(value || "").split("/").map(Number);
  if (!rocYear || !month || !day) return "";
  return `${rocYear + 1911}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumber(value) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchTwseLatestClose(ticker) {
  const url = new URL(twseStockDayUrl);
  url.searchParams.set("stockNo", ticker);
  url.searchParams.set("response", "json");

  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "user-agent": "family-portfolio-dashboard/0.1"
    }
  });
  if (!response.ok) throw new Error(`TWSE 回應 ${response.status}`);

  const payload = await response.json();
  if (payload.stat !== "OK" || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error(payload.stat || "TWSE 查無資料");
  }

  const latest = payload.data[payload.data.length - 1];
  return {
    ticker,
    market: "TW",
    price: parseNumber(latest[6]),
    priceDate: parseRocDate(latest[0]),
    currency: "TWD",
    source: "TWSE",
    status: "actual"
  };
}

async function priceForSymbol(symbol) {
  try {
    if (symbol.market === "TW") return await fetchTwseLatestClose(symbol.ticker);
    return {
      ...symbol,
      price: null,
      priceDate: null,
      currency: "USD",
      source: null,
      status: "missing",
      error: "美股收盤價來源尚未設定"
    };
  } catch (error) {
    return {
      ...symbol,
      price: null,
      priceDate: null,
      currency: symbol.market === "US" ? "USD" : "TWD",
      source: symbol.market === "TW" ? "TWSE" : null,
      status: "error",
      error: error.message
    };
  }
}

export default async function handler(request, response) {
  const symbols = parseSymbols(request.query.symbols);
  if (!symbols.length) {
    response.status(400).json({ error: "請提供 symbols，例如 2330:TW,00878:TW" });
    return;
  }

  const prices = await Promise.all(symbols.map(priceForSymbol));
  response.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=43200");
  response.status(200).json({
    updatedAt: new Date().toISOString(),
    prices
  });
}
