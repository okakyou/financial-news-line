import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  // カンマ区切りの LINE ユーザーID（例: "U1234...,U5678..."）
  LINE_USER_IDS: z
    .string()
    .min(1)
    .transform((v) =>
      v
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
});

export type FinancialConfig = z.infer<typeof schema>;

export function loadFinancialConfig(): FinancialConfig {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(
      `[CONFIG] 環境変数の検証に失敗しました:\n${missing}\n` +
        "必要な環境変数: GEMINI_API_KEY / LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_IDS",
    );
    process.exit(1);
  }
  return result.data;
}
