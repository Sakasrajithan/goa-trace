import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeResults, searchSources } from "./traceSearch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function providerResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Tavily trace search adapter", () => {
  it("normalizes provider results without inventing source metadata or face similarity", () => {
    expect(normalizeResults([
      { url: "https://example.com/post", title: "A source", content: "Provider content", score: 0.948 },
      { title: "Missing URL" },
    ])).toEqual([
      {
        url: "https://example.com/post",
        title: "A source",
        platform: null,
        author: null,
        publishedAt: null,
        imageUrl: null,
        similarity: null,
        searchRelevance: 0.948,
        faceStatus: "FACE_NOT_ANALYZED",
        faceStatusMessage: "FACE NOT ANALYZED",
        snippet: "Provider content",
      },
    ]);
  });

  it("reports a configuration error when no Tavily key is configured", async () => {
    vi.stubEnv("SEARCH_API_URL", "");
    vi.stubEnv("SEARCH_API_KEY", "");

    await expect(searchSources({ query: "face source discovery" })).resolves.toMatchObject({
      status: "search_configuration_error",
      provider: "TAVILY / NOT CONFIGURED",
      message: "SOURCE DISCOVERY IS NOT CONFIGURED. Set SEARCH_API_KEY server-side.",
      results: [],
    });
  });

  it("calls Tavily with its real request shape and returns actual normalized candidates", async () => {
    vi.stubEnv("SEARCH_API_URL", "https://api.tavily.com/search");
    vi.stubEnv("SEARCH_API_KEY", "server-only-test-key");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse({
      results: [{ url: "https://example.com/real-result", title: "Returned source", content: "Provider response" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchSources({ query: "face source discovery", sourceHints: ["uploaded.png"] })).resolves.toMatchObject({
      status: "search_complete",
      provider: "TAVILY",
      message: "SOURCE CANDIDATES FOUND",
      results: [{ url: "https://example.com/real-result", title: "Returned source", similarity: null }],
    });

    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://api.tavily.com/search");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      api_key: "server-only-test-key",
      query: "face source discovery uploaded.png",
      search_depth: "advanced",
      max_results: 10,
      include_answer: false,
      include_raw_content: true,
    });
  });

  it("distinguishes empty results, authentication, and rate-limit responses", async () => {
    vi.stubEnv("SEARCH_API_URL", "https://api.tavily.com/search");
    vi.stubEnv("SEARCH_API_KEY", "server-only-test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse({ results: [] }))
      .mockResolvedValueOnce(providerResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(providerResponse({ error: "rate limited" }, 429));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchSources({ query: "no match" })).resolves.toMatchObject({ status: "no_matches_found", results: [] });
    await expect(searchSources({ query: "bad key" })).resolves.toMatchObject({ status: "search_authentication_error", results: [] });
    await expect(searchSources({ query: "too many" })).resolves.toMatchObject({ status: "search_rate_limited", results: [] });
  });

  it("classifies an aborted provider request as a timeout", async () => {
    vi.stubEnv("SEARCH_API_URL", "https://api.tavily.com/search");
    vi.stubEnv("SEARCH_API_KEY", "server-only-test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })));

    await expect(searchSources({ query: "slow response" })).resolves.toMatchObject({
      status: "search_request_timed_out",
      message: "SEARCH REQUEST TIMED OUT. Tavily did not respond within 15 seconds.",
      results: [],
    });
  });
});
