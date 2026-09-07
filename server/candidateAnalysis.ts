import type { FaceAnalysisStatus, TraceSearchRequest, TraceSearchResult } from "@shared/trace";

const PAGE_TIMEOUT_MS = 8_000;
const IMAGE_TIMEOUT_MS = 8_000;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_CANDIDATE_IMAGES = 5;

export type FaceComparison = {
  status: Extract<FaceAnalysisStatus, "MATCH_ANALYZED" | "FACE_NOT_FOUND" | "FACE_NOT_ANALYZED">;
  similarity: number | null;
};

export type CandidateFaceAnalyzer = {
  compare: (scannedEmbedding: unknown, imageBytes: Uint8Array, imageUrl: string) => Promise<FaceComparison>;
};

export type CandidateContent = {
  html: string;
  imageUrls: string[];
};

function isPrivateOrLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d+)\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

export function isSafePublicUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password && !isPrivateOrLocalHost(parsed.hostname);
  } catch {
    return false;
  }
}

function withTimeout(milliseconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return { controller, timeout };
}

async function readLimitedText(response: Response, limit: number) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > limit) throw new Error("source too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new Error("source too large");
  return new TextDecoder().decode(bytes);
}

export async function fetchSourceContent(url: string): Promise<CandidateContent | null> {
  if (!isSafePublicUrl(url)) return null;
  const { controller, timeout } = withTimeout(PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "GoaTrace/1.0 provenance research; public source preview",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok || response.type === "opaqueredirect" || !/^https?:$/i.test(new URL(response.url || url).protocol)) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return null;
    const html = await readLimitedText(response, MAX_PAGE_BYTES);
    return { html, imageUrls: extractImageUrls(html, url) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function attribute(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function looksIrrelevant(value: string) {
  return /(?:logo|favicon|sprite|tracking|pixel|placeholder|decorative|spacer|icon(?:s)?(?:[./_-]|$))/i.test(value);
}

function addImageUrl(set: Set<string>, value: string, sourceUrl: string, context = "") {
  if (!value || value.startsWith("data:") || looksIrrelevant(`${value} ${context}`)) return;
  try {
    const resolved = new URL(value, sourceUrl).toString();
    if (!isSafePublicUrl(resolved)) return;
    set.add(resolved);
  } catch {
    // Ignore malformed or non-public asset URLs.
  }
}

export function extractImageUrls(html: string, sourceUrl: string) {
  const urls = new Set<string>();
  const metaPattern = /<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*>/gi;
  for (const match of Array.from(html.matchAll(metaPattern))) addImageUrl(urls, attribute(match[0], "content"), sourceUrl, match[0]);

  const imagePattern = /<img\b([^>]*)>/gi;
  for (const match of Array.from(html.matchAll(imagePattern))) {
    const attributes = match[1] || "";
    const width = Number(attribute(attributes, "width") || 0);
    const height = Number(attribute(attributes, "height") || 0);
    if ((width > 0 && width < 64) || (height > 0 && height < 64)) continue;
    const context = `${attribute(attributes, "alt")} ${attribute(attributes, "class")} ${attribute(attributes, "id")} ${attributes}`;
    addImageUrl(urls, attribute(attributes, "src") || attribute(attributes, "data-src"), sourceUrl, context);
    const srcset = attribute(attributes, "srcset") || attribute(attributes, "data-srcset");
    const firstSrc = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    addImageUrl(urls, firstSrc || "", sourceUrl, context);
    if (urls.size >= MAX_CANDIDATE_IMAGES) break;
  }
  return Array.from(urls).slice(0, MAX_CANDIDATE_IMAGES);
}

async function downloadCandidateImage(imageUrl: string) {
  if (!isSafePublicUrl(imageUrl)) return null;
  const { controller, timeout } = withTimeout(IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", "user-agent": "GoaTrace/1.0 provenance research" },
      redirect: "manual",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !contentType.startsWith("image/") || declaredLength > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= MAX_IMAGE_BYTES ? bytes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The face model is deliberately an adapter boundary. Until a real model is wired,
 * candidate images may be inspected and downloaded transiently, but no face score is claimed.
 */
export function getCandidateFaceAnalyzer(): CandidateFaceAnalyzer | null {
  return null;
}

export async function enrichCandidate(result: TraceSearchResult, request: TraceSearchRequest, analyzer = getCandidateFaceAnalyzer()): Promise<TraceSearchResult> {
  const content = await fetchSourceContent(result.url);
  if (!content) {
    return { ...result, imageUrl: null, similarity: null, faceStatus: "SOURCE_CONTENT_UNAVAILABLE", faceStatusMessage: "SOURCE CONTENT UNAVAILABLE" };
  }
  if (content.imageUrls.length === 0) {
    const faceStatus = analyzer ? "FACE_NOT_FOUND" : "FACE_NOT_ANALYZED";
    return { ...result, imageUrl: null, similarity: null, faceStatus, faceStatusMessage: analyzer ? "FACE NOT FOUND" : "FACE NOT ANALYZED" };
  }

  let downloadedImageUrl: string | null = null;
  for (const imageUrl of content.imageUrls) {
    const imageBytes = await downloadCandidateImage(imageUrl);
    if (!imageBytes) continue;
    downloadedImageUrl = imageUrl;
    if (!analyzer) {
      return { ...result, imageUrl, similarity: null, faceStatus: "FACE_NOT_ANALYZED", faceStatusMessage: "FACE NOT ANALYZED" };
    }
    const comparison = await analyzer.compare(request.faceEmbedding, imageBytes, imageUrl);
    if (comparison.status === "MATCH_ANALYZED" && typeof comparison.similarity === "number" && Number.isFinite(comparison.similarity)) {
      return { ...result, imageUrl, similarity: comparison.similarity, faceStatus: "MATCH_ANALYZED", faceStatusMessage: "FACE MATCH ANALYZED" };
    }
    if (comparison.status === "FACE_NOT_FOUND") {
      return { ...result, imageUrl, similarity: null, faceStatus: "FACE_NOT_FOUND", faceStatusMessage: "FACE NOT FOUND" };
    }
    if (comparison.status === "FACE_NOT_ANALYZED") {
      return { ...result, imageUrl, similarity: null, faceStatus: "FACE_NOT_ANALYZED", faceStatusMessage: "FACE NOT ANALYZED" };
    }
  }

  if (!downloadedImageUrl) {
    return { ...result, imageUrl: content.imageUrls[0] || null, similarity: null, faceStatus: "SOURCE_CONTENT_UNAVAILABLE", faceStatusMessage: "SOURCE CONTENT UNAVAILABLE" };
  }
  return { ...result, imageUrl: downloadedImageUrl, similarity: null, faceStatus: "FACE_NOT_FOUND", faceStatusMessage: "FACE NOT FOUND" };
}

export async function enrichAndRankCandidates(results: TraceSearchResult[], request: TraceSearchRequest) {
  const enriched: TraceSearchResult[] = [];
  for (let index = 0; index < results.length; index += 3) {
    const batch = results.slice(index, index + 3);
    enriched.push(...(await Promise.all(batch.map((result) => enrichCandidate(result, request)))));
  }
  return enriched.sort((left, right) => {
    if (left.similarity !== null && right.similarity !== null) return right.similarity - left.similarity;
    if (left.similarity !== null) return -1;
    if (right.similarity !== null) return 1;
    return (right.searchRelevance ?? -1) - (left.searchRelevance ?? -1);
  });
}
