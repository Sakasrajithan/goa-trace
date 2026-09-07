export type TraceSearchRequest = {
  faceEmbedding?: unknown;
  query?: string;
  sourceHints?: string[];
  imageData?: string;
};

export type TraceSearchResult = {
  url: string;
  title: string | null;
  platform: string | null;
  author: string | null;
  publishedAt: string | null;
  similarity: number | null;
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
