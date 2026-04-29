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
  maxResults = 6, // Back to 6 for better depth
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
        search_depth: "advanced", // Back to advanced for deep detail
      }),
    });

    if (!response.ok) throw new Error(`Tavily error: ${response.status}`);

    const data: TavilyResponse = await response.json();

    const sections: string[] = [];

    if (data.answer) {
      sections.push(`Summary: ${data.answer}`);
    }

    // Increase snippet length to 1000 chars for richer detail
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

/**
 * Run market research with 2 targeted queries instead of 4 parallel ones.
 * This halves the number of external API calls and reduces prompt context size.
 */
export async function researchMarket(
  crops: string[],
  region: string,
  country: string,
): Promise<string> {
  const primaryCrop = crops[0] || "vegetables";
  const cropList = crops.slice(0, 5).join(", ");
  // Four focused queries for deep coverage
  const queries = [
    `${cropList} wholesale price market trends 2024 2025 ${country} ${region}`,
    `${cropList} demand and supply analysis ${country} agricultural export statistics`,
    `cost of production for ${primaryCrop} in greenhouse ${country} 2024 2025`,
    `government subsidies and agricultural incentives for greenhouse in ${country}`,
  ];

  // Parallel execution for deeper and faster research
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const result = await searchWeb(q, 5);
        return `Query: ${q}\n${result}`;
      } catch {
        return `Query: ${q}\nSearch failed.`;
      }
    })
  );

  return results.join("\n\n---\n\n");
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

    return `| Month | Avg Max Temp | Avg Min Temp | Avg Max Humidity |\n| :--- | :--- | :--- | :--- |\n${rows.join("\n")}`;
  } catch (err) {
    console.error("[Climate] Failed to fetch climate data:", err);
    return "Climate data unavailable — manual entry required.";
  }
}
