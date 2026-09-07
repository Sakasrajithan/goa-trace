import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  Hash,
  Menu,
  ScanFace,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

const DEMO_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120">
    <rect width="900" height="1120" fill="#111111"/>
    <path d="M75 905 C190 650 308 575 450 575 C592 575 710 650 825 905 L825 1060 L75 1060Z" fill="#2b2b2b"/>
    <ellipse cx="450" cy="430" rx="175" ry="220" fill="#777777"/>
    <path d="M274 384 C264 202 362 142 458 165 C578 148 648 245 626 386 C556 323 505 300 425 313 C368 312 324 340 274 384Z" fill="#1c1c1c"/>
    <circle cx="380" cy="430" r="18" fill="#111111"/><circle cx="520" cy="430" r="18" fill="#111111"/>
    <path d="M390 514 Q450 550 510 514" fill="none" stroke="#111111" stroke-width="14" stroke-linecap="round"/>
    <path d="M108 105 L792 105 M108 1015 L792 1015" stroke="#7c7c7c" stroke-width="2"/>
  </svg>`);

type Stage = 0 | 1 | 2 | 3 | 4;

const stages = [
  { id: 0 as Stage, number: "01", label: "SCAN", detail: "Face input" },
  { id: 1 as Stage, number: "02", label: "SEARCH", detail: "Candidate query" },
  { id: 2 as Stage, number: "03", label: "SOURCE", detail: "Evidence review" },
  { id: 3 as Stage, number: "04", label: "PROOF", detail: "Fingerprint" },
  { id: 4 as Stage, number: "05", label: "VERIFY", detail: "Integrity check" },
];

const searchSteps = [
  "GENERATING VISUAL SIGNATURE",
  "SEARCHING SOURCES",
  "COLLECTING CANDIDATES",
  "COMPARING FACES",
  "RANKING RESULTS",
];

function GoaTraceMark() {
  return (
    <a className="brand" href="#top" aria-label="Goa Trace home">
      <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
        <path d="M8 13V8h5M21 8h5v5M26 21v5h-5M13 26H8v-5" />
        <circle cx="17" cy="17" r="3" />
        <path d="M17 14V5M20 17h9" />
      </svg>
      <span><strong>Goa</strong> Trace</span>
    </a>
  );
}

function MonoBadge({ children }: { children: React.ReactNode }) {
  return <span className="mono-badge">{children}</span>;
}

function PixelArc({ active = false }: { active?: boolean }) {
  return (
    <div className={`pixel-arc ${active ? "is-active" : ""}`} aria-hidden="true">
      <span className="arc-core" />
      <span className="arc-line arc-line-one" />
      <span className="arc-line arc-line-two" />
      <span className="arc-line arc-line-three" />
      <span className="arc-pixel pixel-one" />
      <span className="arc-pixel pixel-two" />
    </div>
  );
}

function TechnicalBackground() {
  return (
    <div className="technical-background" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-scan-line" />
      <svg className="bg-contours" viewBox="0 0 900 680" preserveAspectRatio="none">
        <path d="M50 570 C130 380 265 220 430 245 C575 267 648 418 842 82" />
        <path d="M20 595 C150 390 290 255 434 277 C582 298 665 450 880 110" />
        <path d="M665 0 L665 680 M720 0 L720 680" />
        <circle cx="434" cy="277" r="8" /><circle cx="720" cy="325" r="5" /><circle cx="215" cy="438" r="5" />
      </svg>
    </div>
  );
}

export default function Home() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(0);
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [scanReady, setScanReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setScanReady(true);
      setStage(0);
      setSearchUnavailable(false);
    };
    reader.readAsDataURL(file);
  };

  const loadDemo = () => {
    setImage(DEMO_IMAGE);
    setFileName("local-preview.svg");
    setScanReady(true);
    setError(null);
    setSearchUnavailable(false);
    setStage(0);
  };

  const startSearch = () => {
    if (!image) {
      setError("Upload a face image before starting the trace.");
      return;
    }
    setError(null);
    setStage(1);
    setSearching(true);
    setSearchUnavailable(false);
    setSearchStep(0);
    searchSteps.forEach((_, index) => {
      window.setTimeout(() => setSearchStep(index), index * 380);
    });
    window.setTimeout(() => {
      setSearching(false);
      setSearchUnavailable(true);
    }, 2200);
  };

  const resetTrace = () => {
    setStage(0);
    setImage(null);
    setFileName("");
    setScanReady(false);
    setSearching(false);
    setSearchStep(0);
    setSearchUnavailable(false);
    setError(null);
  };

  const goToTrace = () => document.getElementById("trace")?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="forensic-shell" id="top">
      <div className="grain" aria-hidden="true" />
      <TechnicalBackground />
      <div className="utility-bar">
        <span>HH GOA / TASK 03</span>
        <span>FACE × SEARCH × BLOCKCHAIN</span>
        <span>PROVENANCE SYSTEM / 2026</span>
      </div>

      <header className="site-header-cinematic">
        <GoaTraceMark />
        <nav className={`cinematic-nav ${mobileNav ? "nav-open" : ""}`} id="primary-navigation" aria-label="Primary navigation">
          <a href="#trace" onClick={() => setMobileNav(false)}>Trace</a>
          <a href="#how-it-works" onClick={() => setMobileNav(false)}>How It Works</a>
          <a href="#proof" onClick={() => setMobileNav(false)}>Proof</a>
          <a href="#about" onClick={() => setMobileNav(false)}>About</a>
        </nav>
        <div className="header-cta-wrap">
          <button className="glass-button solid-button" onClick={goToTrace}>Start Trace <ChevronRight size={15} /></button>
          <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={mobileNav} aria-controls="primary-navigation" onClick={() => setMobileNav((open) => !open)}>{mobileNav ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </header>

      <section className="hero-cinematic" id="how-it-works">
        <div className="hero-center">
          <MonoBadge><ScanFace size={12} /> HH GOA / TASK 03</MonoBadge>
          <div className="hero-kicker">FACE DETECTION <span>·</span> SOURCE DISCOVERY <span>·</span> ON-CHAIN PROOF</div>
          <h1>Find the <em>source.</em><br />Anchor the <em>proof.</em></h1>
          <p>Trace a face across the web, discover matching content, and create a verifiable fingerprint of the source on-chain.</p>
          <div className="hero-actions">
            <button className="glass-button solid-button" onClick={goToTrace}>Start Trace <ArrowDown size={15} /></button>
            <a className="ghost-link" href="#pipeline">How it works <ArrowDown size={14} /></a>
          </div>
        </div>
        <div className="hero-footnote"><span className="status-led" /> Face similarity is a lead, not identity proof.</div>
      </section>

      <section className="technical-stats" id="pipeline" aria-label="System overview">
        <div><span>01</span><strong>FACE</strong><small>LOCAL PROCESSING</small></div>
        <div><span>02</span><strong>SEARCH</strong><small>REAL SOURCE DISCOVERY</small></div>
        <div><span>03</span><strong>PROOF</strong><small>POLYGON AMOY</small></div>
      </section>

      <section className="trace-workspace" id="trace">
        <div className="workspace-heading">
          <div><span className="section-overline">GOA TRACE / INVESTIGATION WORKSPACE</span><h2>Trace the <em>evidence.</em></h2></div>
          <p>One restrained surface for face input, source search, fingerprinting, and verification.</p>
        </div>
        {error && <div className="error-line" role="alert"><CircleAlert size={15} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button></div>}
        <div className="workspace-frame">
          <div className="workspace-topline"><span>TRACE / {String(stage + 1).padStart(2, "0")}</span><span className="workspace-provider">PROVIDER <strong>NOT CONFIGURED</strong></span></div>
          <div className="workspace-layout">
            <aside className="stage-index" aria-label="Trace pipeline">
              {stages.map((item) => (
                <button key={item.id} className={`stage-index-item ${stage === item.id ? "active" : ""} ${stage > item.id ? "complete" : ""}`} onClick={() => setStage(item.id)}>
                  <span className="stage-index-number">{stage > item.id ? <Check size={12} /> : item.number}</span>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  {stage === item.id && <i />}
                </button>
              ))}
              <div className="stage-index-note"><ShieldCheck size={16} /><span>No raw image or embedding is stored on-chain.</span></div>
            </aside>

            <div className="stage-view" aria-live="polite">
              {stage === 0 && (
                <div className="stage-content scan-content">
                  <div className="stage-intro"><span className="section-overline">01 / SCAN</span><h3>Upload a face<br /><em>to begin the trace.</em></h3><p>The image is processed to detect and encode a visible face before candidate sources are searched.</p></div>
                  <div className="scan-layout">
                    <button className={`glass-panel upload-panel ${image ? "has-image" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) chooseFile(file); }}>
                      {image ? <><img src={image} alt="Uploaded face scan preview" /><span className="bounding-box"><i>FACE 01 / PREVIEW</i><b>DEMO FRAME</b></span><span className="preview-state"><Check size={13} /> IMAGE BUFFER READY</span></> : <><Upload size={20} /><strong>Drop face scan</strong><span>or choose an image</span></>}
                    </button>
                    <div className="scan-details">
                      <div className="scan-status-title">PROCESSING STATUS</div>
                      <div className={`status-row ${image ? "ready" : ""}`}><span className="status-mark" />IMAGE BUFFER<span>{image ? "READY" : "WAITING"}</span></div>
                      <div className={`status-row ${scanReady ? "ready" : ""}`}><span className="status-mark" />FACE DETECTION<span>{scanReady ? "PREVIEW" : "PENDING"}</span></div>
                      <div className="status-row"><span className="status-mark" />FACE EMBEDDING<span>ADAPTER OFFLINE</span></div>
                      <div className="scan-note">The detector and embedding adapter are not configured in this environment. The interface will not claim a face match without real inference.</div>
                    </div>
                  </div>
                  <div className="stage-actions"><span className="file-label">{fileName || "NO IMAGE SELECTED"}</span><div><button className="text-button" onClick={loadDemo}>LOAD LOCAL PREVIEW</button><button className="glass-button solid-button" onClick={startSearch} disabled={!image}>Start Search <ChevronRight size={15} /></button></div></div>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) chooseFile(file); }} />
                </div>
              )}

              {stage === 1 && (
                <div className="stage-content search-content">
                  <div className="stage-intro"><span className="section-overline">02 / SEARCH</span><h3>Searching for<br /><em>the source.</em></h3><p>Compare the selected face against genuine web and social-media results.</p></div>
                  <div className="search-layout">
                    <div className="search-visual glass-panel"><div className="scan-beam" /><PixelArc active={searching} /><strong>{searching ? searchSteps[searchStep] : searchUnavailable ? "SEARCH UNAVAILABLE" : "SEARCH READY"}</strong><small>{searching ? "REQUEST IN FLIGHT / WAITING FOR PROVIDER" : "NO EXTERNAL PROVIDER RESPONSE"}</small></div>
                    <div className="search-status-list">{searchSteps.map((item, index) => <div className={`search-status-row ${index < searchStep || (!searching && searchUnavailable) ? "seen" : ""} ${searching && index === searchStep ? "active" : ""}`} key={item}><span>{index < searchStep || (!searching && searchUnavailable) ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span>{item}</div>)}</div>
                  </div>
                  {searchUnavailable && <div className="unavailable-panel"><CircleAlert size={17} /><div><strong>SEARCH UNAVAILABLE</strong><span>Unable to reach a configured genuine search provider. No candidate, similarity score, or source URL is shown.</span></div><button className="text-button" onClick={startSearch}>RETRY</button></div>}
                </div>
              )}

              {stage === 2 && (
                <div className="stage-content source-content">
                  <div className="stage-intro"><span className="section-overline">03 / SOURCE</span><h3>A potential source<br /><em>will appear here.</em></h3><p>Only genuine provider results are eligible for evidence review and proof.</p></div>
                  <div className="empty-source glass-panel"><div className="empty-source-icon"><Search size={25} /></div><div><strong>NO SOURCE AVAILABLE</strong><span>Connect a genuine search provider to populate source candidates.</span></div><div className="source-fields"><span>PLATFORM <b>—</b></span><span>SOURCE <b>—</b></span><span>AUTHOR <b>—</b></span><span>DATE <b>—</b></span><span>FACE SIMILARITY <b>—</b></span></div></div>
                  <div className="stage-actions"><span className="file-label">POTENTIAL MATCH / NOT CALCULATED</span><button className="glass-button" onClick={() => setStage(1)}>Back to Search <ChevronRight size={15} /></button></div>
                </div>
              )}

              {stage === 3 && (
                <div className="stage-content proof-content" id="proof">
                  <div className="stage-intro"><span className="section-overline">04 / PROOF</span><h3>Anchor the<br /><em>source.</em></h3><p>Create a deterministic fingerprint of the discovered content and record it on-chain.</p></div>
                  <div className="proof-layout">
                    <div className="proof-fields glass-panel"><div><span>CONTENT FINGERPRINT</span><strong>—</strong><small>SHA-256 / awaiting source</small></div><div><span>SOURCE FINGERPRINT</span><strong>—</strong><small>SHA-256 / awaiting source</small></div></div>
                    <div className="blockchain-panel glass-panel"><div className="blockchain-row"><span>NETWORK</span><strong>POLYGON AMOY</strong></div><div className="blockchain-row"><span>STATUS</span><strong>READY WHEN SOURCE IS FOUND</strong></div><div className="blockchain-flow"><span>CONTENT</span><i /><span>HASH</span><i /><span>CHAIN</span></div><button className="glass-button solid-button" disabled>Anchor on Chain <Hash size={15} /></button></div>
                  </div>
                  <div className="unavailable-panel"><CircleAlert size={17} /><div><strong>PROOF NOT READY</strong><span>A real candidate source and canonical content are required before signing or broadcasting.</span></div></div>
                </div>
              )}

              {stage === 4 && (
                <div className="stage-content verify-content">
                  <div className="stage-intro"><span className="section-overline">05 / VERIFY</span><h3>Does the content<br /><em>still match?</em></h3><p>Recalculate the fingerprint and compare it against the record stored on-chain.</p></div>
                  <div className="verify-layout"><div className="hash-block glass-panel"><span>CURRENT CONTENT</span><strong>—</strong><small>SHA-256</small></div><div className="hash-connector" /><div className="hash-block glass-panel"><span>ON-CHAIN RECORD</span><strong>—</strong><small>SHA-256</small></div></div>
                  <div className="verify-empty"><ShieldCheck size={22} /><strong>VERIFICATION WAITING</strong><span>A matching on-chain record will appear here after proof anchoring.</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="about-strip" id="about">
        <div><span className="section-overline">ABOUT THE SYSTEM</span><h2>Face <em>→</em> source <em>→</em> proof.</h2></div>
        <p>Goa Trace is a forensic provenance interface for the Hacker House Goa Task 3 brief. Similarity is a signal. A content fingerprint is the evidence primitive.</p>
      </section>

      <footer className="cinematic-footer"><div><GoaTraceMark /><span>HH GOA 2026 / TASK 03</span></div><div><span>AI × SEARCH × BLOCKCHAIN</span><span>FIND THE SOURCE. VERIFY THE PROOF.</span></div></footer>
    </main>
  );
}
