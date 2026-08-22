export type SeedSource = {
  sector: string;
  name: string;
  rssUrl: string;
  weight: number;
};

// Every feed below was verified to return valid RSS with at least one item
// before being committed here. Reuters feeds (feeds.reuters.com) were dropped
// across all sectors — that domain no longer resolves; Reuters retired public RSS.
export const seedSources: SeedSource[] = [
  // Business
  { sector: "Business", name: "Economic Times - Markets", rssUrl: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", weight: 3 },
  { sector: "Business", name: "Livemint - Companies", rssUrl: "https://www.livemint.com/rss/companies", weight: 3 },
  { sector: "Business", name: "Business Standard - Latest", rssUrl: "https://www.business-standard.com/rss/latest.rss", weight: 3 },
  { sector: "Business", name: "Moneycontrol - Business", rssUrl: "https://www.moneycontrol.com/rss/business.xml", weight: 3 },
  { sector: "Business", name: "BBC Business", rssUrl: "https://feeds.bbci.co.uk/news/business/rss.xml", weight: 2 },
  { sector: "Business", name: "Financial Times - Companies", rssUrl: "https://www.ft.com/companies?format=rss", weight: 2 },
  { sector: "Business", name: "CNBC Business", rssUrl: "https://www.cnbc.com/id/10001147/device/rss/rss.html", weight: 2 },

  // Technology
  { sector: "Technology", name: "Economic Times - Tech", rssUrl: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms", weight: 3 },
  { sector: "Technology", name: "Livemint - Technology", rssUrl: "https://www.livemint.com/rss/technology", weight: 3 },
  { sector: "Technology", name: "Inc42", rssUrl: "https://inc42.com/feed/", weight: 3 },
  { sector: "Technology", name: "TechCrunch", rssUrl: "https://techcrunch.com/feed/", weight: 2 },
  { sector: "Technology", name: "The Verge", rssUrl: "https://www.theverge.com/rss/index.xml", weight: 2 },
  { sector: "Technology", name: "Ars Technica", rssUrl: "https://feeds.arstechnica.com/arstechnica/index", weight: 2 },
  { sector: "Technology", name: "Wired", rssUrl: "https://www.wired.com/feed/rss", weight: 1 },

  // Healthcare
  { sector: "Healthcare", name: "Economic Times - Health", rssUrl: "https://health.economictimes.indiatimes.com/rss/topstories", weight: 3 },
  { sector: "Healthcare", name: "The Hindu - Health", rssUrl: "https://www.thehindu.com/sci-tech/health/feeder/default.rss", weight: 3 },
  { sector: "Healthcare", name: "Times of India - Health", rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/3908999.cms", weight: 3 },
  { sector: "Healthcare", name: "Indian Express - Health", rssUrl: "https://indianexpress.com/section/lifestyle/health/feed/", weight: 3 },
  { sector: "Healthcare", name: "Hindustan Times - Health", rssUrl: "https://www.hindustantimes.com/feeds/rss/lifestyle/health/rssfeed.xml", weight: 2 },
  { sector: "Healthcare", name: "Livemint - Science/Health", rssUrl: "https://www.livemint.com/rss/science", weight: 2 },
  { sector: "Healthcare", name: "STAT News", rssUrl: "https://www.statnews.com/feed/", weight: 1 },
  { sector: "Healthcare", name: "WHO News", rssUrl: "https://www.who.int/rss-feeds/news-english.xml", weight: 1 },

  // Finance
  { sector: "Finance", name: "Economic Times - Markets/Stocks", rssUrl: "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms", weight: 3 },
  { sector: "Finance", name: "Moneycontrol - Markets", rssUrl: "https://www.moneycontrol.com/rss/marketreports.xml", weight: 3 },
  { sector: "Finance", name: "Livemint - Markets", rssUrl: "https://www.livemint.com/rss/markets", weight: 3 },
  { sector: "Finance", name: "Business Standard - Finance", rssUrl: "https://www.business-standard.com/rss/finance-103.rss", weight: 2 },
  { sector: "Finance", name: "CNBC Finance", rssUrl: "https://www.cnbc.com/id/10000664/device/rss/rss.html", weight: 2 },
  { sector: "Finance", name: "Investing.com News", rssUrl: "https://www.investing.com/rss/news.rss", weight: 1 },
  { sector: "Finance", name: "Yahoo Finance", rssUrl: "https://finance.yahoo.com/news/rssindex", weight: 1 },

  // Politics & Policy
  { sector: "Politics & Policy", name: "The Hindu - National", rssUrl: "https://www.thehindu.com/news/national/feeder/default.rss", weight: 3 },
  { sector: "Politics & Policy", name: "Livemint - Politics", rssUrl: "https://www.livemint.com/rss/politics", weight: 3 },
  { sector: "Politics & Policy", name: "Economic Times - Policy", rssUrl: "https://economictimes.indiatimes.com/news/economy/policy/rssfeeds/1286551815.cms", weight: 3 },
  { sector: "Politics & Policy", name: "Indian Express - India", rssUrl: "https://indianexpress.com/section/india/feed/", weight: 3 },
  { sector: "Politics & Policy", name: "PIB India - Press Releases", rssUrl: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", weight: 2 },
  { sector: "Politics & Policy", name: "BBC Politics", rssUrl: "https://feeds.bbci.co.uk/news/politics/rss.xml", weight: 1 },
  { sector: "Politics & Policy", name: "Al Jazeera - Politics", rssUrl: "https://www.aljazeera.com/xml/rss/all.xml", weight: 1 },
];
