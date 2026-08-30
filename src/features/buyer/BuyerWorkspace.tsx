import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  ChevronRight,
  CircleHelp,
  Copy,
  DollarSign,
  Lock,
  PackagePlus,
  RotateCw,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { catalogSets, productsForSet, readinessForProduct } from "../../data/catalog";
import type { DecisionReadiness } from "../../domain/decision-readiness";
import { evaluateBreakAnalysis } from "../../data/evaluate";
import type { BreakAnalysis } from "../../data/evaluate";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { createAuction, toggleSlotTaken } from "../../domain/auction";
import type { AuctionState } from "../../domain/auction";
import { decodeLegacySearch } from "../../domain/legacy";
import { mergeBreakLines, parseBreakImport } from "../../domain/break-import";
import { createBreakShareUrl, decodeBuyerShare, type AssignmentMode } from "../../domain/share-url";
import {
  calculateProfit,
  requiredHammer,
  WHATNOT_US,
} from "../../domain/marketplace";
import { recommendBid, solveFinancialCap } from "../../domain/buyer-treatment";
import type { ValueRule } from "../../domain/buyer-treatment";
import { completeCost, sellerPlanStatus } from "../../domain/seller-plan";
import { actualLedgerSummary, validateActualLedger, type ActualOrder, type ActualShipment } from "../../domain/actual-ledger";
import { decisionAvailability, decisionEligibility, resolvedOnlyLimit } from "../../domain/valuation";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { deduplicateOmissions } from "../../domain/omissions";
import { simulateOutcomesAsync } from "../../domain/simulation-client";
import type { DistributionSummary, PackOutcomeModel, SimulationResult } from "../../domain/simulation";
import type {
  BreakLine,
  Contributor,
  MarketplacePreset,
  ProductChoice,
  SetChoice,
  SlotId,
  SlotValuation,
  Transaction,
  ValuationResult,
} from "../../domain/types";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import { useMobileInputViewport } from "../../mobile-input-viewport";
import { track } from "../../analytics";
import { chaseMapLayout } from "../../constellation-layout";
import { runtimeReleaseContext, buyerDecisionPresentation, type ReleaseContext } from "../../release-context";
import { manualBudgetCap } from "../../domain/manual-budget";
import { READY_EXAMPLES, readyExampleLine } from "../../data/ready-examples";
import { createLargeBreakPlan, sortNamedCards, summarizeAssignmentValues } from "../../domain/large-break";
import type { TopCardSort } from "../../domain/large-break";
import {
  cleanupLegacyStorage,
  clearColorBreakBrowserStorage,
  defaultSellerPlanDraft,
  readBuyerDecisionRecord,
  readSellerPlanDraft,
  readSessionDraft,
  writeBuyerDecisionRecord,
  writeSellerPlanDraft,
  sellerPlanMatches,
  sellerPlanOwner,
  writeSessionLines,
  type SellerPlanDraft,
} from "../../persistence";
import { Builder, EmptyBreak, ManualBudgetCap } from "../shared/ProductBuilder";
import { CompactWarning } from "./BuyerVisuals";
import { BuyerSetup } from "./BuyerSetup";
import { BuyerView, LargeBreakView } from "./BuyerDetails";

/** Owns only buyer decision state; seller planning has its own controller. */
export function BuyerWorkspace({
  exit,
  startFresh,
  startReady,
}: {
  exit: () => void;
  startFresh: boolean;
  startReady: boolean;
}) {
  const mode = "buyer" as const;
  const legacy = useMemo(() => decodeLegacySearch(location.search), []);
  const sharedBuyer = useMemo(() => decodeBuyerShare(location.search), []);
  const isSharedBreak = legacy.length > 0;
  const initialBuyerRecord = useMemo(() => readBuyerDecisionRecord(), []);
  const firstResultTracked = useRef(false);
  const [legacyNotice, setLegacyNotice] = useState(false);
  const calculationStarted = useRef(Date.now());
  const analysisRequest = useRef(0);
  const [lines, setLines] = useState<BreakLine[]>(() =>
      startFresh ? [] : legacy.length ? legacy : readSessionDraft("buyer").lines,
    ),
    [builder, setBuilder] = useState(false),
    [builderOpener, setBuilderOpener] = useState<HTMLElement | null>(null),
    [analysis, setAnalysis] = useState<BreakAnalysis>(),
    [auction, setAuction] = useState<AuctionState>(() => {
      return sharedBuyer.remaining?.length ? createAuction(sharedBuyer.remaining) : createAuction();
    }),
    [error, setError] = useState<string>(),
    [bulkThreshold, setBulkThreshold] = useState(() => sharedBuyer.bulkThreshold ?? 2),
    [bulkEnabled, setBulkEnabled] = useState(() => sharedBuyer.bulkEnabled ?? true),
    [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(() => sharedBuyer.assignmentMode),
    [buyerBid, setBuyerBid] = useState<number | undefined>(),
    [buyerShipping, setBuyerShipping] = useState<number | undefined>(),
    [largeSpots, setLargeSpots] = useState<number>(() => {
      return sharedBuyer.largeSpots ?? 120;
    }),
    [selectedSlot, setSelectedSlot] = useState<SlotId>(() => {
      return sharedBuyer.selectedSlot ?? "W";
    }),
    [busy, setBusy] = useState(false),
    [calculationGeneration, setCalculationGeneration] = useState(0);
  const [manualCapOpen, setManualCapOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<number>();
  const [manualShipping, setManualShipping] = useState<number>();
  const [manualHammer, setManualHammer] = useState<number>();
  const [recoveryRecord, setRecoveryRecord] = useState(() => isSharedBreak ? initialBuyerRecord : undefined);
  const [buyerRecoveryReady, setBuyerRecoveryReady] = useState(() => !initialBuyerRecord || isSharedBreak);
  const [importUndo, setImportUndo] = useState<{
    lines: BreakLine[];
    assignmentMode: AssignmentMode;
    largeSpots: number;
    bulkEnabled: boolean;
    bulkThreshold: number;
  }>();
  const threshold = bulkEnabled ? bulkThreshold : 0;
  useEffect(() => { if (startReady) setLines([readyExampleLine()]); }, [startReady]);
  useEffect(() => { if (cleanupLegacyStorage()) setLegacyNotice(true); }, []);
  useEffect(() => {
    try {
      writeSessionLines("buyer", lines);
    } catch {
      /* persistence is optional */
    }
  }, [lines]);
  useEffect(() => {
    if (!buyerRecoveryReady) return;
    writeBuyerDecisionRecord({
      lines,
      // A record is not hydrated until its evaluated data version agrees. The
      // pending marker keeps a brand-new local draft atomic before first load.
      dataVersion: analysis?.valuation.dataVersion ?? "pending",
      assignmentMode,
      selectedSlot,
      remaining: auction.remaining,
      bulkEnabled,
      bulkThreshold,
      largeSpots,
    }, { bid: buyerBid, shipping: buyerShipping });
  }, [analysis?.valuation.dataVersion, assignmentMode, auction.remaining, bulkEnabled, bulkThreshold, buyerBid, buyerRecoveryReady, buyerShipping, largeSpots, lines, selectedSlot]);
  const sharedHref = createBreakShareUrl(`${location.origin}${location.pathname}#buyer`, {
    lines,
    assignmentMode,
    selectedSlot,
    remaining: auction.remaining,
    bulkEnabled,
    bulkThreshold,
    largeSpots,
  });
  useEffect(() => {
    if (location.search) history.replaceState(null, "", `${location.pathname}#buyer`);
  }, []);
  useLayoutEffect(() => {
    if (!lines.length) {
      setAnalysis(undefined);
      setBusy(false);
      return;
    }
    const request = ++analysisRequest.current;
    // Never label the previous composition/threshold result as current while
    // the latest calculation is pending.
    setAnalysis(undefined);
    setBusy(true);
    calculationStarted.current = Date.now();
    setError(undefined);
    evaluateBreakAnalysis(lines, threshold)
      .then((next) => {
        if (request !== analysisRequest.current) return;
        setAnalysis(next);
        if (!firstResultTracked.current) {
          const elapsed = Date.now() - calculationStarted.current;
          track("calculation_completed", {
            mode,
            productCount: lines.length,
            durationBucket: elapsed < 10_000 ? "under-10s" : "10s-plus",
            status: next.valuation.status,
          });
          firstResultTracked.current = true;
        }
      })
      .catch((e) => {
        if (request !== analysisRequest.current) return;
        setError(e instanceof Error ? e.message : String(e));
        // Errors are intentionally not transmitted: failure details can be sensitive.
      })
      .finally(() => {
        if (request === analysisRequest.current) setBusy(false);
      });
  }, [lines, threshold, calculationGeneration]);
  useEffect(() => {
    if (buyerRecoveryReady || !initialBuyerRecord || !analysis || recoveryRecord) return;
    const recovered = readBuyerDecisionRecord({
      lines,
      dataVersion: analysis.valuation.dataVersion,
      assignmentMode: initialBuyerRecord.assignmentMode,
      selectedSlot: initialBuyerRecord.selectedSlot,
      remaining: initialBuyerRecord.remaining,
      bulkEnabled: initialBuyerRecord.bulkEnabled,
      bulkThreshold: initialBuyerRecord.bulkThreshold,
      largeSpots: initialBuyerRecord.largeSpots,
    });
    if (recovered) {
      setAuction(createAuction(recovered.remaining));
      setAssignmentMode(recovered.assignmentMode);
      setSelectedSlot(recovered.selectedSlot);
      setBulkEnabled(recovered.bulkEnabled);
      setBulkThreshold(recovered.bulkThreshold);
      setLargeSpots(recovered.largeSpots);
      setBuyerBid(recovered.bid);
      setBuyerShipping(recovered.shipping);
    }
    setBuyerRecoveryReady(true);
  }, [analysis, buyerRecoveryReady, initialBuyerRecord, lines, recoveryRecord]);
  const update = (id: string, patch: Partial<BreakLine>) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const openBuilder = (opener?: HTMLElement) => {
    setBuilderOpener(opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    setBuilder(true);
  };
  useEffect(() => {
    let cancelled = false;
    Promise.all(lines.map(async (line) => {
      const choices = line.tcgId == null ? await productsForSet(line.set) : [];
      const key = line.productKey.replace(/^sealed:/, "");
      const choice = choices.find((product) => product.sealedKey === key || product.key === key);
      const tcgId = line.tcgId ?? choice?.tcgId;
      return {
        id: line.id,
        choice,
        price: line.marketCost ?? await sealedMarketPrice(line.set, tcgId),
      };
    })).then((priced) => {
      if (cancelled) return;
      setLines((current) => current.map((line) => {
        const row = priced.find((candidate) => candidate.id === line.id);
        if (!row) return line;
        return {
          ...line,
          ...(row.choice ? { tcgId: row.choice.tcgId, productLabel: row.choice.label, packCount: row.choice.packCount } : {}),
          ...(line.marketCost == null && row.price != null ? { marketCost: row.price } : {}),
        };
      }));
    });
    return () => { cancelled = true; };
  }, [lines.map((line) => `${line.id}:${line.productKey}:${line.tcgId ?? ""}`).join("|")]);
  const [shareStatus, setShareStatus] = useState<string>();
  const share = async () => {
    try { await navigator.clipboard.writeText(sharedHref); setShareStatus("Buyer setup link copied"); }
    catch { setShareStatus("Clipboard unavailable — copy the displayed buyer setup URL."); }
    track("buyer_setup_copied", { mode, productCount: lines.length });
  };
  return (
    <>
      <nav>
        <button className="wordmark" onClick={exit}>
          <span className="brand-mark">
            <Sparkles />
          </span>
          COLORBREAK
        </button>
        <div className="nav-actions">
          {lines.length > 0 && <button
            className="icon-button"
            onClick={share}
            title="Copy buyer break setup — excludes bids, shipping, seller costs, and actuals."
            aria-label="Copy buyer break setup"
          >
            <Copy />
          </button>}
        </div>
      </nav>
      {legacyNotice && <p role="status">Legacy durable drafts were removed because they could contain financial data. Current drafts stay only in this browser session.</p>}
      {recoveryRecord && <aside className="buyer-recovery-choice" aria-label="Saved buyer decision recovery">
        <div>
          <strong>Saved decision found</strong>
          <p>Resume the saved {recoveryRecord.lines.map((line) => `${line.quantity}× ${line.set} ${line.productLabel}`).join(", ")} decision, or use this shared break without its private bid and shipping.</p>
        </div>
        <div className="buyer-recovery-actions">
          <button type="button" className="primary" onClick={() => {
            setLines(recoveryRecord.lines);
            setAuction(createAuction(recoveryRecord.remaining));
            setAssignmentMode(recoveryRecord.assignmentMode);
            setSelectedSlot(recoveryRecord.selectedSlot);
            setBulkEnabled(recoveryRecord.bulkEnabled);
            setBulkThreshold(recoveryRecord.bulkThreshold);
            setLargeSpots(recoveryRecord.largeSpots);
            setBuyerBid(recoveryRecord.bid);
            setBuyerShipping(recoveryRecord.shipping);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Resume saved decision</button>
          <button type="button" className="quiet" onClick={() => {
            setBuyerBid(undefined);
            setBuyerShipping(undefined);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Use this shared break</button>
          <button type="button" className="quiet" onClick={() => {
            setLines([]);
            setAuction(createAuction());
            setAssignmentMode("pick");
            setSelectedSlot("W");
            setBulkEnabled(true);
            setBulkThreshold(2);
            setLargeSpots(120);
            setBuyerBid(undefined);
            setBuyerShipping(undefined);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Start clean</button>
        </div>
      </aside>}
      {shareStatus && <p role="status">{shareStatus} <input aria-label="Buyer setup URL" readOnly value={sharedHref} /></p>}
      <main className="workspace page" tabIndex={-1} data-focus-fallback>
        <header className="workspace-title">
          <div>
            <p className="eyebrow">
              {assignmentMode === "large" ? "BUYER · LARGE BREAK" : "BUYER · BID CHECK"}
            </p>
            <h1>{assignmentMode === "large" ? "Large Break" : "Bid Check"}</h1>
          </div>
        </header>
        {importUndo && <aside className="import-undo" aria-live="polite">
          <span><b>Break updated</b><small>{lines.length} lines · practice composition updated</small></span>
          <button type="button" className="quiet" onClick={() => {
            setLines(importUndo.lines);
            setAssignmentMode(importUndo.assignmentMode);
            setLargeSpots(importUndo.largeSpots);
            setBulkEnabled(importUndo.bulkEnabled);
            setBulkThreshold(importUndo.bulkThreshold);
            setImportUndo(undefined);
          }}>Undo</button>
        </aside>}
        {isSharedBreak && lines.length > 0 && <aside className="shared-calculation-notice" aria-label="Shared calculation details">
          <Lock />
          <span><b>SHARED CALCULATION · USD · MODEL v4</b><small>Original link unchanged. Editing makes a local copy · {lines.length} products / {lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0)} openings · Prices observed {analysis?.priceAvailability?.observedAt ? new Date(analysis.priceAvailability.observedAt).toLocaleString() : "loading"}</small></span>
        </aside>}
        <>
          {lines.length > 0 && <div className="mobile-stage-nav" aria-label={assignmentMode === "large" ? "Large Break sections" : "Break sections"}><a href="#buyer-large-result">Decision</a>{assignmentMode === "large" && <a href="#buyer-large-assignments">Assignments</a>}<a href="#buyer-break-setup">{isSharedBreak ? "Customize" : "Edit break"}</a></div>}
          <div className={`bid-check-workbench ${lines.length ? "has-break" : "is-empty"}`}>
            <BuyerSetup
              lines={lines}
              add={openBuilder}
              update={update}
              remove={(id) => setLines((rows) => rows.filter((row) => row.id !== id))}
              result={analysis?.valuation}
              auction={auction}
              setAuction={setAuction}
              assignmentMode={assignmentMode}
              setAssignmentMode={setAssignmentMode}
              selected={selectedSlot}
              setSelected={setSelectedSlot}
              bulkEnabled={bulkEnabled}
              bulkThreshold={bulkThreshold}
              setBulkEnabled={setBulkEnabled}
              setBulkThreshold={setBulkThreshold}
              largeSpots={largeSpots}
              setLargeSpots={setLargeSpots}
            />
            <div id="buyer-large-result" className="results buyer-results">
              {manualCapOpen ? <ManualBudgetCap onBack={() => { setManualCapOpen(false); openBuilder(); }} target={manualTarget} setTarget={setManualTarget} shipping={manualShipping} setShipping={setManualShipping} hammer={manualHammer} setHammer={setManualHammer} /> : !lines.length && <section className="buyer-awaiting-break"><span><BarChart3 /></span><h2>Your decision appears here</h2><p><b>1</b> Add every product · <b>2</b> Enter the spot price · <b>3</b> Compare value and risk.</p><p>Need a live bid limit without verified current product data? Set your own budget cap.</p><button type="button" className="primary" onClick={() => setManualCapOpen(true)}>Use manual budget cap</button></section>}
              {busy && <div className="calculating" role="status" aria-live="polite"><span />Calculating exact contents and prices…</div>}
              {error && <CompactWarning title="Couldn’t load this result" summary="No verified modeled ceiling can be offered until this data loads." className="load-warning"><p role="alert">{error}</p><div className="buyer-recovery-actions"><button type="button" className="quiet" onClick={() => setCalculationGeneration((value) => value + 1)}>Retry analysis</button><button type="button" className="quiet" onClick={() => setManualCapOpen(true)}>Use manual budget cap</button></div></CompactWarning>}
              {analysis && (assignmentMode === "large" ? (
                <LargeBreakView analysis={analysis} lines={lines} spots={largeSpots} bid={buyerBid} setBid={setBuyerBid} shipping={buyerShipping} setShipping={setBuyerShipping} />
              ) : (
                <BuyerView
                  analysis={analysis}
                  auction={auction}
                  assignmentMode={assignmentMode}
                  selected={selectedSlot}
                  breakLabel={lines.length === 1 ? `${lines[0].quantity}× ${lines[0].set} ${lines[0].productLabel}` : `${lines.length} products`}
                  bid={buyerBid}
                  setBid={setBuyerBid}
                  shipping={buyerShipping}
                  setShipping={setBuyerShipping}
                  onChooseReady={() => setLines([readyExampleLine()])}
                  onUseManualCap={() => setManualCapOpen(true)}
                />
              ))}
            </div>
          </div>
        </>
      </main>
      <Builder
        open={builder}
        onClose={() => setBuilder(false)}
        lines={lines}
        invokingElement={builderOpener}
        onApply={(nextLines, settings) => {
          setImportUndo({ lines, assignmentMode, largeSpots, bulkEnabled, bulkThreshold });
          setLines(nextLines);
          if (settings) {
            setAssignmentMode(settings.assignmentMode);
            if (settings.largeSpots != null) setLargeSpots(settings.largeSpots);
            if (settings.bulkEnabled != null) setBulkEnabled(settings.bulkEnabled);
            if (settings.bulkThreshold != null) setBulkThreshold(settings.bulkThreshold);
          }
          track("product_selected", { mode, productCount: nextLines.length });
        }}
        onUseManualCap={() => { setBuilder(false); setManualCapOpen(true); }}
      />
    </>
  );
}

