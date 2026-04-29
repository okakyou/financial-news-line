export interface MarketIndicator {
  name: string;
  symbol: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  unit: string;
}

type DataSource = "yahoo" | "stooq";

const INDICATORS: Array<{
  name: string;
  symbol: string;
  unit: string;
  source: DataSource;
}> = [
  { name: "日経平均", symbol: "^N225", unit: "円", source: "yahoo" },
  { name: "NYダウ", symbol: "^DJI", unit: "ドル", source: "yahoo" },
  { name: "ドル円", symbol: "USDJPY=X", unit: "円", source: "yahoo" },
  { name: "WTI原油", symbol: "CL=F", unit: "ドル", source: "yahoo" },
  { name: "日本長期金利", symbol: "10jpyb.b", unit: "%", source: "stooq" },
];

export async function fetchMarketData(): Promise<MarketIndicator[]> {
  return Promise.all(INDICATORS.map(fetchSingle));
}

async function fetchSingle(
  indicator: (typeof INDICATORS)[number],
): Promise<MarketIndicator> {
  try {
    if (indicator.source === "stooq") {
      return await fetchFromStooq(indicator);
    }
    return await fetchFromYahoo(indicator);
  } catch (err) {
    console.warn(`[Market] ${indicator.name} の取得に失敗（スキップ）: ${err}`);
    return { ...indicator, value: null, change: null, changePercent: null };
  }
}

async function fetchFromYahoo(
  indicator: (typeof INDICATORS)[number],
): Promise<MarketIndicator> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    indicator.symbol,
  )}?interval=1d&range=5d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("No result in response");

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const valid = closes.filter((v): v is number => v != null);

  if (valid.length === 0) {
    return { ...indicator, value: null, change: null, changePercent: null };
  }

  const last = valid[valid.length - 1];
  const prev = valid.length >= 2 ? valid[valid.length - 2] : undefined;
  const value: number = last ?? 0;
  const change = prev != null ? value - prev : null;
  const changePercent = prev != null ? ((value - prev) / prev) * 100 : null;

  return { ...indicator, value, change, changePercent };
}

// stooq.com CSV: Date,Open,High,Low,Close,Volume — 最新行の Close（index 4）を使う
async function fetchFromStooq(
  indicator: (typeof INDICATORS)[number],
): Promise<MarketIndicator> {
  const url = `https://stooq.com/q/l/?s=${indicator.symbol}&f=sd2t2ohlcv&e=csv`;
  const text = await fetch(url, { signal: AbortSignal.timeout(8_000) }).then(
    (r) => r.text(),
  );

  const lines = text.trim().split("\n");
  // lines[0] = header row, lines[1..] = data rows (newest last)
  const lastRow = lines[lines.length - 1]?.split(",");
  const prevRow = lines.length >= 3 ? lines[lines.length - 2]?.split(",") : undefined;

  const close = lastRow ? parseFloat(lastRow[4] ?? "") : NaN;
  if (isNaN(close)) throw new Error("stooq: invalid Close value");

  const prevClose = prevRow ? parseFloat(prevRow[4] ?? "") : NaN;
  const change = !isNaN(prevClose) ? close - prevClose : null;
  const changePercent =
    !isNaN(prevClose) ? ((close - prevClose) / prevClose) * 100 : null;

  return { ...indicator, value: close, change, changePercent };
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
  };
}
