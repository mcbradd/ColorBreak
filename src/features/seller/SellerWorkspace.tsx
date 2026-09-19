import { useShareFeedback } from "../shared/ShareFeedback";
import { CommandPanel } from "../shared/CommandPanel";
import { bestAvailableAnalysis } from "../../data/answer-cache";
import { answerFactors } from "../../domain/answer-quality";
import { AnswerProvider } from "../shared/Answer";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { evaluateBreakAnalysis } from "../../data/evaluate";
import type { BreakAnalysis } from "../../data/evaluate";
import { productsForSet } from "../../data/catalog";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { decodeLegacySearch } from "../../domain/legacy";
import { createAuction } from "../../domain/auction";
import { canonicalCompositionFingerprint } from "../../domain/canonical-composition";
import { createBreakShareUrl, decodeBuyerShare } from "../../domain/share-url";
import type { BreakLine } from "../../domain/types";
import { cleanupLegacyStorage, readSessionDraft, writeSessionLines } from "../../persistence";
import { Builder } from "../shared/ProductBuilder";
import { QuickBreakComposer } from "../shared/QuickBreakComposer";
import { CompactWarning } from "../shared/Feedback";
import { SellerGlance } from "./SellerGlance";

// The long economics/receipt workbench arrives after the first usable value.
const SellerView = lazy(() => import("./SellerView").then(module => ({ default: module.SellerView })));

/** Owns seller composition and analysis state; it never hydrates buyer decisions. */
export function SellerWorkspace({ exit }: { exit: () => void }) {
  const legacy = useMemo(() => decodeLegacySearch(location.search), []);
  const sharedBuyer = useMemo(() => decodeBuyerShare(location.search), []);
  const [lines, setLines] = useState<BreakLine[]>(() => legacy.length ? legacy : readSessionDraft("seller").lines);
  const [builder, setBuilder] = useState(false);
  const [builderOpener, setBuilderOpener] = useState<HTMLElement | null>(null);
  const [analysis, setAnalysis] = useState<BreakAnalysis>();
  const [analysisRevision, setAnalysisRevision] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [legacyNotice, setLegacyNotice] = useState(false);
  const [generation, setGeneration] = useState(0);
  const { copy, toast } = useShareFeedback();
  const request = useRef(0);
  // Acquisition costs and hydrated display metadata do not change card values.
  const calculationRevision = `${canonicalCompositionFingerprint(lines)}:${generation}`;
  const analysisCurrent = Boolean(analysis && analysisRevision === calculationRevision && !busy);
  const [transactionCount, setTransactionCount] = useState(() => sharedBuyer.assignmentMode === "large" ? (sharedBuyer.largeSpots ?? 120) : 8);
  const sharedHref = createBreakShareUrl(`${location.origin}${location.pathname}#buyer`, { lines, assignmentMode: "pick", selectedSlots: ["W"], remaining: createAuction().remaining, bulkEnabled: true, bulkThreshold: 2, largeSpots: transactionCount });
  useEffect(() => { if (cleanupLegacyStorage()) setLegacyNotice(true); }, []);
  useEffect(() => { try { writeSessionLines("seller", lines); } catch { /* session persistence is optional */ } }, [lines]);
  useEffect(() => { history.replaceState(null, "", lines.length ? sharedHref.replace("#buyer", "#seller") : `${location.pathname}#seller`); }, [sharedHref, lines.length]);
  useLayoutEffect(() => {
    const current = ++request.current;
    if (!lines.length) {
      setAnalysis(undefined); setAnalysisRevision(undefined); setBusy(false); setError(undefined);
    } else {
      // Keep the last result available for a marked updating state. It cannot
      // drive current decisions until its composition revision matches again.
      setAnalysis(bestAvailableAnalysis(lines, 0));
      setBusy(true); setError(undefined);
      evaluateBreakAnalysis(lines, 0).then((next) => {
        if (current !== request.current) return;
        setAnalysis(next); setAnalysisRevision(calculationRevision);
      }).catch((reason) => {
        if (current === request.current) setError(reason instanceof Error ? reason.message : String(reason));
      }).finally(() => {
        if (current === request.current) setBusy(false);
      });
    }
    return () => { if (current === request.current) request.current += 1; };
  }, [calculationRevision]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(lines.map(async (line) => {
      const choices = line.tcgId == null ? await productsForSet(line.set) : [];
      const key = line.productKey.replace(/^sealed:/, "");
      const choice = choices.find((product) => product.sealedKey === key || product.key === key);
      const tcgId = line.tcgId ?? choice?.tcgId;
      return { id: line.id, choice, price: line.marketCost ?? await sealedMarketPrice(line.set, tcgId) };
    })).then((priced) => { if (!cancelled) setLines((current) => current.map((line) => { const row = priced.find((candidate) => candidate.id === line.id); return !row ? line : { ...line, ...(row.choice ? { tcgId: row.choice.tcgId, productLabel: row.choice.label, packCount: row.choice.packCount } : {}), ...(line.marketCost == null && row.price != null ? { marketCost: row.price } : {}) }; })); });
    return () => { cancelled = true; };
  }, [lines.map((line) => `${line.id}:${line.productKey}:${line.tcgId ?? ""}`).join("|")]);
  const openBuilder = (opener?: HTMLElement) => { setBuilderOpener(opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)); setBuilder(true); };
  const update = (id: string, patch: Partial<BreakLine>) => setLines((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const share = () => copy(sharedHref);
  return <>
    <nav><button className="wordmark" onClick={exit}><span className="brand-mark"><Sparkles /></span>COLORBREAK</button><div className="nav-actions">{lines.length > 0 && <button className="icon-button" onClick={share} title="Copy break link — private costs are excluded." aria-label="Copy break link"><Copy /></button>}</div></nav>
    {legacyNotice && <p role="status">Legacy durable drafts were removed because they could contain financial data. Current drafts stay only in this browser session.</p>}
    {toast}
    <AnswerProvider value={analysis ? answerFactors(analysis.valuation, analysis.outcomeModel.complete, busy, analysis.outcomeOmissions) : []}><main className="workspace page seller-fast command-workspace" tabIndex={-1} data-focus-fallback><header className="workspace-title"><div><p className="eyebrow">SELLER STUDIO</p><h1>Build &amp; value a break</h1></div></header>
      <CommandPanel panels={[{ id: "products", label: "Break", target: "seller-products" }, { id: "values", label: "Values", target: "seller-value" }, { id: "plan", label: "Plan", target: "seller-plan" }]}>
      <div className="seller-fast-grid">
        <div id="seller-products" data-command-panel="products" tabIndex={-1}><QuickBreakComposer lines={lines} onChange={setLines} onImport={openBuilder} /></div>
        <div data-command-panel="values"><SellerGlance lines={lines} analysis={analysis} current={analysisCurrent} busy={busy} /></div>
      </div>
      {error && <CompactWarning title="Couldn’t load this result" summary="Your products are saved. Retry the calculation." className="load-warning"><p role="alert">{error}</p><button type="button" className="quiet" onClick={() => setGeneration((value) => value + 1)}>Retry analysis</button></CompactWarning>}
      <div id="seller-plan" data-command-panel="plan" tabIndex={-1}>{!analysis && <p>Add a product in Break to see pricing and profit.</p>}{analysis && <fieldset className="seller-fast-plan" aria-busy={!analysisCurrent}>
        <legend>Price the break</legend>
        {!analysisCurrent && <p className="glance-updating">{busy ? "Updating seller economics for your new mix…" : "Retry analysis to update seller economics."}</p>}
        <Suspense fallback={<p role="status">Loading pricing tools… Your break values are ready in Values.</p>}><SellerView compact analysis={analysis} lines={lines} transactionCount={transactionCount} add={() => { document.querySelector<HTMLInputElement>(".quick-search-field input")?.focus(); document.querySelector(".quick-break-composer")?.scrollIntoView({ block: "start" }); }} update={update} remove={(id) => setLines((rows) => rows.filter((row) => row.id !== id))} /></Suspense>
      </fieldset>}</div>
      </CommandPanel>
    </main></AnswerProvider>
    <Builder open={builder} initialMode="paste" onClose={() => setBuilder(false)} lines={lines} invokingElement={builderOpener} onApply={(nextLines, settings) => { setLines(nextLines); if (settings?.largeSpots != null) setTransactionCount(settings.largeSpots); }} />
  </>;
}
