import { afterEach, describe, expect, it, vi } from "vitest";
import type { TraceSearchResult } from "@shared/trace";
import { enrichAndRankCandidates, enrichCandidate, extractImageUrls } from "./candidateAnalysis";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function result(url: string, searchRelevance: number | null = 0.5): TraceSearchResult {
  return {
    url,
    title: "Candidate",
    platform: null,
    author: null,
    publishedAt: null,
    imageUrl: null,
    similarity: null,
    searchRelevance,
    faceStatus: "FACE_NOT_ANALYZED",
    faceStatusMessage: "FACE NOT ANALYZED",
    snippet: "Provider content",
  };
}

describe("candidate content and face-analysis boundary", () => {
  it("extracts public image evidence and ignores obvious decorative assets", () => {
    const urls = extractImageUrls(`
      <meta property="og:image" content="/hero.jpg">
      <img src="/logo.svg" alt="company logo" width="500" height="500">
      <img src="/portrait.webp" alt="portrait" width="640" height="480">
      <img src="/pixel.gif" width="1" height="1">
    `, "https://source.example/article");
    expect(urls).toEqual([
      "https://source.example/hero.jpg",
      "https://source.example/portrait.webp",
    ]);
  });

  it("reports source content unavailable when the page cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    await expect(enrichCandidate(result("https://source.example/missing"), { query: "source" })).resolves.toMatchObject({
      faceStatus: "SOURCE_CONTENT_UNAVAILABLE",
      faceStatusMessage: "SOURCE CONTENT UNAVAILABLE",
      similarity: null,
    });
  });

  it("does not claim a score when the page has no usable image or model adapter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html><body><p>Text only</p></body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })));
    await expect(enrichCandidate(result("https://source.example/text"), { query: "source" })).resolves.toMatchObject({
      faceStatus: "FACE_NOT_ANALYZED",
      faceStatusMessage: "FACE NOT ANALYZED",
      similarity: null,
    });
  });

  it("runs a supplied analyzer only on a downloaded candidate image and preserves its real score", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<meta property="og:image" content="/portrait.jpg">', {
        status: 200,
        headers: { "content-type": "text/html" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "3" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const compare = vi.fn().mockResolvedValue({ status: "MATCH_ANALYZED", similarity: 0.87 });

    await expect(enrichCandidate(result("https://source.example/article"), { query: "source", faceEmbedding: [0.1] }, { compare })).resolves.toMatchObject({
      imageUrl: "https://source.example/portrait.jpg",
      faceStatus: "MATCH_ANALYZED",
      faceStatusMessage: "FACE MATCH ANALYZED",
      similarity: 0.87,
    });
    expect(compare).toHaveBeenCalledWith([0.1], expect.any(Uint8Array), "https://source.example/portrait.jpg");
  });

  it("ranks actual face similarity above search relevance while keeping relevance separate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const candidates = [result("https://source.example/high-search", 0.99), result("https://source.example/low-search", 0.2)];
    const enriched = await enrichAndRankCandidates(candidates, { query: "source" });
    expect(enriched.map((item) => item.url)).toEqual([
      "https://source.example/high-search",
      "https://source.example/low-search",
    ]);
    expect(enriched[0]?.searchRelevance).toBe(0.99);
    expect(enriched[0]?.similarity).toBeNull();
  });
});
