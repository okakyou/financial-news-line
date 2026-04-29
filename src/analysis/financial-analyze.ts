import { GoogleGenAI } from "@google/genai";
import {
  FinancialAnalysisSchema,
  financialAnalysisResponseSchema,
  type FinancialAnalysis,
} from "./financial-schema.js";
import { FINANCIAL_ANALYSIS_PROMPT } from "./financial-prompts.js";
import type { FinancialConfig } from "../financial-config.js";
import type { FinancialSettings } from "../financial-settings.js";
import type { RawFinancialArticle } from "../sources/financial-rss.js";
import { UserFacingError } from "../utils/errors.js";

// 503/429 のとき最大3回リトライ（指数バックオフ: 10s → 20s → 40s）
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const retryable = status === 503 || status === 429;
      if (!retryable || i === attempts - 1) throw err;
      const wait = 10_000 * Math.pow(2, i);
      console.warn(`[Gemini] ${status} エラー、${wait / 1000}秒後にリトライ (${i + 1}/${attempts - 1})...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

export async function analyzeFinancialNews(
  articles: RawFinancialArticle[],
  config: FinancialConfig,
  settings: FinancialSettings,
): Promise<FinancialAnalysis> {
  console.info("[3/4] Gemini で金融ニュースを分析中...");
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const articlesForPrompt = articles.map((a) => ({
    title: a.title,
    snippet: a.snippet,
    url: a.url,
    source: a.sourceName,
    publishedAt: a.publishedAt,
  }));

  const prompt = FINANCIAL_ANALYSIS_PROMPT.replace(
    "{articles_json}",
    JSON.stringify(articlesForPrompt, null, 2),
  );

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: settings.analysis.model,
      contents: prompt,
      config: {
        temperature: settings.analysis.temperature,
        responseMimeType: "application/json",
        responseSchema: financialAnalysisResponseSchema as Record<string, unknown>,
      },
    }),
  );

  const candidate = (res as { candidates?: Array<{ finishReason?: string }> })
    .candidates?.[0];

  if (candidate?.finishReason === "SAFETY") {
    throw new UserFacingError(
      "Geminiのセーフティフィルタで分析結果がブロックされました。記事数を減らして再実行してください。",
    );
  }

  const text = res.text;
  if (!text) {
    throw new UserFacingError("Geminiから空の応答が返りました。");
  }

  try {
    return FinancialAnalysisSchema.parse(JSON.parse(text));
  } catch (cause) {
    throw new UserFacingError(
      "Geminiの応答をパースできませんでした。再実行してみてください。",
      { cause },
    );
  }
}
