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
import { fmt, InformationLabel, NumberField, useDialogOwnership } from "./Primitives";

export function Builder({
  open,
  onClose,
  lines,
  onApply,
  invokingElement,
  onUseManualCap,
}: {
  open: boolean;
  onClose: () => void;
  lines: BreakLine[];
  onApply: (lines: BreakLine[], settings?: { assignmentMode: AssignmentMode; largeSpots?: number; bulkEnabled?: boolean; bulkThreshold?: number }) => void;
  invokingElement?: HTMLElement | null;
  onUseManualCap?: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectionRequest = useRef(0);
  const [sets, setSets] = useState<SetChoice[]>([]);
  const [query, setQuery] = useState("");
  const [setSort, setSetSort] = useState<"release" | "alphabetical">(
    "release",
  );
  const [selected, setSelected] = useState<SetChoice>();
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [readiness, setReadiness] = useState<Record<string, DecisionReadiness>>({});
  const [readyOnly, setReadyOnly] = useState(false);
  const [readyRows, setReadyRows] = useState<Array<{ product: ProductChoice; readiness: DecisionReadiness }>>([]);
  const [readyChecking, setReadyChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<BreakLine[]>([]);
  const [composerMode, setComposerMode] = useState<"search" | "paste" | "review">("search");
  const [importSource, setImportSource] = useState("");
  const [importRows, setImportRows] = useState<Array<{ source: string; line?: BreakLine; error?: string }>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importErrorsId = useId();
  const [importing, setImporting] = useState(false);
  const [importSettings, setImportSettings] = useState<{ assignmentMode: AssignmentMode; largeSpots?: number; bulkEnabled?: boolean; bulkThreshold?: number }>();
  useEffect(() => {
    if (open)
      catalogSets().then((rows) =>
        setSets(rows.sort((a, b) => b.released.localeCompare(a.released))),
      );
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setReadyChecking(true);
    void Promise.all(READY_EXAMPLES.map(async (example) => {
      const product = (await productsForSet(example.set)).find((item) => item.sealedKey === example.productKey);
      return product ? { product, readiness: await readinessForProduct(product) } : undefined;
    })).then((rows) => { if (active) setReadyRows(rows.filter((row): row is { product: ProductChoice; readiness: DecisionReadiness } => Boolean(row))); }).catch(() => { if (active) setReadyRows([]); }).finally(() => { if (active) setReadyChecking(false); });
    return () => { active = false; };
  }, [open]);
  useEffect(() => {
    if (!selected) { selectionRequest.current += 1; return; }
    const request = ++selectionRequest.current;
    setProducts([]);
    setReadiness({});
    setLoading(true);
    void (async () => {
      try {
        const rows = await productsForSet(selected.code);
        if (request !== selectionRequest.current) return;
        setProducts(rows);
        const entries: Array<[string, DecisionReadiness]> = [];
        const workerCount = Math.min(4, rows.length);
        let next = 0;
        await Promise.all(Array.from({ length: workerCount }, async () => {
          while (next < rows.length) {
            const product = rows[next++];
            entries.push([product.key, await readinessForProduct(product)]);
          }
        }));
        if (request !== selectionRequest.current) return;
        setReadiness(Object.fromEntries(entries));
      } finally {
        if (request === selectionRequest.current) setLoading(false);
      }
    })();
  }, [selected]);
  useEffect(() => {
    if (!open) {
      setSelected(undefined);
      setQuery("");
      setSetSort("release");
      setComposerMode("search");
      setImportSource("");
      setImportRows([]);
      setImportErrors([]);
      setImportSettings(undefined);
      setReadyOnly(false);
    } else {
      setDraft(lines);
    }
  }, [open, lines]);
  useDialogOwnership(open, onClose, dialogRef, closeRef, invokingElement);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = sets
    .filter((set) =>
      !normalizedQuery
      || set.name.toLocaleLowerCase().includes(normalizedQuery)
      || set.code.toLocaleLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => setSort === "release"
      ? right.released.localeCompare(left.released)
        || left.name.localeCompare(right.name)
      : left.name.localeCompare(right.name)
        || left.released.localeCompare(right.released));
  const choiceLine = (product: ProductChoice, quantity = 1): BreakLine => ({
      id: crypto.randomUUID(),
      set: product.set,
      productKey: product.sealedKey
        ? `sealed:${product.sealedKey}`
        : product.key,
      productLabel: product.label,
      quantity,
      packCount: product.packCount,
      tcgId: product.tcgId,
    });
  const add = (product: ProductChoice) => {
    setDraft((rows) => mergeBreakLines([...rows, choiceLine(product)]));
    setSelected(undefined);
    setQuery("");
  };
  const normalizeProduct = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const resolveImport = async () => {
    setImporting(true);
    setImportRows([]);
    setImportErrors([]);
    try {
      const parsed = parseBreakImport(importSource);
      if (parsed.kind === "list" && parsed.errors.length) {
        setImportErrors(parsed.errors);
        return;
      }
      const sourceRows = parsed.kind === "url"
        ? parsed.lines.map((line) => ({ source: `${line.set} · ${line.productKey} · ${line.quantity}`, set: line.set, product: line.productKey.replace(/^sealed:/, ""), quantity: line.quantity }))
        : parsed.lines;
      if (parsed.kind === "url") {
        const shared = decodeBuyerShare(new URL(importSource).search);
        setImportSettings({ assignmentMode: shared.assignmentMode, largeSpots: shared.largeSpots, bulkEnabled: shared.bulkEnabled, bulkThreshold: shared.bulkThreshold });
      } else setImportSettings(undefined);
      const resolved = await Promise.all(sourceRows.map(async (row) => {
        const choices = await productsForSet(row.set);
        const wanted = normalizeProduct(row.product.replace(/^sealed:/, ""));
        const exact = choices.find((choice) => {
          const key = normalizeProduct(choice.sealedKey ?? choice.key);
          const label = normalizeProduct(choice.label);
          return key === wanted || label === wanted;
        });
        const fuzzy = exact ?? choices.find((choice) => {
          const label = normalizeProduct(choice.label);
          return label.includes(wanted) || wanted.includes(label);
        });
        return fuzzy
          ? { source: row.source, line: choiceLine(fuzzy, row.quantity) }
          : { source: row.source, error: `No exact ${row.set} product matched “${row.product}”.` };
      }));
      setImportRows(resolved);
      setComposerMode("review");
    } catch (error) {
      setImportErrors([error instanceof Error ? error.message : String(error)]);
    } finally {
      setImporting(false);
    }
  };
  const applyImport = () => {
    const additions = importRows.flatMap((row) => row.line ? [row.line] : []);
    if (importRows.some((row) => row.error) || !additions.length) return;
    const next = importSettings ? mergeBreakLines(additions) : mergeBreakLines([...draft, ...additions]);
    setDraft(next);
    onApply(next, importSettings);
    setComposerMode("search");
    setImportSource("");
    setImportRows([]);
    onClose();
  };
  const totalOpenings = draft.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const importMatched = importRows.flatMap((row) => row.line ? [row.line] : []);
  const importOpeningCount = importMatched.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const importIssueCount = importRows.filter((row) => row.error).length;
  const groupedProducts = products.reduce<Record<string, ProductChoice[]>>(
    (groups, product) => {
      (groups[product.category] ??= []).push(product);
      return groups;
    },
    {},
  );
  const visibleProducts = Object.fromEntries(Object.entries(groupedProducts).map(([category, rows]) => [category, rows.filter((product) => !readyOnly || readiness[product.key]?.eligibility === "ready")]));
  const readyCount = products.filter((product) => readiness[product.key]?.eligibility === "ready").length;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            ref={dialogRef}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Add product"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <button
                ref={closeRef}
                className="icon-button"
                onClick={selected ? () => setSelected(undefined) : composerMode !== "search" ? () => setComposerMode("search") : onClose}
                aria-label={selected || composerMode !== "search" ? "Back" : "Close"}
              >
                {selected || composerMode !== "search" ? <ArrowLeft /> : <X />}
              </button>
              <div>
                <small>ADD TO BREAK</small>
                <h2>{composerMode === "paste" ? "Paste a break" : composerMode === "review" ? "Review matches" : selected ? selected.name : "Add products"}</h2>
              </div>
            </header>
            <div className="composer-status" aria-live="polite">
              <span><small>Current break</small><b>{draft.length}</b> product line{draft.length === 1 ? "" : "s"}</span>
              <span><small>Current break</small><b>{totalOpenings}</b> opening{totalOpenings === 1 ? "" : "s"}</span>
            </div>
            {composerMode === "paste" ? (
              <section className="break-import">
                <p><strong>Paste a ColorBreak link or product list</strong> — accepted formats are a ColorBreak link or one canonical product per line.</p>
                <code>SPM | Play Booster Pack | 10</code>
                <textarea autoFocus value={importSource} onChange={(event) => setImportSource(event.target.value)} placeholder="Paste link or product list" aria-label="Break link or product list" aria-describedby={importErrors.length ? importErrorsId : undefined} />
                {importErrors.length > 0 && <ul id={importErrorsId} className="import-errors" role="alert">{importErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
              </section>
            ) : composerMode === "review" ? (
              <section className="import-review">
                <div className="import-review-summary"><b>{importRows.filter((row) => row.line).length} matched</b><span>{importRows.filter((row) => row.error).length} need attention</span></div>
                {importRows.map((row, index) => <div className={`import-review-row ${row.error ? "has-error" : "is-ready"}`} key={`${row.source}-${index}`}>
                  <small>Source</small><span>{row.source}</span>
                  {row.line ? <><small>Canonical product</small><strong>{row.line.set} · {row.line.productLabel}</strong><b>{row.line.quantity} × {row.line.packCount && row.line.packCount > 1 ? `${row.line.packCount} packs` : "opening"}</b></> : <p>{row.error}</p>}
                </div>)}
              </section>
            ) : !selected ? (
              <>
                <section className="ready-now-list" aria-labelledby="ready-now-heading">
                  <InformationLabel>READY NOW</InformationLabel><h3 id="ready-now-heading">Verified modeled ceilings</h3>
                  <p className="data-status-legend">Ready = verified contents + fresh prices. Stale = prices older than six hours. Incomplete = missing contents or exact prices. Unavailable = evidence cannot be verified.</p>
                  {readyChecking ? <p role="status">Checking data…</p> : readyRows.filter((row) => row.readiness.eligibility === "ready").map(({ product, readiness }) => <button type="button" className="ready-now-row" key={product.key} onClick={() => add(product)}><span><strong>{product.label}</strong><small>{product.setName ?? product.set} · {new Date(readiness.priceObservedAt ?? "").toLocaleString()} · published snapshot</small></span><span>Ready</span></button>)}
                  {!readyChecking && !readyRows.some((row) => row.readiness.eligibility === "ready") && <div className="empty-picker-state"><p>No verified modeled ceilings are available in this snapshot.</p><div className="buyer-recovery-actions"><button type="button" className="primary" onClick={onUseManualCap}>Use manual budget cap</button><button type="button" className="quiet" onClick={() => setSelected(undefined)}>Browse all products</button></div></div>}
                </section>
                <button type="button" className="paste-break-action" onClick={() => setComposerMode("paste")}><PackagePlus />Paste list or break link</button>
                <div className="set-browser-tools">
                  <div className="set-sort-tabs" role="group" aria-label="Sort sets">
                    <button aria-pressed={setSort === "release"} onClick={() => setSetSort("release")}>Release date</button>
                    <button aria-pressed={setSort === "alphabetical"} onClick={() => setSetSort("alphabetical")}>Alphabetical</button>
                  </div>
                  <label className="search">
                    <Search />
                    <input
                      autoFocus
                      aria-label="Search sets by name or code"
                      placeholder="Search name or set code"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <InformationLabel>
                  {visible.length} {query ? "MATCHING SETS" : "SETS"}
                </InformationLabel>
                <div className="choice-list">
                  {visible.map((set) => (
                    <button key={set.code} onClick={() => setSelected(set)}>
                      <span className="set-glyph">{set.code.slice(0, 3)}</span>
                      <span>
                        <strong>{set.name}</strong>
                        <small>
                          {set.code} · {set.released}{new Date(`${set.released}T00:00:00Z`) > new Date() ? " · Upcoming / announced" : ""}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label className="ready-only-filter"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} /> Ready for bid check <small aria-live="polite">{readyCount} ready in this snapshot</small></label>
                {loading ? (
                  <div className="loader">
                    <span />
                    Resolving exact products…
                  </div>
                ) : (
                  <div className="product-groups">
                    {Object.entries(visibleProducts).filter(([, rows]) => rows.length).map(([category, rows]) => (
                      <section key={category}>
                        <InformationLabel>
                          {category.toUpperCase()}
                        </InformationLabel>
                        {rows!.map((product) => (
                          <button
                            key={product.key}
                            onClick={() => add(product)}
                          >
                            <span className="product-icon">
                              <Boxes />
                            </span>
                            <span>
                              <strong>{product.label}</strong>
                              <small>
                                {product.packCount
                                  ? `${product.packCount} packs · `
                                  : ""}
                                Contents: {product.status} · Prices: {readiness[product.key]?.eligibility === "ready" ? "fresh" : readiness[product.key]?.eligibility === "stale" ? "stale" : readiness[product.key]?.eligibility === "incomplete" ? "incomplete" : "checking"} · Ceiling: {readiness[product.key]?.eligibility === "ready" ? "available" : "unavailable"}
                              </small>
                            </span>
                            <ChevronRight />
                          </button>
                        ))}
                      </section>
                    ))}
                    {!Object.values(visibleProducts).some((rows) => rows.length) && (readyOnly ? <div className="empty-picker-state"><p>No verified modeled ceilings are available in this snapshot.</p><div className="buyer-recovery-actions"><button type="button" className="primary" onClick={onUseManualCap}>Use manual budget cap</button><button type="button" className="quiet" onClick={() => setReadyOnly(false)}>Show all products</button></div></div> : <p className="empty-picker-state">No products match this filter. Show all products to keep building your break.</p>)}
                  </div>
                )}
              </>
            )}
            <footer className="composer-actions">
              <button type="button" className="quiet" onClick={onClose}>Cancel</button>
              {composerMode === "review" ? (
                <button type="button" className="primary" disabled={!importRows.length || importIssueCount > 0} onClick={applyImport}>
                  {importIssueCount > 0
                    ? `Resolve ${importIssueCount} line${importIssueCount === 1 ? "" : "s"} to continue`
                    : `${importSettings ? "Replace with" : "Add"} ${importMatched.length} lines · ${importOpeningCount} openings`}
                </button>
              ) : composerMode === "paste" ? (
                <button type="button" className="primary" disabled={!importSource.trim() || importing} onClick={resolveImport}>{importing ? "Checking products…" : "Review products"}</button>
              ) : (
                <button type="button" className="primary" disabled={!draft.length} onClick={() => { onApply(draft); onClose(); }}>Done · {draft.length} line{draft.length === 1 ? "" : "s"}</button>
              )}
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>, document.body,
  );
}

function EmptyBreak({ add, practice }: { add: (opener?: HTMLElement) => void; practice?: () => void }) {
  const [why, setWhy] = useState(false);
  return (
    <section className="empty">
      <span>
        <PackagePlus />
      </span>
      <h2>Build your break</h2>
      <p>Add each product that will be opened, then compare colors and value.</p>
      <button className="primary" onClick={(event) => add(event.currentTarget)}>
        <PackagePlus size={18} /> Add products
      </button>
      <div className="empty-actions" aria-label="Break planning next steps">
        <button type="button" className="quiet" onClick={(event) => practice ? practice() : add(event.currentTarget)}>Use an example</button>
        <button type="button" className="quiet" onClick={(event) => add(event.currentTarget)}>Choose products</button>
        <button type="button" className="quiet" onClick={() => setWhy((value) => !value)} aria-expanded={why}>What makes a ceiling available?</button>
      </div>
      {why && <p role="status">A bid ceiling needs complete product contents and current price data. You can still compare available values while you fill in the break.</p>}
    </section>
  );
}

function NextSteps({ reason }: { reason: string }) {
  return <section className="panel next-steps" aria-label="Next steps">
    <InformationLabel>NEXT STEPS</InformationLabel>
    <h2>Finish the setup</h2>
    <p>{reason}</p>
    <ul><li>Choose a product with complete contents and current prices, then enter your bid and added shipping.</li></ul>
  </section>;
}

/** A buyer-entered arithmetic fallback; intentionally separate from valuation. */
function ManualBudgetCap({ onBack, target, setTarget, shipping, setShipping, hammer, setHammer }: { onBack: () => void; target: number | undefined; setTarget: (value: number | undefined) => void; shipping: number | undefined; setShipping: (value: number | undefined) => void; hammer: number | undefined; setHammer: (value: number | undefined) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const manual = manualBudgetCap(target, shipping, hammer);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="bid-live-decision manual-budget-cap" aria-label="Manual budget cap">
    <div className="decision-kicker"><span>BUYER-ENTERED BUDGET</span><span className="decision-evidence evidence-incomplete">Not modeled</span></div>
    <div className="verdict-head"><div className="verdict-decision"><InformationLabel>Manual budget cap — not a ColorBreak modeled ceiling</InformationLabel><h2 ref={heading} tabIndex={-1} aria-live="polite">{manual?.recommendation ?? "SET YOUR CAP"}</h2><p className="decision-reason">Uses the conservative value target you entered. ColorBreak did not verify current contents or prices for this calculation.</p></div><div className="ev-orb"><small>Manual maximum hammer</small><strong className="max-hammer" aria-label="Manual maximum hammer">{manual ? fmt(manual.maximumHammer) : "—"}</strong><span>max(0, value target − shipping)</span></div></div>
    <div className="bid-inputs"><NumberField id="manual-value-target" label="My conservative value target" value={target} onChange={setTarget} live /><NumberField id="manual-added-shipping" label="Added shipping" value={shipping} onChange={setShipping} live /></div>
    <div className="bid-inputs"><NumberField id="manual-current-hammer" label="Optional: current hammer" value={hammer} onChange={setHammer} live /></div>
    {manual?.landedCost != null && <div className="delta"><span>Landed cost <b>{fmt(manual.landedCost)}</b></span><span>Compared with your cap <b>{fmt(manual.maximumHammer)}</b></span></div>}
    <button type="button" className="quiet" onClick={onBack}>Back to products / choose a ready product</button>
  </section>;
}

function QuantityControl({ line, update }: { line: BreakLine; update: (quantity: number) => void }) {
  const unit = line.packCount && line.packCount > 1 ? "products" : "openings";
  return (
    <label className="quantity-control">
      <span>Quantity</span>
      <div>
        <button type="button" disabled={line.quantity <= 1} aria-label={`Decrease ${line.productLabel} quantity`} onClick={() => update(Math.max(1, line.quantity - 1))}>−</button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={line.quantity}
          aria-label={`${line.productLabel} quantity in ${unit}`}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(value) && value >= 1 && value <= 999) update(value);
          }}
        />
        <button type="button" aria-label={`Increase ${line.productLabel} quantity`} onClick={() => update(Math.min(999, line.quantity + 1))}>+</button>
      </div>
    </label>
  );
}

export { QuantityControl, EmptyBreak, NextSteps, ManualBudgetCap };

