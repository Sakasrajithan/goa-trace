import type {
  TraceSearchRequest,
  TraceSearchResponse,
  TraceSearchResult,
} from "@shared/trace";

export type SearchProvider = {
  name: string;
  searchWeb: (request: TraceSearchRequest) => Promise<TraceSearchResult[]>;
};

function normalizeResult(input: unknown): TraceSearchResult | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : typeof record.link === "string" ? record.link : "";
  if (!url || !/^https?:\/\//i.test(url)) return null;

  return {
    url,
    title: typeof record.title === "string" ? record.title : "Untitled source",
    platform: typeof record.platform === "string" ? record.platform : undefined,
    author: typeof record.author === "string" ? record.author : undefined,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    similarity: typeof record.similarity === "number" ? record.similarity : undefined,
    snippet: typeof record.snippet === "string" ? record.snippet : undefined,
  };
}

export function normalizeResults(input: unknown): TraceSearchResult[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeResult).filter((item): item is TraceSearchResult => Boolean(item));
}

function getConfiguredProvider(): SearchProvider | null {
  const endpoint = process.env.SEARCH_API_URL?.trim();
  const apiKey = process.env.SEARCH_API_KEY?.trim();
  if (!endpoint || !apiKey) return null;

  return {
    name: process.env.SEARCH_PROVIDER_NAME?.trim() || "CONFIGURED SEARCH PROVIDER",
    async searchWeb(request) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          faceEmbedding: request.faceEmbedding,
          query: request.query,
          sourceHints: request.sourceHints ?? [],
          imageData: request.imageData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search provider returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as { results?: unknown } | unknown[];
      return normalizeResults(Array.isArray(body) ? body : body.results);
    },
  };
}

export async function searchSources(request: TraceSearchRequest): Promise<TraceSearchResponse> {
  const provider = getConfiguredProvider();
  if (!provider) {
    return {
      status: "search_configuration_error",
      provider: "NONE CONFIGURED",
      message: "SOURCE DISCOVERY IS NOT CONFIGURED. Add SEARCH_API_URL and SEARCH_API_KEY server-side.",
      results: [],
    };
  }

  try {
    const results = await provider.searchWeb(request);
    if (results.length === 0) {
      return {
        status: "no_matches_found",
        provider: provider.name,
        message: "NO MATCHING SOURCE FOUND",
        results,
      };
    }
    return { status: "search_complete", provider: provider.name, results };
  } catch (error) {
    console.error("[Trace Search] Request failed:", error);
    return {
      status: "search_request_failed",
      provider: provider.name,
      message: "SEARCH REQUEST FAILED. Check the provider response and server logs.",
      results: [],
    };
  }
}
