import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { evaluateBreakAnalysis } from "../../data/evaluate";
import type { BreakAnalysis } from "../../data/evaluate";
import { productsForSet } from "../../data/catalog";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { decodeLegacySearch } from "../../domain/legacy";
import { createAuction } from "../../domain/auction";
import { createBreakShareUrl, decodeBuyerShare } from "../../domain/share-url";
import type { BreakLine } from "../../domain/types";
import { cleanupLegacyStorage, readSessionDraft, writeSessionLines } from "../../persistence";
import { Builder, EmptyBreak } from "../shared/ProductBuilder";
import { CompactWarning } from "../shared/Feedback";
import { SellerView } from "./SellerView";

/** Owns seller composition and analysis state; it never hydrates buyer decisions. */
export function SellerWorkspace({ exit }: { exit: () => void }) {
  const legacy = useMemo(() => decodeLegacySearch(location.search), []);
  const sharedBuyer = useMemo(() => decodeBuyerShare(location.search), []);
  const [lines, setLines] = useState<BreakLine[]>(() => legacy.length ? legacy : readSessionDraft("seller").lines);
  const [builder, setBuilder] = useState(false);
  const [builderOpener, setBuilderOpener] = useState<HTMLElement | null>(null);
  const [analysis, setAnalysis] = useState<BreakAnalysis>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [legacyNotice, setLegacyNotice] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [shareStatus, setShareStatus] = useState<string>();
  const request = useRef(0);
  const [transactionCount, setTransactionCount] = useState(() => sharedBuyer.assignmentMode === "large" ? (sharedBuyer.largeSpots ?? 120) : 8);
  const sharedHref = createBreakShareUrl(`${location.origin}${location.pathname}#buyer`, { lines, assignmentMode: "pick", selectedSlots: ["W"], remaining: createAuction().remaining, bulkEnabled: true, bulkThreshold: 2, largeSpots: transactionCount });
  useEffect(() => { if (cleanupLegacyStorage()) setLegacyNotice(true); }, []);
  useEffect(() => { try { writeSessionLines("seller", lines); } catch { /* session persistence is optional */ } }, [lines]);
  useEffect(() => { if (location.search) history.replaceState(null, "", `${location.pathname}#seller`); }, []);
  useLayoutEffect(() => {
    if (!lines.length) { setAnalysis(undefined); setBusy(false); return; }
    const current = ++request.current;
    setAnalysis(undefined); setBusy(true); setError(undefined);
    evaluateBreakAnalysis(lines, 0).then((next) => { if (current === request.current) setAnalysis(next); }).catch((reason) => { if (current === request.current) setError(reason instanceof Error ? reason.message : String(reason)); }).finally(() => { if (current === request.current) setBusy(false); });
  }, [lines, generation]);
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
  const share = async () => { try { await navigator.clipboard.writeText(sharedHref); setShareStatus("Buyer setup link copied"); } catch { setShareStatus("Clipboard unavailable — copy the displayed buyer setup URL."); } };
  return <>
    <nav><button className="wordmark" onClick={exit}><span className="brand-mark"><Sparkles /></span>COLORBREAK</button><div className="nav-actions">{lines.length > 0 && <button className="icon-button" onClick={share} title="Copy buyer break setup — excludes seller costs and actuals." aria-label="Copy buyer break setup"><Copy /></button>}</div></nav>
    {legacyNotice && <p role="status">Legacy durable drafts were removed because they could contain financial data. Current drafts stay only in this browser session.</p>}
    {shareStatus && <p role="status">{shareStatus} <input aria-label="Buyer setup URL" readOnly value={sharedHref} /></p>}
    <main className="workspace page" tabIndex={-1} data-focus-fallback><header className="workspace-title"><div><p className="eyebrow">SELLER · BREAK PLAN</p><h1>Seller Studio</h1></div></header>
      {!lines.length ? <EmptyBreak add={openBuilder} /> : <div className="seller-studio-shell">{busy && <div className="calculating" role="status" aria-live="polite"><span />Calculating exact contents and prices…</div>}{error && <CompactWarning title="Couldn’t load this result" summary="The same composition is still available to retry." className="load-warning"><p role="alert">{error}</p><button type="button" className="quiet" onClick={() => setGeneration((value) => value + 1)}>Retry analysis</button></CompactWarning>}{analysis && !busy && <SellerView analysis={analysis} lines={lines} transactionCount={transactionCount} add={openBuilder} update={update} remove={(id) => setLines((rows) => rows.filter((row) => row.id !== id))} />}</div>}
    </main>
    <Builder open={builder} onClose={() => setBuilder(false)} lines={lines} invokingElement={builderOpener} onApply={(nextLines, settings) => { setLines(nextLines); if (settings?.largeSpots != null) setTransactionCount(settings.largeSpots); }} />
  </>;
}
