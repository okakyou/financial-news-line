import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FinancialAnalysis } from "../analysis/financial-schema.js";
import type { MarketIndicator } from "../sources/market-data.js";

export async function generateHtmlReport(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
  outputPath: string,
): Promise<void> {
  const html = buildHtml(analysis, marketData);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf-8");
  console.info(`→ HTML レポートを ${outputPath} に出力しました`);
}

// ─── HTML builder ────────────────────────────────────────────

function buildHtml(
  analysis: FinancialAnalysis,
  marketData: MarketIndicator[],
): string {
  const now = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>金融市場サマリー｜${now}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", sans-serif;
      background: #f0f2f5;
      color: #222;
      min-height: 100vh;
    }

    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }

    /* ── Header ── */
    .header {
      background: #1a2744;
      border-radius: 16px 16px 0 0;
      padding: 24px 20px 20px;
    }
    .header-eyebrow {
      font-size: 12px;
      color: #aabbdd;
      letter-spacing: 0.05em;
    }
    .header-title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      margin-top: 6px;
    }
    .header-date {
      font-size: 11px;
      color: #8899bb;
      margin-top: 6px;
    }

    /* ── Body card ── */
    .card {
      background: #fff;
      border-radius: 0 0 16px 16px;
      padding: 20px;
    }

    /* ── Section heading ── */
    .section-heading {
      font-size: 13px;
      font-weight: 700;
      color: #333;
      margin-bottom: 12px;
    }

    .divider {
      border: none;
      border-top: 1px solid #e5e8ed;
      margin: 20px 0;
    }

    /* ── Market grid ── */
    .market-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
    }

    .market-tile {
      background: #f8f9fb;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .market-tile-name {
      font-size: 10px;
      color: #888;
      letter-spacing: 0.02em;
    }
    .market-tile-value {
      font-size: 16px;
      font-weight: 700;
      color: #111;
      margin-top: 4px;
      white-space: nowrap;
    }
    .market-tile-change {
      font-size: 11px;
      margin-top: 3px;
      font-weight: 600;
    }
    .up   { color: #e84040; }
    .down { color: #1967d2; }
    .flat { color: #888; }

    /* ── News list ── */
    .news-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .news-item {
      background: #f8f9fb;
      border-radius: 10px;
      padding: 14px;
    }
    .news-item-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .badge-category {
      background: #e8efff;
      color: #1967d2;
    }
    .badge-high   { background: #fdeaea; color: #e84040; }
    .badge-mid    { background: #fff4e0; color: #d08000; }
    .badge-low    { background: #e6f9ee; color: #27ae60; }

    .news-item-title {
      font-size: 14px;
      font-weight: 700;
      color: #111;
      line-height: 1.5;
      margin-bottom: 6px;
    }
    .news-item-summary {
      font-size: 12px;
      color: #555;
      line-height: 1.6;
    }
    .news-item-link {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      color: #1967d2;
      text-decoration: none;
    }
    .news-item-link:hover { text-decoration: underline; }

    /* ── Footer / comment ── */
    .market-comment {
      background: #f8f9fb;
      border-radius: 10px;
      padding: 14px;
      font-size: 13px;
      color: #444;
      line-height: 1.6;
    }

    .generated-at {
      text-align: center;
      font-size: 10px;
      color: #bbb;
      margin-top: 16px;
      padding-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-eyebrow">おはようございます！</div>
      <div class="header-title">本日の金融市場サマリー</div>
      <div class="header-date">${now}　今日もぶち上げていきましょう！</div>
    </div>

    <div class="card">
      <div class="section-heading">📊 マーケット速報</div>
      <div class="market-grid">
        ${marketData.map(renderMarketTile).join("\n        ")}
      </div>

      <hr class="divider" />

      <div class="section-heading">📰 注目ニュース</div>
      <div class="news-list">
        ${analysis.news.map((item, i) => renderNewsItem(item, i)).join("\n        ")}
      </div>

      <hr class="divider" />

      <div class="market-comment">💬 ${escapeHtml(analysis.market_comment)}</div>
    </div>

    <div class="generated-at">Generated by AI-news — ${new Date().toISOString()}</div>
  </div>
</body>
</html>`;
}

// ─── tile / item renderers ────────────────────────────────────

function renderMarketTile(indicator: MarketIndicator): string {
  const valueText =
    indicator.value != null
      ? formatValue(indicator.value, indicator.unit)
      : "取得中...";

  const changeText =
    indicator.changePercent != null
      ? `${indicator.changePercent >= 0 ? "▲" : "▼"}${Math.abs(indicator.changePercent).toFixed(2)}%`
      : "—";

  const dirClass =
    indicator.changePercent == null
      ? "flat"
      : indicator.changePercent >= 0
        ? "up"
        : "down";

  return `<div class="market-tile">
          <div class="market-tile-name">${escapeHtml(indicator.name)}</div>
          <div class="market-tile-value">${escapeHtml(valueText)}</div>
          <div class="market-tile-change ${dirClass}">${escapeHtml(changeText)}</div>
        </div>`;
}

function renderNewsItem(
  item: FinancialAnalysis["news"][number],
  index: number,
): string {
  const impactClass =
    item.impact === "高"
      ? "badge-high"
      : item.impact === "中"
        ? "badge-mid"
        : "badge-low";

  const linkHtml = item.source_url
    ? `<a class="news-item-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">記事を読む →</a>`
    : "";

  return `<div class="news-item">
          <div class="news-item-meta">
            <span class="badge badge-category">${escapeHtml(item.category)}</span>
            <span class="badge ${impactClass}">影響度：${escapeHtml(item.impact)}</span>
          </div>
          <div class="news-item-title">${index + 1}. ${escapeHtml(item.title)}</div>
          <div class="news-item-summary">${escapeHtml(item.summary)}</div>
          ${linkHtml}
        </div>`;
}

// ─── helpers ────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(3)}%`;
  if (value >= 10_000) {
    return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}${unit}`;
  }
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${unit}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
