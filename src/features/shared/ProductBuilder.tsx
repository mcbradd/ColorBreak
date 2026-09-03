import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ChevronRight,
  PackagePlus,
  ScanText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { catalogSets, productsForSet } from "../../data/catalog";
import { prepareProductSelection, type PreparedProductSelection } from "../../domain/decision-evidence";
import { parseBreakImport } from "../../domain/break-import";
import {
  findBreakLineForChoice,
  mergeBreakLines,
  productKeyForChoice,
} from "../../domain/break-line-identity";
import { decodeBuyerShare, type AssignmentMode } from "../../domain/share-url";
import type {
  BreakLine,
  ProductChoice,
  SetChoice,
} from "../../domain/types";
import { manualBudgetCap } from "../../domain/manual-budget";
import {
  ScreenshotOcrError,
  transcribeScreenshot,
  type TranscriptionProgress,
  type UncertainLine,
} from "./screenshot-ocr";
import { fmt, InformationLabel, NumberField, useDialogOwnership } from "./Primitives";

export function Builder({
  open,
  onClose,
  lines,
  onApply,
  invokingElement,
  valueThreshold = 0,
}: {
  open: boolean;
  onClose: () => void;
  lines: BreakLine[];
  onApply: (lines: BreakLine[], settings?: { assignmentMode: AssignmentMode; largeSpots?: number; bulkEnabled?: boolean; bulkThreshold?: number }, prepared?: PreparedProductSelection) => void;
  invokingElement?: HTMLElement | null;
  valueThreshold?: number;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectionRequest = useRef(0);
  const [sets, setSets] = useState<SetChoice[]>([]);
  const [query, setQuery] = useState("");
  const [setSort, setSetSort] = useState<"release" | "alphabetical">("release");
  const [selected, setSelected] = useState<SetChoice>();
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [prepared, setPrepared] = useState<Record<string, PreparedProductSelection>>({});
  const [readyOnly, setReadyOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<BreakLine[]>([]);
  const [composerMode, setComposerMode] = useState<"search" | "paste" | "review">("search");
  const [importSource, setImportSource] = useState("");
  const [importRows, setImportRows] = useState<Array<{ source: string; line?: BreakLine; error?: string }>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importErrorsId = useId();
  const [importing, setImporting] = useState(false);
  const screenshotInput = useRef<HTMLInputElement>(null);
  const [scanProgress, setScanProgress] = useState<TranscriptionProgress>();
  const [scanError, setScanError] = useState<string>();
  const [scanUncertain, setScanUncertain] = useState<UncertainLine[]>([]);
  const [scanLineCount, setScanLineCount] = useState(0);
  const scanNoticeId = useId();
  const [importSettings, setImportSettings] = useState<{ assignmentMode: AssignmentMode; largeSpots?: number; bulkEnabled?: boolean; bulkThreshold?: number }>();
  useEffect(() => {
    if (open)
      catalogSets().then((rows) =>
        setSets(rows.sort((a, b) => b.released.localeCompare(a.released))),
      );
  }, [open]);
  useEffect(() => {
    if (!selected) { selectionRequest.current += 1; return; }
    const request = ++selectionRequest.current;
    setProducts([]);
    setPrepared({});
    setLoading(true);
    void (async () => {
      try {
        const rows = await productsForSet(selected.code);
        if (request !== selectionRequest.current) return;
        setProducts(rows);
        const entries: Array<[string, PreparedProductSelection]> = [];
        const workerCount = Math.min(4, rows.length);
        let next = 0;
        await Promise.all(Array.from({ length: workerCount }, async () => {
          while (next < rows.length) {
            const product = rows[next++];
            entries.push([product.key, await prepareProductSelection([...lines, choiceLine(product)], valueThreshold)]);
          }
        }));
        if (request !== selectionRequest.current) return;
        setPrepared(Object.fromEntries(entries));
      } finally {
        if (request === selectionRequest.current) setLoading(false);
      }
    })();
  }, [selected, lines, valueThreshold]);
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
      setScanProgress(undefined);
      setScanError(undefined);
      setScanUncertain([]);
      setScanLineCount(0);
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
      productKey: productKeyForChoice(product),
      productLabel: product.label,
      quantity,
      packCount: product.packCount,
      tcgId: product.tcgId,
    });
  const add = (product: ProductChoice) => {
    setDraft((rows) => mergeBreakLines([...rows, choiceLine(product)]));
  };
  const updateDraftQuantity = (line: BreakLine, quantity: number) => {
    setDraft((rows) => rows.map((row) => (row.id === line.id ? { ...row, quantity } : row)));
  };
  const removeDraftLine = (line: BreakLine) => {
    setDraft((rows) => rows.filter((row) => row.id !== line.id));
  };
  const normalizeProduct = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  /**
   * Reads a screenshot of a seller's show notes into the same text box the
   * buyer would have pasted into. The transcript is never applied to the break
   * directly: it is deliberately dropped into the composer so it goes through
   * the one `parseBreakImport` path and the one review screen, with the buyer
   * able to correct any misread character first.
   */
  const scanScreenshot = async (image: File) => {
    setComposerMode("paste");
    setImportErrors([]);
    setScanError(undefined);
    setScanUncertain([]);
    setScanLineCount(0);
    setScanProgress({ label: "Loading the text-recognition engine" });
    try {
      const transcript = await transcribeScreenshot(image, setScanProgress);
      // Appending, never replacing: long show notes take two screenshots, and
      // anything the buyer has already typed must survive.
      setImportSource((current) => (current.trim() ? `${current.replace(/\s+$/, "")}\n${transcript.text}` : transcript.text));
      setScanUncertain(transcript.uncertain);
      setScanLineCount(transcript.lineCount);
    } catch (error) {
      setScanError(error instanceof ScreenshotOcrError || error instanceof Error
        ? error.message
        : "That screenshot could not be read. Try a sharper screenshot, or paste the show notes as text.");
    } finally {
      setScanProgress(undefined);
    }
  };
  const chooseScreenshot = () => screenshotInput.current?.click();
  const onScreenshotChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    // Reset so re-picking the same file still fires a change event.
    event.target.value = "";
    if (image) void scanScreenshot(image);
  };
  /** Lets an image on the clipboard be pasted straight into the text box. */
  const onComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = [...event.clipboardData.files].find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    void scanScreenshot(image);
  };
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
  const applyImport = async () => {
    const additions = importRows.flatMap((row) => row.line ? [row.line] : []);
    if (importRows.some((row) => row.error) || !additions.length) return;
    const next = importSettings ? mergeBreakLines(additions) : mergeBreakLines([...draft, ...additions]);
    setDraft(next);
    onApply(next, importSettings, await prepareProductSelection(next, valueThreshold));
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
  const visibleProducts = Object.fromEntries(Object.entries(groupedProducts).map(([category, rows]) => [category, rows.filter((product) => !readyOnly || prepared[product.key]?.assessment.presentation === "eligible")]));
  const readyCount = products.filter((product) => prepared[product.key]?.assessment.presentation === "eligible").length;
  // Unmount before the ownership hook restores focus: no exit animation may
  // leave an active dialog exposed alongside the active workspace.
  if (!open) return null;
  return createPortal(
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
                <h2>{composerMode === "paste" ? "Paste or scan a break" : composerMode === "review" ? "Review matches" : selected ? selected.name : "Add products"}</h2>
              </div>
            </header>
            <input
              ref={screenshotInput}
              type="file"
              accept="image/*"
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={onScreenshotChosen}
            />
            <div className="composer-status" aria-live="polite">
              <small className="composer-status-label">Current break</small>
              <div className="composer-status-tiles">
                <span className="stat-tile"><b>{draft.length}</b><small>product line{draft.length === 1 ? "" : "s"}</small></span>
                <span className="stat-tile"><b>{totalOpenings}</b><small>opening{totalOpenings === 1 ? "" : "s"}</small></span>
              </div>
            </div>
            {composerMode === "paste" ? (
              <section className="break-import">
                <p><strong>Paste a ColorBreak link or product list</strong> — accepted formats are a ColorBreak link or one canonical product per line.</p>
                <code>SPM | Play Booster Pack | 10</code>
                <button type="button" className="screenshot-action" onClick={chooseScreenshot} disabled={Boolean(scanProgress)}>
                  <ScanText />{scanProgress ? "Reading screenshot…" : "Read a screenshot of the show notes"}
                </button>
                <ScanFeedback progress={scanProgress} error={scanError} uncertain={scanUncertain} lineCount={scanLineCount} noticeId={scanNoticeId} />
                <textarea autoFocus value={importSource} onChange={(event) => setImportSource(event.target.value)} onPaste={onComposerPaste} placeholder="Paste link or product list, or read a screenshot" aria-label="Break link or product list" aria-describedby={[importErrors.length ? importErrorsId : "", scanUncertain.length || scanError ? scanNoticeId : ""].filter(Boolean).join(" ") || undefined} />
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
                <div className="set-browser-tools">
                  <label className="search">
                    <Search />
                    <input
                      autoFocus
                      aria-label="Search sets by name or code"
                      placeholder="Search a product or paste a break listing"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <div className="set-sort-tabs" role="group" aria-label="Sort sets">
                    <button aria-pressed={setSort === "release"} onClick={() => setSetSort("release")}>Release date</button>
                    <button aria-pressed={setSort === "alphabetical"} onClick={() => setSetSort("alphabetical")}>Alphabetical</button>
                  </div>
                </div>
                <div className="break-input-actions">
                  <button type="button" className="paste-break-action" onClick={() => setComposerMode("paste")}><PackagePlus />Paste a break listing</button>
                  <button type="button" className="paste-break-action" onClick={chooseScreenshot}><ScanText />Read a screenshot</button>
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
                        {rows!.map((product) => {
                          // Set-scoped: MSH and EOE both publish a
                          // `play-booster-pack`, and each keeps its own line.
                          const addedLine = findBreakLineForChoice(draft, product);
                          const description = <>
                            <strong>{product.label}</strong>
                            <small>
                              {product.packCount && product.packCount > 1
                                ? `${product.packCount} packs · `
                                : ""}
                              {prepared[product.key]?.assessment.presentation === "eligible" ? "Fresh estimate" : "Estimate may need an update"}
                            </small>
                          </>;
                          return addedLine ? (
                            <div className="product-row-line" key={product.key}>
                              <span className="product-icon">
                                <Boxes />
                              </span>
                              <span>
                                {description}
                                <b className="product-added">Added</b>
                              </span>
                              <div className="line-controls">
                                <QuantityControl line={addedLine} update={(quantity) => updateDraftQuantity(addedLine, quantity)} />
                                <button
                                  type="button"
                                  className="remove-line"
                                  aria-label={`Remove ${product.label} from break`}
                                  title="Remove from break"
                                  onClick={() => removeDraftLine(addedLine)}
                                >
                                  <Trash2 />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              key={product.key}
                              onClick={() => add(product)}
                            >
                              <span className="product-icon">
                                <Boxes />
                              </span>
                              <span>
                                {description}
                              </span>
                              <ChevronRight />
                            </button>
                          );
                        })}
                      </section>
                    ))}
                    {!Object.values(visibleProducts).some((rows) => rows.length) && (readyOnly ? <div className="empty-picker-state"><p>No products in this set currently have fresh estimate data.</p><button type="button" className="quiet" onClick={() => setReadyOnly(false)}>Show all products</button></div> : <p className="empty-picker-state">No products match this filter. Show all products to keep building your break.</p>)}
                  </div>
                )}
              </>
            )}
            <footer className="composer-actions">
              {composerMode === "review" ? (
                <button type="button" className="primary" disabled={!importRows.length || importIssueCount > 0} onClick={applyImport}>
                  {importIssueCount > 0
                    ? `Resolve ${importIssueCount} line${importIssueCount === 1 ? "" : "s"} to continue`
                    : `${importSettings ? "Replace with" : "Add"} ${importMatched.length} lines · ${importOpeningCount} openings`}
                </button>
              ) : composerMode === "paste" ? (
                <button type="button" className="primary" disabled={!importSource.trim() || importing} onClick={resolveImport}>{importing ? "Checking products…" : "Review products"}</button>
              ) : (
                <button type="button" className="primary" disabled={!draft.length} onClick={() => { void prepareProductSelection(draft, valueThreshold).then((selection) => { onApply(draft, undefined, selection); onClose(); }); }}>Add to break{draft.length ? ` · ${draft.length}` : ""}</button>
              )}
            </footer>
          </motion.section>
        </motion.div>, document.body,
  );
}

/**
 * Progress, failure and low-confidence reporting for a screenshot read.
 *
 * Recognition takes seconds and downloads the engine on first use, so the
 * stage is always named rather than left as a silent wait. Lines the engine was
 * unsure of are listed by number and quoted verbatim: a misread set code or
 * quantity changes what a break is worth, so it is stated plainly instead of
 * being repaired behind the buyer's back. Meaning never rests on colour — every
 * state carries an icon and a sentence.
 */
function ScanFeedback({ progress, error, uncertain, lineCount, noticeId }: {
  progress?: TranscriptionProgress;
  error?: string;
  uncertain: UncertainLine[];
  lineCount: number;
  noticeId: string;
}) {
  if (progress) {
    const percent = progress.ratio == null ? undefined : Math.round(progress.ratio * 100);
    return (
      <div className="scan-progress" role="status" aria-live="polite">
        <p>{progress.label}{percent == null ? "…" : ` — ${percent}%`}</p>
        <progress max={100} value={percent} aria-label={progress.label} />
        <small>The engine downloads once, then stays on this device.</small>
      </div>
    );
  }
  if (error) {
    return (
      <p className="scan-note scan-note-error" id={noticeId} role="alert">
        <AlertTriangle aria-hidden="true" /><span>{error}</span>
      </p>
    );
  }
  if (!lineCount) return null;
  return (
    <div className="scan-note scan-note-result" id={noticeId} role="status" aria-live="polite">
      <p>
        <ScanText aria-hidden="true" />
        <span>Read {lineCount} line{lineCount === 1 ? "" : "s"} from the screenshot. Nothing has been added to your break yet — check the text below, delete anything that is not a product, then choose Review products.</span>
      </p>
      {uncertain.length > 0 && (
        <>
          <strong><AlertTriangle aria-hidden="true" />Not confidently read: {uncertain.length} line{uncertain.length === 1 ? "" : "s"}</strong>
          <p>These lines are in the box exactly as they were read. Text recognition mistakes set codes, punctuation and quantities most often, so compare each one against the screenshot before continuing.</p>
          <ul>
            {uncertain.map((line) => (
              <li key={line.number}>Line {line.number}, read as “{line.text}” — {line.confidence}% confident.</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EmptyBreak({ add }: { add: (opener?: HTMLElement) => void }) {
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
      <button type="button" className="quiet" onClick={() => setWhy((value) => !value)} aria-expanded={why}>What makes a ceiling available?</button>
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
  const recommendation = manual?.status === "under"
    ? `BID — ${fmt(manual.roomUnderCap!)} ROOM`
    : manual?.status === "at"
      ? "AT LIMIT"
      : manual?.status === "over"
        ? `STOP — ${fmt(manual.overage!)} OVER`
        : undefined;
  return <section className="bid-live-decision manual-budget-cap" aria-label="Manual budget cap">
    <div className="decision-kicker"><span>BUYER-ENTERED BUDGET</span><span className="decision-evidence evidence-incomplete">Not modeled</span></div>
    <div className="verdict-head"><div className="verdict-decision"><InformationLabel>Manual budget cap — not a ColorBreak modeled ceiling</InformationLabel><h2 ref={heading} tabIndex={-1} aria-live="polite">{recommendation ?? "SET YOUR CAP"}</h2><p className="decision-reason">Uses the budget you entered. ColorBreak did not verify current contents or prices for this calculation.</p></div><div className="ev-orb"><small>Estimated Max Bid</small><strong className="max-hammer" aria-label="Estimated maximum bid">{manual ? fmt(manual.maximumHammer) : "—"}</strong><span>Total cap minus added shipping</span></div></div>
    <div className="bid-inputs"><NumberField id="manual-value-target" label="My total landed-cost cap" value={target} onChange={setTarget} live /><NumberField id="manual-added-shipping" label="Added shipping" value={shipping} onChange={setShipping} live /></div>
    <p className="decision-reason">Includes added shipping.</p>
    <div className="bid-inputs"><NumberField id="manual-current-hammer" label="Current bid" value={hammer} onChange={setHammer} hint="Before added shipping." live /></div>
    {manual?.landedCost != null && <div className={`bid-recommendation bid-recommendation-${manual.status === "under" ? "positive" : manual.status === "at" ? "warning" : "negative"}`} aria-live="polite" aria-label="Bid recommendation"><div><small>Bid recommendation</small><strong>{recommendation}</strong></div><p>{manual.status === "under" ? <>Current bid is <b>{fmt(manual.roomUnderCap)}</b> under your Estimated Max Bid of <b>{fmt(manual.maximumHammer)}</b>. Bid only up to {fmt(manual.maximumHammer)}.</> : manual.status === "at" ? <>Current bid matches your Estimated Max Bid of <b>{fmt(manual.maximumHammer)}</b>. Do not bid higher.</> : <>Current bid is <b>{fmt(manual.hammerAboveMaximum)}</b> over your Estimated Max Bid of <b>{fmt(manual.maximumHammer)}</b>. Stop bidding.</>}</p></div>}
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

