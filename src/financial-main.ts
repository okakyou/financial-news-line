// ┌──────────────────────────────────────────────────────────────┐
// │  金融ニュース LINE 配信ツール — 読み順ガイド                 │
// │  この main() の4ステップを上から読めば全体が分かる。          │
// │  詳しく見たくなったら各 import 先にジャンプ。                 │
// │  設定を変えたい場合は src/financial-settings.ts を開く。      │
// └──────────────────────────────────────────────────────────────┘

import { loadFinancialConfig } from "./financial-config.js";
import { financialSettings } from "./financial-settings.js";
import { fetchFinancialNews } from "./sources/financial-rss.js";
import { fetchMarketData } from "./sources/market-data.js";
import { analyzeFinancialNews } from "./analysis/financial-analyze.js";
import { generateHtmlReport } from "./delivery/html-report.js";
import { postToLine } from "./delivery/line.js";
import { UserFacingError } from "./utils/errors.js";

async function main() {
  const config = loadFinancialConfig();

  console.info("[1/4] 金融ニュースを RSS から取得中...");
  const articles = await fetchFinancialNews(financialSettings);
  console.info(`→ 記事 ${articles.length}件 を取得`);

  console.info("[2/4] マーケットデータを取得中...");
  const marketData = await fetchMarketData();
  const fetched = marketData.filter((m) => m.value != null).length;
  console.info(`→ ${fetched}/${marketData.length} 指標を取得`);

  console.info("[3/4] Gemini で重要ニュースを分析中...");
  const analysis = await analyzeFinancialNews(articles, config, financialSettings);
  console.info(`→ ${analysis.news.length}件のニュースを選定`);

  console.info("[3.5/4] HTML レポートを生成中...");
  await generateHtmlReport(analysis, marketData, "dist/report.html");

  console.info("[4/4] LINE へ送信中...");
  await postToLine(
    analysis,
    marketData,
    config,
    financialSettings.report.pagesUrl || undefined,
  );

  console.info("すべての処理が完了しました");
}

main().catch((error: unknown) => {
  if (error instanceof UserFacingError) {
    console.error(`\n[USER-FACING] ${error.message}`);
    console.error("対処法の詳細は docs/troubleshooting.md を参照してください。");
    if (error.cause) {
      console.error("[DETAIL]", error.cause);
    }
  } else {
    console.error("\n[INTERNAL] Unexpected error:", error);
  }
  process.exit(1);
});
