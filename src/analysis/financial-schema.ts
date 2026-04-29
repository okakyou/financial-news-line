import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const FinancialNewsItemSchema = z.object({
  title: z.string().describe("ニュースタイトル（30文字以内）"),
  summary: z.string().describe("投資家向け要約（80文字以内）"),
  category: z.enum(["株式", "為替", "債券", "商品", "経済指標", "企業", "国際"]),
  impact: z.enum(["高", "中", "低"]),
  source_url: z.string().optional(),
});

export const FinancialAnalysisSchema = z.object({
  news: z
    .array(FinancialNewsItemSchema)
    .min(1)
    .max(5)
    .describe("重要度順に並べたニュース（最大5件）"),
  market_comment: z
    .string()
    .describe("マーケット全体の一言コメント（50文字以内）"),
});

export type FinancialAnalysis = z.infer<typeof FinancialAnalysisSchema>;

export const financialAnalysisResponseSchema = zodToJsonSchema(
  FinancialAnalysisSchema,
  { target: "openApi3", $refStrategy: "none" },
);
