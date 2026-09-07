export type TraceSearchRequest = {
  faceEmbedding?: unknown;
  query?: string;
  sourceHints?: string[];
  imageData?: string;
};

export type FaceAnalysisStatus =
  | "MATCH_ANALYZED"
  | "FACE_NOT_FOUND"
  | "SOURCE_CONTENT_UNAVAILABLE"
  | "FACE_NOT_ANALYZED";

export type TraceSearchResult = {
  url: string;
  title: string | null;
  platform: string | null;
  author: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  similarity: number | null;
  searchRelevance: number | null;
  faceStatus: FaceAnalysisStatus;
  faceStatusMessage: string | null;
  snippet: string | null;
};

export type TraceSearchStatus =
  | "search_complete"
  | "no_matches_found"
  | "search_configuration_error"
  | "search_authentication_error"
  | "search_rate_limited"
  | "search_request_failed"
  | "search_request_timed_out";

export type TraceSearchResponse = {
  status: TraceSearchStatus;
  provider: string;
  message?: string;
  results: TraceSearchResult[];
};
