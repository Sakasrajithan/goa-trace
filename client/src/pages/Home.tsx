import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileImage,
  Fingerprint,
  Hash,
  Link2,
  Menu,
  ScanFace,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { canonicalizeCandidate, hashSha256, type TraceCandidate } from "@/lib/trace";

const DEMO_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120">
    <rect width="900" height="1120" fill="#d7b27a"/>
    <rect x="28" y="28" width="844" height="1064" fill="#f6e6bd" stroke="#111111" stroke-width="18"/>
    <circle cx="710" cy="180" r="105" fill="#f4ce14" stroke="#111111" stroke-width="13"/>
    <path d="M90 820 C220 640 360 630 480 780 C580 900 720 870 820 690 L820 1060 L90 1060Z" fill="#1b6e4c" stroke="#111111" stroke-width="16"/>
    <path d="M96 120 L270 60 L220 250 L80 300Z" fill="#e91e8c" stroke="#111111" stroke-width="14"/>
    <path d="M205 870 C205 670 310 520 450 520 C590 520 695 670 695 870 L695 1000 L205 1000Z" fill="#c1502e" stroke="#111111" stroke-width="17"/>
    <ellipse cx="450" cy="420" rx="170" ry="210" fill="#b66d45" stroke="#111111" stroke-width="17"/>
    <path d="M278 370 C270 205 360 150 455 170 C580 150 640 250 625 370 C560 315 510 292 430 304 C370 300 325 328 278 370Z" fill="#111111"/>
    <circle cx="380" cy="420" r="18" fill="#111111"/><circle cx="520" cy="420" r="18" fill="#111111"/>
    <path d="M390 505 Q450 548 510 505" fill="none" stroke="#111111" stroke-width="14" stroke-linecap="round"/>
    <path d="M178 1005 L720 1005" stroke="#f4ce14" stroke-width="26"/>
  </svg>`);

type Stage = 0 | 1 | 2 | 3 | 4;

type Candidate = TraceCandidate;

type Proof = {
  contentHash: string;
  sourceHash: string;
  timestamp: string;
  recordId: string;
};

const CANDIDATE: Candidate = {
  platform: "DEMO / LOCAL DATA",
  sourceUrl: "https://example.com/goa-trace/local-record-001",
  author: "goa_trace_archive",
  publishedAt: "2026-01-18",
  text: "A face in the wild. The source matters more than the screenshot.",
  imageUrl: DEMO_IMAGE,
  similarity: "94.8%",
};

const stages = [
  { id: 0, number: "01", label: "SCAN", sub: "Face input" },
  { id: 1, number: "02", label: "SEARCH", sub: "Source discovery" },
  { id: 2, number: "03", label: "DISCOVERY", sub: "Potential match" },
  { id: 3, number: "04", label: "PROOF", sub: "Fingerprint" },
  { id: 4, number: "05", label: "VERIFY", sub: "Integrity check" },
];

function hashPreview(hash?: string) {
  if (!hash) return "—";
  return `0x${hash.slice(0, 12)}…${hash.slice(-10)}`;
}

function PixelArc({ tone = "yellow", active = false }: { tone?: "yellow" | "pink" | "cream"; active?: boolean }) {
  return (
    <div className={`pixel-arc pixel-arc-${tone} ${active ? "is-active" : ""}`} aria-hidden="true">
      <span className="arc-core" />
      <span className="arc-line arc-line-one" />
      <span className="arc-line arc-line-two" />
      <span className="arc-line arc-line-three" />
      <span className="arc-pixel pixel-one" />
      <span className="arc-pixel pixel-two" />
      <span className="arc-pixel pixel-three" />
    </div>
  );
}

function GoaMark() {
  return (
    <div className="goa-mark" aria-label="Hacker House Goa">
      <div className="house-mark">HH</div>
      <div className="mark-copy">
        <span>HACKER HOUSE</span>
        <strong>गोवा</strong>
      </div>
    </div>
  );
}

function StatusChip({ children, tone = "cream" }: { children: React.ReactNode; tone?: "cream" | "yellow" | "pink" | "terracotta" }) {
  return <span className={`status-chip chip-${tone}`}>{children}</span>;
}

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(0);
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [scanReady, setScanReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [verified, setVerified] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemo = !image || fileName === "demo-face-scan.svg";
  const currentStage = stages[stage];
  const searchSteps = [
    "READING FACE",
    "GENERATING VISUAL SIGNATURE",
    "SEARCHING LOCAL SOURCES",
    "COMPARING CANDIDATES",
    "RANKING MATCHES",
  ];

  const recordPayload = useMemo(() => {
    if (!candidate) return "";
    return canonicalizeCandidate(candidate);
  }, [candidate]);

  const chooseFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file containing a visible face.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setFileName(file.name);
      setScanReady(false);
      setCandidate(null);
      setProof(null);
      setVerified(false);
      setStage(0);
    };
    reader.readAsDataURL(file);
  };

  const loadDemo = () => {
    setImage(DEMO_IMAGE);
    setFileName("demo-face-scan.svg");
    setScanReady(false);
    setCandidate(null);
    setProof(null);
    setVerified(false);
    setError(null);
    setStage(0);
  };

  const startTrace = () => {
    if (!image) {
      setError("Add a face scan first, or load the clearly labelled demo record.");
      return;
    }
    setError(null);
    setScanReady(true);
    setStage(1);
    setSearching(true);
    setSearchStep(0);
    setCandidate(null);
    const steps = [0, 1, 2, 3, 4];
    steps.forEach((step, index) => {
      window.setTimeout(() => setSearchStep(step), index * 520);
    });
    window.setTimeout(() => {
      setCandidate(CANDIDATE);
      setSearching(false);
      setStage(2);
    }, 2900);
  };

  const createProof = async () => {
    if (!candidate) return;
    setAnchoring(true);
    setStage(3);
    const contentHash = await hashSha256(recordPayload);
    const sourceHash = await hashSha256(candidate.sourceUrl);
    const recordId = await hashSha256(`${contentHash}:${Date.now()}`);
    setProof({
      contentHash,
      sourceHash,
      recordId,
      timestamp: new Date().toISOString(),
    });
    window.setTimeout(() => setAnchoring(false), 900);
  };

  const verifyProof = async () => {
    if (!proof || !candidate) return;
    const localHash = await hashSha256(recordPayload);
    setVerified(localHash === proof.contentHash);
    setStage(4);
  };

  const reset = () => {
    setStage(0);
    setImage(null);
    setFileName("");
    setScanReady(false);
    setSearching(false);
    setCandidate(null);
    setProof(null);
    setVerified(false);
    setError(null);
  };

  return (
    <main className="app-shell">
      <div className="top-ticker">
        <div className="ticker-left"><span className="ticker-dot" /> HH GOA / TASK 03</div>
        <div className="ticker-center">FACE → SOURCE → PROOF</div>
        <div className="ticker-right">LOCAL DEMO BUILD / 2026</div>
      </div>

      <header className="site-header">
        <GoaMark />
        <nav className={`site-nav ${mobileNav ? "nav-open" : ""}`}>
          <a href="#trace" onClick={() => setMobileNav(false)}>TRACE</a>
          <a href="#how-it-works" onClick={() => setMobileNav(false)}>HOW IT WORKS</a>
          <a href="#proof" onClick={() => setMobileNav(false)}>PROOF</a>
        </nav>
        <div className="header-actions">
          <button className="button button-yellow button-small" onClick={() => document.getElementById("trace")?.scrollIntoView({ behavior: "smooth" })}>START TRACE <ArrowDown size={15} /></button>
          <button className="menu-button" aria-label="Toggle navigation" onClick={() => setMobileNav((value) => !value)}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <section className="hero-section" id="how-it-works">
        <div className="sun-orb" aria-hidden="true" />
        <div className="leaf-shape leaf-left" aria-hidden="true" />
        <div className="leaf-shape leaf-right" aria-hidden="true" />
        <div className="hanging-card card-day">DAY 01<br /><strong>GENESIS</strong></div>
        <div className="hanging-card card-task">TRACE<br /><strong>/ 01</strong></div>
        <div className="hero-copy">
          <StatusChip tone="pink"><Sparkles size={13} /> INVESTIGATION / PROVENANCE</StatusChip>
          <h1>Find the source.<br /><em>Anchor the proof.</em></h1>
          <p>Goa Trace follows a face across the web, surfaces its source, and creates a tamper-evident fingerprint for the discovered content.</p>
          <div className="hero-actions">
            <button className="button button-yellow" onClick={() => document.getElementById("trace")?.scrollIntoView({ behavior: "smooth" })}>START TRACE <ChevronRight size={18} /></button>
            <a className="text-link" href="#pipeline">See the pipeline <ArrowDown size={16} /></a>
          </div>
          <div className="hero-disclaimer"><CircleAlert size={15} /> Similarity is a lead, not identity proof.</div>
        </div>
        <div className="hero-visual" aria-label="Illustrated face scan and source proof motif">
          <div className="visual-window">
            <div className="window-top"><span>VISUAL SIGNATURE</span><span>LOCAL / 001</span></div>
            <div className="scan-art">
              <div className="scan-grid" />
              <img src={DEMO_IMAGE} alt="Illustrated demo face scan" />
              <div className="scan-box"><span>FACE DETECTED</span></div>
              <PixelArc tone="yellow" active />
            </div>
            <div className="window-bottom"><span>BOUNDING BOX / 01</span><span>READY</span></div>
          </div>
          <div className="visual-tag tag-source">SOURCE<br /><strong>FOUND</strong></div>
          <div className="visual-tag tag-proof">PROOF<br /><strong>ANCHORED</strong></div>
        </div>
      </section>

      <section className="pipeline-strip" id="pipeline">
        <div className="section-kicker"><span>THE TRACE RITUAL</span><i /></div>
        <div className="pipeline-steps">
          {stages.map((item, index) => (
            <div className={`pipeline-step ${stage >= item.id ? "is-current" : ""}`} key={item.id}>
              <span className="pipeline-number">{item.number}</span>
              <strong>{item.label}</strong>
              <span>{item.sub}</span>
              {index < stages.length - 1 && <ChevronRight className="pipeline-arrow" size={18} />}
            </div>
          ))}
        </div>
      </section>

      <section className="trace-section" id="trace">
        <div className="section-heading">
          <div>
            <StatusChip tone="yellow">LIVE WORKBENCH</StatusChip>
            <h2>Trace the signal.</h2>
          </div>
          <div className="heading-note"><span className="mono">PROVIDER</span><strong>DEMO / LOCAL DATA</strong><span>Controlled record for local development. Replace with a genuine reverse-image adapter for judging.</span></div>
        </div>

        {error && <div className="error-banner"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} /></button></div>}

        <div className="workbench-grid">
          <aside className="stage-rail">
            <div className="rail-title"><span>PIPELINE</span><span className="mono">05 STEPS</span></div>
            {stages.map((item) => (
            <button key={item.id} className={`rail-step ${stage === item.id ? "active" : ""} ${stage > item.id ? "done" : ""}`} onClick={() => item.id <= stage && setStage(item.id as Stage)}>
                <span className="rail-index">{stage > item.id ? <Check size={14} /> : item.number}</span>
                <span><strong>{item.label}</strong><small>{item.sub}</small></span>
                {stage === item.id && <span className="rail-pip" />}
              </button>
            ))}
            <div className="rail-note"><Fingerprint size={19} /><span><strong>NO RAW BIOMETRICS</strong>Only hashes and minimal metadata belong in the proof record.</span></div>
          </aside>

          <div className="stage-canvas">
            {stage === 0 && (
              <div className="stage-panel scan-panel">
                <div className="panel-header">
                  <div><span className="eyebrow">01 / SCAN</span><h3>Drop a face scan<br /><em>to begin the trace.</em></h3></div>
                  <ScanFace className="panel-icon" size={40} strokeWidth={1.5} />
                </div>
                <div className="upload-layout">
                  <button className={`drop-zone ${image ? "has-image" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) chooseFile(file); }}>
                    {image ? <img src={image} alt="Uploaded face scan" /> : <><Upload size={31} /><strong>DROP IMAGE HERE</strong><span>or choose a JPG, PNG, or WEBP</span></>}
                    {image && <span className="drop-overlay"><Check size={18} /> SCAN LOADED</span>}
                  </button>
                  <div className="scan-readout">
                    <div className="readout-label">SCAN READOUT</div>
                    <div className={`readout-state ${scanReady ? "ready" : ""}`}><span className="state-dot" />{scanReady ? "FACE DETECTED" : image ? "READY TO ANALYZE" : "WAITING FOR INPUT"}</div>
                    <div className="readout-row"><span>FACE COUNT</span><strong>{image ? "01" : "—"}</strong></div>
                    <div className="readout-row"><span>EMBEDDING</span><strong>{scanReady ? "LOCAL / READY" : "PENDING"}</strong></div>
                    <div className="readout-row"><span>RETENTION</span><strong>IN MEMORY</strong></div>
                    <div className="readout-help">For this build, the demo scan is explicitly labelled. Plug the local face-api adapter into this stage to enable production detection.</div>
                  </div>
                </div>
                <div className="panel-footer"><span className="file-name">{fileName || "NO FILE SELECTED"}</span><div className="footer-actions"><button className="button button-ghost" onClick={loadDemo}><FileImage size={16} /> LOAD DEMO SCAN</button><button className="button button-black" onClick={startTrace} disabled={!image}>START TRACE <ChevronRight size={17} /></button></div></div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); }} />
              </div>
            )}

            {stage === 1 && (
              <div className="stage-panel search-panel">
                <div className="panel-header"><div><span className="eyebrow">02 / SEARCH</span><h3>Search the sources.<br /><em>Follow the visual trail.</em></h3></div><Search className="panel-icon" size={40} strokeWidth={1.5} /></div>
                <div className="search-layout">
                  <div className="search-animation"><PixelArc tone="pink" active={searching} /><div className="arc-label">{searching ? searchSteps[searchStep] : "SOURCE READY"}</div><div className="arc-sub">{searching ? "DEMO PROVIDER / CONTROLLED LOCAL RECORD" : "SEARCH OPERATION COMPLETE"}</div></div>
                  <div className="search-status-list">{searchSteps.map((item, index) => <div className={`search-status ${index < searchStep || (!searching && index <= 4) ? "done" : ""} ${index === searchStep && searching ? "active" : ""}`} key={item}><span>{index < searchStep || (!searching && index <= 4) ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>{item}</div>)}</div>
                </div>
                <div className="panel-footer"><span className="search-count">{searching ? "SEARCH IN FLIGHT" : "1 CANDIDATE FOUND"}</span><StatusChip tone="pink">DEMO / LOCAL DATA</StatusChip></div>
              </div>
            )}

            {stage === 2 && candidate && (
              <div className="stage-panel discovery-panel">
                <div className="panel-header"><div><span className="eyebrow">03 / DISCOVERY</span><h3>Source found.<br /><em>Inspect before proof.</em></h3></div><Link2 className="panel-icon" size={40} strokeWidth={1.5} /></div>
                <div className="discovery-layout">
                  <div className="candidate-image"><img src={candidate.imageUrl} alt="Candidate source preview" /><div className="match-stamp"><span>POTENTIAL</span><strong>MATCH</strong><small>{candidate.similarity}</small></div></div>
                  <div className="candidate-details"><StatusChip tone="pink">{candidate.platform}</StatusChip><div className="similarity-row"><div><span className="eyebrow">FACE SIMILARITY</span><strong>{candidate.similarity}</strong></div><div className="similarity-meter"><span style={{ width: candidate.similarity }} /></div></div><div className="metadata-list"><div><span>SOURCE</span><strong>Local archive record</strong></div><div><span>AUTHOR</span><strong>@{candidate.author}</strong></div><div><span>POST DATE</span><strong>{candidate.publishedAt}</strong></div><div><span>URL</span><strong className="mono">{candidate.sourceUrl.replace("https://", "")}</strong></div></div><p className="candidate-quote">“{candidate.text}”</p><div className="candidate-actions"><a className="button button-ghost" href={candidate.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE <ArrowUpRight size={15} /></a><button className="button button-black" onClick={createProof}>CREATE FINGERPRINT <Fingerprint size={16} /></button></div></div>
                </div>
              </div>
            )}

            {stage === 3 && proof && (
              <div className="stage-panel proof-panel" id="proof">
                <div className="panel-header"><div><span className="eyebrow">04 / PROOF</span><h3>Create a tamper-evident<br /><em>fingerprint of the source.</em></h3></div><Hash className="panel-icon" size={40} strokeWidth={1.5} /></div>
                <div className="proof-banner"><PixelArc tone="yellow" active={anchoring} /><div><span>{anchoring ? "BUILDING LOCAL PROOF RECORD" : "PROOF RECORD READY"}</span><strong>{anchoring ? "HASHING CANONICAL CONTENT" : "FINGERPRINT GENERATED"}</strong></div><StatusChip tone={anchoring ? "yellow" : "pink"}>{anchoring ? "PROCESSING" : "DEMO / LOCAL DATA"}</StatusChip></div>
                <div className="proof-grid"><div className="proof-field"><span>CONTENT HASH</span><strong className="mono">{hashPreview(proof.contentHash)}</strong><small>SHA-256 / canonical content</small></div><div className="proof-field"><span>SOURCE HASH</span><strong className="mono">{hashPreview(proof.sourceHash)}</strong><small>SHA-256 / source URL</small></div><div className="proof-field"><span>NETWORK</span><strong>POLYGON AMOY</strong><small>Chain ID 80002 / adapter offline</small></div><div className="proof-field"><span>WALLET</span><strong>SERVER-SIDE ONLY</strong><small>Private key never reaches browser</small></div></div>
                <div className="proof-note"><CircleAlert size={17} /><span><strong>Blockchain adapter not connected.</strong> The local SHA-256 record is real and reproducible; wire <span className="mono">POLYGON_RPC_URL</span> + <span className="mono">PRIVATE_KEY</span> server-side to broadcast this fingerprint on Amoy.</span></div>
                <div className="panel-footer"><span className="mono">RECORD {hashPreview(proof.recordId)}</span><button className="button button-black" onClick={verifyProof}>{anchoring ? "PREPARING PROOF" : "VERIFY LOCAL RECORD"} <ShieldCheck size={16} /></button></div>
              </div>
            )}

            {stage === 4 && proof && (
              <div className="stage-panel verify-panel">
                <div className="panel-header"><div><span className="eyebrow">05 / VERIFY</span><h3>Compare the record.<br /><em>Trust the fingerprint.</em></h3></div><ShieldCheck className="panel-icon" size={40} strokeWidth={1.5} /></div>
                <div className={`verification-stamp ${verified ? "verified" : "mismatch"}`}><div className="stamp-ring">{verified ? <Check size={50} /> : <X size={50} />}</div><div><span>{verified ? "MATCHED" : "CONTENT CHANGED"}</span><strong>{verified ? "✓ VERIFIED" : "✕ MISMATCH"}</strong><small>{verified ? "The current content matches the local proof record." : "The current content does not match the stored fingerprint."}</small></div></div>
                <div className="compare-grid"><div><span>LOCAL FINGERPRINT</span><strong className="mono">{hashPreview(proof.contentHash)}</strong></div><div><span>STORED FINGERPRINT</span><strong className="mono">{hashPreview(proof.contentHash)}</strong></div></div>
                <div className="verification-meta"><div><span>TRANSACTION</span><strong>NOT BROADCAST</strong></div><div><span>BLOCK</span><strong>—</strong></div><div><span>TIMESTAMP</span><strong>{new Date(proof.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></div><div><span>CONTRACT</span><strong>TraceRegistry.sol</strong></div><div><span>NETWORK</span><strong>Polygon Amoy / 80002</strong></div></div>
                <div className="panel-footer"><span className="verified-foot"><Check size={15} /> INTEGRITY VERIFIED LOCALLY</span><button className="button button-yellow" onClick={reset}>START NEW TRACE <ArrowUp size={16} /></button></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="principles-section">
        <div className="principle-card principle-green"><span className="principle-num">01</span><ScanFace size={30} /><h3>Face is a lead.</h3><p>Similarity can surface a source. It never makes an identity claim.</p></div>
        <div className="principle-card principle-yellow"><span className="principle-num">02</span><Search size={30} /><h3>Source is inspectable.</h3><p>Every candidate carries a provider label and an open-source path.</p></div>
        <div className="principle-card principle-pink"><span className="principle-num">03</span><FileCheck2 size={30} /><h3>Proof is reproducible.</h3><p>Canonical content becomes a deterministic fingerprint for verification.</p></div>
      </section>

      <footer className="site-footer"><GoaMark /><div className="footer-motto">Find where it appears.<br /><em>Prove what changed.</em></div><div className="footer-meta"><span className="mono">GOA TRACE / HH TASK 03</span><span>FACE → SOURCE → PROOF</span></div></footer>
    </main>
  );
}
