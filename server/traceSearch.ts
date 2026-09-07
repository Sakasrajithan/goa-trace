import type {
  TraceSearchRequest,
  TraceSearchResponse,
  TraceSearchResult,
} from "@shared/trace";
import { enrichAndRankCandidates } from "./candidateAnalysis";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_TIMEOUT_MS = 15_000;

export type SearchProvider = {
  name: string;
  searchWeb: (request: TraceSearchRequest) => Promise<TraceSearchResult[]>;
};

type SearchFailureKind =
  | "search_authentication_error"
  | "search_rate_limited"
  | "search_provider_error"
  | "search_request_failed"
  | "search_request_timed_out";

class SearchProviderError extends Error {
  constructor(public readonly kind: SearchFailureKind, message: string, public readonly httpStatus?: number) {
    super(message);
    this.name = "SearchProviderError";
  }
}

function safeProviderDetail(raw: string, apiKey: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const detail = [parsed.error, parsed.message, parsed.detail].find((value) => typeof value === "string") as string | undefined;
    raw = detail || raw;
  } catch {
    // Keep the raw provider text when Tavily does not return JSON.
  }
  return raw
    .replaceAll(apiKey, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/tvly-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 240);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeResult(input: unknown): TraceSearchResult | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const url = nullableString(record.url);
  if (!url || !/^https?:\/\//i.test(url)) return null;

  return {
    url,
    title: nullableString(record.title),
    platform: null,
    author: null,
    publishedAt: null,
    imageUrl: null,
    // Tavily's score is search relevance, not face similarity.
    similarity: null,
    searchRelevance: typeof record.score === "number" && Number.isFinite(record.score) ? record.score : null,
    faceStatus: "FACE_NOT_ANALYZED",
    faceStatusMessage: "FACE NOT ANALYZED",
    snippet: nullableString(record.content) || nullableString(record.raw_content),
  };
}

export function normalizeResults(input: unknown): TraceSearchResult[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeResult).filter((item): item is TraceSearchResult => Boolean(item));
}

function createTimeoutSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  return { controller, timeout };
}

function getConfiguredProvider(): SearchProvider | null {
  const apiKey = process.env.SEARCH_API_KEY?.trim();
  if (!apiKey) return null;

  const endpoint = process.env.SEARCH_API_URL?.trim() || TAVILY_ENDPOINT;
  return {
    name: "TAVILY",
    async searchWeb(request) {
      const { controller, timeout } = createTimeoutSignal();
      try {
        const query = [request.query, ...(request.sourceHints ?? [])]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(" ") || "face source discovery";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            query,
            search_depth: "advanced",
            max_results: 10,
            include_answer: false,
            include_raw_content: true,
          }),
        });

        if (!response.ok) {
          const providerBody = await response.text();
          const detail = safeProviderDetail(providerBody, apiKey);
          if (response.status === 401 || response.status === 403) {
            throw new SearchProviderError("search_authentication_error", `Tavily rejected the server credential with HTTP ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
          }
          if (response.status === 429) {
            throw new SearchProviderError("search_rate_limited", `Tavily rate limit reached with HTTP ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
          }
          if (response.status >= 500) {
            throw new SearchProviderError("search_provider_error", `Tavily provider error with HTTP ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
          }
          throw new SearchProviderError("search_request_failed", `Tavily returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
        }

        const body = (await response.json()) as { results?: unknown };
        return normalizeResults(body.results);
      } catch (error) {
        if (error instanceof SearchProviderError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new SearchProviderError("search_request_timed_out", "SEARCH REQUEST TIMED OUT. Tavily did not respond within 15 seconds.");
        }
        if (error instanceof Error && error.name === "AbortError") {
          throw new SearchProviderError("search_request_timed_out", "SEARCH REQUEST TIMED OUT. Tavily did not respond within 15 seconds.");
        }
        throw new SearchProviderError("search_request_failed", error instanceof Error ? error.message : "Unknown Tavily request failure");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

const statusMessages: Record<SearchFailureKind, string> = {
  search_authentication_error: "SEARCH AUTHENTICATION ERROR. Tavily rejected the server credential.",
  search_rate_limited: "SEARCH RATE LIMITED. Tavily requested a retry later.",
  search_provider_error: "SEARCH PROVIDER ERROR. Tavily returned a server-side failure.",
  search_request_failed: "SEARCH REQUEST FAILED. Check the Tavily response and server logs.",
  search_request_timed_out: "SEARCH REQUEST TIMED OUT. Tavily did not respond within 15 seconds.",
};

export async function searchSources(request: TraceSearchRequest): Promise<TraceSearchResponse> {
  const provider = getConfiguredProvider();
  if (!provider) {
    return {
      status: "search_configuration_error",
      provider: "TAVILY / NOT CONFIGURED",
      message: "SOURCE DISCOVERY IS NOT CONFIGURED. Set SEARCH_API_KEY server-side.",
      results: [],
    };
  }

  try {
    const results = await enrichAndRankCandidates(await provider.searchWeb(request), request);
    if (results.length === 0) {
      return {
        status: "no_matches_found",
        provider: provider.name,
        message: "NO MATCHING SOURCE FOUND",
        results,
      };
    }
    return { status: "search_complete", provider: provider.name, message: "SOURCE CANDIDATES FOUND", results };
  } catch (error) {
    const kind = error instanceof SearchProviderError ? error.kind : "search_request_failed";
    const providerStatus = error instanceof SearchProviderError && error.httpStatus ? ` http_status=${error.httpStatus}` : "";
    console.warn(`[Trace Search] provider=TAVILY status=${kind}${providerStatus}`);
    return {
      status: kind,
      provider: provider.name,
      message: error instanceof SearchProviderError ? error.message : statusMessages[kind],
      results: [],
    };
  }
}
