import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const twseStockDayUrl = "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY";

type PriceRequestSymbol = {
  ticker: string;
  market?: string;
  name?: string;
  currency?: string;
  type?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function parseRocDate(value: string) {
  const [rocYear, month, day] = String(value || "").split("/").map(Number);
  if (!rocYear || !month || !day) return "";
  return `${rocYear + 1911}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumber(value: string) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSecurityKind(type = "") {
  if (type.toLowerCase() === "etf" || type === "ETF") return "etf";
  if (type === "股票" || type.toLowerCase() === "stock") return "stock";
  return "other";
}

async function fetchTwseLatestClose(ticker: string) {
  const url = new URL(twseStockDayUrl);
  url.searchParams.set("stockNo", ticker);
  url.searchParams.set("response", "json");

  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  if (!authorization.startsWith("Bearer ")) return jsonResponse({ error: "請先登入後再更新收盤價。" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "登入狀態已失效，請重新登入。" }, 401);

  const { data: membership, error: membershipError } = await userClient
    .from("household_members")
    .select("household_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) return jsonResponse({ error: membershipError.message }, 500);
  if (!membership?.household_id) return jsonResponse({ error: "找不到家庭成員資料。" }, 403);

  const body = await request.json().catch(() => ({}));
  const symbols = Array.isArray(body.symbols) ? body.symbols as PriceRequestSymbol[] : [];
  if (!symbols.length) return jsonResponse({ error: "請提供要更新的標的。" }, 400);

  const prices = [];
  for (const symbol of symbols) {
    const ticker = String(symbol.ticker || "").trim().toUpperCase();
    const market = String(symbol.market || "TW").trim().toUpperCase();
    if (!ticker) continue;

    try {
      if (market !== "TW") {
        prices.push({
          ticker,
          market,
          price: null,
          priceDate: null,
          currency: symbol.currency || "USD",
          source: null,
          status: "missing",
          error: "美股收盤價來源尚未設定"
        });
        continue;
      }

      const price = await fetchTwseLatestClose(ticker);
      const { data: security, error: securityError } = await adminClient
        .from("securities")
        .upsert({
          household_id: membership.household_id,
          ticker,
          market,
          name: symbol.name || ticker,
          currency: price.currency,
          kind: toSecurityKind(symbol.type),
          status: "active",
          deleted_at: null
        }, { onConflict: "household_id,market,ticker" })
        .select("id")
        .single();
      if (securityError) throw securityError;

      const { error: priceError } = await adminClient.from("price_snapshots").upsert({
        household_id: membership.household_id,
        security_id: security.id,
        price_date: price.priceDate,
        close_price: price.price,
        currency: price.currency,
        source: price.source,
        value_status: "actual"
      }, { onConflict: "household_id,security_id,price_date,source" });
      if (priceError) throw priceError;

      prices.push(price);
    } catch (error) {
      prices.push({
        ticker,
        market,
        price: null,
        priceDate: null,
        currency: market === "US" ? "USD" : "TWD",
        source: market === "TW" ? "TWSE" : null,
        status: "error",
        error: error instanceof Error ? error.message : "更新失敗"
      });
    }
  }

  return jsonResponse({
    updatedAt: new Date().toISOString(),
    prices
  });
});
