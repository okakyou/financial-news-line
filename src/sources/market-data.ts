export interface MarketIndicator {
  name: string;
  symbol: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  unit: string;
}

type DataSource = "yahoo" | "stooq" | "mof";

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
  { name: "日本国債10年物利回り", symbol: "10Y", unit: "%", source: "mof" },
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
    if (indicator.source === "mof") {
      return await fetchFromMOF(indicator);
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

// 財務省公開CSV: Date,1Y,2Y,...,10Y,...,40Y
// 当月の国債金利を取得し最新2行から前日比を計算する
async function fetchFromMOF(
  indicator: (typeof INDICATORS)[number],
): Promise<MarketIndicator> {
  const url =
    "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv";
  const text = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8_000),
  }).then((r) => r.text());

  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);

  const headerIdx = lines.findIndex((l) => l.startsWith("Date,"));
  if (headerIdx === -1) throw new Error("MOF: header row not found");

  const headerLine = lines[headerIdx];
  if (!headerLine) throw new Error("MOF: header line missing");
  const headers = headerLine.split(",");
  const colIdx = headers.indexOf(indicator.symbol);
  if (colIdx === -1)
    throw new Error(`MOF: column "${indicator.symbol}" not found`);

  const dataRows = lines
    .slice(headerIdx + 1)
    .filter((l) => /^\d{4}\/\d+\/\d+/.test(l));

  if (dataRows.length === 0) throw new Error("MOF: no data rows");

  const lastLine = dataRows[dataRows.length - 1];
  if (!lastLine) throw new Error("MOF: last row missing");
  const lastRow = lastLine.split(",");
  const value = parseFloat(lastRow[colIdx] ?? "");
  if (isNaN(value)) throw new Error("MOF: invalid value");

  const prevLine =
    dataRows.length >= 2 ? dataRows[dataRows.length - 2] : undefined;
  const prevRow = prevLine ? prevLine.split(",") : undefined;
  const prevValue = prevRow ? parseFloat(prevRow[colIdx] ?? "") : NaN;
  const change = !isNaN(prevValue) ? value - prevValue : null;
  const changePercent =
    !isNaN(prevValue) ? ((value - prevValue) / prevValue) * 100 : null;

  return { ...indicator, value, change, changePercent };
}

// stooq.com 日足CSV: Date,Open,High,Low,Close,Volume — Close は index 4
// 直近5日分を取得して最新2行から前日比を計算する
async function fetchFromStooq(
  indicator: (typeof INDICATORS)[number],
): Promise<MarketIndicator> {
  const url = `https://stooq.com/q/d/l/?s=${indicator.symbol}&i=d`;
  const text = await fetch(url, { signal: AbortSignal.timeout(8_000) }).then(
    (r) => r.text(),
  );

  const lines = text.trim().split("\n").filter(Boolean);
  // lines[0] = header row "Date,Open,High,Low,Close,Volume"
  // lines[1..] = data rows, oldest first
  if (lines.length < 2) throw new Error("stooq: no data rows");

  const lastRow = lines[lines.length - 1]?.split(",");
  const prevRow = lines.length >= 3 ? lines[lines.length - 2]?.split(",") : undefined;

  // Date=0, Open=1, High=2, Low=3, Close=4, Volume=5
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
