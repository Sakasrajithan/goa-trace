import { describe, expect, it } from "vitest";
import { canonicalizeCandidate, hashSha256, type TraceCandidate } from "../client/src/lib/trace";

const candidate: TraceCandidate = {
  platform: "DEMO / LOCAL DATA",
  sourceUrl: "https://example.com/source-001",
  author: "archive_user",
  publishedAt: "2026-01-18",
  text: "A source note.",
  imageUrl: "data:image/svg+xml;base64,face",
  similarity: "94.8%",
};

describe("trace canonicalization", () => {
  it("keeps the same field order for reproducible proof records", () => {
    expect(canonicalizeCandidate(candidate)).toBe(
      "https://example.com/source-001|A source note.|archive_user|DEMO / LOCAL DATA|2026-01-18|data:image/svg+xml;base64,face",
    );
  });

  it("produces the same SHA-256 fingerprint for the same content", async () => {
    const canonical = canonicalizeCandidate(candidate);
    const first = await hashSha256(canonical);
    const second = await hashSha256(canonical);

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it("changes the fingerprint when canonical content changes", async () => {
    const original = await hashSha256(canonicalizeCandidate(candidate));
    const changed = await hashSha256(canonicalizeCandidate({ ...candidate, text: "A changed source note." }));

    expect(changed).not.toBe(original);
  });
});
