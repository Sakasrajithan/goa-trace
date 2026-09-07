# Goa Trace

## What it does

Goa Trace is a Hacker House Goa 2026 Task 3 interface for moving from **face scan → source discovery → content fingerprint → verification**. It is intentionally framed as an investigation/provenance tool: face similarity surfaces a lead, while a deterministic content hash makes a discovered source reproducible.

## Task 3 mapping

| Requirement | Current build | Production adapter |
| --- | --- | --- |
| Face detection / identification | Upload flow, face scan readout, bounding-box visual, and explicit local-demo labeling | Browser `@vladmandic/face-api` detection + embedding |
| Genuine web / social search | `POST /api/trace/search` → Tavily server boundary with normalized real-result rendering | Supply a server-side Tavily API key |
| Matching post | Source candidate cards; similarity remains null until real face comparison considers a candidate relevant | Candidate ranking using face embeddings |
| Content hash | Real browser Web Crypto SHA-256 hash over canonical candidate content | Server-side canonicalization for untrusted input |
| Blockchain verification | Local proof record and deterministic local re-verification; never mislabeled as an on-chain transaction | `ethers` + TraceRegistry.sol on Polygon Amoy |

## Architecture

The project is a Vite + React + TypeScript + Tailwind 4 frontend inside the full-stack WebDev template. `client/src/pages/Home.tsx` owns the staged workbench UI and local proof flow. The scaffold already contains the tRPC/Express server surface for adding secure search and blockchain procedures without exposing credentials to the browser.

The UI is intentionally a single-screen experience so a judge can understand the pipeline without navigating through unnecessary pages. The browser calls `POST /api/trace/search`; it never receives the provider key. When the server has no provider configured, the UI reports `SEARCH CONFIGURATION ERROR` and `SOURCE DISCOVERY IS NOT CONFIGURED` instead of pretending that a result exists.

## Pipeline

1. **Scan** — select an image or load the clearly labelled local demo scan.
2. **Search** — the browser posts non-secret scan context to `/api/trace/search` and renders backend-reported progress and response states.
3. **Source** — inspect actual normalized provider results, similarity only when calculated, source URL, author, date, platform, and snippet.
4. **Proof** — calculate SHA-256 content and source hashes using the Web Crypto API and create a local proof record.
5. **Verify** — recalculate the canonical content hash and compare it with the stored local proof record.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Lucide icons
- Web Crypto API for SHA-256
- Express + tRPC server scaffold
- Polygon Amoy target network for the production blockchain adapter

## Face detection

The current browser experience is deliberately honest about the adapter boundary. The UI shows the scan, a bounding-box motif, and a local readout, but it does not claim that a real face embedding was produced. To turn the flow into the official task implementation, add `@vladmandic/face-api`, load its models from a controlled model path, and populate `faceDetected`, `faceCount`, `embedding`, `similarity`, `confidence`, and `boundingBox` from actual inference.

Face similarity is **not proof of identity**. Tavily returns are labelled “Source Candidate”; Goa Trace should only use “Potential Match” after real face-comparison logic considers a candidate relevant.

## Search provider

The backend now exposes `POST /api/trace/search`. Its request body is:

```json
{
  "faceEmbedding": null,
  "query": "face source discovery",
  "sourceHints": ["uploaded-file-name"],
  "imageData": "data:image/..."
}
```

`faceEmbedding` is `null` until the existing face-processing layer produces a real embedding; the frontend does not invent a second representation. The response is normalized to:

```json
{
  "status": "search_complete | no_matches_found | search_configuration_error | search_authentication_error | search_rate_limited | search_request_failed | search_request_timed_out",
  "provider": "provider name",
  "message": "optional technical message",
  "results": [{ "url": "https://...", "title": "...", "platform": null, "author": null, "publishedAt": null, "imageUrl": "https://...", "similarity": null, "searchRelevance": 0.89, "faceStatus": "FACE_NOT_ANALYZED", "faceStatusMessage": "FACE NOT ANALYZED", "snippet": "..." }]
}
```

The configured provider is a server-side adapter:

```text
SearchProvider
├── searchWeb()
└── normalizeResults()
```

The production provider is `TavilySearchProvider`. It calls `https://api.tavily.com/search` from the server with `search_depth: "advanced"`, `max_results: 10`, `include_answer: false`, and `include_raw_content: true`. `SEARCH_API_URL` may override the endpoint for controlled deployments, but defaults to Tavily. `SEARCH_API_KEY` is sent only in the server-side request body and never returned to the browser. Tavily’s relevance `score` is returned separately as `searchRelevance`; it is never mapped to face `similarity`.

## Candidate analysis

After Tavily returns candidates, `server/candidateAnalysis.ts` fetches public HTML pages server-side, extracts Open Graph and `<img>` image URLs, filters obvious logos/icons/pixels/decorative assets, and downloads candidate images transiently for inspection. It does not bypass authentication, persist downloaded images, or fabricate face scores. The `CandidateFaceAnalyzer` interface is the explicit model boundary: until a real face detector and embedding comparator is supplied, candidates return `similarity: null` with `FACE NOT ANALYZED`. A source that cannot be fetched returns `SOURCE CONTENT UNAVAILABLE`; a configured analyzer that finds no face returns `FACE NOT FOUND`; only an actual comparator may return `FACE MATCH ANALYZED` and a numeric similarity.

## Blockchain

The target production network is **Polygon Amoy** (chain ID `80002`, currency `POL`). The backend should use `ethers`, a dedicated testnet wallet, and a minimal `TraceRegistry.sol` contract with:

```solidity
registerProof(bytes32 contentHash, bytes32 sourceHash)
getProof(bytes32 contentHash)
```

The frontend must receive the actual transaction hash, block number, timestamp, contract address, and a PolygonScan Amoy link. Raw images, embeddings, and private data should never be placed on-chain.

## Environment variables

When adding the production adapters, configure these project secrets server-side only:

```env
POLYGON_RPC_URL=
PRIVATE_KEY=
SEARCH_API_URL=https://api.tavily.com/search
SEARCH_API_KEY=<TAVILY_API_KEY>
ORIGINKIT_API_KEY=
```

The private key must be a dedicated Polygon Amoy testnet wallet. Never commit a local `.env`, expose any key in frontend JavaScript, or put a private key into a transaction payload. The WebDev project uses its managed secret store for these values. The current runtime has a server-only Tavily key configured and the live endpoint has been verified to return real enriched candidates.

## Installation

```bash
pnpm install
```

## Running locally

```bash
pnpm dev
```

Open the WebDev preview URL. Choose **LOAD LOCAL PREVIEW** or upload an image, then **START SEARCH**. With the current server-only Tavily configuration, the page renders only real returned candidates and their enrichment states. If the key is absent, the expected truthful result is **SEARCH CONFIGURATION ERROR** with **SOURCE DISCOVERY IS NOT CONFIGURED**.

## Demo flow

The app is designed for a short screen recording:

- The opening screen explains the product in one glance.
- `START TRACE` jumps to the workbench.
- `LOAD LOCAL PREVIEW` makes the local scan boundary visible.
- The staged search visualization is driven by the backend response state.
- Tavily returns use “Source Candidate”; “Potential Match” is reserved for real comparison output, never “Identity Confirmed.”
- The proof panel exposes the canonical hash and explicitly states that the blockchain adapter is offline.
- Verification compares the local hash against the stored proof record and reports the result.

## Verification model

The local proof hash is generated from a canonical string containing the source URL, post text, author, platform, publication date, and image data URL. The same string is hashed again during verification. The production server should canonicalize and hash bytes in one shared module so registration and verification cannot drift.

## Security

The current demo does not upload the selected image. It only uses the browser FileReader for an in-memory preview. Production face processing should prefer in-memory execution, delete temporary files after processing, and store only content/source hashes and minimal metadata in the blockchain record.

## Limitations

This repository intentionally stops short of claiming a face match or blockchain transaction when those server credentials and adapters have not been configured. The search endpoint explicitly distinguishes configuration errors, authentication failures, rate limits, timeouts, provider failures, empty results, and successful Tavily results. This is safer and more technically accurate than displaying fake transaction hashes or fabricated search results.

## Future improvements

- Add a real face detector and embedding comparator implementing `CandidateFaceAnalyzer`.
- Add robots/terms-aware candidate fetch safeguards and stronger image heuristics.
- Add the TraceRegistry Solidity contract and an `ethers` Amoy signer.
- Replace the local proof record with a tRPC `proof.anchor` + `proof.verify` flow.
- Add mismatch testing by changing candidate content before verification.

## Screenshots

Capture fresh previews from the WebDev project after starting the dev server.

## License

MIT
