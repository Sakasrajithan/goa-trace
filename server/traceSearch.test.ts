import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeResults, searchSources } from "./traceSearch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("trace search adapter", () => {
  it("normalizes provider results without inventing missing metadata", () => {
    expect(normalizeResults([
      { link: "https://example.com/post", title: "A source", platform: "Web", similarity: 0.948 },
      { title: "Missing URL" },
    ])).toEqual([
      { url: "https://example.com/post", title: "A source", platform: "Web", similarity: 0.948 },
    ]);
  });

  it("reports a configuration error when no provider is configured", async () => {
    vi.stubEnv("SEARCH_API_URL", "");
    vi.stubEnv("SEARCH_API_KEY", "");

    await expect(searchSources({ query: "face source discovery" })).resolves.toMatchObject({
      status: "search_configuration_error",
      provider: "NONE CONFIGURED",
      results: [],
    });
  });

  it("returns actual provider results and preserves an empty result set", async () => {
    vi.stubEnv("SEARCH_API_URL", "https://search.example.test/query");
    vi.stubEnv("SEARCH_API_KEY", "server-only-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ url: "https://example.com/real-result", title: "Returned source", snippet: "Provider response" }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    await expect(searchSources({ query: "face source discovery" })).resolves.toMatchObject({
      status: "search_complete",
      results: [{ url: "https://example.com/real-result", title: "Returned source", snippet: "Provider response" }],
    });
    expect(fetch).toHaveBeenCalledWith("https://search.example.test/query", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer server-only-test-key" }),
    }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })));
    await expect(searchSources({ query: "no match" })).resolves.toMatchObject({
      status: "no_matches_found",
      results: [],
    });
  });
});
