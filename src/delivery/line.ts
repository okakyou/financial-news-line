import type { FinancialConfig } from "../financial-config.js";
import type { FinancialAnalysis } from "../analysis/financial-schema.js";
import type { MarketIndicator } from "../sources/market-data.js";
import { UserFacingError } from "../utils/errors.js";

const LINE_API_BASE = "https://api.line.me/v2/bot/message";

// ─── public API ─────────────────────────────────────────────

export async function postToLine(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
  config: FinancialConfig,
  pagesUrl?: string,
): Promise<void> {
  const message = buildFlexMessage(analysis, marketData, pagesUrl);
  const userIds = config.LINE_USER_IDS;

  const firstId = userIds[0];
  if (userIds.length === 1 && firstId) {
    await pushMessage(firstId, [message], config.LINE_CHANNEL_ACCESS_TOKEN);
  } else {
    await multicastMessage(userIds, [message], config.LINE_CHANNEL_ACCESS_TOKEN);
  }

  console.info(`LINE 送信完了 (${userIds.length}名)`);
}

// ─── LINE API calls ──────────────────────────────────────────

async function pushMessage(
  to: string,
  messages: LineMessage[],
  token: string,
): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/push`, {
    method: "POST",
    headers: lineHeaders(token),
    body: JSON.stringify({ to, messages }),
  });
  await assertLineOk(res, "push");
}

async function multicastMessage(
  to: string[],
  messages: LineMessage[],
  token: string,
): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/multicast`, {
    method: "POST",
    headers: lineHeaders(token),
    body: JSON.stringify({ to, messages }),
  });
  await assertLineOk(res, "multicast");
}

// ─── Flex Message builder ────────────────────────────────────

function buildFlexMessage(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
  pagesUrl?: string,
): LineFlexMessage {
  return {
    type: "flex",
    altText: `本日の金融市場サマリー｜${analysis.market_comment}`,
    contents: buildBubble(analysis, marketData, pagesUrl),
  };
}

function buildBubble(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
  pagesUrl?: string,
): FlexBubble {
  return {
    type: "bubble",
    size: "giga",
    header: buildHeader(),
    body: buildBody(analysis, marketData),
    footer: buildFooter(analysis, pagesUrl),
    styles: {
      header: { backgroundColor: "#1a2744" },
      footer: { backgroundColor: "#f5f7fa" },
    },
  };
}

function buildHeader(): FlexBox {
  const now = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return {
    type: "box",
    layout: "vertical",
    paddingAll: "20px",
    contents: [
      {
        type: "text",
        text: "おはようございます！",
        color: "#aabbdd",
        size: "sm",
      },
      {
        type: "text",
        text: "本日の金融市場サマリー",
        color: "#ffffff",
        size: "xl",
        weight: "bold",
        margin: "sm",
      },
      {
        type: "text",
        text: `${now}｜今日もぶち上げていきましょう！`,
        color: "#8899bb",
        size: "xs",
        margin: "sm",
        wrap: true,
      },
    ],
  };
}

function buildBody(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    spacing: "lg",
    contents: [
      buildMarketSection(marketData),
      buildSeparator(),
      buildNewsSection(analysis),
    ],
  };
}

function buildMarketSection(marketData: MarketIndicator[]): FlexBox {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: "📊 マーケット速報",
        size: "sm",
        weight: "bold",
        color: "#333333",
      },
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: marketData.map(buildMarketRow),
      },
    ],
  };
}

function buildMarketRow(indicator: MarketIndicator): FlexBox {
  const valueText =
    indicator.value != null
      ? formatValue(indicator.value, indicator.unit)
      : "取得中...";

  const changeText =
    indicator.changePercent != null
      ? `${indicator.changePercent >= 0 ? "▲" : "▼"}${Math.abs(indicator.changePercent).toFixed(2)}%`
      : "";

  const isPositive = (indicator.changePercent ?? 0) >= 0;
  const changeColor = indicator.changePercent == null
    ? "#888888"
    : isPositive
      ? "#e84040"
      : "#1967d2";

  return {
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: indicator.name,
        size: "xs",
        color: "#666666",
        flex: 3,
      },
      {
        type: "text",
        text: valueText,
        size: "xs",
        color: "#222222",
        weight: "bold",
        align: "end",
        flex: 4,
      },
      {
        type: "text",
        text: changeText,
        size: "xs",
        color: changeColor,
        align: "end",
        flex: 3,
      },
    ],
  };
}

function buildSeparator(): FlexSeparator {
  return { type: "separator", color: "#e5e8ed" };
}

function buildNewsSection(analysis: FinancialAnalysis): FlexBox {
  const topNews = analysis.news.slice(0, 3);

  return {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      {
        type: "text",
        text: "📰 注目ニュース",
        size: "sm",
        weight: "bold",
        color: "#333333",
      },
      ...topNews.map(buildNewsItem),
    ],
  };
}

function buildNewsItem(
  item: FinancialAnalysis["news"][number],
  index: number,
): FlexBox {
  const impactColor =
    item.impact === "高" ? "#e84040" : item.impact === "中" ? "#f0a500" : "#27ae60";

  // LINE は https:// または http:// で始まる URI のみ受け付ける
  const validUrl =
    item.source_url?.startsWith("https://") || item.source_url?.startsWith("http://")
      ? item.source_url
      : undefined;

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    paddingAll: "12px",
    backgroundColor: "#f8f9fb",
    cornerRadius: "8px",
    action: validUrl
      ? { type: "uri", label: "記事を開く", uri: validUrl }
      : undefined,
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `[${item.category}]`,
            size: "xxs",
            color: "#1967d2",
            flex: 0,
          },
          {
            type: "text",
            text: `影響度：${item.impact}`,
            size: "xxs",
            color: impactColor,
            flex: 0,
          },
        ],
      },
      {
        type: "text",
        text: `${index + 1}. ${item.title}`,
        size: "sm",
        weight: "bold",
        color: "#111111",
        wrap: true,
      },
      {
        type: "text",
        text: item.summary,
        size: "xs",
        color: "#555555",
        wrap: true,
      },
    ],
  };
}

function buildFooter(analysis: FinancialAnalysis, pagesUrl?: string): FlexBox {
  const fallbackUrl =
    analysis.news
      .map((n) => n.source_url)
      .find((url): url is string => !!url) ??
    "https://news.yahoo.co.jp/topics/business";

  const ctaUri = pagesUrl || fallbackUrl;

  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: `💬 ${analysis.market_comment}`,
        size: "xs",
        color: "#555555",
        wrap: true,
      },
      {
        type: "button",
        style: "primary",
        color: "#1a2744",
        height: "sm",
        action: {
          type: "uri",
          label: `全記事を見る（${analysis.news.length}件）`,
          uri: ctaUri,
        },
      },
    ],
  };
}

// ─── helpers ────────────────────────────────────────────────

function lineHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function assertLineOk(res: Response, endpoint: string): Promise<void> {
  if (res.ok) return;

  let errorCode: string | undefined;
  try {
    const body = (await res.json()) as { message?: string };
    errorCode = body.message;
  } catch {
    // ignore JSON parse failure
  }

  const msg =
    res.status === 401
      ? "LINE_CHANNEL_ACCESS_TOKEN が無効です。LINE Developers コンソールで確認してください。"
      : res.status === 400
        ? `LINE APIリクエストが不正です（${errorCode ?? "不明"}）。LINE_USER_IDS を確認してください。`
        : `LINE ${endpoint} 送信に失敗: HTTP ${res.status} ${errorCode ?? ""}`;

  throw new UserFacingError(msg);
}

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(3)}%`;
  if (value >= 10_000) {
    return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}${unit}`;
  }
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${unit}`;
}

// ─── LINE type definitions ───────────────────────────────────

type LineMessage = LineFlexMessage;

interface LineFlexMessage {
  type: "flex";
  altText: string;
  contents: FlexBubble;
}

interface FlexBubble {
  type: "bubble";
  size?: string;
  header?: FlexBox;
  body?: FlexBox;
  footer?: FlexBox;
  styles?: Record<string, { backgroundColor?: string }>;
}

interface FlexBox {
  type: "box";
  layout: "vertical" | "horizontal";
  contents: FlexComponent[];
  spacing?: string;
  paddingAll?: string;
  backgroundColor?: string;
  cornerRadius?: string;
  action?: FlexAction;
  flex?: number;
}

interface FlexSeparator {
  type: "separator";
  color?: string;
}

interface FlexText {
  type: "text";
  text: string;
  size?: string;
  weight?: string;
  color?: string;
  wrap?: boolean;
  align?: string;
  flex?: number;
  margin?: string;
}

interface FlexButton {
  type: "button";
  style?: string;
  color?: string;
  height?: string;
  action: FlexAction;
}

interface FlexAction {
  type: "uri";
  label: string;
  uri: string;
}

type FlexComponent = FlexBox | FlexSeparator | FlexText | FlexButton;
