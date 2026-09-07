export type TraceSearchRequest = {
  faceEmbedding?: unknown;
  query?: string;
  sourceHints?: string[];
  imageData?: string;
};

export type TraceSearchResult = {
  url: string;
  title: string;
  platform?: string;
  author?: string;
  publishedAt?: string;
  similarity?: number;
  snippet?: string;
};

export type TraceSearchStatus =
  | "search_complete"
  | "no_matches_found"
  | "search_configuration_error"
  | "search_request_failed";

export type TraceSearchResponse = {
  status: TraceSearchStatus;
  provider: string;
  message?: string;
  results: TraceSearchResult[];
};
