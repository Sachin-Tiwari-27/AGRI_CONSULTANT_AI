// Live market research via Tavily API
// Used during report generation to pull current crop prices and market data

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

export async function searchWeb(
  query: string,
  maxResults = 5,
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

    // Format results as clean text for injection into prompts
    const sections: string[] = [];

    if (data.answer) {
      sections.push(`Summary: ${data.answer}`);
    }

    data.results.forEach((r, i) => {
      sections.push(`[Source ${i + 1}] ${r.title}\n${r.content.slice(0, 500)}`);
    });

    return sections.join("\n\n");
  } catch (err) {
    console.error("[Search] Web search failed:", err);
    return "Web search temporarily unavailable.";
  }
}

// Convenience: run multiple searches and combine results
export async function researchMarket(
  crops: string[],
  region: string,
  country: string,
): Promise<string> {
  const queries = [
    `${crops.join(", ")} wholesale price ${country} 2025`,
    `vegetable import statistics ${country} ${region} 2025`,
    `greenhouse farming ${country} market opportunity`,
    `${crops[0]} production demand ${region} GCC`,
  ];

  const results = await Promise.allSettled(queries.map((q) => searchWeb(q, 3)));

  return results
    .map((r, i) => {
      if (r.status === "fulfilled") return `Query: ${queries[i]}\n${r.value}`;
      return `Query: ${queries[i]}\nSearch failed.`;
    })
    .join("\n\n---\n\n");
}

// Fetch live climate data from Open-Meteo (free, no key needed)
export async function fetchClimateData(
  lat: number,
  lon: number,
): Promise<string> {
  try {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lon.toString());
    url.searchParams.set("models", "EC_Earth3P_HR");
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_max",
    );
    url.searchParams.set("start_date", "2020-01-01");
    url.searchParams.set("end_date", "2025-12-31");

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

    const data = await response.json();

    // Aggregate to monthly averages for prompt injection
    const monthly: Record<
      number,
      { maxTemps: number[]; minTemps: number[]; humidity: number[] }
    > = {};
    for (let m = 1; m <= 12; m++)
      monthly[m] = { maxTemps: [], minTemps: [], humidity: [] };

    data.daily.time.forEach((date: string, i: number) => {
      const month = parseInt(date.split("-")[1]);
      if (data.daily.temperature_2m_max[i])
        monthly[month].maxTemps.push(data.daily.temperature_2m_max[i]);
      if (data.daily.temperature_2m_min[i])
        monthly[month].minTemps.push(data.daily.temperature_2m_min[i]);
      if (data.daily.relative_humidity_2m_max[i])
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
      return `${monthNames[i]}: max ${avg(m.maxTemps)}°C, min ${avg(m.minTemps)}°C, humidity ${avg(m.humidity)}%`;
    });

    return rows.join("\n");
  } catch (err) {
    console.error("[Climate] Failed to fetch climate data:", err);
    return "Climate data unavailable — manual entry required.";
  }
}
