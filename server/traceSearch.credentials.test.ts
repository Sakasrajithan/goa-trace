import { describe, expect, it } from "vitest";
import { searchSources } from "./traceSearch";

describe("configured Tavily credential", () => {
  it.runIf(Boolean(process.env.SEARCH_API_KEY))("reaches Tavily without exposing the credential", async () => {
    const response = await searchSources({ query: "Tavily Search API documentation" });
    expect(["search_complete", "no_matches_found", "search_rate_limited"]).toContain(response.status);
    expect(response.provider).toBe("TAVILY");
    expect(JSON.stringify(response)).not.toContain(process.env.SEARCH_API_KEY ?? "__missing__");
  }, 20_000);
});
