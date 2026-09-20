import { useShareFeedback } from "../shared/ShareFeedback";
import { CommandPanel } from "../shared/CommandPanel";
import { bestAvailableAnalysis } from "../../data/answer-cache";
import { answerFactors } from "../../domain/answer-quality";
import { AnswerProvider } from "../shared/Answer";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, Lock, Sparkles } from "lucide-react";
import { productsForSet } from "../../data/catalog";
import type { BreakAnalysis } from "../../data/evaluate";
import { assessBuyerDecision, type BuyerDecisionAssessment, type PreparedProductSelection } from "../../domain/decision-evidence";
import { canonicalCompositionFingerprint } from "../../domain/canonical-composition";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { refreshPublishedPrices, type PriceRefreshResult } from "../../data/scryfall";
import { createAuction } from "../../domain/auction";
import type { AuctionState } from "../../domain/auction";
import { decodeLegacySearch } from "../../domain/legacy";
import { createBreakShareUrl, decodeBuyerShare, type AssignmentMode } from "../../domain/share-url";
import { SLOT_IDS } from "../../domain/types";
import type { BreakLine, SlotId } from "../../domain/types";
import { track } from "../../analytics";
import { readyExampleLine } from "../../data/ready-examples";
import {
  cleanupLegacyStorage,
  readBuyerDecisionRecord,
  readSessionDraft,
  writeBuyerDecisionRecord,
  writeSessionLines,
} from "../../persistence";
import { useBuyerCosts } from "../shared/useBuyerCosts";
import { Builder, ManualBudgetCap } from "../shared/ProductBuilder";
import { CompactWarning, useOutcomeSimulation } from "./BuyerVisuals";
import { BuyerSetup } from "./BuyerSetup";
import { BuyerAssumptions } from "./BuyerAssumptions";
import { BuyerView, LargeBreakView, type PriceRefreshState } from "./BuyerDetails";

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
  // The workspace keeps the break in the address bar, so a reload lands on a
  // URL this browser wrote itself. The history entry says which it is; without
  // that marker your own reload would be announced as someone else's link.
  const ownUrl = useMemo(() => (history.state as { colorbreakOwn?: boolean } | null)?.colorbreakOwn === true, []);
  const isSharedBreak = legacy.length > 0 && !ownUrl;
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
    [decisionAssessment, setDecisionAssessment] = useState<BuyerDecisionAssessment>(),
    [preparedSelection, setPreparedSelection] = useState<PreparedProductSelection>(),
    [auction, setAuction] = useState<AuctionState>(() => {
      const legacyTaken = sharedBuyer.selectedSlots ?? [];
      return sharedBuyer.remaining?.length
        ? createAuction(sharedBuyer.remaining)
        : createAuction(SLOT_IDS.filter((slot) => !legacyTaken.includes(slot)));
    }),
    [error, setError] = useState<string>(),
    [bulkThreshold, setBulkThreshold] = useState(() => sharedBuyer.bulkThreshold ?? 2),
    [bulkEnabled, setBulkEnabled] = useState(() => sharedBuyer.bulkEnabled ?? true),
    // The normal buyer view calculates the remaining random-slot pool. Legacy
    // "pick" URLs stay readable but normalize to the standard format.
    [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(() => sharedBuyer.assignmentMode === "large" ? "large" : "random"),
    [buyerBid, setBuyerBid] = useState<number | undefined>(),
    [largeSpots, setLargeSpots] = useState<number>(() => {
      return sharedBuyer.largeSpots ?? 120;
    }),
    [targetSlots, setTargetSlots] = useState<SlotId[]>(() => (sharedBuyer.targetSlots ?? []).filter((slot) => !sharedBuyer.remaining || sharedBuyer.remaining.includes(slot))),
    [busy, setBusy] = useState(false),
    // The buyer asked, so the buyer gets told what happened: the phase while
    // it runs, and the real answer after, including "nothing newer exists".
    [priceRefresh, setPriceRefresh] = useState<PriceRefreshState>("idle"),
    [calculationGeneration, setCalculationGeneration] = useState(0);
  const refreshRequest = useRef(0);
  const refreshBusy = useRef(false);
  const pendingPriceRefresh = useRef<{ request: number; context: string; result: PriceRefreshResult } | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [assumptionsOpener, setAssumptionsOpener] = useState<HTMLElement | null>(null);
  const [manualCapOpen, setManualCapOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<number>();
  const [manualShipping, setManualShipping] = useState<number>();
  const [manualHammer, setManualHammer] = useState<number>();
  const [recoveryRecord, setRecoveryRecord] = useState(() => isSharedBreak ? initialBuyerRecord : undefined);
  const [buyerRecoveryReady, setBuyerRecoveryReady] = useState(() => !initialBuyerRecord || isSharedBreak);
  const threshold = bulkEnabled ? bulkThreshold : 0;
  const updateAuction = (next: AuctionState) => {
    setAuction(next);
    setTargetSlots((current) => current.filter((slot) => next.remaining.includes(slot)));
  };
  const costSettings = useBuyerCosts(lines, analysis?.valuation, assignmentMode === "large" ? largeSpots : 8, 0);
  const costs = costSettings.costs;
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
    if (!buyerRecoveryReady || analysis?.valuation.dataVersion.startsWith("preview:")) return;
    writeBuyerDecisionRecord({
      lines,
      // A record is not hydrated until its evaluated data version agrees. The
      // pending marker keeps a brand-new local draft atomic before first load.
      dataVersion: analysis?.valuation.dataVersion ?? "pending",
      assignmentMode,
      selectedSlots: [],
      remaining: auction.remaining,
      bulkEnabled,
      bulkThreshold,
      largeSpots,
    }, { bid: buyerBid, shipping: costs.shipping });
  }, [analysis?.valuation.dataVersion, assignmentMode, auction.remaining, bulkEnabled, bulkThreshold, buyerBid, buyerRecoveryReady, costs.shipping, largeSpots, lines]);
  const sharedHref = createBreakShareUrl(`${location.origin}${location.pathname}#buyer`, {
    lines,
    assignmentMode,
    targetSlots,
    remaining: auction.remaining,
    bulkEnabled,
    bulkThreshold,
    largeSpots,
  });
  // A link only propagates a break if the address bar carries one. Stripping
  // the query on arrival meant the only shareable URL lived behind the share
  // control, and a recipient who forwarded what they saw sent an empty break.
  useEffect(() => {
    const target = lines.length ? new URL(sharedHref) : null;
    history.replaceState(
      { ...(history.state as object | null), colorbreakOwn: true },
      "",
      target ? `${target.pathname}${target.search}${target.hash}` : `${location.pathname}#buyer`,
    );
  }, [sharedHref, lines.length]);
  const refreshContext = `${canonicalCompositionFingerprint(lines)}|${threshold}`;
  // A completed request may only update the break that started it.
  useLayoutEffect(() => {
    refreshRequest.current += 1;
    refreshBusy.current = false;
    pendingPriceRefresh.current = null;
    setPriceRefresh("idle");
    return () => { refreshRequest.current += 1; refreshBusy.current = false; pendingPriceRefresh.current = null; };
  }, [refreshContext]);
  useLayoutEffect(() => {
    const request = ++analysisRequest.current;
    if (!lines.length) {
      setAnalysis(undefined);
      setDecisionAssessment(undefined);
      setBusy(false);
      return;
    }
    const refresh = pendingPriceRefresh.current;
    const finishRefresh = (result: PriceRefreshState) => {
      if (!refresh || refresh.request !== refreshRequest.current || refresh.context !== refreshContext) return;
      pendingPriceRefresh.current = null;
      refreshBusy.current = false;
      setPriceRefresh(result);
    };
    // Never label the previous composition/threshold result as current while
    // the latest calculation is pending.
    const transfer = preparedSelection;
    if (transfer && !refresh
      && transfer.compositionFingerprint === canonicalCompositionFingerprint(lines)
      && transfer.assessment.analysis.valuation.threshold === threshold
      && Date.now() <= transfer.assessment.assessedAt + transfer.assessment.policyThresholdMs) {
      setAnalysis(transfer.assessment.analysis);
      setDecisionAssessment(transfer.assessment);
      setPreparedSelection(undefined);
      setBusy(false);
      return;
    }
    setAnalysis(bestAvailableAnalysis(lines, threshold));
    setDecisionAssessment(undefined);
    setBusy(true);
    calculationStarted.current = Date.now();
    setError(undefined);
    assessBuyerDecision(lines, threshold)
      .then((next) => {
        if (request !== analysisRequest.current) return;
        setAnalysis(next.analysis);
        setDecisionAssessment(next);
        if (refresh) finishRefresh(refresh.result);
        if (!firstResultTracked.current) {
          const elapsed = Date.now() - calculationStarted.current;
          track("calculation_completed", {
            mode,
            productCount: lines.length,
            durationBucket: elapsed < 10_000 ? "under-10s" : "10s-plus",
            status: next.analysis.valuation.status,
          });
          firstResultTracked.current = true;
        }
      })
      .catch((e) => {
        if (request !== analysisRequest.current) return;
        setError(e instanceof Error ? e.message : String(e));
        finishRefresh("error");
        // Errors are intentionally not transmitted: failure details can be sensitive.
      })
      .finally(() => {
        if (request === analysisRequest.current) setBusy(false);
      });
    return () => { analysisRequest.current += 1; };
  }, [lines, threshold, calculationGeneration]);
  const refreshPrices = async () => {
    if (refreshBusy.current) return;
    const request = ++refreshRequest.current;
    refreshBusy.current = true;
    setPriceRefresh("searching");
    track("price_refresh_requested", { mode, productCount: lines.length });
    try {
      // Same publication check the product picker runs: usable prices survive a
      // failure, so a refused refresh never costs the buyer their estimate.
      const result = await refreshPublishedPrices((phase) => {
        if (request === refreshRequest.current) setPriceRefresh(phase);
      });
      if (request !== refreshRequest.current) return;
      pendingPriceRefresh.current = { request, context: refreshContext, result };
      setPriceRefresh("checking");
      setCalculationGeneration((generation) => generation + 1);
    } catch {
      if (request === refreshRequest.current) {
        refreshBusy.current = false;
        setPriceRefresh("error");
      }
    }
  };
  useEffect(() => {
    if (buyerRecoveryReady || !initialBuyerRecord || !analysis || analysis.valuation.dataVersion.startsWith("preview:") || recoveryRecord) return;
    const recovered = readBuyerDecisionRecord({
      lines,
      dataVersion: analysis.valuation.dataVersion,
      assignmentMode: initialBuyerRecord.assignmentMode,
      selectedSlots: initialBuyerRecord.selectedSlots,
      remaining: initialBuyerRecord.remaining,
      bulkEnabled: initialBuyerRecord.bulkEnabled,
      bulkThreshold: initialBuyerRecord.bulkThreshold,
      largeSpots: initialBuyerRecord.largeSpots,
    });
    if (recovered) {
      updateAuction(createAuction(recovered.remaining));
      setAssignmentMode(recovered.assignmentMode);
      setBulkEnabled(recovered.bulkEnabled);
      setBulkThreshold(recovered.bulkThreshold);
      setLargeSpots(recovered.largeSpots);
      setBuyerBid(recovered.bid);
    }
    setBuyerRecoveryReady(true);
  }, [analysis, buyerRecoveryReady, initialBuyerRecord, lines, recoveryRecord]);
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
    // A catalog or sealed-price fetch that fails leaves the break lines as the
    // buyer entered them; it must not surface as an unhandled rejection.
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [lines.map((line) => `${line.id}:${line.productKey}:${line.tcgId ?? ""}`).join("|")]);
  const { copy, toast } = useShareFeedback();
  // One simulation for the whole workspace: the slot rail's candles and the
  // decision's outcome range are two views of the same modeled openings.
  const activeBidTargets = targetSlots.filter((slot) => auction.remaining.includes(slot));
  const simulation = useOutcomeSimulation(analysis, activeBidTargets.length ? activeBidTargets : auction.remaining, undefined);
  const share = async () => {
    await copy(sharedHref);
    track("buyer_setup_copied", { mode, productCount: lines.length });
  };
  return (
    <>
      <nav className="buyer-topbar">
        <button className="wordmark" onClick={exit}>
          <span className="brand-mark">
            <Sparkles />
          </span>
          COLORBREAK
        </button>
        <h1 className="buyer-topbar-title">{assignmentMode === "large" ? "Custom" : "Check a bid"}</h1>
        <div className="nav-actions">
          {lines.length > 0 && <button
            className="icon-button share-break"
            onClick={share}
            title="Copy break link — private costs are excluded."
            aria-label="Copy break link"
          >
            <Copy />
            <span>Copy link</span>
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
            updateAuction(createAuction(recoveryRecord.remaining));
            setAssignmentMode(recoveryRecord.assignmentMode === "large" ? "large" : "random");
            setBulkEnabled(recoveryRecord.bulkEnabled);
            setBulkThreshold(recoveryRecord.bulkThreshold);
            setLargeSpots(recoveryRecord.largeSpots);
            setBuyerBid(recoveryRecord.bid);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Resume saved decision</button>
          <button type="button" className="quiet" onClick={() => {
            setBuyerBid(undefined);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Use this shared break</button>
          <button type="button" className="quiet" onClick={() => {
            setLines([]);
            updateAuction(createAuction());
            setAssignmentMode("random");
            setTargetSlots([]);
            setBulkEnabled(true);
            setBulkThreshold(2);
            setLargeSpots(120);
            setBuyerBid(undefined);
            setRecoveryRecord(undefined);
            setBuyerRecoveryReady(true);
          }}>Start clean</button>
        </div>
      </aside>}
      {toast}
      <AnswerProvider value={analysis ? answerFactors(analysis.valuation, analysis.outcomeModel.complete, busy, analysis.outcomeOmissions) : []}><main className="workspace page command-workspace" tabIndex={-1} data-focus-fallback>
        {isSharedBreak && lines.length > 0 && <aside className="shared-calculation-notice" aria-label="Shared calculation details">
          <Lock />
          <span><b>SHARED CALCULATION · USD · MODEL v4</b><small>Editing updates this break link · {lines.length} products / {lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0)} openings · Prices observed {analysis?.priceAvailability?.observedAt ? new Date(analysis.priceAvailability.observedAt).toLocaleString() : "loading"}</small></span>
        </aside>}
        <CommandPanel
          panels={[{ id: "products", label: "Break", target: "buyer-products" }]}
          actions={<BuyerAssumptions costs={costSettings} bulkEnabled={bulkEnabled} bulkThreshold={bulkThreshold} setBulkEnabled={setBulkEnabled} setBulkThreshold={setBulkThreshold} result={analysis?.valuation} open={assumptionsOpen} onOpenChange={setAssumptionsOpen} opener={assumptionsOpener} onOpen={() => setAssumptionsOpener(null)} />}
        >
          <div className={`bid-check-workbench ${lines.length ? "has-break" : "is-empty"}`}>
            <BuyerSetup
              lines={lines}
              onImport={openBuilder}
              onChange={setLines}
              result={analysis?.valuation}
              auction={auction}
              setAuction={updateAuction}
              assignmentMode={assignmentMode}
              setAssignmentMode={setAssignmentMode}
              targetSlots={activeBidTargets}
              setTargetSlots={setTargetSlots}
              costs={costs}
              distributions={simulation.result?.slotDistributions}
              largeSpots={largeSpots}
              setLargeSpots={setLargeSpots}
            />
            <div id="buyer-large-result" className="results buyer-results buyer-decision-stage" tabIndex={-1}>
              {!lines.length && <p>Add a product in Break to see your bid decision.</p>}
              {manualCapOpen ? <ManualBudgetCap onBack={() => { setManualCapOpen(false); openBuilder(); }} target={manualTarget} setTarget={setManualTarget} shipping={manualShipping} setShipping={setManualShipping} hammer={manualHammer} setHammer={setManualHammer} /> : null}
              {busy && <div className="calculating" role="status" aria-live="polite"><span />Improving the estimate…</div>}
              {error && <CompactWarning title="Couldn’t load this result" summary="The best available estimate remains visible. Retry to improve it." className="load-warning"><p role="alert">{error}</p><div className="buyer-recovery-actions"><button type="button" className="quiet" onClick={() => setCalculationGeneration((value) => value + 1)}>Retry analysis</button><button type="button" className="quiet" onClick={() => setManualCapOpen(true)}>Use manual budget cap</button></div></CompactWarning>}
              {analysis && (assignmentMode === "large" ? (
                <LargeBreakView analysis={analysis} lines={lines} spots={largeSpots} bid={buyerBid} setBid={setBuyerBid} costs={costs} onAdjustCosts={opener => { setAssumptionsOpener(opener); setAssumptionsOpen(true); }} />
              ) : (
                <BuyerView
                  analysis={analysis}
                  eligibility={decisionAssessment?.eligibility}
                  auction={auction}
                  targetSlots={activeBidTargets}
                  breakLabel={lines.length === 1 ? `${lines[0].quantity}× ${lines[0].set} ${lines[0].productLabel}` : `${lines.length} products`}
                  costs={costs}
                  simulation={simulation}
                  onChooseReady={() => setLines([readyExampleLine()])}
                  onUseManualCap={() => setManualCapOpen(true)}
                  priceRefresh={priceRefresh}
                  onRefreshPrices={refreshPrices}
                />
              ))}
            </div>
          </div>
        </CommandPanel>
      </main></AnswerProvider>
      <Builder
        open={builder}
        initialMode="paste"
        onClose={() => setBuilder(false)}
        lines={lines}
        invokingElement={builderOpener}
        valueThreshold={threshold}
        onApply={(nextLines, settings, prepared) => {
          setCalculationGeneration(value => value + 1);
          setPreparedSelection(prepared);
          setLines(nextLines);
          if (settings) {
            setAssignmentMode(settings.assignmentMode);
            if (settings.largeSpots != null) setLargeSpots(settings.largeSpots);
            if (settings.bulkEnabled != null) setBulkEnabled(settings.bulkEnabled);
            if (settings.bulkThreshold != null) setBulkThreshold(settings.bulkThreshold);
          }
          track("product_selected", { mode, productCount: nextLines.length });
        }}
      />
    </>
  );
}

