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
import { catalogSets, productsForSet, readinessForProduct } from "./data/catalog";
import type { DecisionReadiness } from "./domain/decision-readiness";
import { evaluateBreakAnalysis } from "./data/evaluate";
import type { BreakAnalysis } from "./data/evaluate";
import { sealedMarketPrice } from "./data/sealed-prices";
import { createAuction, toggleSlotTaken } from "./domain/auction";
import type { AuctionState } from "./domain/auction";
import { decodeLegacySearch } from "./domain/legacy";
import { mergeBreakLines, parseBreakImport } from "./domain/break-import";
import { createBreakShareUrl, decodeBuyerShare, type AssignmentMode } from "./domain/share-url";
import {
  calculateProfit,
  requiredHammer,
  WHATNOT_US,
} from "./domain/marketplace";
import { recommendBid, solveFinancialCap } from "./domain/buyer-treatment";
import type { ValueRule } from "./domain/buyer-treatment";
import { completeCost, sellerPlanStatus } from "./domain/seller-plan";
import { decisionAvailability, decisionEligibility, resolvedOnlyLimit } from "./domain/valuation";
import { cardDisplayName, cardTreatmentLabel } from "./domain/card-label";
import { deduplicateOmissions } from "./domain/omissions";
import { simulateOutcomesAsync } from "./domain/simulation-client";
import type { DistributionSummary, PackOutcomeModel, SimulationResult } from "./domain/simulation";
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
} from "./domain/types";
import { SLOT_IDS, SLOT_NAMES } from "./domain/types";
import { useMobileInputViewport } from "./mobile-input-viewport";
import { track } from "./analytics";
import { chaseMapLayout } from "./constellation-layout";
import { createLargeBreakPlan, sortNamedCards, summarizeAssignmentValues } from "./domain/large-break";
import type { TopCardSort } from "./domain/large-break";
import {
  cleanupLegacyStorage,
  defaultSellerPlanDraft,
  discardSellerPlanDraft,
  readSellerPlanDraft,
  readSessionLines,
  sellerCompositionFingerprint,
  writeSellerPlanDraft,
  writeSessionLines,
  type SellerPlanDraft,
} from "./persistence";
import { decisionFingerprint } from "./features/buyer/decision-state";

type Mode = "home" | "buyer" | "seller";
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const fmt = (value: number | undefined) =>
  value == null ? "—" : money.format(value);
const fmtChart = (value: number) => `$${value.toFixed(2)}`;
const oddsLabel = (probability: number) =>
  probability >= 0.9995
    ? "100%"
    : probability > 0
      ? `${(probability * 100).toFixed(probability < 0.01 ? 2 : 1)}%`
      : "0%";
const FOCUSABLE_SELECTOR = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/** Keeps a dialog's opener stable even while its owning screen re-renders. */
function useDialogOwnership(open: boolean, onClose: () => void, dialogRef: RefObject<HTMLElement | null>, initialFocus?: RefObject<HTMLElement | null>) {
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const application = document.getElementById("root");
    document.body.style.overflow = "hidden";
    application?.setAttribute("inert", "");
    application?.setAttribute("aria-hidden", "true");
    initialFocus?.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      application?.removeAttribute("inert");
      application?.removeAttribute("aria-hidden");
      opener.current?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
      opener.current = null;
    };
  }, [open]); // onClose intentionally lives in a ref: re-renders must not reset ownership.
}

function DisclosureArrow() {
  return <ChevronRight className="disclosure-arrow" aria-hidden="true" />;
}

const plainEvidence = (value: string) => ({
  "official-verified": "Checked with official product information",
  "aggregate-identified": "Product matched",
  ambiguous: "Needs review",
  "mtgjson-structured": "Exact item list imported",
  "prose-only": "Only a written description is available",
  unresolved: "Missing",
  "published-rate-checked": "Pack odds checked against published information",
  "weighted-upstream": "Pack odds imported",
  unvalidated: "Not independently checked",
  exact: "Exact card version used",
  "class-only": "Foil or nonfoil group only",
  "seller-confirmed": "Confirmed by seller",
  preset: "Using ColorBreak defaults",
  "user-entered": "Entered by user",
  unknown: "Not set",
}[value] ?? value.replaceAll("-", " "));

function countedPriceLabel(row: Contributor): string {
  const finish = row.finish ?? (row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const price = row.marketPrice ?? (finish === "foil" ? row.card.foil : row.card.nonfoil);
  if (price == null) return "Price unavailable";
  return row.priceBasis === "listed-tcg"
    ? `${fmt(price)} listed TCG price`
    : row.priceBasis === "same-printing-foil-market"
      ? `${fmt(price)} same-printing foil market price`
    : `${fmt(price)} ${finish} market price`;
}

function NumericInput({
  value,
  onCommit,
  placeholder = "0",
  disabled = false,
  ariaLabel,
  live = false,
  id,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  live?: boolean;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value == null ? "" : String(value));
    }
  }, [value]);

  const commit = () => {
    const normalized = draft.trim().replace(",", ".");
    if (!normalized || normalized === ".") {
      setDraft("");
      onCommit(undefined);
      return;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      const next = Math.max(0, parsed);
      setDraft(String(next));
      onCommit(next);
      return;
    }

    setDraft(value == null ? "" : String(value));
  };

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      pattern="[0-9]*[.,]?[0-9]*"
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*(?:[.,]\d*)?$/.test(next)) return;
        setDraft(next);
        if (!live) return;
        const normalized = next.trim().replace(",", ".");
        if (!normalized || normalized === ".") {
          onCommit(undefined);
          return;
        }
        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) onCommit(Math.max(0, parsed));
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  prefix = "$",
  hint,
  live = false,
  id,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  prefix?: string;
  hint?: string;
  live?: boolean;
  id?: string;
}) {
  return (
    <label className="number-field">
      <span>
        {label}
        {hint && <Tip text={hint} />}
      </span>
      <div>
        <b>{prefix}</b>
        <NumericInput
          id={id}
          value={value}
          placeholder="0"
          onCommit={onChange}
          ariaLabel={label}
          live={live}
        />
      </div>
    </label>
  );
}

export function Tip({
  text,
  children,
  className = "",
  label,
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;
    const anchorBox = anchor.getBoundingClientRect();
    const popoverBox = popover.getBoundingClientRect();
    const gutter = 12;
    const left = Math.min(
      window.innerWidth - popoverBox.width - gutter,
      Math.max(gutter, anchorBox.left + anchorBox.width / 2 - popoverBox.width / 2),
    );
    const top = anchorBox.top >= popoverBox.height + gutter
      ? anchorBox.top - popoverBox.height - 8
      : anchorBox.bottom + 8;
    setPosition({
      left: Math.max(gutter, left),
      top: Math.min(
        window.innerHeight - popoverBox.height - gutter,
        Math.max(gutter, top),
      ),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        anchorRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <span
        ref={anchorRef}
        className={`tip ${children ? "tip-indicator" : "tip-icon"} ${className}`.trim()}
        role="button"
        tabIndex={0}
        aria-label={label ?? text}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
          }
        }}
        onBlur={() => setOpen(false)}
      >
        {children ?? <CircleHelp />}
      </span>
      {open && createPortal(
        <span
          ref={popoverRef}
          id={id}
          className="tip-popover"
          role="tooltip"
          style={position}
        >
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}

function InformationLabel({
  children,
  help,
  className = "",
}: {
  children: ReactNode;
  help?: string;
  className?: string;
}) {
  return (
    <p className={`section-label information-label ${className}`.trim()}>
      <span>{children}</span>
      {help && <Tip text={help} />}
    </p>
  );
}

function PanelHeading({
  label,
  help,
  title,
  accessory,
  description,
}: {
  label: ReactNode;
  help?: string;
  title: ReactNode;
  accessory?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="panel-heading">
      <InformationLabel help={help}>{label}</InformationLabel>
      <div className="panel-heading-main">
        <div className="panel-heading-copy">
          <h2>{title}</h2>
          {description}
        </div>
        {accessory && <div className="panel-heading-accessory">{accessory}</div>}
      </div>
    </header>
  );
}

function Status({ result }: { result: ValuationResult }) {
  const icon =
    result.status === "incomplete" ? (
      <ShieldAlert size={16} />
    ) : (
      <BadgeCheck size={16} />
    );
  return (
    <Tip
      className={`status ${result.status}`}
      text={result.status === "verified"
        ? "Product contents, pack odds, card versions, and prices are ready."
        : result.status === "estimated"
          ? "Some product details are estimates, so treat this as a rough answer."
          : "Some values may be low. Open the nearby warning for a short explanation or technical details."}
      label={`Explain ${result.status} data status`}
    >
      {icon}
      <span>{result.status}</span>
    </Tip>
  );
}

function CatalogUnavailableNotice({ onEdit }: { onEdit?: () => void }) {
  return <section className="catalog-unavailable" role="status">
    <InformationLabel>CATALOG STATUS</InformationLabel>
    <h2>No current calculation is trusted for a live decision</h2>
    <p>Published prices are stale, incomplete, or still being checked. ColorBreak does not promise a refresh time it does not own; you can still explore the browser-local analysis-only model.</p>
    <div>{onEdit && <button type="button" className="quiet" onClick={onEdit}>Edit products</button>}<a className="quiet" href="./methodology.html">Methodology &amp; status</a><a className="quiet" href="./">Return home</a></div>
  </section>;
}

function Home({ choose }: { choose: (mode: Mode, fresh?: boolean) => void }) {
  const supportUrl = import.meta.env.VITE_SUPPORT_URL as string | undefined;
  const recentBuyer = readSessionLines("buyer");
  const recentSeller = readSessionLines("seller");
  const [cleared, setCleared] = useState(false);
  const clearDevice = async () => {
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("colorbreak:")) storage.removeItem(key);
      }
    }
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("colorbreak-")).map((name) => caches.delete(name)));
    history.replaceState(null, "", location.pathname);
    setCleared(true);
  };
  return (
    <main className="home page">
      <header className="launcher-bar">
        <div className="brand">
          <span className="brand-mark"><Sparkles /></span>
          <span>COLORBREAK</span>
        </div>
        <span className="engine-ready" aria-label="Catalog is analysis-only"><i /> DEMO · ANALYSIS ONLY</span>
      </header>
      <section className="launcher-intro">
        <InformationLabel>Decision launcher</InformationLabel>
        <h1>What do you need to decide?</h1>
        <p>For Magic: The Gathering break buyers and sellers: set a bid ceiling or build a viable slot-plan scenario from the exact boxes being opened. Results are modeled, not guaranteed.</p>
      </section>
      <section className="mode-grid" aria-label="Choose a job">
        <button
          className="mode-card buyer-card"
          aria-label="Bid Check — should I bid?"
          onClick={() => choose("buyer", true)}
        >
          <span className="mode-number">01</span>
          <span className="mode-copy">
            <small>BUYING A COLOR SLOT</small>
          <strong>Explore a bid</strong>
            <p>Analysis-only — bid caps are temporarily unavailable in this published catalog.</p>
          </span>
          <span className="mode-output"><small>CATALOG POSTURE</small><b>Analysis only</b><span>Check catalog · no bid cap</span></span>
          <ChevronRight />
        </button>
        <button
          className="mode-card seller-card"
          aria-label="Seller Studio — should I run it?"
          onClick={() => choose("seller")}
        >
          <span className="mode-number">02</span>
          <span className="mode-copy">
            <small>PLANNING A BREAK</small>
            <strong>Should I run it?</strong>
            <p>Add products and costs. ColorBreak builds the viable plan.</p>
          </span>
          <span className="mode-output"><small>YOUR ANSWER</small><b>Economics decision</b><span>Costs · scenarios · demand gate</span></span>
          <ChevronRight />
        </button>
      </section>
      {recentBuyer.length > 0 && (
        <button className="resume-action" onClick={() => choose("buyer", false)}>
          <RotateCw />
          <span><small>LAST BUYER SETUP</small><strong>Resume {recentBuyer.length} product{recentBuyer.length === 1 ? "" : "s"}</strong></span>
          <ChevronRight />
        </button>
      )}
      {recentSeller.length > 0 && <button className="resume-action" onClick={() => choose("seller", false)}>
        <RotateCw /><span><small>THIS BROWSER SESSION</small><strong>Resume seller plan · costs are session-only</strong></span><ChevronRight />
      </button>}
      <p className="demo-scope" role="note">Public demo only — do not use this GitHub Pages build for commercial transactions or financially consequential decisions. A production release needs a header-capable host.</p>
      <footer className="launcher-footer">
        <span>Exact-printing prices · Modeled pull ranges · No login</span>
        <span><a href="./methodology.html">Methodology</a> · <a href="./privacy.html">Privacy</a>{supportUrl && <> · <a href={supportUrl} rel="noreferrer" target="_blank">Support</a></>}</span>
      </footer>
      <button type="button" className="quiet" onClick={() => void clearDevice()}>Clear local ColorBreak app data</button>
      {cleared && <p role="status">ColorBreak-controlled local app storage and cache cleared. Browser history, HTTP cache, and clipboard require browser controls.</p>}
    </main>
  );
}

function Builder({
  open,
  onClose,
  lines,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  lines: BreakLine[];
  onApply: (lines: BreakLine[], settings?: { assignmentMode: AssignmentMode; largeSpots?: number; bulkEnabled?: boolean; bulkThreshold?: number }) => void;
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
  useDialogOwnership(open, onClose, dialogRef, closeRef);
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
                          {set.code} · {set.released}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {!loading && products.length > 0 && readyCount === 0 && <CatalogUnavailableNotice />}
                <label className="ready-only-filter"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} /> Decision-ready only <small aria-live="polite">{readyCount} ready in this published snapshot</small></label>
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
                                Contents: {product.status} · Prices: {readiness[product.key]?.eligibility === "ready" ? "fresh" : readiness[product.key]?.eligibility === "stale" ? "stale" : readiness[product.key]?.eligibility === "incomplete" ? "incomplete" : "checking"} · Bid cap: {readiness[product.key]?.eligibility === "ready" ? "available" : "unavailable"}
                              </small>
                            </span>
                            <ChevronRight />
                          </button>
                        ))}
                      </section>
                    ))}
                    {!Object.values(visibleProducts).some((rows) => rows.length) && <p className="empty-picker-state">No decision-ready products in this published snapshot. Keep or edit this break as analysis-only.</p>}
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

function EmptyBreak({ add }: { add: () => void }) {
  return (
    <section className="empty">
      <span>
        <PackagePlus />
      </span>
      <h2>What’s being opened?</h2>
      <p>Pick the sealed products once. ColorBreak calculates automatically.</p>
      <button className="primary" onClick={add}>
        <PackagePlus size={18} /> Add products
      </button>
    </section>
  );
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

export function Composition({
  lines,
  add,
  update,
  remove,
  headingLabel = "BREAK",
  showHelp = true,
}: {
  lines: BreakLine[];
  add: () => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
  headingLabel?: string;
  showHelp?: boolean;
}) {
  const [expanded, setExpanded] = useState(lines.length <= 4);
  useEffect(() => {
    if (lines.length <= 4) setExpanded(true);
  }, [lines.length]);
  const totalOpenings = lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const rows = lines.map((line) => (
    <div className="line" key={line.id}>
      <span className="set-glyph">{line.set}</span>
      <span className="line-identity">
        <strong>{line.productLabel}</strong>
        <small>{line.set} · {line.packCount && line.packCount > 1 ? `${line.packCount} openings each` : "1 opening each"}</small>
      </span>
      <div className="line-controls">
        <QuantityControl line={line} update={(quantity) => update(line.id, { quantity })} />
        <button
          className="remove-line"
          aria-label={`Remove ${line.productLabel} from break`}
          title="Remove from break"
          onClick={() => remove(line.id)}
        >
          <Trash2 />
        </button>
      </div>
    </div>
  ));
  return (
    <section className="composition panel">
      <PanelHeading
        label={headingLabel}
        help={showHelp ? "The sealed products and quantities being opened in this break. Changing any line immediately recalculates card contents, prices, color value, and possible opening values." : undefined}
        title={<>{lines.length} line{lines.length === 1 ? "" : "s"} · {totalOpenings} opening{totalOpenings === 1 ? "" : "s"}</>}
        accessory={<button className={lines.length ? "quiet" : "primary composition-add-primary"} onClick={add}>
          <PackagePlus /> Add products
        </button>}
      />
      {lines.length > 4 ? <details className="composition-roster" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="disclosure-summary"><span>{expanded ? "Hide product editor" : `Review ${lines.length} product lines`}</span><b>{totalOpenings} openings</b><DisclosureArrow /></summary>
        <div>{rows}</div>
      </details> : rows}
    </section>
  );
}

export function ValueSummary({ result }: { result: ValuationResult }) {
  const ignoredEV = Math.max(0, result.marketEV - result.sellableEV);
  const countedCards = result.slots.reduce(
    (total, slot) => total + slot.contributors.length,
    0,
  );
  return (
    <section className="value-summary panel">
      <PanelHeading
        label={result.threshold > 0 ? "BREAK VALUE AFTER IGNORING BULK" : "BREAK VALUE · ALL PRICED CARDS"}
        help={result.threshold > 0
          ? "The average card value left after removing cards below your bulk-filter amount. This is an average across many possible openings, not a guaranteed result."
          : "Bulk filtering is off, so this average includes every priced card. It is an average across many possible openings, not a guaranteed result."}
        title={fmt(result.sellableEV)}
        accessory={<Status result={result} />}
      />
      <div className="metric-row">
        <div>
          <span>{result.threshold > 0 ? "Before ignoring bulk" : "All priced cards"}</span>
          <b>{fmt(result.marketEV)}</b>
        </div>
        <div>
          <span>{result.threshold > 0 ? "Ignored as bulk" : "Filtered out"}</span>
          <b>{fmt(ignoredEV)}</b>
        </div>
        <div>
          <span>Priced cards used</span>
          <b>{countedCards}</b>
        </div>
      </div>
      <p className="value-equation">
        <span>{fmt(result.marketEV)} all cards</span>
        <b>−</b>
        <span>{fmt(ignoredEV)} {result.threshold > 0 ? "ignored" : "filtered out"}</span>
        <b>=</b>
        <strong>{fmt(result.sellableEV)} used here</strong>
      </p>
    </section>
  );
}

export function SlotRail({
  result,
  auction,
  setAuction,
  assignmentMode,
  setAssignmentMode,
  selected,
  setSelected,
  largeSpots,
  setLargeSpots,
}: {
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selected: SlotId;
  setSelected: (id: SlotId) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  const [editingAvailability, setEditingAvailability] = useState(false);
  return (
    <section className="buyer-slot-control" aria-labelledby="buyer-color-heading">
      <div className="buyer-slot-heading">
        <div>
          <InformationLabel>1 · BREAK FORMAT</InformationLabel>
          <h2 id="buyer-color-heading">{assignmentMode === "pick" ? "Choose your color" : assignmentMode === "random" ? "Mark colors already taken" : "Set the random spot count"}</h2>
          <p>{assignmentMode === "large" ? "For top-value cards and the 17 catch-all spots." : editingAvailability ? "Availability editing is separate from color selection." : "Tap a color to select it."}</p>
        </div>
      </div>
      <div className="assignment-toggle buyer-assignment-toggle" role="group" aria-label="Break assignment mode">
        <button aria-pressed={assignmentMode === "pick"} className={assignmentMode === "pick" ? "active" : ""} onClick={() => {
          const nextSelected = auction.remaining.includes(selected) ? selected : auction.remaining[0];
          if (nextSelected) setSelected(nextSelected);
          setAssignmentMode("pick");
        }}>Pick a color</button>
        <button aria-pressed={assignmentMode === "random"} className={assignmentMode === "random" ? "active" : ""} onClick={() => setAssignmentMode("random")}>Random remaining</button>
        <button aria-pressed={assignmentMode === "large"} className={assignmentMode === "large" ? "active" : ""} onClick={() => setAssignmentMode("large")}>Large break</button>
      </div>
      {assignmentMode === "large" ? (
        <div className="large-break-spot-input">
          <div className="large-break-spot-label"><span>Random spots</span><small>Usually 100–200</small></div>
          <NumericInput value={largeSpots} onCommit={(value) => setLargeSpots(Math.max(1, Math.min(500, Math.round(value ?? 1))))} ariaLabel="Large break spot count" live />
          <p><b>17</b> catch-all spots · remaining spots use top-value cards, with characters grouped by name</p>
        </div>
      ) : <><div className="buyer-slot-rail" role="group" aria-label="Color slots">
        {SLOT_IDS.map((id) => {
          const slot = result?.slots.find((row) => row.id === id);
          const taken = !auction.remaining.includes(id);
          const finalAvailable = !taken && auction.remaining.length === 1;
          return (
            <div className={`buyer-slot-tile slot-${id} ${selected === id && assignmentMode === "pick" ? "active" : ""} ${taken ? "taken" : ""}`} key={id}>
              <button
                type="button"
                aria-pressed={selected === id && assignmentMode === "pick"}
                aria-label={`${SLOT_NAMES[id]} slot`}
                disabled={taken}
                className="buyer-slot-select"
                onClick={() => {
                  setSelected(id);
                  setAssignmentMode("pick");
                }}
              >
                <span>{id}</span>
                <b>{slot ? fmt(slot.sellableEV) : "—"}</b>
                <small>{taken ? "Taken" : SLOT_NAMES[id]}</small>
              </button>
            </div>
          );
        })}
      </div>
      <div className="availability-editor">
        <button type="button" className="quiet" aria-expanded={editingAvailability} onClick={() => setEditingAvailability((value) => !value)}>{editingAvailability ? "Done editing availability" : "Edit availability"}</button>
        {editingAvailability && <div className="availability-actions" role="group" aria-label="Color availability">
          {SLOT_IDS.map((id) => {
            const taken = !auction.remaining.includes(id);
            const finalAvailable = !taken && auction.remaining.length === 1;
            return <button type="button" key={id} aria-label={taken ? `Restore ${SLOT_NAMES[id]} slot` : `Mark ${SLOT_NAMES[id]} taken`} aria-pressed={taken} disabled={finalAvailable} onClick={() => {
              const next = toggleSlotTaken(auction, id);
              if (next === auction) return;
              setAuction(next);
              setAssignmentMode("random");
              if (!next.remaining.includes(selected)) setSelected(next.remaining[0]);
            }}>{taken ? `Restore ${id}` : `Mark ${id} taken`}</button>;
          })}
        </div>}
      </div>
      <p className="remaining-summary">{assignmentMode === "random" ? `${auction.remaining.length} colors remain in the random pool` : `${SLOT_NAMES[selected]} selected`}</p></>}
    </section>
  );
}

function cardPreviewSubtitle(row: Contributor, priceOverride?: number): string {
  const finish = row.finish ?? (row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const price = priceOverride ?? row.marketPrice ?? (finish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined;
  return `${fmt(price)} · ${cardTreatmentLabel(row.card, finish)} · ${row.card.set}`;
}

function CompactWarning({
  title,
  summary,
  children,
  className = "",
}: {
  title: ReactNode;
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`compact-warning ${className}`.trim()}>
      <summary className="disclosure-summary">
        <ShieldAlert />
        <span><b>{title}</b><small>{summary}</small></span>
        <DisclosureArrow />
      </summary>
      <div className="compact-warning-details">{children}</div>
    </details>
  );
}

function IncompleteDataWarning({ analysis, title = "Some values may be low", id, open, onOpenChange }: { analysis: BreakAnalysis; title?: string; id?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const omissions = deduplicateOmissions([...analysis.valuation.omissions, ...analysis.outcomeOmissions]
    .filter((item) => item.material));
  if (analysis.valuation.status !== "incomplete" && analysis.outcomeModel.complete !== false) return null;
  const hasPriceGap = omissions.some((item) => /price|printing/.test(item.code));
  const hasPullRateGap = omissions.some((item) => /pull-rate/.test(item.code));
  const hasPackGap = omissions.some((item) => !/price|printing|pull-rate/.test(item.code));
  const effects = [
    "The estimate still uses all verified information.",
    hasPriceGap ? "Cards without a price count as $0." : "",
    hasPullRateGap ? "Cards with unknown pull chances stay in Rank by Price but are left out of EV." : "",
    hasPackGap ? "Unverified pack contents are not included." : "",
    "The real value may be higher.",
  ].filter(Boolean).join(" ");
  const technicalMessage = (message: string) => message
    .replace(/ Its price remains visible, but it is excluded from expected value and Rank by EV until the rate can be verified\.$/, "")
    .replace(/ Its price stays visible, but it adds \$0 to expected value and is omitted from Rank by EV because the exact chance of opening it is unknown\.$/, "");
  return (
    <details id={id} className="incomplete-data-warning" open={open} onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
      <summary className="disclosure-summary">
        <ShieldAlert />
        <span><b>{title}</b><small>Some prices, pull chances, or pack contents could not be verified.</small></span>
        <DisclosureArrow />
      </summary>
      <div className="incomplete-data-details">
        <p>{effects}</p>
        {omissions.length > 0 && <details className="incomplete-data-technical" open={open}>
          <summary className="disclosure-summary">
            <span><b>Technical details</b><small>{omissions.length} {omissions.length === 1 ? "issue" : "issues"}</small></span>
            <DisclosureArrow />
          </summary>
          <ul>{omissions.map((omission, index) => <li key={`${omission.code}-${index}`}>
            <span>{technicalMessage(omission.message)}</span>
            {omission.source && <a href={omission.source} target="_blank" rel="noreferrer">Source</a>}
          </li>)}</ul>
        </details>}
      </div>
    </details>
  );
}

export function CardInspector({
  row,
  status,
  threshold,
  onClose,
}: {
  row: Contributor | null;
  status: ValuationResult["status"];
  threshold: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [faceIndex, setFaceIndex] = useState(0);

  useEffect(() => setFaceIndex(0), [row?.card.id, row?.finish]);

  useDialogOwnership(Boolean(row), onClose, dialogRef, closeRef);

  const affiliateTemplate = import.meta.env.VITE_TCGPLAYER_AFFILIATE_URL as
    | string
    | undefined;
  const affiliateUrl = row
    ? affiliateTemplate?.replace("{card}", encodeURIComponent(row.card.name))
    : undefined;
  const odds = row?.sellablePullProbability ?? 0;
  const selectedFinish = row?.finish ?? (row && row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const selectedPrice = row
    ? row.marketPrice ?? (selectedFinish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined
    : undefined;
  const selectedPriceSource = row?.priceBasis === "listed-tcg"
    ? "Exact-printing listed TCG price"
    : row?.priceBasis === "same-printing-foil-market"
      ? "Same-printing foil market price"
      : "Exact-printing market price";
  const baseSelectedPrice = row
    ? selectedFinish === "foil" ? row.card.foil : selectedFinish === "nonfoil" ? row.card.nonfoil : undefined
    : undefined;
  const showSelectedFinishPrice = Boolean(row && (
    selectedFinish !== "nonfoil"
    || selectedPrice !== (baseSelectedPrice ?? undefined)
  ));
  const faces = row?.card.faces ?? [];
  const activeFace = faces[faceIndex];
  const activeImage = activeFace?.image ?? row?.card.image;
  const activeOracleText = activeFace?.oracleText ?? row?.card.oracleText;
  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          className="scrim card-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={onClose}
        >
          <motion.section
            ref={dialogRef}
            className="card-inspector"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-inspector-title"
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <InformationLabel>CARD DETAILS</InformationLabel>
                <h2 id="card-inspector-title">{cardDisplayName(row.card, row.finish)}</h2>
              </div>
              <button
                ref={closeRef}
                className="icon-button"
                onClick={onClose}
                aria-label="Close card details"
              >
                <X />
              </button>
            </header>
            <div className="card-inspector-body">
              <div className="card-art">
                {activeImage ? (
                  <img src={activeImage} alt={`${activeFace?.name ?? row.card.name} ${faces.length > 1 ? (faceIndex === 0 ? "front face" : "back face") : "card"}`} />
                ) : (
                  <span>Image unavailable</span>
                )}
                {faces.length > 1 && (
                  <button
                    type="button"
                    className="flip-card"
                    onClick={() => setFaceIndex((current) => (current + 1) % faces.length)}
                    aria-label={`Flip to ${faces[(faceIndex + 1) % faces.length]?.name ?? (faceIndex === 0 ? "back face" : "front face")}`}
                  >
                    <RotateCw aria-hidden="true" /> Flip <small>{faceIndex + 1} / {faces.length}</small>
                  </button>
                )}
              </div>
              <div className="card-info">
                <div className="card-stat primary-stat">
                  <span>Pull odds in this break</span>
                  <strong>{oddsLabel(odds)}</strong>
                  <small>
                    {odds > 0 && odds < 1
                      ? `About 1 in ${(1 / odds).toFixed(odds < 0.1 ? 1 : 0)} breaks`
                      : odds >= 1
                        ? "Guaranteed by known contents"
                        : "No known pull path"}
                  </small>
                </div>
                <div className="card-price-grid">
                  <div className="card-stat">
                    <span>Nonfoil market</span>
                    <strong>{fmt(row.card.nonfoil ?? undefined)}</strong>
                  </div>
                  <div className="card-stat">
                    <span>Foil market</span>
                    <strong>{fmt(row.card.foil ?? undefined)}</strong>
                  </div>
                </div>
                {showSelectedFinishPrice && <div className="card-stat selected-finish-price">
                  <span>Selected finish price</span>
                  <strong>{fmt(selectedPrice)}</strong>
                  <small>{row ? `${cardTreatmentLabel(row.card, selectedFinish)} · ${selectedPriceSource}` : selectedPriceSource}</small>
                </div>}
                <div className="card-stat">
                  <span>Average copies per break</span>
                  <strong>
                    {row.sellableCopies.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}
                  </strong>
                  <small>
                    {status === "verified"
                      ? `Card versions worth ${fmt(threshold)} or more are included.`
                      : "This uses the product information currently available. Missing details could change it."}
                  </small>
                </div>
                {activeOracleText && (
                  <p className="oracle-text">{activeOracleText}</p>
                )}
                {affiliateUrl && (
                  <div className="affiliate-action">
                    <a href={affiliateUrl} rel="sponsored noreferrer" target="_blank">
                      Find this card on TCGplayer
                    </a>
                    <small>
                      Affiliate link. ColorBreak may earn a commission; it never
                      changes prices, odds, rankings, or analysis.
                    </small>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function useOutcomeSimulation(
  analysis: BreakAnalysis,
  remaining: SlotId[],
  landedCost: number | undefined,
): { result?: SimulationResult; error?: string; busy: boolean } {
  const [state, setState] = useState<{ result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const modelKey = analysis.outcomeModel.cacheKey ?? JSON.stringify(analysis.outcomeModel);
  const key = `${analysis.valuation.dataVersion}|${analysis.valuation.status}|${modelKey}|${analysis.valuation.threshold}|${remaining.join("")}|${landedCost ?? "none"}`;
  useEffect(() => {
    let current = true;
    let refinementId: number | undefined;
    setState((previous) => ({ ...previous, busy: true, error: undefined }));
    const options = {
      seed: key,
      sampleCount: 10_000,
      remaining,
      landedCost,
    };
    simulateOutcomesAsync(analysis.outcomeModel, options).then((result) => {
      if (!current) return;
      setState({ result, busy: false });
      const refine = () => simulateOutcomesAsync(analysis.outcomeModel, { ...options, sampleCount: 50_000 })
        .then((refined) => { if (current) setState({ result: refined, busy: false }); })
        .catch(() => { /* keep the valid interactive result */ });
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (idleWindow.requestIdleCallback) {
        refinementId = idleWindow.requestIdleCallback(refine, { timeout: 4000 });
      } else {
        refinementId = setTimeout(refine, 750);
      }
    }).catch((error) => {
      if (current) setState({ busy: false, error: error instanceof Error ? error.message : String(error) });
    });
    return () => {
      current = false;
      if (refinementId != null) {
        const idleWindow = window as Window & { cancelIdleCallback?: (id: number) => void };
        if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(refinementId);
        else clearTimeout(refinementId);
      }
    };
  // `remaining` is often assembled inline by chart callers. The request key
  // captures its values; depending on the array identity creates a render loop.
  }, [key]);
  return state;
}

function OutcomeRange({ summary, landed, compact = false }: { summary?: DistributionSummary; landed?: number; compact?: boolean }) {
  if (!summary) return <div className="distribution-empty">Calculating the outcome range from the information currently available…</div>;
  const chanceToClear = landed == null
    ? undefined
    : summary.chanceToClearCost ?? summary.fingerprint.filter((value) => value >= landed).length / summary.fingerprint.length;
  return (
    <div className={`outcome-range ${compact ? "outcome-range-compact" : ""}`} aria-label="Possible opening values">
      <div className="outcome-range-heading">
        <span>{compact ? "Outcome range" : "Possible opening values"}</span>
        {!compact && <Tip text="Shows a lower result, a middle result, and a higher result across many simulated openings. These are examples of the range you could see, not a prediction of the next opening." />}
      </div>
      <div className="outcome-landmarks">
        <div>
          <span>{compact ? "Downside" : "Lower result"}</span>
          <b>{fmt(summary.p10)}</b>
          {!compact && <small>About 1 in 10 openings are worth this or less</small>}
        </div>
        <div className="typical">
          <span>{compact ? "Typical" : "Typical result"}</span>
          <b>{fmt(summary.median)}</b>
          {!compact && <small>About half are worth less and half are worth more</small>}
        </div>
        <div>
          <span>{compact ? "Upside" : "Higher result"}</span>
          <b>{fmt(summary.p90)}</b>
          {!compact && <small>About 1 in 10 openings are worth this or more</small>}
        </div>
      </div>
      {chanceToClear != null && landed != null && (
        <div className="clear-chance">
          <div><span>Chance card value covers your {fmt(landed)} cost</span><b>{Math.round(chanceToClear * 100)}%</b></div>
          <div className="clear-chance-track" aria-label={`${Math.round(chanceToClear * 100)}% chance card value covers your cost`}>
            <span style={{ width: `${chanceToClear * 100}%` }} />
          </div>
        </div>
      )}
      {!compact && <p>Possible results from simulations—not a prediction of the next opening.</p>}
    </div>
  );
}

export function BreakBalance({
  result, remaining, simulation,
}: {
  result: ValuationResult;
  remaining: SlotId[];
  simulation?: SimulationResult;
}) {
  const rows = result.slots.filter((slot) => remaining.includes(slot.id));
  const distributions = simulation?.slotDistributions;
  const weakest = Math.min(...rows.map((slot) => slot.sellableEV));
  const strongest = Math.max(...rows.map((slot) => slot.sellableEV), 0);
  const balanceTip = (
    <Tip
      className="balance-score"
      text={strongest
        ? `The weakest remaining slot has ${Math.round(weakest / strongest * 100)}% as much average card value after the bulk filter as the strongest remaining slot. 100% would mean equal slot values; a lower percentage means a more uneven break.`
        : "There is not enough counted value to compare the weakest and strongest remaining slots."}
      label="Explain the Break Balance percentage"
    >
      <b>{strongest ? `${Math.round(weakest / strongest * 100)}%` : "—"}</b>
      <span>weakest vs strongest</span>
    </Tip>
  );
  if (!distributions) return (
    <section className="panel balance-panel">
      <PanelHeading
        label="BREAK BALANCE"
        help="ColorBreak is checking thousands of pack openings using the published pull weights and pack-collation rules."
        title="Building realistic pull ranges"
        accessory={balanceTip}
      />
      <div className="distribution-unavailable" role="status"><b>Calculating ranges</b><span>The rest of the page remains available while this finishes.</span></div>
    </section>
  );
  const scaleMax = Math.max(...SLOT_IDS.flatMap((id) => [
    distributions[id].p99,
    result.slots.find((slot) => slot.id === id)?.sellableEV ?? 0,
  ]), 1);
  const positionOnScale = (value: number) => Math.min(100, Math.max(0, value / scaleMax * 100));
  const axisTicks = [0, .25, .5, .75, 1].map((fraction) => ({
    fraction,
    value: scaleMax * fraction,
  }));
  return (
    <section className="panel balance-panel">
      <PanelHeading
        label="BREAK BALANCE"
        help="Each wick shows the middle 98% of modeled openings, trimming the most extreme 1% at both ends. The white body contains the middle half. The EV marker is the pull-rate average after serialized and one-of-one collector outliers are removed."
        title="Equal chance, unequal pools"
        accessory={balanceTip}
      />
      <p className="balance-note">Each remaining slot is equally likely. The card value assigned to each slot is not equal.</p>
      <p className="balance-scale-note">Shared linear scale · practical 1-in-100 maximum excludes the most extreme opening results</p>
      <div className="balance-chart" aria-label="Practical modeled card-value range and pull-rate expected value by color">
        <div className="balance-axis" aria-hidden="true">
          <span />
          <div className="balance-axis-track">
            {axisTicks.map((tick) => <span key={tick.fraction} style={{ left: `${tick.fraction * 100}%` }}>{fmtChart(tick.value)}</span>)}
          </div>
        </div>
        {rows.map((slot) => {
          const distribution = distributions[slot.id];
          const rangeLow = distribution.p01;
          const rangeHigh = distribution.p99;
          const expectedValue = slot.sellableEV;
          const bodyLow = Math.min(rangeHigh, Math.max(rangeLow, distribution.p25));
          const bodyHigh = Math.max(bodyLow, Math.min(rangeHigh, Math.max(rangeLow, distribution.p75)));
          const lowPosition = positionOnScale(rangeLow);
          const highPosition = positionOnScale(rangeHigh);
          const evPosition = positionOnScale(expectedValue);
          const bodyLowPosition = positionOnScale(bodyLow);
          const bodyHighPosition = positionOnScale(bodyHigh);
          return (
            <div className={`balance-column slot-${slot.id}`} key={slot.id} aria-label={`${slot.name}: practical range ${fmt(rangeLow)} to ${fmt(rangeHigh)}, pull-rate expected value ${fmt(expectedValue)}, middle half ${fmt(bodyLow)} to ${fmt(bodyHigh)}`}>
              <strong className="balance-slot"><span>{slot.id}</span><small>{slot.name}</small></strong>
              <div className="balance-track">
                <span className="balance-whisker" style={{ left: `${lowPosition}%`, width: `${Math.max(0, highPosition - lowPosition)}%` }} />
                <span className="balance-cap balance-cap-high" style={{ left: `${highPosition}%` }} />
                <span className="balance-cap balance-cap-low" style={{ left: `${lowPosition}%` }} />
                <span className="balance-body" style={{ left: `${bodyLowPosition}%`, width: `${Math.max(0, bodyHighPosition - bodyLowPosition)}%` }} />
                <span className="balance-ev-marker" style={{ left: `${evPosition}%` }} />
                <div className="balance-values">
                  <div className="balance-worst"><small>LOW</small>{fmtChart(rangeLow)}</div>
                  <div className="balance-ev"><small>EV</small>{fmtChart(expectedValue)}</div>
                  <div className="balance-best"><small>HIGH</small>{fmtChart(rangeHigh)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="balance-caption"><b>Low / high</b> practical 1st-to-99th percentile · <strong>outlined bar</strong> middle half of modeled openings · <span>EV marker</span> pull-rate average. Every slot uses the same linear scale from $0 to {fmtChart(scaleMax)}. Serialized and one-of-one collector outliers are excluded.</p>
    </section>
  );
}

interface EvidenceExplanation {
  title: string;
  status: string;
  meaning: string;
  matters: string;
  action: string;
}

function EvidenceDialog({ item, onClose }: { item: EvidenceExplanation | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogOwnership(Boolean(item), onClose, dialogRef, closeRef);
  if (!item) return null;
  return createPortal(
    <div className="scrim evidence-scrim" onPointerDown={onClose}>
      <section ref={dialogRef} className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div><InformationLabel>WHY THIS MATTERS</InformationLabel><h2 id="evidence-dialog-title">{item.title}</h2></div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close explanation"><X /></button>
        </header>
        <div className="evidence-explanation">
          <p className="evidence-current"><span>Current check</span><strong>{item.status}</strong></p>
          <section><h3>What is it?</h3><p>{item.meaning}</p></section>
          <section><h3>Why should I care?</h3><p>{item.matters}</p></section>
          <section><h3>What should I do?</h3><p>{item.action}</p></section>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function EvidenceLens({ analysis }: { analysis: BreakAnalysis }) {
  const [selected, setSelected] = useState<EvidenceExplanation | null>(null);
  const { valuation } = analysis;
  const priceAvailability = analysis.priceAvailability ?? {
    status: "unavailable" as const,
    source: "none" as const,
    message: "Price-source availability was not reported for this analysis.",
  };
  const priced = Date.parse(valuation.pricedAt);
  const ageHours = Number.isFinite(priced) ? Math.max(0, (Date.now() - priced) / 36e5) : undefined;
  const labels: EvidenceExplanation[] = [
    {
      title: "Exact product",
      status: plainEvidence(valuation.evidence.productIdentity),
      meaning: "This checks that ColorBreak is using the exact box, bundle, or pack in the auction—not a similarly named product.",
      matters: "Two products from the same set can contain different packs, promos, and card chances. Choosing the wrong one can change every number on this page.",
      action: "Match the product name and contents to the seller's listing. If this check is uncertain, do not rely on the bid guidance.",
    },
    {
      title: "Items inside",
      status: plainEvidence(valuation.evidence.contents),
      meaning: "This checks which packs, promos, box toppers, decks, and fixed cards are actually inside the sealed product.",
      matters: "An uncounted promo or topper can hide real value. A pack counted by mistake can make the break look better than it is.",
      action: "Use the result normally when this is ready. If a warning appears, open it for a short explanation or the exact technical details.",
    },
    {
      title: "Pack chances",
      status: plainEvidence(valuation.evidence.collation),
      meaning: "A pack is not filled by picking every card equally. This check describes how often each kind of card can appear.",
      matters: "These chances power the pull odds, typical outcome, and high and low ranges. Bad pack chances can make a correct price produce a wrong answer.",
      action: "When this is uncertain, use the shown range as a partial estimate. Missing pack chances can move the low, typical, and high outcomes in either direction.",
    },
    {
      title: "Card versions",
      status: plainEvidence(valuation.evidence.finish),
      meaning: "The same card can be nonfoil, foil, etched, textured, or another special version, and each version can have a different price.",
      matters: "Using a premium version's price for an ordinary copy can badly overstate value. Missing a guaranteed premium version can understate it.",
      action: "Check the seller's exact product version when this is uncertain. ColorBreak will not silently swap one card version's price for another.",
    },
    {
      title: "Card prices",
      status: priceAvailability.status === "available" ? "Ready" : plainEvidence(priceAvailability.status),
      meaning: `These are saved market-price observations${ageHours == null ? "" : ` from about ${ageHours < 1 ? "less than one" : Math.round(ageHours)} hours ago`}—not guaranteed sale prices.`,
      matters: "Prices move, and a listed market price does not promise that you can sell the card for that amount. Older prices make the bid comparison less dependable.",
      action: "Give yourself more room below the shown value when prices are old or missing, especially when one expensive card drives most of a color's value.",
    },
    {
      title: "Color assignment rules",
      status: plainEvidence(valuation.evidence.breakRules),
      meaning: "This says where multicolor cards, colorless cards, lands, double-faced cards, promos, and toppers go in the break.",
      matters: "The total break value may stay the same while the value of the color you can win changes a lot. Seller rules can differ from ColorBreak's preset.",
      action: "Confirm the seller's rules before bidding. If they differ, update the rules or avoid using the per-color guidance.",
    },
  ];
  return (
    <details className="rollout evidence-lens">
      <summary className="disclosure-summary">
        <span><ShieldAlert /><b>Data confidence</b><small>{analysis.outcomeModel.complete === false ? "Resolved-only result · exact missing items listed below" : "All key information is ready"}</small></span>
        <span className="summary-actions"><span className="summary-help"><span>{ageHours == null ? "Price time unknown" : `Prices ${ageHours < 1 ? "<1" : Math.round(ageHours)}h old`}</span><Tip text="Shows which product details were checked, what is missing, and how those gaps may affect the values and outcome ranges shown." /></span><DisclosureArrow /></span>
      </summary>
      <div className="evidence-grid">
        {labels.map((item) => (
          <button key={item.title} type="button" onClick={() => setSelected(item)} aria-label={`Explain ${item.title}: ${item.status}`}>
            <span>{item.title}</span><b>{item.status}</b><ChevronRight />
          </button>
        ))}
      </div>
      <p className="evidence-price-note">Price source: {priceAvailability.source === "snapshot" ? "saved Scryfall prices" : plainEvidence(priceAvailability.source)}.</p>
      {analysis.outcomeOmissions.length > 0 && (
        <ul>{analysis.outcomeOmissions.slice(0, 8).map((omission, index) => <li key={`${omission.code}-${index}`}>{omission.message}</li>)}</ul>
      )}
      <EvidenceDialog item={selected} onClose={() => setSelected(null)} />
    </details>
  );
}

export function ChaseConstellation({
  slot,
  onInspect,
}: {
  slot: SlotValuation;
  onInspect: (row: Contributor) => void;
}) {
  const rows = slot.contributors.slice(0, 12);
  const datum = (row: Contributor) => ({
    price: row.marketPrice ?? row.marketValue / Math.max(row.copies, .0001),
    probability: row.sellablePullProbability,
  });
  const maxContribution = Math.max(1, ...rows.map((row) => row.sellableValue));
  const diameters = rows.map((row) => 26 + Math.sqrt(row.sellableValue / maxContribution) * 12);
  const scale = chaseMapLayout(rows.map((row, index) => ({
    ...datum(row),
    diameter: diameters[index],
  })));
  const contributorId = (row: Contributor) => `${row.card.id}|${row.finish ?? "nonfoil"}`;
  return (
    <details className="rollout supporting-view">
      <summary className="disclosure-summary"><span><b>Chase Map</b><small>Card price vs. chance of pulling it</small></span><span className="summary-actions"><span className="summary-help"><span>{SLOT_NAMES[slot.id]}</span><Tip text="Each numbered point maps directly to the same number in the card key. Position shows price and pull chance; size shows how much the card adds to average value. Tap either place for full details." /></span><DisclosureArrow /></span></summary>
      {!rows.length ? <p className="supporting-empty">No cards meet the current bulk boundary.</p> : (
        <div className="chase-map" aria-label={`${SLOT_NAMES[slot.id]} card price and pull chance map`}>
          <div className="constellation">
            <div className="chase-plot" aria-hidden="true">
              <span className="plot-price plot-price-high">{fmt(scale.maxPrice)}</span>
              <span className="plot-price plot-price-mid">{fmt(scale.maxPrice / 2)}</span>
              <span className="plot-price plot-price-low">$0</span>
              <span className="plot-odds plot-odds-low">0%</span>
              <span className="plot-odds plot-odds-mid">{oddsLabel(scale.maxProbability / 2)}</span>
              <span className="plot-odds plot-odds-high">{oddsLabel(scale.maxProbability)}</span>
            </div>
            {rows.map((row, index) => {
              const point = scale.points[index];
              const diameter = diameters[index];
              const displayName = cardDisplayName(row.card, row.finish);
              return (
                <button
                  className="chase-point"
                  key={contributorId(row)}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    width: `${diameter}px`,
                    height: `${diameter}px`,
                  }}
                  onClick={() => onInspect(row)}
                  aria-label={`${displayName}: ${oddsLabel(row.sellablePullProbability)} pull chance, ${fmt(datum(row).price)} market price, adds ${fmt(row.sellableValue)} to the average`}
                  title={displayName}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="chase-card-key">
            {rows.map((row, index) => (
              <button key={contributorId(row)} type="button" onClick={() => onInspect(row)}>
                <b>{index + 1}</b>
                <CardThumbnail row={row} />
                <span><strong>{row.card.name}</strong><small>{cardPreviewSubtitle(row, datum(row).price)}</small></span>
                <em>{fmt(row.sellableValue)}</em>
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && <div className="chase-chart-key" aria-label="Chase Map chart key">
        <span><b>X</b> Chance to pull</span>
        <span><b>Y</b> Market price</span>
        <span className="chase-size-legend"><i />Larger dot adds more to average value</span>
      </div>}
      <p className="supporting-note">Top-right cards combine the highest price with the best pull chance. Tap any card image to inspect its price, odds, and printing.</p>
    </details>
  );
}

export function BulkFilterControl({
  enabled,
  threshold,
  result,
  onToggle,
  onThreshold,
  compact = false,
}: {
  enabled: boolean;
  threshold: number;
  result?: ValuationResult;
  onToggle: (enabled: boolean) => void;
  onThreshold: (threshold: number) => void;
  compact?: boolean;
}) {
  const ignored = result ? Math.max(0, result.marketEV - result.sellableEV) : 0;
  const retained = result && result.marketEV > 0 ? result.sellableEV / result.marketEV : 1;
  const explanation = enabled
    ? `Cards worth less than ${fmt(threshold)} each are ignored everywhere in ColorBreak. Cards worth exactly ${fmt(threshold)} are still counted.`
    : `Bulk filtering is off. Every priced card is counted. Turn it on to ignore cards worth less than ${fmt(threshold)} each.`;
  return (
    <section className={`bulk-filter-control ${enabled ? "enabled" : "disabled"}`}>
      <div className="bulk-filter-main">
        <button type="button" className="bulk-toggle" role="switch" aria-checked={enabled} onClick={() => onToggle(!enabled)}>
          <span aria-hidden="true"><i /></span><b>Bulk filter</b><small>{enabled ? "On" : "Off"}</small>
        </button>
        <label className="bulk-value-field">
          <span>Ignore cards under</span>
          <div><b>$</b><NumericInput value={threshold} onCommit={(value) => onThreshold(value ?? 0)} ariaLabel="Bulk filter dollar amount" /></div>
        </label>
        {!compact && <Tip className="bulk-filter-help" text={explanation} label="Explain the current bulk filter setting" />}
      </div>
      {!compact && <details className="bulk-filter-details">
        <summary className="disclosure-summary"><span>See what the filter changes</span><DisclosureArrow /></summary>
        {!result ? <p>Product values are still loading.</p> : (
          <div className="bulk-filter-rollout">
            <div><span>All priced card value</span><b>{fmt(result.marketEV)}</b></div>
            <div><span>{enabled ? "Ignored as bulk" : "Ignored while filter is off"}</span><b>{fmt(ignored)}</b></div>
            <div><span>Value used by ColorBreak</span><b>{fmt(result.sellableEV)}</b></div>
            <div className="boundary-track" aria-label={`${Math.round(retained * 100)} percent of all card value is counted`}><span style={{ width: `${retained * 100}%` }} /></div>
            <p>{enabled
              ? `${fmt(result.marketEV)} in all priced cards − ${fmt(ignored)} under ${fmt(threshold)} = ${fmt(result.sellableEV)} used throughout the tool.`
              : `No priced cards are being removed. Turn the filter on when you do not want low-value bulk included in card value.`}</p>
          </div>
        )}
      </details>}
    </section>
  );
}

function slotProfile(slot: SlotValuation) {
  if (!slot.contributors.length) return "NO PRICED CARDS";
  if (slot.chaseShare >= 0.5) return "CHASE-HEAVY";
  if (slot.chaseShare >= 0.3) return "MIXED";
  return "DIVERSIFIED";
}

function CardThumbnail({ row }: { row: Contributor }) {
  return (
    <span
      className="card-thumbnail"
      style={{ backgroundImage: row.card.image ? `url("${row.card.image}")` : undefined }}
      aria-hidden="true"
    >
      {row.card.image ? null : row.card.name.slice(0, 1)}
    </span>
  );
}

export function ContributorRows({
  slot,
  onInspect,
  limit = 8,
}: {
  slot: SlotValuation;
  onInspect: (row: Contributor) => void;
  limit?: number;
}) {
  if (!slot.contributors.length) {
    return <p className="no-contributors">No cards in this color are above the current bulk limit.</p>;
  }
  return (
    <>
      <div className="contributor-columns">
        <span>Card and exact printing</span>
        <span>Pull odds</span>
        <span>Adds to average</span>
      </div>
      {slot.contributors.slice(0, limit).map((row) => (
        <button
          type="button"
          className="card-row contributor-card"
          key={`${row.card.id}|${row.finish ?? "nonfoil"}`}
          onClick={() => onInspect(row)}
          aria-label={`Open ${cardDisplayName(row.card, row.finish)}: ${oddsLabel(row.sellablePullProbability)} pull odds, ${countedPriceLabel(row)}, adds ${fmt(row.sellableValue)} to the average`}
        >
          <CardThumbnail row={row} />
          <span className="card-summary">
            <strong>{row.card.name}</strong>
            <small>{cardPreviewSubtitle(row)}</small>
          </span>
          <span className="pull-odds">
            <b>{oddsLabel(row.sellablePullProbability)}</b>
          </span>
          <span className="ev-contribution">
            <b>{fmt(row.sellableValue)}</b>
          </span>
        </button>
      ))}
    </>
  );
}

export function SlotValueDetails({
  slot,
  threshold,
  onInspect,
  className = "",
}: {
  slot: SlotValuation;
  threshold: number;
  onInspect: (row: Contributor) => void;
  className?: string;
}) {
  const profileLabel = slotProfile(slot);
  const profileTip = (
    <Tip
      className={`risk-label risk-${profileLabel.toLowerCase().replace(/[^a-z]+/g, "-")}`}
      text={profileLabel === "DIVERSIFIED"
        ? "The biggest card supplies less than 30% of this color's average value. More cards share the load, but this does not guarantee a minimum return."
        : profileLabel === "MIXED"
          ? "The biggest card supplies 30% to 49% of this color's average value. One chase matters, but other cards still add meaningful value."
          : profileLabel === "CHASE-HEAVY"
            ? "One card supplies at least half of this color's average value. The average depends heavily on pulling that card."
            : `No ${slot.name.toLowerCase()} card is worth at least ${fmt(threshold)}.`}
      label={`Explain ${profileLabel.toLowerCase()} value spread`}
    >
      <span>{profileLabel}</span>
    </Tip>
  );
  return (
    <section className={`panel slot-detail ${className}`.trim()}>
      <PanelHeading
        label={`${slot.name.toUpperCase()} VALUE DETAILS`}
        help="Shows which cards create this color's average value and how much that value depends on one expensive chase card."
        title={<>What makes up {fmt(slot.sellableEV)}?</>}
        accessory={profileTip}
        description={<p className="risk-explainer">
            {slot.name} cards worth {fmt(threshold)} or more. Cheaper cards are ignored as bulk.
          </p>}
      />
      <div className="concentration">
        <div className="concentration-labels">
          <span>Value spread across cards</span>
          <span>Value depends on one chase</span>
        </div>
        <div className="risk-bar" aria-label={`${Math.round(slot.chaseShare * 100)}% of this color's average value comes from its biggest card`}>
          <span style={{ width: `${Math.min(100, slot.chaseShare * 100)}%` }} />
        </div>
      </div>
      <div className="metric-row risk-metrics">
        <div><span>Biggest card's share</span><b>{Math.round(slot.chaseShare * 100)}%</b></div>
        <div><span>Value without it</span><b>{fmt(slot.withoutChase)}</b></div>
        <div><span>Priced cards used</span><b>{slot.contributors.length}</b></div>
      </div>
      <details open className="contributors">
        <summary className="disclosure-summary">
          <span>
            Cards adding the most value
            <small>Largest effect on the average first</small>
          </span>
          <DisclosureArrow />
        </summary>
        <ContributorRows slot={slot} onInspect={onInspect} />
      </details>
    </section>
  );
}

function LargeBreakSlotCards({
  rows,
  onInspect,
}: {
  rows: Contributor[];
  onInspect: (row: Contributor) => void;
}) {
  const sortedRows = [...rows].sort((left, right) =>
    (right.marketPrice ?? right.card.foil ?? right.card.nonfoil ?? 0)
      - (left.marketPrice ?? left.card.foil ?? left.card.nonfoil ?? 0)
      || left.card.name.localeCompare(right.card.name),
  );
  return (
    <div className="large-break-slot-cards">
      <div className="contributor-columns">
        <span>Card and exact printing</span>
        <span>Pull odds</span>
        <span>Adds to average</span>
      </div>
      {sortedRows.length ? sortedRows.map((row) => (
        <button
          type="button"
          className="card-row contributor-card"
          key={`${row.card.id}|${row.finish ?? "nonfoil"}`}
          onClick={() => onInspect(row)}
          aria-label={`Open ${cardDisplayName(row.card, row.finish)} card details`}
        >
          <CardThumbnail row={row} />
          <span className="card-summary"><strong>{row.card.name}</strong><small>{cardPreviewSubtitle(row)}</small></span>
          <span className="pull-odds"><b>{oddsLabel(row.sellablePullProbability)}</b></span>
          <span className="ev-contribution"><b>{fmt(row.sellableValue)}</b></span>
        </button>
      )) : <p className="no-contributors">No priced cards are assigned to this slot.</p>}
    </div>
  );
}

export function LargeBreakView({
  analysis,
  lines,
  spots,
  bid,
  setBid,
  shipping,
  setShipping,
}: {
  analysis: BreakAnalysis;
  lines: BreakLine[];
  spots: number;
  bid: number | undefined;
  setBid: (value: number | undefined) => void;
  shipping: number | undefined;
  setShipping: (value: number | undefined) => void;
}) {
  const result = analysis.valuation;
  const eligibility = decisionEligibility(result);
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const [excludedCard, setExcludedCard] = useState<Contributor | null>(null);
  const [topCardSort, setTopCardSort] = useState<TopCardSort>("expected-value");
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [tax, setTax] = useState<number | undefined>(0);
  const [haircut, setHaircut] = useState(0);
  const [namedLimit, setNamedLimit] = useState(10);
  const [categoryLimit, setCategoryLimit] = useState(5);
  const [blockersOpen, setBlockersOpen] = useState(false);
  const plan = useMemo(() => createLargeBreakPlan(result, spots), [result, spots]);
  const assignment = useMemo(() => summarizeAssignmentValues(plan), [plan]);
  const rankedNamedCards = useMemo(() => sortNamedCards(plan.namedCards, topCardSort), [plan.namedCards, topCardSort]);
  const completeSealedValue = lines.every((line) => line.marketCost != null);
  const sealedMarketValue = completeSealedValue
    ? lines.reduce((sum, line) => sum + line.quantity * line.marketCost!, 0)
    : undefined;
  const namedEV = plan.namedCards.reduce((sum, card) => sum + card.pullEV, 0);
  const categoryEV = plan.categories.reduce((sum, category) => sum + category.pullEV, 0);
  const totalOpenings = lines.reduce((sum, line) => sum + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const allIn = bid == null ? undefined : bid + (shipping ?? 0) + (tax ?? 0);
  const liquidFactor = Math.max(0, 1 - haircut / 100);
  const liquidMean = assignment.mean * liquidFactor;
  const belowCost = allIn == null ? undefined : assignment.values.filter((value) => value * liquidFactor < allIn).length;
  const materialOmissions = deduplicateOmissions([...result.omissions, ...analysis.outcomeOmissions].filter((item) => item.material));
  const coverageReady = result.status === "verified" && analysis.outcomeModel.complete && materialOmissions.length === 0;
  const comparison = !coverageReady
    ? "CANNOT CLASSIFY PRICE"
    : allIn == null
      ? "ENTER ONE-SPOT BID"
      : allIn < liquidMean * .95
        ? "BELOW MODELED MEAN"
        : allIn > liquidMean * 1.05
          ? "ABOVE MODELED MEAN"
          : "NEAR MODELED MEAN";
  const maxAssignment = Math.max(1, ...assignment.values);
  return (
    <section className="large-break-results" aria-label="Large break spot value">
      <header className="large-break-result-head">
        <div><InformationLabel>LARGE RANDOM BREAK</InformationLabel><h2>{plan.spotCount} spots</h2></div>
        <Status result={result} />
      </header>
      <section className={`large-break-decision ${coverageReady ? "is-ready" : "is-blocked"}`} aria-label="One-spot price check">
        <div className="large-break-decision-copy">
          <InformationLabel>ONE-SPOT EV CHECK</InformationLabel>
          <h2>{comparison}</h2>
          {!coverageReady ? <><p>The model is incomplete, so ColorBreak will not turn this partial estimate into a price judgment.</p><button type="button" className="review-blockers" onClick={() => { setBlockersOpen(true); requestAnimationFrame(() => document.getElementById("large-break-blockers")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Review all {materialOmissions.length} model blockers ↓</button></> : allIn == null ? <p>Enter the current bid for one random spot. This compares cost with modeled average value; it is not a guaranteed return.</p> : <p><b>{fmt(allIn)}</b> all-in is <b>{fmt(Math.abs(liquidMean - allIn))}</b> {allIn <= liquidMean ? "below" : "above"} the {fmt(liquidMean)} modeled mean.</p>}
        </div>
        <div className="large-break-cost-fields">
          <NumberField id="large-break-bid" label="Bid for one spot" value={bid} onChange={setBid} />
          <NumberField id="large-break-shipping" label="Allocated shipping" value={shipping} onChange={setShipping} />
          <NumberField id="large-break-tax" label="Estimated tax" value={tax} onChange={setTax} />
          <label className="large-break-haircut"><span>Listed card value you expect to recover</span><div><input aria-label="Percent of listed card value you expect to recover" type="number" inputMode="numeric" min="0" max="100" value={100 - haircut} onChange={(event) => setHaircut(Math.max(0, 100 - Math.min(100, Number(event.target.value) || 0)))} /><b>%</b></div><small>After selling fees and typical discounts</small></label>
        </div>
        <div className="large-break-cost-equation">
          <span>One-spot bid {fmt(bid)}</span><b>+</b><span>shipping {fmt(shipping ?? 0)}</span><b>+</b><span>tax {fmt(tax ?? 0)}</span><b>=</b><strong>{fmt(allIn)} total paid</strong>
        </div>
      </section>
      <section id="buyer-large-assignments" className="assignment-overview" aria-label="Modeled value across the assigned spots">
        <div className="assignment-overview-heading">
          <div><InformationLabel>100-ASSIGNMENT VALUE SHAPE</InformationLabel><h3>Average value is not the typical assignment</h3></div>
          {belowCost != null && <strong>{belowCost} of {assignment.values.length} assignments have modeled average value below your cost</strong>}
        </div>
        <p className="assignment-rules"><b>How assignments work:</b> each card belongs to one assignment only. The 83 named assignments collect every eligible printing of that card or character; the 17 category assignments collect the remaining cards by color and type. A spot can receive multiple cards when they are opened—or none when its cards are not opened.</p>
        <div className="assignment-value-strip" aria-hidden="true">
          {assignment.values.map((value, index) => <i key={`${value}-${index}`} style={{ "--assignment-height": `${Math.max(3, value / maxAssignment * 100)}%` } as CSSProperties} />)}
        </div>
        <div className="assignment-landmarks">
          <div><span>Lower tenth</span><b>{fmt(assignment.p10 * liquidFactor)}</b><small>10 of 100 assignments are at or below this modeled average</small></div>
          <div><span>Middle assignment</span><b>{fmt(assignment.median * liquidFactor)}</b><small>Half are lower and half are higher</small></div>
          <div><span>Mean</span><b>{fmt(liquidMean)}</b><small>Total modeled value ÷ {assignment.values.length}</small></div>
          <div><span>Upper tenth</span><b>{fmt(assignment.p90 * liquidFactor)}</b><small>10 of 100 assignments are at or above this modeled average</small></div>
        </div>
        <p className="assignment-limitation"><ShieldAlert />These figures compare the modeled average value of the {assignment.values.length} assigned spots. Realized opening ranges remain unavailable until every product has a complete pull model; ColorBreak does not invent a chance of profit.</p>
        <div className="assignment-cohorts">
          <div><span>{plan.namedCards.length} named assignments</span><b>{fmt(assignment.namedAverage * liquidFactor)} average</b><small>{Math.round(assignment.namedShare * 100)}% of modeled value</small></div>
          <div><span>{plan.categories.length} category assignments</span><b>{fmt(assignment.categoryAverage * liquidFactor)} average</b><small>{Math.round(assignment.categoryShare * 100)}% of modeled value</small></div>
          <div><span>Concentration</span><b>Top 10 hold {Math.round(assignment.topTenShare * 100)}%</b><small>Top assignment holds {Math.round(assignment.topOneShare * 100)}%</small></div>
        </div>
      </section>
      <section className="data-readiness" aria-label="Data readiness">
        <div><span>Pack contents</span><b>{analysis.outcomeModel.complete ? `${totalOpenings}/${totalOpenings} modeled` : "Partial"}</b><small>{analysis.outcomeModel.complete ? "Outcome model complete" : "One or more products lack a complete outcome model"}</small></div>
        <div><span>Pull rates</span><b>{materialOmissions.length ? `${materialOmissions.length} blockers` : "Ready"}</b><small>{materialOmissions[0]?.message ?? "Included EV uses verified pull-rate evidence"}</small></div>
        <div><span>Card prices</span><b>{analysis.priceAvailability.status}</b><small>{analysis.priceAvailability.observedAt ? `Observed ${new Date(analysis.priceAvailability.observedAt).toLocaleDateString()}` : analysis.priceAvailability.message}</small></div>
        <div><span>Sealed prices</span><b>{completeSealedValue ? `${lines.length}/${lines.length} products` : `${lines.filter((line) => line.marketCost != null).length}/${lines.length} products`}</b><small>{completeSealedValue ? "All references available" : "Missing references do not silently become $0"}</small></div>
      </section>
      <div className="large-break-metrics">
        <div><span>Sealed market value / spot</span><strong>{sealedMarketValue == null ? "—" : fmt(sealedMarketValue / plan.spotCount)}</strong><small>{sealedMarketValue == null ? "A sealed-market price is unavailable; pull EV is still shown" : `${fmt(sealedMarketValue)} total sealed value`}</small></div>
        <div><span>Modeled mean / assignment</span><strong>{fmt(plan.totalPullEV / plan.spotCount)}</strong><small>{result.threshold > 0 ? `Only model-approved cards at or above ${fmt(result.threshold)} included · ${materialOmissions.length} blockers excluded` : `Only cards with usable prices and model-approved pull inputs included · ${materialOmissions.length} blockers excluded`}</small></div>
      </div>
      <div className="large-break-allocation">
        <div><span>Named assignments</span><b>{plan.namedCards.length}</b><small>{fmt(namedEV)} modeled EV</small></div>
        <div><span>Category spots</span><b>{plan.categories.length}</b><small>{fmt(categoryEV)} pull EV</small></div>
        <div><span>Total modeled EV</span><b>{fmt(plan.totalPullEV)}</b><small>Across {totalOpenings} openings</small></div>
      </div>
      <IncompleteDataWarning analysis={analysis} title="Some spot values may be low" id="large-break-blockers" open={blockersOpen} onOpenChange={setBlockersOpen} />
      <section className="large-break-pool-section">
        <div className="large-break-section-heading large-break-top-heading">
          <div><InformationLabel>NAMED POOL</InformationLabel><h3>Top cards & characters</h3></div>
          <div className="top-card-sort" role="group" aria-label="Rank top spots by">
            <span>Rank by</span>
            <div>
              <button type="button" aria-pressed={topCardSort === "price"} onClick={() => setTopCardSort("price")}>Price</button>
              <button type="button" aria-pressed={topCardSort === "expected-value"} onClick={() => setTopCardSort("expected-value")}>Expected value</button>
            </div>
          </div>
        </div>
        <div className="large-break-card-list">
          {rankedNamedCards.slice(0, namedLimit).map((card, index) => {
            const slotKey = `named:${card.key}`;
            const isOpen = openSlot === slotKey;
            return <div className={`large-break-card large-break-slot ${isOpen ? "open" : ""}`} key={card.key}>
            <button type="button" className="large-break-card-main" onClick={() => setOpenSlot(isOpen ? null : slotKey)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} cards in ${card.name} slot`}>
              <span className="large-break-rank">{String(index + 1).padStart(2, "0")}</span>
              {card.image ? <img src={card.image} alt="" /> : <span className="card-placeholder" />}
              <span className="large-break-card-copy"><strong>{card.name}</strong><small>{card.cards.length} card{card.cards.length === 1 ? "" : "s"} · {cardPreviewSubtitle(card.row, card.marketPrice)}</small></span>
            </button>
            <div className="large-break-card-value"><span>Pull EV</span>{card.pullRateVerified
              ? <b>{fmt(card.pullEV)}</b>
              : <button type="button" className="excluded-ev" onClick={() => setExcludedCard(card.row)} aria-label={`Explain why ${card.name} is excluded from Pull EV`}>Excluded</button>}
            </div>
            {isOpen && <LargeBreakSlotCards rows={card.cards} onInspect={setInspectedCard} />}
          </div>})}
        </div>
        {rankedNamedCards.length > namedLimit && <button type="button" className="show-more-assignments" onClick={() => setNamedLimit(rankedNamedCards.length)}>Show {rankedNamedCards.length - namedLimit} more named assignments</button>}
        {namedLimit > 10 && <button type="button" className="show-more-assignments" onClick={() => setNamedLimit(10)}>Show top 10 only</button>}
      </section>
      <section className="large-break-pool-section">
        <div className="large-break-section-heading"><div><InformationLabel>RESIDUAL POOL</InformationLabel><h3>Creature colors & card types</h3></div><span>Top-value named spots excluded</span></div>
        <div className="large-break-category-head"><span>Slot</span><span>Slot EV</span></div>
        {plan.categories.slice(0, categoryLimit).map((category) => {
          const slotKey = `category:${category.key}`;
          const isOpen = openSlot === slotKey;
          return <div className={`large-break-category large-break-slot ${isOpen ? "open" : ""}`} key={category.key}>
          <button type="button" className="large-break-category-main" onClick={() => setOpenSlot(isOpen ? null : slotKey)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} cards in ${category.label} slot`}>
            <strong>{category.label}</strong><small>{category.cardCount} remaining card{category.cardCount === 1 ? "" : "s"}</small>
          </button>
          <b>{fmt(category.pullEV)}</b>
          {isOpen && <LargeBreakSlotCards rows={category.cards} onInspect={setInspectedCard} />}
        </div>})}
        {plan.categories.length > categoryLimit && <button type="button" className="show-more-assignments" onClick={() => setCategoryLimit(plan.categories.length)}>Show all {plan.categories.length} category assignments</button>}
        {categoryLimit > 5 && <button type="button" className="show-more-assignments" onClick={() => setCategoryLimit(5)}>Show first 5 categories</button>}
      </section>
      <CardInspector row={inspectedCard} status={result.status} threshold={result.threshold} onClose={() => setInspectedCard(null)} />
      <EvidenceDialog item={excludedCard ? {
        title: "Excluded from Pull EV",
        status: cardDisplayName(excludedCard.card, excludedCard.finish),
        meaning: "An exact pull chance for this printing is not published or independently verifiable.",
        matters: "Pull EV multiplies price by pull chance. Using an uncertain chance could make this card add an unrealistic amount of value.",
        action: "Its current price remains in Rank by Price. It will return to Rank by EV when an exact pull rate can be verified.",
      } : null} onClose={() => setExcludedCard(null)} />
    </section>
  );
}

export function BuyerView({
  analysis,
  lines,
  auction,
  assignmentMode,
  selected,
  breakLabel,
  bid,
  setBid,
  shipping,
  setShipping,
  onChooseDecisionReady,
}: {
  analysis: BreakAnalysis;
  lines?: BreakLine[];
  auction: AuctionState;
  assignmentMode: AssignmentMode;
  selected: SlotId;
  breakLabel?: string;
  bid: number | undefined;
  setBid: (value: number | undefined) => void;
  shipping: number | undefined;
  setShipping: (value: number | undefined) => void;
  onChooseDecisionReady?: () => void;
}) {
  const result = analysis.valuation;
  const eligibility = decisionEligibility(result);
  const availability = decisionAvailability(result);
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const [valueRule, setValueRule] = useState<ValueRule>({ kind: "median" });
  const [resolvedOnlyRequested, setResolvedOnlyRequested] = useState(false);
  const [confirmation, setConfirmation] = useState<{ fingerprint: string; confirmedAt: number }>();
  const slot = result.slots.find((row) => row.id === selected)!;
  const landed = (bid ?? 0) + (shipping ?? 0);
  const simulation = useOutcomeSimulation(analysis, auction.remaining, bid == null ? undefined : landed);
  const distribution = assignmentMode === "random"
    ? simulation.result?.remainingPool
    : simulation.result?.slotDistributions[selected];
  const fallbackMean = assignmentMode === "random"
    ? result.slots.filter((row) => auction.remaining.includes(row.id)).reduce((sum, row) => sum + row.sellableEV, 0) / Math.max(1, auction.remaining.length)
    : slot.sellableEV;
  const valueTarget = distribution == null
    ? undefined
    : valueRule.kind === "median"
      ? distribution.median
      : valueRule.kind === "coverage"
        ? distribution.p25
        : distribution.mean;
  const decisionInput = decisionFingerprint({
    lines, selected, assignmentMode, remaining: auction.remaining, bid, shipping,
    risk: valueRule.kind === "coverage" ? `${valueRule.kind}:${valueRule.coverage}` : valueRule.kind,
    omissionIds: eligibility.affectedGroups.map((group) => group.id),
    valuationVersion: result.dataVersion,
    priceSource: eligibility.observedSource,
    observedAt: eligibility.observedAt,
    distribution: distribution ?? "pending",
  });
  const reconfirmed = confirmation?.fingerprint === decisionInput && Date.now() - confirmation.confirmedAt <= 60_000;
  useEffect(() => {
    if (confirmation && confirmation.fingerprint !== decisionInput) setConfirmation(undefined);
  }, [confirmation, decisionInput]);
  const scoped = valueTarget == null || shipping == null ? undefined : resolvedOnlyLimit(valueTarget, shipping, eligibility);
  const cap = eligibility.status !== "eligible" || valueTarget == null || shipping == null
    ? { kind: "unknown-cost" as const }
    : solveFinancialCap({
        valueTarget,
        acceptedAmounts: valueTarget > shipping
          ? [Math.floor((valueTarget - shipping) * 100) / 100]
          : [],
        addedCost: () => shipping,
      });
  const activeCap = eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped && reconfirmed
    ? { kind: "cap" as const, amount: scoped.amount, allInAtCap: scoped.allIn }
    : cap;
  const recommendation = recommendBid(bid, activeCap);
  const decision = !reconfirmed ? "RECONFIRM CURRENT INPUTS" : eligibility.status !== "eligible"
    ? eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped && reconfirmed
      ? bid == null ? "ENTER BID" : recommendation.action === "bid" ? "BID" : recommendation.action === "stop" ? "STOP HERE" : recommendation.action === "pass" ? "PASS" : "NO CAP"
      : eligibility.status === "material-incomplete" ? `LIMIT UNAVAILABLE — ${eligibility.blockerCount} MATERIAL OMISSIONS` : "LIMIT UNAVAILABLE"
    : bid == null
    ? "ENTER BID"
    : shipping == null
      ? "ADD SHIPPING"
      : recommendation.action === "bid"
        ? "BID"
        : recommendation.action === "stop"
          ? "STOP HERE"
          : recommendation.action === "pass"
            ? "PASS"
            : "NO CAP";
  const ruleLabel = valueRule.kind === "median"
    ? "Typical outcome"
    : valueRule.kind === "coverage"
      ? "75% coverage"
      : "Average outcome";
  return (
    <>
      {eligibility.status !== "eligible" && <CatalogUnavailableNotice onEdit={onChooseDecisionReady} />}
      <section
        className={`bid-live-decision decision-${recommendation.tone} verdict-${decision.replace(/[^A-Z]/g, "").toLowerCase()}`}
        aria-label="Live bid decision"
      >
        <div className="decision-kicker">
          <span>{breakLabel ? `${breakLabel} · ` : ""}Manual auction check · {assignmentMode === "random" ? `${auction.remaining.length} random colors` : `${SLOT_NAMES[selected]} slot`}</span>
          <span className={`decision-evidence evidence-${result.status}`}>{result.status === "verified" ? "Data ready" : result.status}</span>
        </div>
        <div className="verdict-head">
          <div className="verdict-decision">
            <InformationLabel>Recommendation</InformationLabel>
            <h2 aria-live="polite">{decision}</h2>
            {eligibility.status !== "eligible" && <div className="decision-reason"><p><strong>No bid decision is available.</strong> {availability.detail} Observed {eligibility.observedAt ? new Date(eligibility.observedAt).toLocaleString() : "unknown"} from {eligibility.observedSource ?? "the published snapshot"}.</p>{onChooseDecisionReady && <button type="button" className="primary" onClick={onChooseDecisionReady}>Choose a decision-ready product</button>}{eligibility.affectedGroups.length > 0 && <details><summary className="disclosure-summary">Why this is unavailable<DisclosureArrow /></summary><p>Policy threshold: {eligibility.freshnessThresholdMs / 36e5} hours.</p><ul>{eligibility.affectedGroups.map((group) => <li key={group.id}>{group.label}</li>)}</ul></details>}{eligibility.status === "material-incomplete" && !resolvedOnlyRequested && eligibility.resolvedOnlyAvailable && <button type="button" className="quiet" onClick={() => { setResolvedOnlyRequested(true); setConfirmation(undefined); }}>Calculate resolved-only limit</button>}{eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped && <p><strong>CONSERVATIVE · INCOMPLETE LIMIT</strong> uses only resolved exact-printing values. It is not a full break recommendation.</p>}</div>}
            {(eligibility.status === "eligible" || (eligibility.status === "material-incomplete" && resolvedOnlyRequested && scoped)) && !reconfirmed && <p className="decision-reason"><button type="button" className="quiet" onClick={() => setConfirmation({ fingerprint: decisionInput, confirmedAt: Date.now() })}>Reconfirm current inputs</button> The cap and recommendation remain hidden until this exact composition, evidence, price observation, and simulation result are confirmed. Confirmation expires after one minute.</p>}
            {eligibility.status === "eligible" && bid == null && <p className="decision-reason"><a href="#buyer-current-bid">Enter the current auction price</a> to compare it with your maximum hammer.</p>}
            {bid != null && shipping == null && <p className="decision-reason"><a href="#buyer-added-shipping">Enter the extra shipping charged for this purchase</a>. It affects your landed cost and maximum hammer.</p>}
            {reconfirmed && eligibility.status === "eligible" && recommendation.action === "bid" && (
              <p className="decision-reason">Current hammer is {fmt(recommendation.room)} below your modeled ceiling.</p>
            )}
            {reconfirmed && eligibility.status === "eligible" && recommendation.action === "stop" && (
              <p className="decision-reason">The current hammer has reached your modeled ceiling.</p>
            )}
            {reconfirmed && eligibility.status === "eligible" && recommendation.action === "pass" && (
              <p className="decision-reason">Current hammer is {fmt(Math.abs(recommendation.room))} beyond your modeled ceiling.</p>
            )}
          </div>
          <div className="ev-orb">
            <small><span>{eligibility.status === "eligible" || (resolvedOnlyRequested && scoped) ? "Your max hammer" : "Limit unavailable"}</span></small>
            <strong className="max-hammer" aria-label="Maximum hammer" aria-live="polite">{reconfirmed && activeCap.kind === "cap" ? fmt(activeCap.amount) : "—"}</strong>
            <span>{eligibility.status === "eligible" ? `${ruleLabel} limit` : resolvedOnlyRequested && scoped ? "Conservative incomplete limit" : "No action recommendation"}</span>
            <strong aria-label="Typical card value" aria-live="polite">{simulation.busy && !distribution ? "Checking…" : fmt(distribution?.median ?? fallbackMean)}</strong>
            {distribution?.median === 0 && <em>Usually no card above the bulk filter</em>}
            <span>Average {fmt(distribution?.mean ?? fallbackMean)}</span>
          </div>
        </div>
        <div className="value-rule" role="group" aria-label="Risk stance">
          <button aria-pressed={valueRule.kind === "coverage"} onClick={() => setValueRule({ kind: "coverage", coverage: .75 })}>Protect downside</button>
          <button aria-pressed={valueRule.kind === "median"} onClick={() => setValueRule({ kind: "median" })}>Balanced</button>
          <button aria-pressed={valueRule.kind === "average"} onClick={() => setValueRule({ kind: "average" })}>Chase upside</button>
        </div>
        <div className="bid-inputs">
          <NumberField id="buyer-current-bid" label={eligibility.status === "eligible" ? "Current bid" : "Optional: compare your current all-in cost"} value={bid} onChange={setBid} />
          <NumberField
            id="buyer-added-shipping"
            label={eligibility.status === "eligible" ? "Your added shipping" : "Optional: added shipping"}
            value={shipping}
            onChange={setShipping}
            hint="Only shipping added by this purchase—not your whole order."
          />
        </div>
        {bid != null && (
          <div className="delta">
            <span>
              Landed cost <b>{fmt(landed)}</b>
            </span>
            <span>
              Average gap <b>{fmt((distribution?.mean ?? fallbackMean) - landed)}</b>
            </span>
          </div>
        )}
        <OutcomeRange summary={distribution} landed={bid == null ? undefined : landed} compact />
        {simulation.busy && <p className="simulation-state">Checking more possible openings…</p>}
        {simulation.error && <CompactWarning title="Pull ranges unavailable" summary="The recommendation is still shown without the range." className="inline-warning"><p>{simulation.error}</p></CompactWarning>}
        <IncompleteDataWarning analysis={analysis} title="Some estimates may be low" />
      </section>
      <section className="bid-explorer">
        <header className="disclosure-summary">
          <span>
            <strong>Decision evidence</strong>
            <small>Break value, Break Balance, data quality, and ranked cards · updated live</small>
          </span>
        </header>
        <div className="bid-explorer-body">
          <ValueSummary result={result} />
          <BreakBalance result={result} remaining={auction.remaining} simulation={simulation.result} />
          <EvidenceLens analysis={analysis} />
          <SlotValueDetails
            slot={slot}
            threshold={result.threshold}
            onInspect={setInspectedCard}
          />
        </div>
      </section>
      <CardInspector
        row={inspectedCard}
        status={result.status}
        threshold={result.threshold}
        onClose={() => setInspectedCard(null)}
      />
    </>
  );
}

function allocate(
  result: ValuationResult,
  total: number,
  min: number,
  locked: Partial<Record<SlotId, number>>,
  unsold: Set<SlotId>,
) {
  const output = Object.fromEntries(SLOT_IDS.map((id) => [id, 0])) as Record<
    SlotId,
    number
  >;
  const active = result.slots.filter(
    (slot) => slot.sellableEV > 0 && !unsold.has(slot.id),
  );
  for (const slot of active) if (locked[slot.id] != null) output[slot.id] = locked[slot.id]!;
  const unlocked = active.filter((slot) => locked[slot.id] == null);
  const remaining = Math.max(
    0,
    total - active.reduce((sum, slot) => sum + (locked[slot.id] ?? 0), 0),
  );
  const effectiveMin = unlocked.length ? Math.min(min, remaining / unlocked.length) : 0;
  const distributable = Math.max(0, remaining - effectiveMin * unlocked.length);
  const weight = unlocked.reduce((sum, slot) => sum + slot.sellableEV, 0);
  for (const slot of unlocked) {
    output[slot.id] = effectiveMin + (weight ? distributable * slot.sellableEV / weight : 0);
  }
  return output;
}

function RangeCandle({ summary, max, bonus = false }: { summary: DistributionSummary; max: number; bonus?: boolean }) {
  const pct = (value: number) => `${Math.max(0, Math.min(100, value / Math.max(1, max) * 100))}%`;
  return (
    <span className={`range-candle ${bonus ? "bonus" : "base"}`} aria-label={`${bonus ? "With bonus" : "Current"}: ${fmt(summary.p01)} rare low, ${fmt(summary.median)} typical, ${fmt(summary.p99)} rare high`}>
      <i className="candle-wick" style={{ bottom: pct(summary.p01), height: pct(summary.p99 - summary.p01) }} />
      <i className="candle-body" style={{ bottom: pct(summary.p25), height: pct(Math.max(.01, summary.p75 - summary.p25)) }} />
      <i className="candle-median" style={{ bottom: pct(summary.median) }} />
    </span>
  );
}

function monotoneBonus(before: DistributionSummary, sampledAfter: DistributionSummary): DistributionSummary {
  return {
    ...sampledAfter,
    min: Math.max(before.min, sampledAfter.min),
    p01: Math.max(before.p01, sampledAfter.p01),
    p10: Math.max(before.p10, sampledAfter.p10),
    p25: Math.max(before.p25, sampledAfter.p25),
    median: Math.max(before.median, sampledAfter.median),
    p75: Math.max(before.p75, sampledAfter.p75),
    p90: Math.max(before.p90, sampledAfter.p90),
    p99: Math.max(before.p99, sampledAfter.p99),
    max: Math.max(before.max, sampledAfter.max),
    ...(before.chanceToClearCost == null || sampledAfter.chanceToClearCost == null ? {} : {
      chanceToClearCost: Math.max(before.chanceToClearCost, sampledAfter.chanceToClearCost),
    }),
  };
}

function UpsideCandles({ base, bonus, bonusLabel, selectedSlot, selectSlot, useRandom, buyerLanded }: { base: BreakAnalysis; bonus: BreakAnalysis; bonusLabel: string; selectedSlot: SlotId; selectSlot: (slot: SlotId) => void; useRandom: boolean; buyerLanded: number }) {
  const baseSimulation = useOutcomeSimulation(base, [...SLOT_IDS], buyerLanded);
  const bonusSimulation = useOutcomeSimulation(bonus, [...SLOT_IDS], buyerLanded);
  if (baseSimulation.error || bonusSimulation.error) return (
    <CompactWarning title="Pull ranges unavailable" summary="Card values and profit are still available." className="distribution-unavailable">
      <p>{bonusSimulation.error ?? baseSimulation.error}</p>
    </CompactWarning>
  );
  if (!baseSimulation.result || !bonusSimulation.result) return <p className="calculating"><span />Building pull ranges…</p>;
  const selectedBefore = useRandom ? baseSimulation.result.remainingPool : baseSimulation.result.slotDistributions[selectedSlot];
  const selectedAfter = monotoneBonus(selectedBefore, useRandom ? bonusSimulation.result.remainingPool : bonusSimulation.result.slotDistributions[selectedSlot]);
  const rows = SLOT_IDS.map((id) => {
    const before = baseSimulation.result!.slotDistributions[id];
    const after = monotoneBonus(before, bonusSimulation.result!.slotDistributions[id]);
    return { id, before, after, lift: after.p99 - before.p99 };
  }).sort((a, b) => b.lift - a.lift);
  // The two configuration candles answer the selected buyer's question and need
  // their own scale. A chase-heavy color must not flatten an unrelated selection.
  const scenarioMaximum = Math.max(1, selectedAfter.p99);
  const colorMaximum = Math.max(1, ...rows.map((row) => row.after.p99));
  const unpricedOutcomes = bonus.outcomeOmissions.filter((item) => !item.material && /missing-.+-price|missing-price/.test(item.code));
  return (
    <div className="upside-chart">
      <div className="upside-callout">
        <span>RARE HIGH-END GAIN</span>
        <b>+{fmt(selectedAfter.p99 - selectedBefore.p99)}</b>
        <small>{useRandom ? "Random slot" : SLOT_NAMES[selectedSlot]} typical result changes {fmt(selectedBefore.median)} → {fmt(selectedAfter.median)}</small>
        <small>At {fmt(buyerLanded)} landed: {Math.round((selectedBefore.chanceToClearCost ?? 0) * 100)}% → {Math.round((selectedAfter.chanceToClearCost ?? 0) * 100)}% of modeled openings cover buyer cost</small>
      </div>
      <div className="scenario-candles" aria-label="Buyer value range by break configuration">
        <div className="scenario-candle-column"><div><RangeCandle summary={selectedBefore} max={scenarioMaximum} /></div><b>Current break</b><small>Rare high {fmt(selectedBefore.p99)}</small></div>
        <div className="scenario-candle-column"><div><RangeCandle summary={selectedAfter} max={scenarioMaximum} bonus /></div><b>+ {bonusLabel}</b><small>Rare high {fmt(selectedAfter.p99)}</small></div>
      </div>
      <p className="x-axis-note"><b>X-axis:</b> break configuration · <b>Y-axis:</b> {useRandom ? "card value received by a random slot" : `${SLOT_NAMES[selectedSlot]} card value`}</p>
      <h3>Which colors gain the most upside?</h3>
      <div className="upside-legend"><span><i className="base" />Current</span><span><i className="bonus" />With bonus</span></div>
      <div className="candle-grid">{rows.map(({ id, before, after, lift }) => (
        <button type="button" className={`candle-column ${!useRandom && selectedSlot === id ? "active" : ""}`} key={id} onClick={() => selectSlot(id)}>
          <div className="candle-pair"><RangeCandle summary={before} max={colorMaximum} /><RangeCandle summary={after} max={colorMaximum} bonus /></div>
          <b>{id}</b><small>+{fmt(lift)} rare high</small>
        </button>
      ))}</div>
      {unpricedOutcomes.length > 0 && <CompactWarning
        title={`${unpricedOutcomes.length} rare ${unpricedOutcomes.length === 1 ? "card has" : "cards have"} no current price`}
        summary="The high-end estimate may be low."
        className="distribution-data-note"
      >
        <p>Their pull chances are included, but their value counts as $0.</p>
        <details className="incomplete-data-technical">
          <summary className="disclosure-summary"><span><b>Technical details</b><small>{unpricedOutcomes.length} {unpricedOutcomes.length === 1 ? "issue" : "issues"}</small></span><DisclosureArrow /></summary>
          <ul>{unpricedOutcomes.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
        </details>
      </CompactWarning>}
      <p>Thin line: middle 98% of modeled openings · solid body: middle half · center mark: typical result. Serialized and one-of-one collector outliers are excluded.</p>
    </div>
  );
}

function SellerScenarioLab({
  baseAnalysis, lines, acquisition, buyerShipping, packing, coveredShipping, shipmentCount, transactionCount, marketplace, selectedSlot, setSelectedSlot,
}: {
  baseAnalysis: BreakAnalysis;
  lines: BreakLine[];
  acquisition: number;
  buyerShipping: number;
  packing: number;
  coveredShipping: number;
  shipmentCount: number;
  transactionCount: number;
  marketplace: MarketplacePreset;
  selectedSlot: SlotId;
  setSelectedSlot: (slot: SlotId) => void;
}) {
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [thresholdSales, setThresholdSales] = useState(500);
  const [bonusAnalysis, setBonusAnalysis] = useState<BreakAnalysis>();
  const [bonusMarket, setBonusMarket] = useState<number>();
  const [bonusPrices, setBonusPrices] = useState<Record<string, number>>({});
  const [bonusPriceLoading, setBonusPriceLoading] = useState(false);
  const [bonusCostOverride, setBonusCostOverride] = useState<number>();
  const [useRandom, setUseRandom] = useState(false);
  const setCodes = [...new Set(lines.map((line) => line.set))];
  const productRef = (product: ProductChoice) => `${product.set}|${product.sealedKey ?? product.key}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all(setCodes.map(productsForSet)).then((groups) => {
      const packs = groups.flat().filter((product) => product.category === "pack");
      if (cancelled) return;
      setProducts(packs);
      setSelectedKey((current) => packs.some((product) => productRef(product) === current)
        ? current
        : (packs.find((product) => /collector/i.test(product.label)) ? productRef(packs.find((product) => /collector/i.test(product.label))!) : packs[0] ? productRef(packs[0]) : ""));
      Promise.all(packs.map(async (product) => [productRef(product), await sealedMarketPrice(product.set, product.tcgId)] as const))
        .then((quotes) => {
          if (!cancelled) setBonusPrices(Object.fromEntries(quotes.filter((quote): quote is readonly [string, number] => quote[1] != null)));
        });
    });
    return () => { cancelled = true; };
  }, [setCodes.join("|")]);
  const selected = products.find((product) => productRef(product) === selectedKey);
  useEffect(() => {
    if (!selected) return;
    setBonusCostOverride(undefined);
    setBonusMarket(undefined);
    setBonusAnalysis(undefined);
    setBonusPriceLoading(true);
    const bonusLine: BreakLine = {
      id: "seller-bonus-preview",
      set: selected.set,
      productKey: selected.sealedKey ? `sealed:${selected.sealedKey}` : selected.key,
      productLabel: selected.label,
      quantity: 1,
      packCount: selected.packCount,
      tcgId: selected.tcgId,
    };
    let cancelled = false;
    Promise.all([
      evaluateBreakAnalysis([...lines, bonusLine], baseAnalysis.valuation.threshold),
      sealedMarketPrice(selected.set, selected.tcgId),
    ]).then(([next, market]) => {
      if (!cancelled) { setBonusAnalysis(next); setBonusMarket(market); setBonusPriceLoading(false); }
    });
    return () => { cancelled = true; };
  }, [selected?.set, selected?.sealedKey, selected?.key, lines, baseAnalysis.valuation.threshold]);
  const keep = 1 - marketplace.commissionRate - marketplace.processingRate;
  const fixedFees = transactionCount * (marketplace.processingFlat + buyerShipping * marketplace.processingRate);
  const shipmentCosts = (packing + coveredShipping) * shipmentCount;
  const profitAt = (sales: number, productCost: number) => sales * keep - fixedFees - shipmentCosts - productCost;
  const bonusCost = bonusCostOverride ?? bonusMarket;
  const bonusCostKnown = bonusCost != null;
  const afterCost = bonusCostKnown ? acquisition + bonusCost : undefined;
  const afterBreakEven = afterCost == null ? undefined : requiredHammer(transactionCount, shipmentCosts, afterCost, 0, buyerShipping, marketplace);
  const bonusBuyerValue = bonusAnalysis ? bonusAnalysis.valuation.sellableEV - baseAnalysis.valuation.sellableEV : 0;
  const averageBuyerLanded = thresholdSales / Math.max(1, transactionCount) + buyerShipping;
  return (
    <section className="panel seller-scenario-lab">
      <PanelHeading
        label="BONUS PACK PLANNER"
        help="Uses a real pack from the selected sets, its current sealed market price, exact card model, and your fee and shipping settings to compare the current break with the bonus-pack version."
        title="Does a bonus pack earn its keep?"
        accessory={<Tip className="compliance-badge compliance-permitted" text="A fixed pack disclosed before sales can be included as break product. A pack added only after a sales threshold requires written Whatnot approval before advertising or export."><span>Policy check</span></Tip>}
      />
      <div className="scenario-controls">
        <label><span>Bonus pack</span><select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>{products.map((product) => {
          const market = bonusPrices[productRef(product)];
          return <option key={productRef(product)} value={productRef(product)}>{product.set} · {product.label}{market == null ? "" : ` · ${fmt(market)}`}</option>;
        })}</select></label>
        <NumberField label="Sales threshold" value={thresholdSales} onChange={(value) => setThresholdSales(value ?? 0)} />
        <div className="bonus-market-reference"><span>Current pack market price</span><b>{bonusPriceLoading ? "Loading…" : fmt(bonusMarket)}</b><small>Daily sealed-product snapshot</small></div>
        <NumberField label="My cost for this pack" value={bonusCostOverride} onChange={setBonusCostOverride} hint="Optional. Your actual cost replaces market price in all profit calculations. Clear it to use market price again." />
      </div>
      <div className="scenario-view-picker">
        <span>Show buyer upside for</span>
        <div>{SLOT_IDS.map((slot) => <button key={slot} className={!useRandom && selectedSlot === slot ? `active slot-${slot}` : `slot-${slot}`} onClick={() => { setUseRandom(false); setSelectedSlot(slot); }}>{slot}</button>)}<button className={useRandom ? "active" : ""} onClick={() => setUseRandom(true)}>Random</button></div>
      </div>
      <CompactWarning title="Written approval required" summary="Needed before advertising a threshold-triggered pack." className="scenario-policy-note">
        <p>A fixed pack disclosed before bidding can be included normally. Written Whatnot approval is required only when the pack depends on reaching a sales threshold.</p>
      </CompactWarning>
      {selected && bonusAnalysis && (
        <>
          <div className="scenario-economics">
            <div><span>Cost used in profit math</span><b>{bonusCostKnown ? fmt(bonusCost) : "Add your cost"}</b><small>{bonusCostOverride == null ? "Current market price" : `Your cost · market ${fmt(bonusMarket)}`}</small></div>
            <div><span>Buyer card value added</span><b>+{fmt(bonusBuyerValue)}</b></div>
            <div><span>New break-even sales</span><b>{bonusCostKnown ? fmt(afterBreakEven) : "Needs pack cost"}</b></div>
            <div><span>Buyer landed cost at threshold</span><b>{fmt(averageBuyerLanded)}</b></div>
            <div><span>Profit at {fmt(thresholdSales)} before</span><b>{fmt(profitAt(thresholdSales, acquisition))}</b></div>
            <div><span>Profit at {fmt(thresholdSales)} with pack</span><b>{afterCost == null ? "Needs pack cost" : fmt(profitAt(thresholdSales, afterCost))}</b></div>
            <div><span>Margin with pack</span><b>{afterCost == null ? "Needs pack cost" : thresholdSales ? `${Math.round(profitAt(thresholdSales, afterCost) / thresholdSales * 100)}%` : "—"}</b></div>
          </div>
          <UpsideCandles base={baseAnalysis} bonus={bonusAnalysis} bonusLabel={selected.label} selectedSlot={selectedSlot} selectSlot={(slot) => { setUseRandom(false); setSelectedSlot(slot); }} useRandom={useRandom} buyerLanded={averageBuyerLanded} />
        </>
      )}
    </section>
  );
}

function SellerPlanArchive({
  analysis,
  lines,
  update,
  selectedSlot,
  setSelectedSlot,
}: {
  analysis: BreakAnalysis;
  lines: BreakLine[];
  update: (id: string, p: Partial<BreakLine>) => void;
  selectedSlot: SlotId;
  setSelectedSlot: (slot: SlotId) => void;
}) {
  const result = analysis.valuation;
  const [margin, setMargin] = useState(20),
    [buyerShip, setBuyerShip] = useState(5),
    [packing, setPacking] = useState(2),
    [covered, setCovered] = useState(0),
    [shipments, setShipments] = useState(8),
    [minimum, setMinimum] = useState(1);
  const [labor, setLabor] = useState(0);
  const [tax, setTax] = useState(0);
  const [giveaways, setGiveaways] = useState(0);
  const [refundReserve, setRefundReserve] = useState(0);
  const [overhead, setOverhead] = useState(0);
  const [commission, setCommission] = useState(WHATNOT_US.commissionRate * 100);
  const [processing, setProcessing] = useState(WHATNOT_US.processingRate * 100);
  const [processingFlat, setProcessingFlat] = useState(WHATNOT_US.processingFlat);
  const [actual, setActual] = useState<Partial<Record<SlotId, number>>>({});
  const [locked, setLocked] = useState<Partial<Record<SlotId, number>>>({});
  const [unsold, setUnsold] = useState<Set<SlotId>>(new Set());
  const [openSlot, setOpenSlot] = useState<SlotId | null>(selectedSlot);
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  useEffect(() => setOpenSlot(selectedSlot), [selectedSlot]);
  const acquisition = lines.reduce(
    (n, l) => n + (l.myCost ?? l.marketCost ?? 0) * l.quantity,
    0,
  );
  const costsComplete = lines.every(
    (l) => l.myCost != null || l.marketCost != null,
  );
  const missingCostLine = lines.find((line) => line.myCost == null && line.marketCost == null);
  const marketplace = {
    ...WHATNOT_US,
    commissionRate: commission / 100,
    processingRate: processing / 100,
    processingFlat,
    name: commission === 8 && processing === 2.9 && processingFlat === 0.3
      ? "Whatnot US"
      : "Custom fees",
  };
  const soldIds = SLOT_IDS.filter((id) => !unsold.has(id));
  const shipmentCount = Math.min(soldIds.length, Math.max(1, Math.round(shipments)));
  const shipmentCosts = (packing + covered) * shipmentCount;
  const otherCosts = labor + tax + giveaways + refundReserve + overhead;
  const plannedCost = completeCost({
    acquisition,
    packingAndCoveredShipping: shipmentCosts,
    labor,
    tax,
    giveaways,
    refundReserve,
    overhead,
  });
  const targetProfit = plannedCost * margin / 100;
  const target = requiredHammer(
    soldIds.length,
    shipmentCosts,
    acquisition + otherCosts,
    targetProfit,
    buyerShip,
    marketplace,
  );
  const breakEven = requiredHammer(
    soldIds.length,
    shipmentCosts,
    acquisition + otherCosts,
    0,
    buyerShip,
    marketplace,
  );
  const asks = allocate(result, target, minimum, locked, unsold);
  const planStatus = sellerPlanStatus(result.sellableEV, breakEven, target);
  const planStatusLabel = planStatus.kind === "run"
    ? "RUN THIS BREAK"
    : planStatus.kind === "change"
      ? "REPRICE OR CHANGE"
      : "DO NOT RUN";
  const askTotal = soldIds.reduce((sum, id) => sum + asks[id], 0);
  const transactions = Object.entries(actual)
    .filter(([slot, v]) => v != null && !unsold.has(slot as SlotId))
    .map(
      ([slot, hammer]) =>
        ({
          slot: slot as SlotId,
          hammer: hammer!,
          buyerShipping: buyerShip,
          buyerTax: 0,
        }) as Transaction,
    );
  const profit =
    transactions.length === soldIds.length && soldIds.length > 0
      ? calculateProfit(
          transactions,
          Array.from({ length: shipmentCount }, (_, index) => ({
            id: `shipment-${index + 1}`,
            slots: [],
            packingCost: packing,
            sellerCoveredShipping: covered,
          })),
          acquisition + otherCosts,
          marketplace,
        )
      : undefined;
  return (
    <>
      <section className={`panel seller-primary-decision seller-${costsComplete ? planStatus.kind : "incomplete"}`}>
        <div className="decision-kicker">
          <span>V2 SELLER DECISION</span>
          <span>Economics check · no fill prediction</span>
        </div>
        <div className="seller-decision-main">
          <div>
            <InformationLabel>RECOMMENDATION</InformationLabel>
            <h2>{costsComplete ? planStatusLabel : missingCostLine ? <a href={`#seller-cost-${missingCostLine.id}`}>ENTER COST FOR {missingCostLine.productLabel.toUpperCase()}</a> : "ENTER PRODUCT COST"}</h2>
            {costsComplete && <p>Modeled buyer card value is {fmt(Math.abs(planStatus.headroom))} {planStatus.headroom >= 0 ? "above" : "below"} the sales target. Validate demand before launch.</p>}
          </div>
          <strong>{costsComplete ? fmt(targetProfit) : "—"}<small>planned net target</small></strong>
        </div>
        {costsComplete && (
          <div className="seller-decision-metrics">
            <div><span>Break-even sales</span><b>{fmt(breakEven)}</b></div>
            <div><span>Target sales</span><b>{fmt(target)}</b></div>
            <div><span>Complete planned cost</span><b>{fmt(plannedCost)}</b></div>
          </div>
        )}
      </section>
      <ValueSummary result={result} />
      <section className="panel seller-plan">
        <PanelHeading
          label="PROFIT PLAN"
          help="Break-even is the total slot revenue needed to repay product cost, platform fees, packing, and shipping you cover. The sales goal adds your chosen profit margin."
          title={costsComplete ? <>{fmt(breakEven)} break-even</> : missingCostLine ? <a href={`#seller-cost-${missingCostLine.id}`}>Enter cost for {missingCostLine.productLabel}</a> : "Enter product cost"}
          accessory={<Tip className="market-badge" text="The fee settings used for each sale. You can edit them below when another marketplace charges different fees." label={`Explain the ${marketplace.name} marketplace preset`}>
            <Store />
            {marketplace.name}
          </Tip>}
        />
        {costsComplete && (
          <div className="profit-plan-summary">
            <div><span>Buyer card value</span><b>{fmt(result.sellableEV)}</b></div>
            <div><span>Complete planned cost</span><b>{fmt(plannedCost)}</b></div>
            <div><span>Sales goal</span><b>{fmt(target)}</b><small>{margin}% profit target</small></div>
          </div>
        )}
        <div className="cost-lines">
          {lines.map((line) => (
            <div className="product-cost-card" key={line.id}>
              <span className="product-cost-name">
                <strong>{line.productLabel}</strong>
                <small>{line.quantity} × product</small>
              </span>
              <div className="cost-price-grid">
                <div className="market-cost-readout">
                  <span>Current sealed market</span>
                  <b>{line.marketCost == null ? "Unavailable" : fmt(line.marketCost)}</b>
                  <small>{line.marketCost == null ? "Enter your cost to continue" : "TCGplayer market via TCGCSV"}</small>
                </div>
                <NumberField
                  id={`seller-cost-${line.id}`}
                  label="My actual unit cost"
                  value={line.myCost}
                  onChange={(n) => update(line.id, { myCost: n })}
                  hint="Optional. Your real cost replaces the sealed market price in every profit calculation."
                />
              </div>
              <p className="cost-basis-note">Using {line.myCost == null ? "current market price" : "your actual cost"}: <b>{fmt((line.myCost ?? line.marketCost) ?? undefined)}</b> each</p>
            </div>
          ))}
        </div>
        <div className="settings-grid">
          <NumberField
            label="Target margin"
            value={margin}
            onChange={(n) => setMargin(n ?? 0)}
            prefix="%"
          />
          <NumberField
            label="Buyer shipping"
            value={buyerShip}
            onChange={(n) => setBuyerShip(n ?? 0)}
            hint="Used only in processing-fee math; it is not your revenue."
          />
          <NumberField
            label="Packing / shipment"
            value={packing}
            onChange={(n) => setPacking(n ?? 0)}
          />
          <NumberField
            label="You cover / shipment"
            value={covered}
            onChange={(n) => setCovered(n ?? 0)}
          />
          <NumberField
            label="Shipments"
            value={shipments}
            onChange={(n) => setShipments(n ?? 1)}
            prefix=""
            hint="Buyer-grouped packages. Fees remain per color-slot purchase."
          />
          <NumberField label="Labor" value={labor} onChange={(n) => setLabor(n ?? 0)} hint="Total labor opportunity cost for preparing and running this break." />
          <NumberField label="Tax / permits" value={tax} onChange={(n) => setTax(n ?? 0)} />
          <NumberField label="Giveaways" value={giveaways} onChange={(n) => setGiveaways(n ?? 0)} />
          <NumberField label="Refund reserve" value={refundReserve} onChange={(n) => setRefundReserve(n ?? 0)} />
          <NumberField label="Allocated overhead" value={overhead} onChange={(n) => setOverhead(n ?? 0)} />
        </div>
        <details className="fee-settings">
          <summary className="disclosure-summary"><span>Marketplace fee assumptions</span><DisclosureArrow /></summary>
          <div className="settings-grid">
            <NumberField label="Commission" value={commission} onChange={(n) => setCommission(n ?? 0)} prefix="%" />
            <NumberField label="Processing" value={processing} onChange={(n) => setProcessing(n ?? 0)} prefix="%" />
            <NumberField label="Fixed / purchase" value={processingFlat} onChange={(n) => setProcessingFlat(n ?? 0)} />
          </div>
          <p className="muted">Current Whatnot US default, editable for another marketplace. Fees apply per purchase.</p>
        </details>
      </section>
      {costsComplete && (
        <SellerScenarioLab
          baseAnalysis={analysis}
          lines={lines}
          acquisition={acquisition + otherCosts}
          buyerShipping={buyerShip}
          packing={packing}
          coveredShipping={covered}
          shipmentCount={shipmentCount}
          transactionCount={soldIds.length}
          marketplace={marketplace}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
        />
      )}
      {costsComplete && (
        <section className="panel ask-grid">
          <PanelHeading
            label="ASKS TO CLEAR"
            help="Splits the total sales target across the color slots based on their average card value. Tap a color to see the cards behind its number."
            title={<>{fmt(askTotal)} total</>}
            accessory={<button
              className="quiet"
              onClick={() =>
                setActual(
                  Object.fromEntries(soldIds.map((id) => [id, asks[id]])),
                )
              }
            >
              <Copy />
              Use plan
            </button>}
          />
          <p className="muted">
            Target {fmt(target)} · split by average card value. Lock a target or mark a color unsold; the other targets update automatically.
          </p>
          {result.slots.map((slot) => (
            <div className="ask-entry" key={slot.id}>
              <div className={`ask ${unsold.has(slot.id) ? "unsold" : ""}`}>
                <button
                  type="button"
                  className="ask-slot-summary"
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    setOpenSlot((current) => current === slot.id ? null : slot.id);
                  }}
                  aria-expanded={openSlot === slot.id}
                  aria-label={`${openSlot === slot.id ? "Hide" : "Show"} ${slot.name} value details`}
                >
                  <span className={`slot-letter slot-letter-${slot.id}`}>{slot.id}</span>
                  <span>
                    <strong>{slot.name}</strong>
                    <small>{fmt(slot.sellableEV)} average card value</small>
                  </span>
                </button>
                <b>{fmt(asks[slot.id])}</b>
                <div className="ask-actions">
                  <button
                    title={locked[slot.id] == null ? "Lock target" : "Unlock target"}
                    onClick={() => setLocked((current) => {
                      const next = { ...current };
                      if (next[slot.id] == null) next[slot.id] = asks[slot.id];
                      else delete next[slot.id];
                      return next;
                    })}
                  >
                    {locked[slot.id] == null ? <Unlock /> : <Lock />}
                  </button>
                  <button
                    title={unsold.has(slot.id) ? "Sell this slot" : "Mark unsold"}
                    onClick={() => setUnsold((current) => {
                      const next = new Set(current);
                      if (next.has(slot.id)) next.delete(slot.id);
                      else next.add(slot.id);
                      return next;
                    })}
                  >
                    {unsold.has(slot.id) ? <DollarSign /> : <X />}
                  </button>
                </div>
                <label>
                  <small>Actual</small>
                  <NumericInput
                    ariaLabel={`Actual ${slot.name} sale price`}
                    placeholder={unsold.has(slot.id) ? "unsold" : "—"}
                    disabled={unsold.has(slot.id)}
                    value={actual[slot.id]}
                    onCommit={(value) => setActual({ ...actual, [slot.id]: value })}
                  />
                </label>
              </div>
              {openSlot === slot.id && (
                <SlotValueDetails
                  className="seller-slot-detail"
                  slot={slot}
                  threshold={result.threshold}
                  onInspect={setInspectedCard}
                />
              )}
            </div>
          ))}
          <div className="min-row">
            <NumberField
              label="Minimum ask"
              value={minimum}
              onChange={(n) => setMinimum(n ?? 0)}
            />
          </div>
        </section>
      )}
      {profit && (
        <section
          className={`panel profit ${profit.profit >= targetProfit ? "positive" : "negative"}`}
        >
          <header className="profit-heading">
            <InformationLabel help="Shows what you would keep after the entered sale prices, fees, product costs, packing, and shipping you cover.">
              ACTUAL OUTCOME
            </InformationLabel>
          </header>
          <h2>{fmt(profit.profit)} profit</h2>
          <div className="metric-row profit-metrics">
            <div>
              <span>Hammer</span>
              <b>{fmt(profit.hammer)}</b>
            </div>
            <div>
              <span>Fees</span>
              <b>−{fmt(profit.fees)}</b>
            </div>
            <div>
              <span>Packing &amp; shipping</span>
              <b>−{fmt(profit.shipmentCosts)}</b>
            </div>
          </div>
        </section>
      )}
      <CardInspector
        row={inspectedCard}
        status={result.status}
        threshold={result.threshold}
        onClose={() => setInspectedCard(null)}
      />
    </>
  );
}

function sellerOutcomeLabel(value: number) {
  return `${value >= 0 ? "Profit" : "Loss"} ${fmt(Math.abs(value))}`;
}

function SellerEnticement({
  baseAnalysis,
  lines,
  transactionCount,
  baseProfitAtAll,
}: {
  baseAnalysis: BreakAnalysis;
  lines: BreakLine[];
  transactionCount: number;
  baseProfitAtAll: number;
}) {
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [threshold, setThreshold] = useState(25);
  const [bonusAnalysis, setBonusAnalysis] = useState<BreakAnalysis>();
  const [marketPrice, setMarketPrice] = useState<number>();
  const [costOverride, setCostOverride] = useState<number>();
  const [loading, setLoading] = useState(false);
  const setCodes = [...new Set(lines.map((line) => line.set))];
  const productRef = (product: ProductChoice) => `${product.set}|${product.sealedKey ?? product.key}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all(setCodes.map(productsForSet))
      .then((groups) => groups.flat().filter((product) => product.category === "pack"))
      .then((packs) => {
        if (cancelled) return;
        setProducts(packs);
        setSelectedKey((current) => packs.some((product) => productRef(product) === current)
          ? current
          : "");
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, [setCodes.join("|")]);

  const selected = products.find((product) => productRef(product) === selectedKey);
  useEffect(() => {
    if (!selected) {
      setBonusAnalysis(undefined);
      setMarketPrice(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setBonusAnalysis(undefined);
    setMarketPrice(undefined);
    setCostOverride(undefined);
    const bonusLine: BreakLine = {
      id: "seller-enticement-preview",
      set: selected.set,
      productKey: selected.sealedKey ? `sealed:${selected.sealedKey}` : selected.key,
      productLabel: selected.label,
      quantity: 1,
      packCount: selected.packCount,
      tcgId: selected.tcgId,
    };
    Promise.all([
      evaluateBreakAnalysis([...lines, bonusLine], 0),
      sealedMarketPrice(selected.set, selected.tcgId),
    ]).then(([next, market]) => {
      if (!cancelled) {
        setBonusAnalysis(next);
        setMarketPrice(market);
      }
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.set, selected?.sealedKey, selected?.key, lines]);

  const packCost = costOverride ?? marketPrice;
  const evAdded = bonusAnalysis
    ? Math.max(0, bonusAnalysis.valuation.marketEV - baseAnalysis.valuation.marketEV)
    : undefined;
  const allCost = packCost == null ? undefined : packCost * transactionCount;
  const allEv = evAdded == null ? undefined : evAdded * transactionCount;

  return (
    <section className="seller-enticement" aria-label="Enticement">
      <div className="seller-section-heading">
        <div><InformationLabel>4 · ENTICEMENT</InformationLabel><h2>Bonus pack threshold</h2></div>
        <small>One pack per bid over the threshold</small>
      </div>
      <div className="enticement-controls">
        <label className="compact-select"><span>Booster</span><select id="seller-bonus-booster" aria-label="Bonus booster" value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
          <option value="">Choose a booster</option>
          {products.map((product) => <option key={productRef(product)} value={productRef(product)}>{product.set} · {product.label}</option>)}
        </select></label>
        <NumberField label="Bid threshold" value={threshold} onChange={(value) => setThreshold(value ?? 0)} live />
        <NumberField id="seller-bonus-cost" label="My booster cost" value={costOverride} onChange={setCostOverride} live />
      </div>
      <div className="enticement-metrics">
        <div><span>Market / pack</span><b>{loading ? "Loading…" : fmt(marketPrice)}</b></div>
        <div><span>Cost / qualifying bid</span><b>{packCost == null ? <a href={selected ? "#seller-bonus-cost" : "#seller-bonus-booster"}>{selected ? "Enter booster cost" : "Choose a booster"}</a> : fmt(packCost)}</b></div>
        <div><span>Pull EV added / pack</span><b>{evAdded == null ? "—" : `+${fmt(evAdded)}`}</b></div>
        <div><span>If all {transactionCount} clear {fmt(threshold)}</span><b>{allCost == null ? "—" : `${fmt(allCost)} cost`}</b><small>{allEv == null ? "" : `+${fmt(allEv)} modeled pull EV · ${sellerOutcomeLabel(baseProfitAtAll - (allCost ?? 0))}`}</small></div>
      </div>
      {selected && !loading && packCost == null && <CompactWarning title={<a href="#seller-bonus-cost" onClick={(event) => event.stopPropagation()}>Enter your cost for {selected.label}</a>} summary="Needed to calculate profit." className="missing-input-warning">
        <p>No sealed-market price is available, so the booster expense cannot be subtracted until you enter your cost.</p>
      </CompactWarning>}
      <CompactWarning title="Written approval required" summary="Needed before advertising threshold-triggered packs." className="enticement-policy">
        <p>A pack included and disclosed before bidding does not need threshold approval.</p>
      </CompactWarning>
    </section>
  );
}

export function SellerView({
  analysis,
  lines,
  transactionCount,
  add,
  update,
  remove,
}: {
  analysis: BreakAnalysis;
  lines: BreakLine[];
  transactionCount: number;
  add: () => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
}) {
  const planFingerprint = sellerCompositionFingerprint(lines, analysis.valuation.dataVersion);
  const [draft, setDraft] = useState<SellerPlanDraft>(() => readSellerPlanDraft(planFingerprint));
  const setPlan = (patch: Partial<SellerPlanDraft>) => setDraft((current) => ({ ...current, ...patch }));
  useEffect(() => { setDraft(readSellerPlanDraft(planFingerprint)); }, [planFingerprint]);
  useEffect(() => { writeSellerPlanDraft(planFingerprint, draft); }, [draft, planFingerprint]);
  const {
    buyerShipping, packing, postage, shipments, mailingMethod, labor, tax,
    giveaways, refundReserve, overhead, commission, processing, processingFlat,
    plannedBidOverride, minimumAsk,
  } = draft;
  const acceptedEstimateIds = new Set(draft.acceptedEstimateIds);
  const setAcceptedEstimateIds = (update: (current: Set<string>) => Set<string>) => setDraft((current) => ({ ...current, acceptedEstimateIds: [...update(new Set(current.acceptedEstimateIds))] }));
  const setBuyerShipping = (value: number) => setPlan({ buyerShipping: value });
  const setPacking = (value: number) => setPlan({ packing: value });
  const setPostage = (value: number) => setPlan({ postage: value });
  const setShipments = (value: number) => setPlan({ shipments: value });
  const setMailingMethod = (value: string) => setPlan({ mailingMethod: value });
  const setLabor = (value: number) => setPlan({ labor: value });
  const setTax = (value: number) => setPlan({ tax: value });
  const setGiveaways = (value: number) => setPlan({ giveaways: value });
  const setRefundReserve = (value: number) => setPlan({ refundReserve: value });
  const setOverhead = (value: number) => setPlan({ overhead: value });
  const setCommission = (value: number) => setPlan({ commission: value });
  const setProcessing = (value: number) => setPlan({ processing: value });
  const setProcessingFlat = (value: number) => setPlan({ processingFlat: value });
  const setPlannedBidOverride = (value: number | undefined) => setPlan({ plannedBidOverride: value });
  const [productsOpen, setProductsOpen] = useState(false);
  const costStatusRef = useRef<HTMLSpanElement>(null);
  const focusManualCost = (id: string) => {
    setProductsOpen(true);
    window.setTimeout(() => document.getElementById(`seller-cost-${id}`)?.focus(), 0);
  };
  const totalOpenings = lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0);
  const marketEstimateLines = lines.filter((line) => line.myCost == null && line.marketCost != null);
  const estimateAccepted = (line: BreakLine) => acceptedEstimateIds.has(line.id);
  const acquisition = lines.reduce((total, line) => total + (line.myCost ?? (estimateAccepted(line) ? line.marketCost : undefined) ?? 0) * line.quantity, 0);
  const costsComplete = lines.every((line) => line.myCost != null || (estimateAccepted(line) && line.marketCost != null));
  const missingCostLine = lines.find((line) => line.myCost == null && line.marketCost == null);
  const otherCosts = labor + tax + giveaways + refundReserve + overhead;
  const shipmentCount = Math.min(transactionCount, Math.max(1, Math.round(shipments)));
  const shipmentCost = (packing + postage) * shipmentCount;
  const completeOverhead = completeCost({
    acquisition,
    packingAndCoveredShipping: shipmentCost,
    labor,
    tax,
    giveaways,
    refundReserve,
    overhead,
  });
  const marketplace: MarketplacePreset = {
    ...WHATNOT_US,
    commissionRate: commission / 100,
    processingRate: processing / 100,
    processingFlat,
    name: commission === 8 && processing === 2.9 && processingFlat === .3 ? "Whatnot US" : "Custom fees",
  };
  const breakEvenTotal = costsComplete
    ? requiredHammer(transactionCount, shipmentCost, acquisition + otherCosts, 0, buyerShipping, marketplace)
    : undefined;
  const breakEvenBid = breakEvenTotal == null ? undefined : breakEvenTotal / transactionCount;
  const plannedBid = plannedBidOverride ?? (breakEvenBid == null ? undefined : Math.ceil(breakEvenBid * 100) / 100);
  const profitAt = (bid: number, soldCount: number) => {
    const transactionNetValue = bid
      - bid * marketplace.commissionRate
      - (bid + buyerShipping) * marketplace.processingRate
      - marketplace.processingFlat;
    const scenarioShipments = Math.min(soldCount, shipmentCount);
    return transactionNetValue * soldCount
      - (packing + postage) * scenarioShipments
      - acquisition
      - otherCosts;
  };
  const allSoldProfit = plannedBid == null ? 0 : profitAt(plannedBid, transactionCount);
  const scenarios = [...new Set([transactionCount, Math.max(1, Math.ceil(transactionCount * (transactionCount >= 20 ? .85 : .75))), Math.max(1, Math.ceil(transactionCount * (transactionCount >= 20 ? .7 : .5)))])]
    .map((sold) => ({ sold, profit: plannedBid == null || !costsComplete ? undefined : profitAt(plannedBid, sold) }));
  const unsoldSlots = new Set(draft.unsoldSlots);
  const soldSlots = analysis.valuation.slots.filter((slot) => slot.sellableEV > 0 && !unsoldSlots.has(slot.id));
  const asks = plannedBid == null ? undefined : allocate(
    analysis.valuation,
    plannedBid * transactionCount,
    minimumAsk,
    draft.lockedAsks,
    unsoldSlots,
  );
  const actualTransactions: Transaction[] = soldSlots.flatMap((slot) => {
    const hammer = draft.actualAsks[slot.id];
    return hammer == null ? [] : [{ slot: slot.id, hammer, buyerShipping, buyerTax: 0 }];
  });
  const actualProfit = costsComplete && soldSlots.length > 0 && actualTransactions.length === soldSlots.length
    ? calculateProfit(
      actualTransactions,
      Array.from({ length: shipmentCount }, (_, index) => ({
        id: `seller-plan-${index}`, slots: [], packingCost: packing, sellerCoveredShipping: postage,
      })),
      acquisition + otherCosts,
      marketplace,
    )
    : undefined;

  return (
    <section className="seller-command-center">
      {decisionEligibility(analysis.valuation).status !== "eligible" && <CatalogUnavailableNotice onEdit={add} />}
      <p className="seller-plan-scope" role="note">This private seller plan is scoped to this exact product composition and valuation model. Changing either starts a clean plan.</p>
      <section className="seller-contents" aria-labelledby="seller-contents-heading">
        <div className="seller-section-heading">
          <div><InformationLabel>1 · BREAK</InformationLabel><h2 id="seller-contents-heading">Contents &amp; cost basis</h2></div>
          <button className="primary seller-add-products" onClick={add}><PackagePlus />Add products</button>
        </div>
        <div className="seller-break-reconciliation" aria-label="Seller break composition summary">
          <strong>{lines.length} lines · {totalOpenings} openings · {transactionCount} spots</strong>
          <span ref={costStatusRef} tabIndex={-1} role="status">{costsComplete ? "Cost basis ready" : "Cost basis incomplete"}</span>
        </div>
        <details className="seller-cost-rollout seller-product-ledger" open={productsOpen} onToggle={(event) => setProductsOpen(event.currentTarget.open)}>
          <summary className="disclosure-summary">
            <span><strong>{productsOpen ? "Hide product ledger" : "Edit products & costs"}</strong><small>{lines.length} lines · quantities and actual acquisition costs</small></span>
            <DisclosureArrow />
          </summary>
          <div className="seller-product-lines">
            {lines.map((line) => (
              <div className="seller-product-line" key={line.id}>
                <span className="set-glyph">{line.set}</span>
                <span className="seller-product-name"><strong>{line.productLabel}</strong><small>{line.set}</small></span>
                <div className="seller-market-price"><span>Current market</span><b>{fmt(line.marketCost)}</b><small>{line.myCost != null ? "Actual cost entered" : line.marketCost == null ? "Estimate unavailable — enter your cost" : estimateAccepted(line) ? "Market estimate accepted — estimated" : "Estimate available — not accepted"}</small></div>
                <NumberField id={`seller-cost-${line.id}`} label="My cost basis" value={line.myCost} onChange={(value) => update(line.id, { myCost: value })} live />
                {line.myCost == null && line.marketCost != null && <button type="button" className="quiet" onClick={() => { setPlan({ acceptedEstimateIds: acceptedEstimateIds.has(line.id) ? draft.acceptedEstimateIds.filter((id) => id !== line.id) : [...draft.acceptedEstimateIds, line.id] }); window.setTimeout(() => costStatusRef.current?.focus(), 0); }}>{estimateAccepted(line) ? "Stop using estimate" : "Use estimate"}</button>}
                {line.myCost == null && line.marketCost == null && <button type="button" className="quiet" onClick={() => focusManualCost(line.id)}>Enter actual cost</button>}
                <QuantityControl line={line} update={(quantity) => update(line.id, { quantity })} />
                <button className="remove-line" aria-label={`Remove ${line.productLabel} from break`} onClick={() => remove(line.id)}><Trash2 /></button>
              </div>
            ))}
          </div>
        </details>
      </section>

      {marketEstimateLines.length > 0 && <section className="cost-basis-policy" aria-label="Cost basis policy">
        <div><InformationLabel>COST BASIS</InformationLabel><h3>{acceptedEstimateIds.size ? "Some market estimates accepted" : "Actual costs are still blank"}</h3><p>Each sealed-market estimate is optional, reversible, and remains labeled estimated. Enter seller costs whenever available.</p></div>
        <button type="button" className="quiet" onClick={() => setPlan({ acceptedEstimateIds: acceptedEstimateIds.size === marketEstimateLines.length ? [] : marketEstimateLines.map((line) => line.id) })}>{acceptedEstimateIds.size === marketEstimateLines.length ? "Stop using estimates" : `Use ${marketEstimateLines.length} market estimates`}</button>
      </section>}

      {missingCostLine && <CompactWarning title={<a href={`#seller-cost-${missingCostLine.id}`} onClick={() => focusManualCost(missingCostLine.id)}>Enter your cost for {missingCostLine.productLabel}</a>} summary="Needed to calculate break-even and profit." className="missing-input-warning">
        <p>No sealed-market price is available for this product, so ColorBreak needs your cost instead.</p>
      </CompactWarning>}

      <IncompleteDataWarning analysis={analysis} title="Some seller values may be low" />

      <details className="seller-cost-rollout">
        <summary className="disclosure-summary">
          <span><strong>Costs &amp; platform fees</strong><small>{costsComplete ? `${fmt(completeOverhead)} base cost` : "Cost basis incomplete"} · {marketplace.name} · {shipmentCount} expected combined shipments</small></span>
          <DisclosureArrow />
        </summary>
        <div className="seller-cost-grid">
          <label className="compact-select"><span>Mailing method</span><select aria-label="Mailing method" value={mailingMethod} onChange={(event) => {
            setPlan({ mailingMethod: event.target.value, ...(event.target.value === "whatnot-label" ? { postage: 0 } : {}) });
          }}>
            <option value="whatnot-label">Whatnot buyer-paid label</option>
            <option value="ground">USPS Ground Advantage</option>
            <option value="priority">USPS Priority Mail</option>
            <option value="custom">Other / custom</option>
          </select></label>
          <NumberField label="Buyer shipping at checkout" value={buyerShipping} onChange={(value) => setPlan({ buyerShipping: value ?? 0 })} live />
          <NumberField label="Packaging / shipment" value={packing} onChange={(value) => setPlan({ packing: value ?? 0 })} live />
          <NumberField label="Postage / shipment" value={postage} onChange={(value) => setPlan({ postage: value ?? 0 })} live />
          <NumberField label={`Expected combined shipments (up to ${transactionCount})`} value={shipments} onChange={(value) => setPlan({ shipments: value ?? 1 })} live />
          <NumberField label="Labor" value={labor} onChange={(value) => setPlan({ labor: value ?? 0 })} live />
          <NumberField label="Tax on fees / permits" value={tax} onChange={(value) => setPlan({ tax: value ?? 0 })} live />
          <NumberField label="Giveaways" value={giveaways} onChange={(value) => setPlan({ giveaways: value ?? 0 })} live />
          <NumberField label="Refund / damage reserve" value={refundReserve} onChange={(value) => setPlan({ refundReserve: value ?? 0 })} live />
          <NumberField label="Allocated overhead" value={overhead} onChange={(value) => setPlan({ overhead: value ?? 0 })} live />
          <NumberField label="Commission" value={commission} onChange={(value) => setPlan({ commission: value ?? 0 })} prefix="%" live />
          <NumberField label="Processing" value={processing} onChange={(value) => setPlan({ processing: value ?? 0 })} prefix="%" live />
          <NumberField label="Fixed / purchase" value={processingFlat} onChange={(value) => setPlan({ processingFlat: value ?? 0 })} live />
        </div>
        <p className="seller-cost-source">Whatnot US TCG defaults: 8% commission and 2.9% + $0.30 processing, checked {WHATNOT_US.policyDate}. USPS postage varies by weight and distance; enter the actual label cost when the seller pays it.</p>
      </details>

      <section className="seller-break-economics" aria-label="Seller break economics">
        <div className="seller-break-even">
          <span>Break-even bid</span>
          <strong>{fmt(breakEvenBid)}</strong>
          <small>per spot · all {transactionCount} sold</small>
        </div>
        <details className="seller-assumptions"><summary className="disclosure-summary"><span>Assumptions used</span><DisclosureArrow /></summary><p>{acceptedEstimateIds.size ? "Acquisition includes accepted estimated market inputs; " : "Acquisition uses seller-entered costs; "}fees checked {WHATNOT_US.policyDate}; buyer shipping {fmt(buyerShipping)}; packaging/postage {fmt(packing + postage)} per shipment; up to one combined shipment per sold spot ({shipmentCount} expected). Change this if you expect consolidation. Scenarios are sell-through math, not a demand prediction.</p></details>
        <NumberField label="Planned bid per spot" value={plannedBid} onChange={(value) => setPlan(value == null ? { plannedBidOverride: undefined } : { plannedBidOverride: value })} live />
        <div className="seller-fill-scenarios">
          {scenarios.map((scenario) => <div className={scenario.profit != null && scenario.profit >= 0 ? "positive" : "negative"} key={scenario.sold}>
            <span>{scenario.sold} / {transactionCount} sold</span>
            <b>{scenario.profit == null && !costsComplete ? missingCostLine ? <a href={`#seller-cost-${missingCostLine.id}`} onClick={() => setProductsOpen(true)}>Enter {missingCostLine.productLabel} cost</a> : "Choose cost basis" : scenario.profit == null ? "Enter planned bid" : sellerOutcomeLabel(scenario.profit)}</b>
          </div>)}
        </div>
      </section>

      {costsComplete && asks && <section className="panel ask-grid" aria-label="Per-slot seller operating plan">
        <PanelHeading
          label="SLOT OPERATING PLAN"
          help="Targets are split by modeled sellable card value. Locks preserve a chosen target; marking a slot unsold redistributes the remaining recovery across the eligible unlocked slots."
          title={`${fmt(soldSlots.reduce((sum, slot) => sum + asks[slot.id], 0))} recovery target`}
          accessory={<button type="button" className="quiet" onClick={() => setPlan({ actualAsks: Object.fromEntries(soldSlots.map((slot) => [slot.id, asks[slot.id]])) })}><Copy />Use plan</button>}
        />
        <p className="muted">Session-only private plan. Actual-result profit stays hidden until every sold slot has an entered actual ask.</p>
        {analysis.valuation.slots.map((slot) => {
          const unsold = unsoldSlots.has(slot.id);
          const eligible = slot.sellableEV > 0;
          const locked = draft.lockedAsks[slot.id] != null;
          return <div className={`ask-entry ${!eligible ? "ineligible" : ""}`} key={slot.id}>
            <div className={`ask ${unsold ? "unsold" : ""}`}>
              <span className={`slot-letter slot-letter-${slot.id}`}>{slot.id}</span>
              <span><strong>{slot.name}</strong><small>{eligible ? `${fmt(slot.sellableEV)} sellable EV` : "No modeled sellable value"}</small></span>
              <b>{eligible && !unsold ? fmt(asks[slot.id]) : unsold ? "Unsold" : "—"}</b>
              {eligible && <div className="ask-actions">
                <button type="button" title={locked ? "Unlock target" : "Lock target"} onClick={() => setPlan({ lockedAsks: locked ? Object.fromEntries(Object.entries(draft.lockedAsks).filter(([id]) => id !== slot.id)) : { ...draft.lockedAsks, [slot.id]: asks[slot.id] } })}>{locked ? <Lock /> : <Unlock />}</button>
                <button type="button" title={unsold ? "Sell this slot" : "Mark unsold"} onClick={() => setPlan({ unsoldSlots: unsold ? draft.unsoldSlots.filter((id) => id !== slot.id) : [...draft.unsoldSlots, slot.id] })}>{unsold ? <DollarSign /> : <X />}</button>
              </div>}
              <label><small>Actual</small><NumericInput ariaLabel={`Actual ${slot.name} sale price`} placeholder={unsold ? "unsold" : "—"} disabled={!eligible || unsold} value={draft.actualAsks[slot.id]} onCommit={(value) => setPlan({ actualAsks: value == null ? Object.fromEntries(Object.entries(draft.actualAsks).filter(([id]) => id !== slot.id)) : { ...draft.actualAsks, [slot.id]: value } })} /></label>
            </div>
          </div>;
        })}
        <div className="min-row"><NumberField label="Minimum ask" value={minimumAsk} onChange={(value) => setPlan({ minimumAsk: value ?? 0 })} live /></div>
      </section>}

      {actualProfit && <section className={`panel profit ${actualProfit.profit >= 0 ? "positive" : "negative"}`} aria-label="Actual seller result">
        <InformationLabel>ACTUAL RESULT</InformationLabel>
        <h2>{fmt(actualProfit.profit)} profit</h2>
        <div className="metric-row profit-metrics"><div><span>Hammer</span><b>{fmt(actualProfit.hammer)}</b></div><div><span>Fees</span><b>−{fmt(actualProfit.fees)}</b></div><div><span>Packing &amp; shipping</span><b>−{fmt(actualProfit.shipmentCosts)}</b></div></div>
      </section>}

      <button type="button" className="quiet" onClick={() => { discardSellerPlanDraft(planFingerprint); setDraft(defaultSellerPlanDraft()); }}>Discard this seller plan</button>

      <SellerEnticement
        baseAnalysis={analysis}
        lines={lines}
        transactionCount={transactionCount}
        baseProfitAtAll={allSoldProfit}
      />
      <p className="seller-demand-checkpoint"><strong>Economics ready — demand validation pending.</strong> Record audience/pre-interest, a comparable break and date, and your planned time window before launch. This does not predict fill or profit.</p>
    </section>
  );
}

function storedLines(
  mode: "buyer" | "seller",
  legacy: BreakLine[],
): BreakLine[] {
  if (legacy.length) return legacy;
  try {
    return JSON.parse(
      sessionStorage.getItem(`colorbreak:${mode}:draft:v1`) ?? "[]",
    ) as BreakLine[];
  } catch {
    return [];
  }
}

function storedBuyerNumber(key: "bid" | "shipping" | "large-spots"): number | undefined {
  try {
    const stored = sessionStorage.getItem(`colorbreak:buyer:${key}`);
    if (stored == null || stored.trim() === "") return undefined;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function BuyerSetup({
  lines,
  add,
  update,
  remove,
  result,
  auction,
  setAuction,
  assignmentMode,
  setAssignmentMode,
  selected,
  setSelected,
  bulkEnabled,
  bulkThreshold,
  setBulkEnabled,
  setBulkThreshold,
  largeSpots,
  setLargeSpots,
}: {
  lines: BreakLine[];
  add: () => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
  result?: ValuationResult;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  assignmentMode: AssignmentMode;
  setAssignmentMode: (mode: AssignmentMode) => void;
  selected: SlotId;
  setSelected: (slot: SlotId) => void;
  bulkEnabled: boolean;
  bulkThreshold: number;
  setBulkEnabled: (enabled: boolean) => void;
  setBulkThreshold: (threshold: number) => void;
  largeSpots: number;
  setLargeSpots: (spots: number) => void;
}) {
  return (
    <section id="buyer-break-setup" className="buyer-setup" aria-label="Bid setup">
      <SlotRail
        result={result}
        auction={auction}
        setAuction={setAuction}
        assignmentMode={assignmentMode}
        setAssignmentMode={setAssignmentMode}
        selected={selected}
        setSelected={setSelected}
        largeSpots={largeSpots}
        setLargeSpots={setLargeSpots}
      />
      <Composition
        lines={lines}
        add={add}
        update={update}
        remove={remove}
        headingLabel="2 · BREAK CONTENTS"
        showHelp={false}
      />
      <div className="buyer-options-heading">
        <InformationLabel>3 · VALUE FILTER</InformationLabel>
        <h2>Set what counts as value</h2>
      </div>
      <BulkFilterControl
        enabled={bulkEnabled}
        threshold={bulkThreshold}
        result={result}
        onToggle={setBulkEnabled}
        onThreshold={setBulkThreshold}
        compact
      />
    </section>
  );
}

export function Workspace({
  mode,
  exit,
  startFresh = false,
}: {
  mode: "buyer" | "seller";
  exit: () => void;
  startFresh?: boolean;
}) {
  const legacy = useMemo(() => decodeLegacySearch(location.search), []);
  const sharedBuyer = useMemo(() => decodeBuyerShare(location.search), []);
  const isSharedBreak = legacy.length > 0;
  const firstResultTracked = useRef(false);
  const [legacyNotice, setLegacyNotice] = useState(false);
  const calculationStarted = useRef(Date.now());
  const analysisRequest = useRef(0);
  const [lines, setLines] = useState<BreakLine[]>(() =>
      startFresh && mode === "buyer" ? [] : storedLines(mode, legacy),
    ),
    [builder, setBuilder] = useState(false),
    [analysis, setAnalysis] = useState<BreakAnalysis>(),
    [auction, setAuction] = useState<AuctionState>(() => {
      return sharedBuyer.remaining?.length ? createAuction(sharedBuyer.remaining) : createAuction();
    }),
    [error, setError] = useState<string>(),
    [bulkThreshold, setBulkThreshold] = useState(() => sharedBuyer.bulkThreshold ?? 2),
    [bulkEnabled, setBulkEnabled] = useState(() => sharedBuyer.bulkEnabled ?? true),
    [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(() => sharedBuyer.assignmentMode),
    [buyerBid, setBuyerBid] = useState<number | undefined>(() => {
      const value = sessionStorage.getItem("colorbreak:buyer:bid"); return value == null ? undefined : Number(value);
    }),
    [buyerShipping, setBuyerShipping] = useState<number | undefined>(() => {
      const value = sessionStorage.getItem("colorbreak:buyer:shipping"); return value == null ? undefined : Number(value);
    }),
    [largeSpots, setLargeSpots] = useState<number>(() => {
      return sharedBuyer.largeSpots ?? storedBuyerNumber("large-spots") ?? 120;
    }),
    [selectedSlot, setSelectedSlot] = useState<SlotId>(() => {
      return sharedBuyer.selectedSlot ?? "W";
    }),
    [busy, setBusy] = useState(false);
  const [importUndo, setImportUndo] = useState<{
    lines: BreakLine[];
    assignmentMode: AssignmentMode;
    largeSpots: number;
    bulkEnabled: boolean;
    bulkThreshold: number;
  }>();
  const threshold = mode === "seller" ? 0 : bulkEnabled ? bulkThreshold : 0;
  useEffect(() => { if (cleanupLegacyStorage()) setLegacyNotice(true); }, []);
  useEffect(() => {
    try {
      writeSessionLines(mode, lines);
    } catch {
      /* persistence is optional */
    }
  }, [lines, mode]);
  useEffect(() => {
    try { sessionStorage.setItem("colorbreak:buyer:auction", JSON.stringify(auction)); } catch { /* optional */ }
  }, [auction]);
  useEffect(() => {
    try {
      if (buyerBid == null) sessionStorage.removeItem("colorbreak:buyer:bid");
      else sessionStorage.setItem("colorbreak:buyer:bid", String(buyerBid));
    } catch { /* optional */ }
  }, [buyerBid]);
  useEffect(() => {
    try {
      if (buyerShipping == null) sessionStorage.removeItem("colorbreak:buyer:shipping");
      else sessionStorage.setItem("colorbreak:buyer:shipping", String(buyerShipping));
    } catch { /* optional */ }
  }, [buyerShipping]);
  useEffect(() => {
    try { sessionStorage.setItem("colorbreak:buyer:large-spots", String(largeSpots)); } catch { /* optional */ }
  }, [largeSpots]);
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
  useEffect(() => {
    if (!lines.length) {
      setAnalysis(undefined);
      return;
    }
    const request = ++analysisRequest.current;
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
  }, [lines, threshold]);
  const update = (id: string, patch: Partial<BreakLine>) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
          {mode === "buyer" && lines.length > 0 && <button
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
      {shareStatus && <p role="status">{shareStatus} <input aria-label="Buyer setup URL" readOnly value={sharedHref} /></p>}
      <main className="workspace page">
        <header className="workspace-title">
          <div>
            <p className="eyebrow">
              {mode === "buyer" ? assignmentMode === "large" ? "BUYER · LARGE RANDOM MODE" : "BUYER · FAST BID CHECK" : "SELLER · PLAN TO LAUNCH"}
            </p>
            <h1>{mode === "buyer" ? assignmentMode === "large" ? "Large Break" : "Bid Check" : "Seller Studio"}</h1>
          </div>
        </header>
        {importUndo && <aside className="import-undo" aria-live="polite">
          <span><b>Break updated</b><small>{lines.length} lines · review complete</small></span>
          <button type="button" className="quiet" onClick={() => {
            setLines(importUndo.lines);
            setAssignmentMode(importUndo.assignmentMode);
            setLargeSpots(importUndo.largeSpots);
            setBulkEnabled(importUndo.bulkEnabled);
            setBulkThreshold(importUndo.bulkThreshold);
            setImportUndo(undefined);
          }}>Undo</button>
        </aside>}
        {mode === "buyer" && isSharedBreak && lines.length > 0 && <aside className="shared-calculation-notice" aria-label="Shared calculation details">
          <Lock />
          <span><b>SHARED CALCULATION · USD · MODEL v4</b><small>Original link unchanged. Editing makes a local copy · {lines.length} products / {lines.reduce((total, line) => total + line.quantity * Math.max(1, line.packCount ?? 1), 0)} openings · Prices observed {analysis?.priceAvailability.observedAt ? new Date(analysis.priceAvailability.observedAt).toLocaleString() : "loading"}</small></span>
        </aside>}
        {mode === "buyer" ? (
          <>
          {lines.length > 0 && <div className="mobile-stage-nav" aria-label="Large Break sections"><a href="#buyer-large-result">Decision</a>{assignmentMode === "large" && <a href="#buyer-large-assignments">Assignments</a>}<a href="#buyer-break-setup">{isSharedBreak ? "Customize" : "Edit break"}</a></div>}
          <div className={`bid-check-workbench ${lines.length ? "has-break" : "is-empty"}`}>
            <BuyerSetup
              lines={lines}
              add={() => setBuilder(true)}
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
              {!lines.length && <section className="buyer-awaiting-break"><span><BarChart3 /></span><h2>Your decision appears here</h2><p><b>1</b> Add every product · <b>2</b> Enter the spot price · <b>3</b> Compare value and risk.</p></section>}
              {busy && <div className="calculating"><span />Calculating exact contents and prices…</div>}
              {error && <CompactWarning title="Couldn’t load this result" summary="Open for details, then try again." className="load-warning"><p>{error}</p></CompactWarning>}
              {analysis && (assignmentMode === "large" ? (
                <LargeBreakView analysis={analysis} lines={lines} spots={largeSpots} bid={buyerBid} setBid={setBuyerBid} shipping={buyerShipping} setShipping={setBuyerShipping} />
              ) : (
                <BuyerView
                  analysis={analysis}
                  lines={lines}
                  auction={auction}
                  assignmentMode={assignmentMode}
                  selected={selectedSlot}
                  breakLabel={lines.length === 1 ? `${lines[0].quantity}× ${lines[0].set} ${lines[0].productLabel}` : `${lines.length} products`}
                  bid={buyerBid}
                  setBid={setBuyerBid}
                  shipping={buyerShipping}
                  setShipping={setBuyerShipping}
                  onChooseDecisionReady={() => setBuilder(true)}
                />
              ))}
            </div>
          </div>
          </>
        ) : !lines.length ? (
          <EmptyBreak add={() => setBuilder(true)} />
        ) : (
          <div className="seller-studio-shell">
              {busy && (
                <div className="calculating">
                  <span />
                  Calculating exact contents and prices…
                </div>
              )}
              {error && <CompactWarning title="Couldn’t load this result" summary="Open for details, then try again." className="load-warning"><p>{error}</p></CompactWarning>}
              {analysis && !busy && (
                <SellerView
                  analysis={analysis}
                  lines={lines}
                  transactionCount={assignmentMode === "large" ? largeSpots : 8}
                  add={() => setBuilder(true)}
                  update={update}
                  remove={(id) => setLines((rows) => rows.filter((row) => row.id !== id))}
                />
              )}
          </div>
        )}
      </main>
      <Builder
        open={builder}
        onClose={() => setBuilder(false)}
        lines={lines}
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
      />
    </>
  );
}

export function App() {
  useMobileInputViewport();
  const hasSharedBreak = decodeLegacySearch(location.search).length > 0;
  const initial: Mode =
    location.hash === "#seller"
      ? "seller"
      : location.hash === "#buyer" || hasSharedBreak
        ? "buyer"
        : "home";
  const [mode, setMode] = useState<Mode>(initial);
  const [startFreshBuyer, setStartFreshBuyer] = useState(false);
  const choose = (next: Mode, fresh = next === "buyer" && mode === "home") => {
    setStartFreshBuyer(fresh);
    setMode(next);
    history.replaceState(
      null,
      "",
      next === "home" ? location.pathname : `#${next}`,
    );
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {mode === "home" ? (
          <Home choose={choose} />
        ) : (
          <Workspace
            mode={mode}
            exit={() => choose("home")}
            startFresh={mode === "buyer" && startFreshBuyer}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
