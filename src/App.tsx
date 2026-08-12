import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
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
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { catalogSets, productsForSet } from "./data/catalog";
import { evaluateBreakAnalysis } from "./data/evaluate";
import type { BreakAnalysis } from "./data/evaluate";
import { sealedMarketPrice } from "./data/sealed-prices";
import { assignSlot, createAuction, undoAssignment } from "./domain/auction";
import type { AuctionState } from "./domain/auction";
import { decodeLegacySearch, encodeComposition } from "./domain/legacy";
import {
  calculateProfit,
  requiredHammer,
  WHATNOT_US,
} from "./domain/marketplace";
import { buyerVerdict } from "./domain/valuation";
import { simulateOutcomesAsync } from "./domain/simulation-client";
import type { DistributionSummary, SimulationResult } from "./domain/simulation";
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
import { layoutChaseTargets } from "./constellation-layout";

type Mode = "home" | "buyer" | "seller";
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const fmt = (value: number | undefined) =>
  value == null ? "—" : money.format(value);
const oddsLabel = (probability: number) =>
  probability >= 0.9995
    ? "100%"
    : probability > 0
      ? `${(probability * 100).toFixed(probability < 0.01 ? 2 : 1)}%`
      : "0%";

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

function countedMarketLabel(row: Contributor): string {
  const labels: string[] = [];
  const nonfoilCopies = row.sellableCopies - row.sellableFoilCopies;
  if (nonfoilCopies > 0 && row.card.nonfoil != null) {
    labels.push(`${fmt(row.card.nonfoil)} nonfoil`);
  }
  if (row.sellableFoilCopies > 0 && row.card.foil != null) {
    labels.push(`${fmt(row.card.foil)} foil`);
  }
  return labels.join(" / ") || "Price unavailable";
}

function NumericInput({
  value,
  onCommit,
  placeholder = "0",
  disabled = false,
  ariaLabel,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
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
        if (/^\d*(?:[.,]\d*)?$/.test(next)) setDraft(next);
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
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  prefix?: string;
  hint?: string;
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
          value={value}
          placeholder="0"
          onCommit={onChange}
          ariaLabel={label}
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

function SectionLabel({ children, text }: { children: ReactNode; text: string }) {
  return (
    <p className="section-label">
      <span>{children}</span>
      <Tip text={text} />
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
  help: string;
  title: ReactNode;
  accessory?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="panel-heading">
      <SectionLabel text={help}>{label}</SectionLabel>
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
          : "Some product information is missing. Open Data confidence to see what is affected."}
      label={`Explain ${result.status} data status`}
    >
      {icon}
      <span>{result.status}</span>
    </Tip>
  );
}

function Home({ choose }: { choose: (mode: Mode) => void }) {
  const supportUrl = import.meta.env.VITE_SUPPORT_URL as string | undefined;
  return (
    <main className="home page">
      <div className="brand">
        <span className="brand-mark">
          <Sparkles />
        </span>
        <span>COLORBREAK</span>
      </div>
      <section className="hero">
        <p className="eyebrow">MTG COLOR BREAK INTELLIGENCE</p>
        <h1>
          Know the break.
          <br />
          <em>Make the call.</em>
        </h1>
        <p>
          Accurate product contents, color-slot value, and real marketplace
          economics—without the spreadsheet.
        </p>
      </section>
      <section className="mode-grid">
        <button
          className="mode-card buyer-card"
          onClick={() => choose("buyer")}
        >
          <span className="mode-icon">
            <DollarSign />
          </span>
          <span>
            <small>LIVE AUCTION</small>
            <strong>Check a bid</strong>
            <p>See what a slot is worth before the clock runs out.</p>
          </span>
          <ChevronRight />
        </button>
        <button
          className="mode-card seller-card"
          onClick={() => choose("seller")}
        >
          <span className="mode-icon">
            <Store />
          </span>
          <span>
            <small>BREAK PLANNING</small>
            <strong>Build & price</strong>
            <p>Set profitable asks with fees, packing, and shipping included.</p>
          </span>
          <ChevronRight />
        </button>
      </section>
      <p className="source-note">
        Prices by Scryfall · Product data by MTGJSON · No login required
      </p>
      <p className="source-note source-links">
        <a href="/methodology.html">Methodology</a> ·{" "}
        <a href="/privacy.html">Privacy</a>
        {supportUrl && (
          <>
            {" "}·{" "}
            <a href={supportUrl} rel="noreferrer" target="_blank">
              Support ColorBreak
            </a>
          </>
        )}
      </p>
    </main>
  );
}

function Builder({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (line: BreakLine) => void;
}) {
  const [sets, setSets] = useState<SetChoice[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SetChoice>();
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (open)
      catalogSets().then((rows) =>
        setSets(rows.sort((a, b) => b.released.localeCompare(a.released))),
      );
  }, [open]);
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    productsForSet(selected.code)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [selected]);
  useEffect(() => {
    if (!open) {
      setSelected(undefined);
      setQuery("");
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = [...document.querySelectorAll<HTMLElement>(
        ".sheet button:not(:disabled), .sheet input:not(:disabled), .sheet [tabindex='0']",
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  const visible = sets
    .filter((set) =>
      `${set.name} ${set.code}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, query ? 20 : 8);
  const add = (product: ProductChoice) => {
    onAdd({
      id: crypto.randomUUID(),
      set: product.set,
      productKey: product.sealedKey
        ? `sealed:${product.sealedKey}`
        : product.key,
      productLabel: product.label,
      quantity: 1,
      packCount: product.packCount,
      tcgId: product.tcgId,
    });
    onClose();
  };
  const groupedProducts = products.reduce<Record<string, ProductChoice[]>>(
    (groups, product) => {
      (groups[product.category] ??= []).push(product);
      return groups;
    },
    {},
  );
  return (
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
                className="icon-button"
                onClick={selected ? () => setSelected(undefined) : onClose}
                aria-label={selected ? "Back" : "Close"}
              >
                {selected ? <ArrowLeft /> : <X />}
              </button>
              <div>
                <small>ADD TO BREAK</small>
                <h2>{selected ? selected.name : "Choose a set"}</h2>
              </div>
            </header>
            {!selected ? (
              <>
                <label className="search">
                  <Search />
                  <input
                    autoFocus
                    placeholder="Search sets…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <p className="section-label">
                  {query ? "RESULTS" : "RECENT SETS"}
                </p>
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
                {loading ? (
                  <div className="loader">
                    <span />
                    Resolving exact products…
                  </div>
                ) : (
                  <div className="product-groups">
                    {Object.entries(groupedProducts).map(([category, rows]) => (
                      <section key={category}>
                        <p className="section-label">
                          {category.toUpperCase()}
                        </p>
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
                                {product.status}
                              </small>
                            </span>
                            <ChevronRight />
                          </button>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
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
        <PackagePlus size={18} /> Add a product
      </button>
    </section>
  );
}

export function Composition({
  lines,
  add,
  update,
  remove,
}: {
  lines: BreakLine[];
  add: () => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
}) {
  return (
    <section className="composition panel">
      <PanelHeading
        label="BREAK"
        help="The sealed products and quantities being opened in this break. Changing any line immediately recalculates card contents, prices, color value, and possible opening values."
        title={<>{lines.length} product{lines.length === 1 ? "" : "s"}</>}
        accessory={<button className="quiet" onClick={add}>
          <PackagePlus /> Add
        </button>}
      />
      {lines.map((line) => (
        <div className="line" key={line.id}>
          <span className="set-glyph">{line.set}</span>
          <span>
            <strong>{line.productLabel}</strong>
            <small>{line.set}</small>
          </span>
          <div className="line-controls">
            <div className="stepper" aria-label={`${line.productLabel} quantity`}>
              <button
                disabled={line.quantity <= 1}
                aria-label={`Decrease ${line.productLabel} quantity`}
                onClick={() =>
                  update(line.id, { quantity: Math.max(1, line.quantity - 1) })
                }
              >
                −
              </button>
              <b>{line.quantity}</b>
              <button
                aria-label={`Increase ${line.productLabel} quantity`}
                onClick={() => update(line.id, { quantity: line.quantity + 1 })}
              >
                +
              </button>
            </div>
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
      ))}
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
      {result.omissions.length > 0 && (
        <details className="notice">
          <summary>
            {result.omissions.length} data note
            {result.omissions.length === 1 ? "" : "s"}
          </summary>
          {result.omissions.slice(0, 8).map((item, i) => (
            <p key={`${item.code}${i}`}>{item.message}</p>
          ))}
        </details>
      )}
    </section>
  );
}

function SlotRail({
  result,
  selected,
  setSelected,
}: {
  result: ValuationResult;
  selected: SlotId;
  setSelected: (id: SlotId) => void;
}) {
  return (
    <section className="slot-browser">
      <div className="slot-browser-heading">
        <span>Inspect a color slot</span>
        <Tip text="Choose a color to update the card-level views below. These buttons inspect a slot; they do not remove it from the remaining random-assignment pool." />
      </div>
      <div className="slot-rail" role="tablist" aria-label="Color slots">
        {result.slots.map((slot) => (
          <button
            role="tab"
            aria-selected={selected === slot.id}
            aria-label={`${slot.name} slot`}
            className={`slot slot-${slot.id} ${selected === slot.id ? "active" : ""}`}
            key={slot.id}
            onClick={() => setSelected(slot.id)}
          >
            <span>{slot.id}</span>
            <b>{fmt(slot.sellableEV)}</b>
          </button>
        ))}
      </div>
    </section>
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

  useEffect(() => {
    if (!row) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], [tabindex='0']",
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    };
  }, [row, onClose]);

  const affiliateTemplate = import.meta.env.VITE_TCGPLAYER_AFFILIATE_URL as
    | string
    | undefined;
  const affiliateUrl = row
    ? affiliateTemplate?.replace("{card}", encodeURIComponent(row.card.name))
    : undefined;
  const odds = row?.sellablePullProbability ?? 0;
  return (
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
                <p className="section-label">CARD DETAILS</p>
                <h2 id="card-inspector-title">{row.card.name}</h2>
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
                {row.card.image ? (
                  <img src={row.card.image} alt={`${row.card.name} card`} />
                ) : (
                  <span>Image unavailable</span>
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
                {row.card.oracleText && (
                  <p className="oracle-text">{row.card.oracleText}</p>
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
    </AnimatePresence>
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
    if (analysis.outcomeModel.complete === false || analysis.valuation.status === "incomplete") {
      setState({ busy: false, error: "Outcome distribution withheld because material model inputs are unresolved." });
      return () => { current = false; };
    }
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

function OutcomeRange({ summary, landed }: { summary?: DistributionSummary; landed?: number }) {
  if (!summary) return <div className="distribution-empty">Distribution unavailable until every material input is resolved.</div>;
  const chanceToClear = landed == null
    ? undefined
    : summary.chanceToClearCost ?? summary.fingerprint.filter((value) => value >= landed).length / summary.fingerprint.length;
  return (
    <div className="outcome-range" aria-label="Possible opening values">
      <div className="outcome-range-heading">
        <span>Possible opening values</span>
        <Tip text="Shows a lower result, a middle result, and a higher result across many simulated openings. These are examples of the range you could see, not a prediction of the next opening." />
      </div>
      <div className="outcome-landmarks">
        <div>
          <span>Lower result</span>
          <b>{fmt(summary.p10)}</b>
          <small>About 1 in 10 openings are worth this or less</small>
        </div>
        <div className="typical">
          <span>Typical result</span>
          <b>{fmt(summary.median)}</b>
          <small>About half are worth less and half are worth more</small>
        </div>
        <div>
          <span>Higher result</span>
          <b>{fmt(summary.p90)}</b>
          <small>About 1 in 10 openings are worth this or more</small>
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
      <p>Possible results from simulations—not a prediction of the next opening.</p>
    </div>
  );
}

export function BreakBalance({
  result, simulation, remaining,
}: {
  result: ValuationResult;
  simulation?: SimulationResult;
  remaining: SlotId[];
}) {
  const rows = result.slots.filter((slot) => remaining.includes(slot.id));
  const equalShare = rows.length ? rows.reduce((sum, slot) => sum + slot.sellableEV, 0) / rows.length : 0;
  const max = Math.max(equalShare, ...rows.map((slot) => simulation?.slotDistributions[slot.id].p90 ?? slot.sellableEV), 1);
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
  return (
    <section className="panel balance-panel">
      <PanelHeading
        label="BREAK BALANCE"
        help="Compares the remaining color slots even though each is equally likely to be assigned. Taller bars mean a higher middle result; the thin lines show how high the value can reach in stronger openings."
        title="Equal chance, unequal pools"
        accessory={balanceTip}
      />
      <p className="balance-note">Each remaining slot is equally likely. The card value assigned to each slot is not equal.</p>
      <div className="balance-chart" style={{ "--equal": `${equalShare / max * 100}%` } as CSSProperties}>
        {rows.map((slot) => {
          const distribution = simulation?.slotDistributions[slot.id];
          const value = slot.sellableEV;
          const rangeLow = distribution?.p10 ?? 0;
          const rangeHigh = distribution?.p90 ?? value;
          return (
            <div className={`balance-column slot-${slot.id}`} key={slot.id}>
              <span className="balance-whisker" style={{ bottom: `${(rangeLow / max) * 100}%`, height: `${(Math.max(0, rangeHigh - rangeLow) / max) * 100}%` }} />
              <span className="balance-bar" style={{ height: `${(value / max) * 100}%` }} />
              <b>{slot.id}</b>
              <small>{fmt(value)}</small>
            </div>
          );
        })}
      </div>
      <p className="balance-caption">Bars match each color's average card value below. Thin lines show the modeled lower-to-higher range. The dashed line shows an even split: {fmt(equalShare)}.</p>
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
  useEffect(() => {
    if (!item) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    };
  }, [item, onClose]);
  if (!item) return null;
  return createPortal(
    <div className="scrim evidence-scrim" onPointerDown={onClose}>
      <section className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="section-label">WHY THIS MATTERS</p><h2 id="evidence-dialog-title">{item.title}</h2></div>
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
      action: "Use the result normally when this is ready. When items are missing, treat the shown value as incomplete and read the named data notes.",
    },
    {
      title: "Pack chances",
      status: plainEvidence(valuation.evidence.collation),
      meaning: "A pack is not filled by picking every card equally. This check describes how often each kind of card can appear.",
      matters: "These chances power the pull odds, typical outcome, and high and low ranges. Bad pack chances can make a correct price produce a wrong answer.",
      action: "When this is uncertain, ColorBreak hides probability-based guidance. Base a decision only on information that remains clearly available.",
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
    <details className="panel evidence-lens">
      <summary>
        <span><ShieldAlert /><b>Data confidence</b><small>{analysis.outcomeModel.complete === false ? "Some missing data prevents a full answer" : "All key information is ready"}</small></span>
        <span className="summary-help"><span>{ageHours == null ? "Price time unknown" : `Prices ${ageHours < 1 ? "<1" : Math.round(ageHours)}h old`}</span><Tip text="Shows which product details were checked and which are still missing. ColorBreak hides outcome ranges when missing information could change the answer." /></span>
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

function ChaseConstellation({
  slot,
  onInspect,
}: {
  slot: SlotValuation;
  onInspect: (row: Contributor) => void;
}) {
  const rows = slot.contributors.slice(0, 12);
  const maxPrice = Math.max(1, ...rows.map((row) => row.marketValue / Math.max(row.copies, .0001)));
  const maxContribution = Math.max(1, ...rows.map((row) => row.sellableValue));
  const rowById = new Map(rows.map((row) => [row.card.id, row]));
  const layout = layoutChaseTargets(rows.map((row) => {
    const price = row.marketValue / Math.max(row.copies, .0001);
    return {
      id: row.card.id,
      x: 22 + row.sellablePullProbability * 56,
      y: 79 - price / maxPrice * 58,
    };
  }));
  return (
    <details className="panel supporting-view">
      <summary><span><b>Chase Map</b><small>Card price vs. chance of pulling it</small></span><span className="summary-help"><span>{SLOT_NAMES[slot.id]}</span><Tip text="Each glowing point is a card's exact price and pull chance. Follow its line to the card image around the graph, then tap the image for full details." /></span></summary>
      {!rows.length ? <p className="supporting-empty">No cards meet the current bulk boundary.</p> : (
        <div className="constellation chase-map" aria-label={`${SLOT_NAMES[slot.id]} card price and pull chance map`}>
          <div className="chase-plot" aria-hidden="true">
            <span className="plot-y-title">MARKET PRICE</span>
            <span className="plot-x-title">CHANCE TO PULL</span>
            <span className="plot-price plot-price-high">{fmt(maxPrice)}</span>
            <span className="plot-price plot-price-mid">{fmt(maxPrice / 2)}</span>
            <span className="plot-price plot-price-low">$0</span>
            <span className="plot-odds plot-odds-low">0%</span>
            <span className="plot-odds plot-odds-mid">50%</span>
            <span className="plot-odds plot-odds-high">100%</span>
          </div>
          <svg className="chase-pointers" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {layout.map((point) => {
              const row = rowById.get(point.id)!;
              const radius = 1.1 + Math.sqrt(row.sellableValue / maxContribution) * 1.8;
              return (
                <g key={point.id}>
                  <polyline points={`${point.x},${point.y} ${point.exitX},${point.exitY} ${point.targetX},${point.targetY}`} />
                  <circle cx={point.x} cy={point.y} r={radius} />
                </g>
              );
            })}
          </svg>
          {layout.map((point) => {
            const row = rowById.get(point.id)!;
            const price = row.marketValue / Math.max(row.copies, .0001);
            return (
              <button
                className="chase-target"
                key={row.card.id}
                style={{ left: `${point.targetX}%`, top: `${point.targetY}%` }}
                onClick={() => onInspect(row)}
                aria-label={`${row.card.name}: ${oddsLabel(row.sellablePullProbability)} pull chance, ${fmt(price)} market price, adds ${fmt(row.sellableValue)} to the average`}
                title={row.card.name}
              >
                {row.card.image ? <img src={row.card.image} alt="" loading="lazy" /> : <span>{row.card.name.slice(0, 1)}</span>}
                <i>{oddsLabel(row.sellablePullProbability)}</i>
              </button>
            );
          })}
        </div>
      )}
      <p className="supporting-warning">Top-right cards combine the highest price with the best pull chance. Tap any card image to inspect its price, odds, and printing.</p>
    </details>
  );
}

export function BulkFilterControl({
  enabled,
  threshold,
  result,
  onToggle,
  onThreshold,
}: {
  enabled: boolean;
  threshold: number;
  result?: ValuationResult;
  onToggle: (enabled: boolean) => void;
  onThreshold: (threshold: number) => void;
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
        <Tip className="bulk-filter-help" text={explanation} label="Explain the current bulk filter setting" />
      </div>
      <details className="bulk-filter-details">
        <summary><span>See what the filter changes</span><ChevronRight /></summary>
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
      </details>
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
      {row.card.name.slice(0, 1)}
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
        <span>Card and market price</span>
        <span>Pull odds</span>
        <span>Adds to average</span>
      </div>
      {slot.contributors.slice(0, limit).map((row) => (
        <button
          type="button"
          className="card-row contributor-card"
          key={row.card.id}
          onClick={() => onInspect(row)}
          aria-label={`Open ${row.card.name}: ${oddsLabel(row.sellablePullProbability)} pull odds, ${countedMarketLabel(row)} market price, adds ${fmt(row.sellableValue)} to the average`}
        >
          <CardThumbnail row={row} />
          <span className="card-summary">
            <strong>{row.card.name}</strong>
            <small>{countedMarketLabel(row)} market</small>
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
        <summary>
          <span>
            Cards adding the most value
            <small>Largest effect on the average first</small>
          </span>
        </summary>
        <ContributorRows slot={slot} onInspect={onInspect} />
      </details>
    </section>
  );
}

export function BuyerView({
  analysis,
  auction,
  setAuction,
  selected,
  setSelected,
}: {
  analysis: BreakAnalysis;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
  selected: SlotId;
  setSelected: (slot: SlotId) => void;
}) {
  const result = analysis.valuation;
  const [assignmentMode, setAssignmentMode] = useState<"random" | "pick">("pick");
  const [bid, setBid] = useState<number>();
  const [shipping, setShipping] = useState<number>();
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const slot = result.slots.find((row) => row.id === selected)!;
  const landed = (bid ?? 0) + (shipping ?? 0);
  const simulation = useOutcomeSimulation(analysis, auction.remaining, bid == null ? undefined : landed);
  const distribution = assignmentMode === "random"
    ? simulation.result?.remainingPool
    : simulation.result?.slotDistributions[selected];
  const fallbackMean = assignmentMode === "random"
    ? result.slots.filter((row) => auction.remaining.includes(row.id)).reduce((sum, row) => sum + row.sellableEV, 0) / Math.max(1, auction.remaining.length)
    : slot.sellableEV;
  const decision = bid == null ? "ENTER BID"
    : result.status === "incomplete" ? "NO VERDICT"
      : distribution?.chanceToClearCost == null
        ? buyerVerdict(slot, landed, result.status)
        : distribution.chanceToClearCost >= .6 ? "MORE CONSERVATIVE"
          : distribution.chanceToClearCost >= .4 ? "HIGHER RISK" : "CHASE-ORIENTED";
  return (
    <>
      <section
        className={`verdict panel verdict-${decision.replace(/[^A-Z]/g, "").toLowerCase()}`}
      >
        <div className="assignment-toggle" role="group" aria-label="Break assignment mode">
          <button className={assignmentMode === "random" ? "active" : ""} onClick={() => setAssignmentMode("random")}>Random remaining slot</button>
          <button className={assignmentMode === "pick" ? "active" : ""} onClick={() => setAssignmentMode("pick")}>I pick my color</button>
        </div>
        <div className="verdict-head">
          <div>
            <SectionLabel text={assignmentMode === "random"
              ? "The next buyer is assigned one of these remaining color slots at random. Enter the current bid to compare your total cost with all the ways the remaining slots could turn out."
              : "Pick My Color evaluates only the selected color slot instead of averaging across a random assignment from the remaining pool."}
            >
              {assignmentMode === "random" ? `${auction.remaining.length} RANDOM SLOTS REMAIN` : `${SLOT_NAMES[selected].toUpperCase()} SLOT`}
            </SectionLabel>
            <h2>{decision}</h2>
          </div>
          <div className="ev-orb">
            <small>TYPICAL CARD VALUE <Tip text="The middle result across many simulated openings: about half are worth less and half are worth more. The average below it can be pulled upward by rare expensive cards." /></small>
            <strong>{fmt(distribution?.median ?? fallbackMean)}</strong>
            <span>Average {fmt(distribution?.mean ?? fallbackMean)}</span>
          </div>
        </div>
        <div className="bid-inputs">
          <NumberField label="Current bid" value={bid} onChange={setBid} />
          <NumberField
            label="Your added shipping"
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
        <OutcomeRange summary={distribution} landed={bid == null ? undefined : landed} />
        {simulation.busy && <p className="simulation-state">Checking more possible openings…</p>}
        {simulation.error && <p className="blocked"><ShieldAlert />{simulation.error}</p>}
        {result.status === "incomplete" && (
          <p className="blocked">
            <ShieldAlert /> Verdict withheld. {result.statusReason}
          </p>
        )}
      </section>
      {assignmentMode === "random" && (
        <section className="panel assignment-panel">
          <PanelHeading
            label="AFTER EACH AUCTION"
            help="After Whatnot reveals which color the buyer received, tap that matching circle once. ColorBreak removes it from the random pool and recalculates the next auction. Dimmed circles are already assigned; Undo restores the most recent one."
            title="Tap the assigned slot"
            accessory={<button className="quiet" disabled={!auction.assignments.length} onClick={() => setAuction(undoAssignment(auction))}>Undo</button>}
          />
          <div className="assignment-slots">
            {SLOT_IDS.map((id) => (
              <button
                key={id}
                className={`slot-${id}`}
                disabled={!auction.remaining.includes(id) || auction.remaining.length === 1}
                onClick={() => {
                  const next = assignSlot(auction, id);
                  setAuction(next);
                  track("slot_assigned", { remainingCount: next.remaining.length });
                }}
                aria-label={`Mark ${SLOT_NAMES[id]} assigned`}
              ><span>{id}</span><small>{SLOT_NAMES[id]}</small></button>
            ))}
          </div>
          {auction.remaining.length === 1 && <p className="last-slot">Final slot: {SLOT_NAMES[auction.remaining[0]]}. No assignment tap needed.</p>}
        </section>
      )}
      <BreakBalance result={result} simulation={simulation.result} remaining={auction.remaining} />
      <EvidenceLens analysis={analysis} />
        <SlotRail result={result} selected={selected} setSelected={(slotId) => { setSelected(slotId); setAssignmentMode("pick"); }} />
      <ChaseConstellation slot={slot} onInspect={setInspectedCard} />
      <SlotValueDetails
        slot={slot}
        threshold={result.threshold}
        onInspect={setInspectedCard}
      />
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
    <span className={`range-candle ${bonus ? "bonus" : "base"}`} aria-label={`${bonus ? "With bonus" : "Current"}: ${fmt(summary.min)} lowest, ${fmt(summary.median)} typical, ${fmt(summary.max)} highest modeled`}>
      <i className="candle-wick" style={{ bottom: pct(summary.min), height: pct(summary.max - summary.min) }} />
      <i className="candle-body" style={{ bottom: pct(summary.p25), height: pct(Math.max(.01, summary.p75 - summary.p25)) }} />
      <i className="candle-median" style={{ bottom: pct(summary.median) }} />
    </span>
  );
}

function monotoneBonus(before: DistributionSummary, sampledAfter: DistributionSummary): DistributionSummary {
  return {
    ...sampledAfter,
    min: Math.max(before.min, sampledAfter.min),
    p10: Math.max(before.p10, sampledAfter.p10),
    p25: Math.max(before.p25, sampledAfter.p25),
    median: Math.max(before.median, sampledAfter.median),
    p75: Math.max(before.p75, sampledAfter.p75),
    p90: Math.max(before.p90, sampledAfter.p90),
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
    <div className="distribution-unavailable" role="status">
      <b>Pull ranges unavailable</b>
      <span>{bonusSimulation.error ?? baseSimulation.error}</span>
      <small>The buyer-value and seller-profit calculations above are still available.</small>
    </div>
  );
  if (!baseSimulation.result || !bonusSimulation.result) return <p className="calculating"><span />Building pull ranges…</p>;
  const selectedBefore = useRandom ? baseSimulation.result.remainingPool : baseSimulation.result.slotDistributions[selectedSlot];
  const selectedAfter = monotoneBonus(selectedBefore, useRandom ? bonusSimulation.result.remainingPool : bonusSimulation.result.slotDistributions[selectedSlot]);
  const rows = SLOT_IDS.map((id) => {
    const before = baseSimulation.result!.slotDistributions[id];
    const after = monotoneBonus(before, bonusSimulation.result!.slotDistributions[id]);
    return { id, before, after, lift: after.max - before.max };
  }).sort((a, b) => b.lift - a.lift);
  // The two configuration candles answer the selected buyer's question and need
  // their own scale. A chase-heavy color must not flatten an unrelated selection.
  const scenarioMaximum = Math.max(1, selectedAfter.max);
  const colorMaximum = Math.max(1, ...rows.map((row) => row.after.max));
  return (
    <div className="upside-chart">
      <div className="upside-callout">
        <span>MODELED BUYER CEILING</span>
        <b>+{fmt(selectedAfter.max - selectedBefore.max)}</b>
        <small>{useRandom ? "Random slot" : SLOT_NAMES[selectedSlot]} typical result changes {fmt(selectedBefore.median)} → {fmt(selectedAfter.median)}</small>
        <small>At {fmt(buyerLanded)} landed: {Math.round((selectedBefore.chanceToClearCost ?? 0) * 100)}% → {Math.round((selectedAfter.chanceToClearCost ?? 0) * 100)}% of modeled openings cover buyer cost</small>
      </div>
      <div className="scenario-candles" aria-label="Buyer value range by break configuration">
        <div className="scenario-candle-column"><div><RangeCandle summary={selectedBefore} max={scenarioMaximum} /></div><b>Current break</b><small>Ceiling {fmt(selectedBefore.max)}</small></div>
        <div className="scenario-candle-column"><div><RangeCandle summary={selectedAfter} max={scenarioMaximum} bonus /></div><b>+ {bonusLabel}</b><small>Ceiling {fmt(selectedAfter.max)}</small></div>
      </div>
      <p className="x-axis-note"><b>X-axis:</b> break configuration · <b>Y-axis:</b> {useRandom ? "card value received by a random slot" : `${SLOT_NAMES[selectedSlot]} card value`}</p>
      <h3>Which colors gain the most upside?</h3>
      <div className="upside-legend"><span><i className="base" />Current</span><span><i className="bonus" />With bonus</span></div>
      <div className="candle-grid">{rows.map(({ id, before, after, lift }) => (
        <button type="button" className={`candle-column ${!useRandom && selectedSlot === id ? "active" : ""}`} key={id} onClick={() => selectSlot(id)}>
          <div className="candle-pair"><RangeCandle summary={before} max={colorMaximum} /><RangeCandle summary={after} max={colorMaximum} bonus /></div>
          <b>{id}</b><small>+{fmt(lift)} ceiling</small>
        </button>
      ))}</div>
      <p>Thin line: lowest to highest modeled pull · solid body: middle half · center mark: typical result. Rare best cases are possible, not promised.</p>
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
      <p className="scenario-policy-note"><ShieldAlert />The economics below can model a sales threshold. Whatnot export remains unavailable unless the seller has written approval; a pack disclosed and included before sales does not need that threshold mechanic.</p>
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

export function SellerView({
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
  const targetProfit = (acquisition * margin) / 100;
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
  const target = requiredHammer(
    soldIds.length,
    (packing + covered) * shipmentCount,
    acquisition,
    targetProfit,
    buyerShip,
    marketplace,
  );
  const breakEven = requiredHammer(
    soldIds.length,
    (packing + covered) * shipmentCount,
    acquisition,
    0,
    buyerShip,
    marketplace,
  );
  const asks = allocate(result, target, minimum, locked, unsold);
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
          acquisition,
          marketplace,
        )
      : undefined;
  return (
    <>
      <section className="panel seller-plan">
        <PanelHeading
          label="PROFIT PLAN"
          help="Break-even is the total slot revenue needed to repay product cost, platform fees, packing, and shipping you cover. The sales goal adds your chosen profit margin."
          title={costsComplete ? <>{fmt(breakEven)} break-even</> : "Waiting for a product price"}
          accessory={<Tip className="market-badge" text="The fee settings used for each sale. You can edit them below when another marketplace charges different fees." label={`Explain the ${marketplace.name} marketplace preset`}>
            <Store />
            {marketplace.name}
          </Tip>}
        />
        {costsComplete && (
          <div className="profit-plan-summary">
            <div><span>Buyer card value</span><b>{fmt(result.sellableEV)}</b></div>
            <div><span>Product cost used</span><b>{fmt(acquisition)}</b></div>
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
        </div>
        <details className="fee-settings">
          <summary>Marketplace fee assumptions</summary>
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
          acquisition={acquisition}
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
            <SectionLabel text="Shows what you would keep after the entered sale prices, fees, product costs, packing, and shipping you cover.">
              ACTUAL OUTCOME
            </SectionLabel>
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

function storedLines(
  mode: "buyer" | "seller",
  legacy: BreakLine[],
): BreakLine[] {
  if (legacy.length) return legacy;
  try {
    return JSON.parse(
      localStorage.getItem(`colorbreak:${mode}:lines`) ?? "[]",
    ) as BreakLine[];
  } catch {
    return [];
  }
}

function Workspace({
  mode,
  exit,
}: {
  mode: "buyer" | "seller";
  exit: () => void;
}) {
  const legacy = useMemo(() => decodeLegacySearch(location.search), []);
  const firstResultTracked = useRef(false);
  const calculationStarted = useRef(Date.now());
  const [lines, setLines] = useState<BreakLine[]>(() =>
      storedLines(mode, legacy),
    ),
    [builder, setBuilder] = useState(false),
    [analysis, setAnalysis] = useState<BreakAnalysis>(),
    [auction, setAuction] = useState<AuctionState>(() => {
      const shared = new URLSearchParams(location.search).get("r");
      const remaining = shared?.split("").filter((slot): slot is SlotId => SLOT_IDS.includes(slot as SlotId));
      return remaining?.length ? createAuction(remaining) : createAuction();
    }),
    [error, setError] = useState<string>(),
    [bulkThreshold, setBulkThreshold] = useState(2),
    [bulkEnabled, setBulkEnabled] = useState(true),
    [selectedSlot, setSelectedSlot] = useState<SlotId>(() => {
      const shared = new URLSearchParams(location.search).get("s") as SlotId | null;
      return shared && SLOT_IDS.includes(shared) ? shared : "W";
    }),
    [busy, setBusy] = useState(false);
  const threshold = bulkEnabled ? bulkThreshold : 0;
  useEffect(() => {
    try {
      localStorage.setItem(`colorbreak:${mode}:lines`, JSON.stringify(lines));
    } catch {
      /* persistence is optional */
    }
  }, [lines, mode]);
  useEffect(() => {
    try { localStorage.setItem("colorbreak:buyer:auction", JSON.stringify(auction)); } catch { /* optional */ }
  }, [auction]);
  useEffect(() => {
    if (!lines.length) {
      setAnalysis(undefined);
      return;
    }
    setBusy(true);
    calculationStarted.current = Date.now();
    setError(undefined);
    evaluateBreakAnalysis(lines, threshold)
      .then((next) => {
        setAnalysis(next);
        if (!firstResultTracked.current) {
          const elapsed = Date.now() - calculationStarted.current;
          track("first_result", {
            mode,
            productCount: lines.length,
            durationBucket: elapsed < 10_000 ? "under-10s" : "10s-plus",
            status: next.valuation.status,
          });
          firstResultTracked.current = true;
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        track("calculation_error", { mode, stage: "evaluate", code: "evaluation-failed" });
      })
      .finally(() => setBusy(false));
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
  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set("b", encodeComposition(lines));
    url.searchParams.set("s", selectedSlot);
    if (mode === "buyer") url.searchParams.set("r", auction.remaining.join(""));
    await navigator.clipboard.writeText(url.toString());
    track("break_shared", { mode, productCount: lines.length, remainingCount: auction.remaining.length });
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
          <button
            className="icon-button"
            onClick={share}
            title="Copy public break link"
          >
            <Copy />
          </button>
          {mode === "buyer" && (
            <button
              className="icon-button"
              onClick={() => setBuilder(true)}
              title="Add product"
            >
              <PackagePlus />
            </button>
          )}
        </div>
      </nav>
      <main className="workspace page">
        <header className="workspace-title">
          <div>
            <p className="eyebrow">
              {mode === "buyer" ? "LIVE AUCTION" : "BREAK PLANNING"}
            </p>
            <h1>{mode === "buyer" ? "Check a bid" : "Build & price"}</h1>
          </div>
        </header>
        {lines.length > 0 && (
          <BulkFilterControl
            enabled={bulkEnabled}
            threshold={bulkThreshold}
            result={analysis?.valuation}
            onToggle={setBulkEnabled}
            onThreshold={setBulkThreshold}
          />
        )}
        {!lines.length ? (
          <EmptyBreak add={() => setBuilder(true)} />
        ) : (
          <div className="workspace-grid">
            <aside>
              <Composition
                lines={lines}
                add={() => setBuilder(true)}
                update={update}
                remove={(id) =>
                  setLines((rows) => rows.filter((r) => r.id !== id))
                }
              />
            </aside>
            <div className="results">
              {busy && (
                <div className="calculating">
                  <span />
                  Calculating exact contents and prices…
                </div>
              )}
              {error && (
                <div className="error">
                  <ShieldAlert />
                  {error}
                </div>
              )}
              {analysis && !busy && (
                <>
                  {mode === "buyer" ? (
                    <><ValueSummary result={analysis.valuation} /><BuyerView analysis={analysis} auction={auction} setAuction={setAuction} selected={selectedSlot} setSelected={setSelectedSlot} /></>
                  ) : (
                    <SellerView analysis={analysis} lines={lines} update={update} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Builder
        open={builder}
        onClose={() => setBuilder(false)}
        onAdd={(line) => {
          setLines((rows) => [...rows, line]);
          track("break_created", { mode, productCount: lines.length + 1 });
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
  const choose = (next: Mode) => {
    setMode(next);
    history.replaceState(
      null,
      "",
      next === "home" ? location.pathname : `#${next}`,
    );
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
          <Workspace mode={mode} exit={() => choose("home")} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
