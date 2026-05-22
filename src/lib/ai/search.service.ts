// ── search.service.ts ─────────────────────────────────────────────────────────
//
// Climate and market data fetches are now cached via DataCache.
// Climate data: 7-day TTL (historical archive barely changes).
// Market data:  24-hour TTL (prices shift daily).

import { DataCache, CACHE_TTL } from "./gateway";
import { getRedisClient } from "./gateway";

// Lazy singleton — initialised on first use
let _cache: DataCache | null = null;
async function getCache(): Promise<DataCache> {
  if (_cache) return _cache;
  const redis = await getRedisClient();
  _cache = new DataCache(redis);
  return _cache;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

// ── Web search (no cache — queries are unique per call) ───────────────────────

export async function searchWeb(
  query: string,
  maxResults = 6,
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[Search] TAVILY_API_KEY not set — skipping web search");
    return "Web search unavailable — API key not configured.";
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "advanced",
      }),
    });

    if (!response.ok) throw new Error(`Tavily error: ${response.status}`);

    const data: TavilyResponse = await response.json();
    const sections: string[] = [];

    if (data.answer) sections.push(`Summary: ${data.answer}`);
    data.results.forEach((r, i) => {
      sections.push(
        `[Source ${i + 1}] ${r.title}\n${r.content.slice(0, 1000)}`,
      );
    });

    return sections.join("\n\n");
  } catch (err) {
    console.error("[Search] Web search failed:", err);
    return "Web search temporarily unavailable.";
  }
}

// ── Market research (cached 24h) ──────────────────────────────────────────────

// ── Market research (cached 24h) ──────────────────────────────────────────────

export async function researchMarket(
  crops: string[],
  region: string,
  country: string,
): Promise<string> {
  const cache = await getCache();
  // Pass the region into the key builder
  const cacheKey = DataCache.marketKey(country, region, crops);

  const cached = await cache.get(cacheKey);
  if (cached) {
    console.info(`[Search] Market data cache hit: ${cacheKey}`);
    return cached;
  }

  const primaryCrop = crops[0] || "vegetables";
  const cropList = crops.slice(0, 5).join(", ");

  const queries = [
    `${cropList} wholesale price market trends 2024 2025 ${country} ${region}`,
    `${cropList} demand and supply analysis ${country} agricultural export statistics`,
    `cost of production for ${primaryCrop} in greenhouse ${country} 2024 2025`,
    `government subsidies and agricultural incentives for greenhouse in ${country}`,
  ];

  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const result = await searchWeb(q, 5);
        return `Query: ${q}\n${result}`;
      } catch {
        return `Query: ${q}\nSearch failed.`;
      }
    }),
  );

  const combined = results.join("\n\n---\n\n");

  await cache.set(cacheKey, combined, CACHE_TTL.MARKET_DATA);
  console.info(`[Search] Market data cached: ${cacheKey}`);

  return combined;
}

// ── Climate data (cached 7 days) ──────────────────────────────────────────────

export async function fetchClimateData(
  lat: number,
  lon: number,
): Promise<string> {
  const cache = await getCache();
  const cacheKey = DataCache.climateKey(lat, lon);

  const cached = await cache.get(cacheKey);
  if (cached) {
    console.info(`[Search] Climate data cache hit: ${cacheKey}`);
    return cached;
  }

  try {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lon.toString());
    url.searchParams.set("models", "era5");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max",
    );
    url.searchParams.set("start_date", "2022-01-01");
    url.searchParams.set("end_date", "2025-12-31");

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

    const data = await response.json();

    const monthly: Record<
      number,
      { maxTemps: number[]; minTemps: number[]; humidity: number[] }
    > = {};
    for (let m = 1; m <= 12; m++)
      monthly[m] = { maxTemps: [], minTemps: [], humidity: [] };

    data.daily.time.forEach((date: string, i: number) => {
      const month = parseInt(date.split("-")[1]);
      if (data.daily.temperature_2m_max[i] !== null)
        monthly[month].maxTemps.push(data.daily.temperature_2m_max[i]);
      if (data.daily.temperature_2m_min[i] !== null)
        monthly[month].minTemps.push(data.daily.temperature_2m_min[i]);
      if (data.daily.relative_humidity_2m_max[i] !== null)
        monthly[month].humidity.push(data.daily.relative_humidity_2m_max[i]);
    });

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const avg = (arr: number[]) =>
      arr.length
        ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
        : "N/A";

    const rows = Array.from({ length: 12 }, (_, i) => {
      const m = monthly[i + 1];
      return `| ${monthNames[i]} | ${avg(m.maxTemps)}°C | ${avg(m.minTemps)}°C | ${avg(m.humidity)}% |`;
    });

    const result =
      `| Month | Avg Max Temp | Avg Min Temp | Avg Max Humidity |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      rows.join("\n");

    await cache.set(cacheKey, result, CACHE_TTL.CLIMATE_DATA);
    console.info(`[Search] Climate data cached: ${cacheKey}`);

    return result;
  } catch (err) {
    console.error("[Climate] Failed to fetch climate data:", err);
    return "Climate data unavailable — manual entry required.";
  }
}
