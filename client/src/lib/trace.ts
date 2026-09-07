export type TraceCandidate = {
  platform: string;
  sourceUrl: string;
  author: string;
  publishedAt: string;
  text: string;
  imageUrl: string;
  similarity: string;
};

export function canonicalizeCandidate(candidate: TraceCandidate) {
  return [
    candidate.sourceUrl,
    candidate.text,
    candidate.author,
    candidate.platform,
    candidate.publishedAt,
    candidate.imageUrl,
  ].join("|");
}

export async function hashSha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
