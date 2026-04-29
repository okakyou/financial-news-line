export interface FinancialSettings {
  rss: {
    lookbackHours: number;
    maxArticles: number;
    timeoutMs: number;
  };
  analysis: {
    model: string;
    temperature: number;
  };
  report: {
    /** GitHub Pages の公開 URL。空文字のとき CTA は Yahoo!ニュースにフォールバック */
    pagesUrl: "https://okakyou.github.io/AI-news/report.html",
  };
}

export const financialSettings: FinancialSettings = {
  rss: {
    lookbackHours: 20,
    maxArticles: 30,
    timeoutMs: 10_000,
  },
  analysis: {
    model: "gemini-2.5-flash",
    temperature: 0,
  },
  report: {
    pagesUrl: "https://okakyou.github.io/AI-news/report.html",
  },
};
