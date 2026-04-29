import Parser from "rss-parser";
import { UserFacingError } from "../utils/errors.js";
import type { FinancialSettings } from "../financial-settings.js";

export interface RawFinancialArticle {
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  snippet: string;
}

const RSS_FEEDS = [
  {
    name: "NHK経済",
    url: "https://www3.nhk.or.jp/rss/news/cat6.xml",
  },
  {
    name: "産経ニュース 経済",
    url: "https://www.sankei.com/rss/economy.xml",
  },
  {
    name: "朝日新聞 経済",
    url: "https://www.asahi.com/rss/asahi/money.rdf",
  },
  {
    name: "Yahoo!ニュース 経済",
    url: "https://news.yahoo.co.jp/rss/topics/business.xml",
  },
];

export async function fetchFinancialNews(
  settings: FinancialSettings,
): Promise<RawFinancialArticle[]> {
  const parser = new Parser({ timeout: settings.rss.timeoutMs });
  const cutoff = Date.now() - settings.rss.lookbackHours * 60 * 60 * 1000;
  const results: RawFinancialArticle[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items) {
        const pubTime = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        if (pubTime < cutoff) continue;

        results.push({
          title: item.title ?? "",
          url: item.link ?? "",
          publishedAt: item.pubDate ?? new Date().toISOString(),
          sourceName: feed.name,
          snippet: item.contentSnippet ?? item.content ?? "",
        });
      }
      console.info(`  → ${feed.name}: ${parsed.items.length}件`);
    } catch (err) {
      console.warn(`[RSS] ${feed.name} の取得に失敗（スキップ）: ${err}`);
    }
  }

  if (results.length === 0) {
    throw new UserFacingError(
      "すべてのRSSフィードからニュースを取得できませんでした。ネットワーク接続を確認してください。",
    );
  }

  return results.slice(0, settings.rss.maxArticles);
}
