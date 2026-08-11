import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
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
  Settings2,
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
import { assignSlot, createAuction, undoAssignment } from "./domain/auction";
import type { AuctionState } from "./domain/auction";
import { canExportScenario, WHATNOT_ENTICEMENTS } from "./domain/compliance";
import type { EnticementScenario } from "./domain/compliance";
import { scenarioEconomics } from "./domain/enticement";
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
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
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
      onChange={(event) => {
        const next = event.target.value;
        if (/^\d*(?:[.,]\d*)?$/.test(next)) setDraft(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
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
        />
      </div>
    </label>
  );
}

export function Tip({ text }: { text: string }) {
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
        className="tip"
        role="button"
        tabIndex={0}
        aria-label={text}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (
            event.pointerType === "mouse" &&
            document.activeElement !== anchorRef.current
          ) setOpen(false);
        }}
        onBlur={() => setOpen(false)}
      >
        <CircleHelp size={14} />
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

function Status({ result }: { result: ValuationResult }) {
  const icon =
    result.status === "incomplete" ? (
      <ShieldAlert size={16} />
    ) : (
      <BadgeCheck size={16} />
    );
  return (
    <span className={`status ${result.status}`}>
      {icon}
      <span>{result.status}</span>
      <Tip text={result.statusReason} />
    </span>
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
            <p>Set profitable asks with fees and fulfillment included.</p>
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
      <header>
        <div>
          <p className="section-label">BREAK</p>
          <h2>
            {lines.length} product{lines.length === 1 ? "" : "s"}
          </h2>
        </div>
        <button className="quiet" onClick={add}>
          <PackagePlus /> Add
        </button>
      </header>
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
      <header>
        <div>
          <p className="section-label">BREAK EV AFTER BULK FILTER</p>
          <h2>{fmt(result.sellableEV)}</h2>
        </div>
        <Status result={result} />
      </header>
      <div className="metric-row">
        <div>
          <span>
            Raw modeled EV
            <Tip text={`Expected value from every priced card before applying the ${fmt(result.threshold)} bulk filter. This number is shown for reconciliation only; ColorBreak uses the ${fmt(result.sellableEV)} counted EV for decisions.`} />
          </span>
          <b>{fmt(result.marketEV)}</b>
        </div>
        <div>
          <span>
            Bulk excluded
            <Tip text={`Cards priced below ${fmt(result.threshold)} contribute ${fmt(ignoredEV)} of raw modeled EV, but ColorBreak excludes that amount from decisions. Counted EV (${fmt(result.sellableEV)}) plus bulk excluded (${fmt(ignoredEV)}) equals raw modeled EV (${fmt(result.marketEV)}). This is a reconciliation—not a loss or negative value.`} />
          </span>
          <b>{fmt(ignoredEV)}</b>
        </div>
        <div>
          <span>
            Printings counted
            <Tip text={`Distinct card printings with a qualifying ${fmt(result.threshold)}+ finish in this break.`} />
          </span>
          <b>{countedCards}</b>
        </div>
      </div>
      <p className="value-equation">
        <span>{fmt(result.marketEV)} raw</span>
        <b>−</b>
        <span>{fmt(ignoredEV)} bulk</span>
        <b>=</b>
        <strong>{fmt(result.sellableEV)} counted</strong>
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
    <div className="slot-rail" role="tablist" aria-label="Color slots">
      {result.slots.map((slot) => (
        <button
          role="tab"
          aria-selected={selected === slot.id}
          className={`slot slot-${slot.id} ${selected === slot.id ? "active" : ""}`}
          key={slot.id}
          onClick={() => setSelected(slot.id)}
        >
          <span>{slot.id}</span>
          <b>{fmt(slot.sellableEV)}</b>
        </button>
      ))}
    </div>
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
                  <span>Counted expected copies</span>
                  <strong>
                    {row.sellableCopies.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}
                  </strong>
                  <small>
                    {status === "verified"
                      ? `Qualifying finishes worth ${fmt(threshold)} or more in this break.`
                      : `Known-data estimate for qualifying ${fmt(threshold)}+ finishes; unresolved contents may increase these odds.`}
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

function useOutcomeSimulation(
  analysis: BreakAnalysis,
  remaining: SlotId[],
  landedCost: number | undefined,
): { result?: SimulationResult; error?: string; busy: boolean } {
  const [state, setState] = useState<{ result?: SimulationResult; error?: string; busy: boolean }>({ busy: false });
  const key = `${analysis.valuation.dataVersion}|${analysis.valuation.threshold}|${remaining.join("")}|${landedCost ?? "none"}`;
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
  }, [analysis, key, landedCost, remaining]);
  return state;
}

function OutcomeFingerprint({ summary, landed }: { summary?: DistributionSummary; landed?: number }) {
  if (!summary) return <div className="distribution-empty">Distribution unavailable until every material input is resolved.</div>;
  const clears = landed == null ? undefined : summary.fingerprint.filter((value) => value >= landed).length;
  return (
    <div className="fingerprint" aria-label="Twenty equal-probability modeled outcome bands">
      <div className="fingerprint-dots">
        {summary.fingerprint.map((value, index) => (
          <span
            key={index}
            className={landed != null && value >= landed ? "clears" : ""}
            title={`${Math.round((index + .5) * 5)}th percentile: ${fmt(value)}`}
          />
        ))}
      </div>
      <div className="fingerprint-scale">
        <span>P10 {fmt(summary.p10)}</span>
        <strong>Typical {fmt(summary.median)}</strong>
        <span>P90 {fmt(summary.p90)}</span>
      </div>
      {clears != null && (
        <p><b>{clears} of 20</b> modeled outcome bands clear {fmt(landed)}.</p>
      )}
      <small>Modeled possibilities—not a prediction of the next opening.</small>
    </div>
  );
}

function BreakBalance({
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
  return (
    <section className="panel balance-panel">
      <header>
        <div>
          <p className="section-label">BREAK BALANCE</p>
          <h2>Equal chance, unequal pools</h2>
        </div>
        <b>{strongest ? `${Math.round(weakest / strongest * 100)}%` : "—"}</b>
      </header>
      <p className="balance-note">Each remaining slot is equally likely. The card value assigned to each slot is not equal.</p>
      <div className="balance-chart" style={{ "--equal": `${equalShare / max * 100}%` } as CSSProperties}>
        {rows.map((slot) => {
          const distribution = simulation?.slotDistributions[slot.id];
          const value = distribution?.median ?? slot.sellableEV;
          return (
            <div className={`balance-column slot-${slot.id}`} key={slot.id}>
              <span className="balance-whisker" style={{ height: `${((distribution?.p90 ?? value) / max) * 100}%` }} />
              <span className="balance-bar" style={{ height: `${(value / max) * 100}%` }} />
              <b>{slot.id}</b>
              <small>{fmt(value)}</small>
            </div>
          );
        })}
      </div>
      <p className="balance-caption">Dashed line: equal share {fmt(equalShare)} · Bars: {simulation ? "typical modeled value" : "mean EV"}</p>
    </section>
  );
}

function EvidenceLens({ analysis }: { analysis: BreakAnalysis }) {
  const { valuation } = analysis;
  const priceAvailability = analysis.priceAvailability ?? {
    status: "unavailable" as const,
    source: "none" as const,
    message: "Price-source availability was not reported for this analysis.",
  };
  const priced = Date.parse(valuation.pricedAt);
  const ageHours = Number.isFinite(priced) ? Math.max(0, (Date.now() - priced) / 36e5) : undefined;
  const labels = [
    ["Identity", valuation.evidence.productIdentity],
    ["Contents", valuation.evidence.contents],
    ["Collation", valuation.evidence.collation],
    ["Finish", valuation.evidence.finish],
    ["Prices", `${priceAvailability.status} · ${priceAvailability.source}`],
    ["Break rules", valuation.evidence.breakRules],
  ];
  return (
    <details className="panel evidence-lens">
      <summary>
        <span><ShieldAlert /><b>Evidence lens</b><small>{analysis.outcomeModel.complete === false ? "Outcome chart blocked by known gaps" : "Inputs eligible for modeled outcomes"}</small></span>
        <span>{ageHours == null ? "Price time unknown" : `Prices ${ageHours < 1 ? "<1" : Math.round(ageHours)}h old`}</span>
      </summary>
      <div className="evidence-grid">
        {labels.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}
      </div>
      <p className="evidence-price-note">{priceAvailability.message}</p>
      {analysis.outcomeOmissions.length > 0 && (
        <ul>{analysis.outcomeOmissions.slice(0, 8).map((omission, index) => <li key={`${omission.code}-${index}`}>{omission.message}</li>)}</ul>
      )}
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
  return (
    <details className="panel supporting-view">
      <summary><span><b>Chase Constellation</b><small>Pull chance × market price; bubble size is EV contribution</small></span><span>{SLOT_NAMES[slot.id]}</span></summary>
      {!rows.length ? <p className="supporting-empty">No cards meet the current bulk boundary.</p> : (
        <div className="constellation" aria-label={`${SLOT_NAMES[slot.id]} pull chance by market price`}>
          <span className="constellation-y">Higher price ↑</span>
          <span className="constellation-x">More frequent →</span>
          {rows.map((row) => {
            const price = row.marketValue / Math.max(row.copies, .0001);
            const size = 14 + Math.sqrt(row.sellableValue / maxContribution) * 24;
            return (
              <button
                key={row.card.id}
                style={{
                  left: `${Math.min(96, 4 + row.sellablePullProbability * 92)}%`,
                  bottom: `${Math.min(90, 8 + price / maxPrice * 78)}%`,
                  width: size,
                  height: size,
                }}
                onClick={() => onInspect(row)}
                aria-label={`${row.card.name}: ${oddsLabel(row.sellablePullProbability)} pull chance, ${fmt(price)} market price, ${fmt(row.sellableValue)} EV contribution`}
                title={row.card.name}
              >{row.card.name.slice(0, 1)}</button>
            );
          })}
        </div>
      )}
      <p className="supporting-warning">High and far right means valuable and frequent—not “due” in the next opening. Tap a bubble for the card.</p>
    </details>
  );
}

function BulkBoundary({ result }: { result: ValuationResult }) {
  const ignored = Math.max(0, result.marketEV - result.sellableEV);
  const retained = result.marketEV > 0 ? result.sellableEV / result.marketEV : 0;
  return (
    <details className="panel supporting-view">
      <summary><span><b>Bulk Boundary</b><small>How “Ignore bulk under {fmt(result.threshold)}” changes modeled value</small></span><span>{Math.round(retained * 100)}% retained</span></summary>
      <div className="bulk-boundary">
        <div><span>All resolved card value</span><b>{fmt(result.marketEV)}</b></div>
        <div className="boundary-track" aria-label={`${Math.round(retained * 100)} percent of raw modeled value remains counted`}><span style={{ width: `${retained * 100}%` }} /></div>
        <div><span>Counted at {fmt(result.threshold)}+</span><b>{fmt(result.sellableEV)}</b></div>
        <p>{fmt(ignored)} is below the current per-card boundary. This is not a liquidity, condition, or net-resale estimate.</p>
      </div>
    </details>
  );
}

function EVRiver({ result }: { result: ValuationResult }) {
  const total = Math.max(result.marketEV, 1);
  return (
    <details className="panel supporting-view">
      <summary><span><b>EV River</b><small>Resolved product contents → color slots → counted value</small></span><span>{fmt(result.sellableEV)}</span></summary>
      <div className="ev-river" aria-label="Expected value flow by color slot">
        <div className="river-source"><b>{fmt(result.marketEV)}</b><span>resolved card value</span></div>
        <div className="river-slots">
          {result.slots.filter((row) => row.marketEV > 0).map((row) => (
            <span key={row.id} className={`slot-${row.id}`} style={{ flexGrow: row.marketEV / total }} title={`${row.name}: ${fmt(row.marketEV)}`}><b>{row.id}</b></span>
          ))}
        </div>
        <div className="river-outcomes"><span><b>{fmt(result.sellableEV)}</b> counted</span><span><b>{fmt(Math.max(0, result.marketEV - result.sellableEV))}</b> below boundary</span></div>
      </div>
      <p className="supporting-warning">Widths show expected-value share, not pull probability. Open a slot for printing-level contributors.</p>
    </details>
  );
}

export function BuyerView({
  analysis,
  auction,
  setAuction,
}: {
  analysis: BreakAnalysis;
  auction: AuctionState;
  setAuction: (state: AuctionState) => void;
}) {
  const result = analysis.valuation;
  const [selected, setSelected] = useState<SlotId>("W");
  const [assignmentMode, setAssignmentMode] = useState<"random" | "pick">("random");
  const [bid, setBid] = useState<number>();
  const [shipping, setShipping] = useState<number>();
  const [inspectedCard, setInspectedCard] = useState<Contributor | null>(null);
  const slot = result.slots.find((row) => row.id === selected)!;
  const profileLabel = !slot.contributors.length
    ? "NO COUNTED VALUE"
    : slot.chaseShare >= 0.5
      ? "CHASE-HEAVY"
      : slot.chaseShare >= 0.3
        ? "MIXED"
        : "DIVERSIFIED";
  const landed = (bid ?? 0) + (shipping ?? 0);
  const simulation = useOutcomeSimulation(analysis, auction.remaining, bid == null ? undefined : landed);
  const distribution = assignmentMode === "random"
    ? simulation.result?.remainingPool
    : simulation.result?.slotDistributions[selected];
  const fallbackMean = assignmentMode === "random"
    ? result.slots.filter((row) => auction.remaining.includes(row.id)).reduce((sum, row) => sum + row.sellableEV, 0) / Math.max(1, auction.remaining.length)
    : slot.sellableEV;
  const decision = bid == null ? "READY"
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
            <p className="section-label">
              {assignmentMode === "random" ? `${auction.remaining.length} RANDOM SLOTS REMAIN` : `${SLOT_NAMES[selected].toUpperCase()} SLOT`}
            </p>
            <h2>{decision}</h2>
          </div>
          <div className="ev-orb">
            <small>TYPICAL MODELED VALUE</small>
            <strong>{fmt(distribution?.median ?? fallbackMean)}</strong>
            <span>Mean {fmt(distribution?.mean ?? fallbackMean)}</span>
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
              Mean gap <b>{fmt((distribution?.mean ?? fallbackMean) - landed)}</b>
            </span>
          </div>
        )}
        <OutcomeFingerprint summary={distribution} landed={bid == null ? undefined : landed} />
        {simulation.busy && <p className="simulation-state">Refining 10,000 modeled openings…</p>}
        {simulation.error && <p className="blocked"><ShieldAlert />{simulation.error}</p>}
        {result.status === "incomplete" && (
          <p className="blocked">
            <ShieldAlert /> Verdict withheld. {result.statusReason}
          </p>
        )}
      </section>
      {assignmentMode === "random" && (
        <section className="panel assignment-panel">
          <header>
            <div><p className="section-label">AFTER EACH AUCTION</p><h2>Tap the assigned slot</h2></div>
            <button className="quiet" disabled={!auction.assignments.length} onClick={() => setAuction(undoAssignment(auction))}>Undo</button>
          </header>
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
      <BreakBalance result={result} simulation={simulation.result} remaining={assignmentMode === "random" ? auction.remaining : [selected]} />
      <EvidenceLens analysis={analysis} />
      <SlotRail result={result} selected={selected} setSelected={setSelected} />
      <ChaseConstellation slot={slot} onInspect={setInspectedCard} />
      <BulkBoundary result={result} />
      <EVRiver result={result} />
      <section className="panel slot-detail">
        <header>
          <div>
            <p className="section-label">SLOT VALUE MAKEUP</p>
            <h2>What makes up {fmt(slot.sellableEV)}?</h2>
            <p className="risk-explainer">
              {SLOT_NAMES[selected]} cards worth {fmt(result.threshold)} or more.
              Bulk below the threshold is not included.
            </p>
          </div>
          <span className={`risk-label risk-${profileLabel.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {profileLabel}
          </span>
        </header>
        <div className="concentration">
          <div className="concentration-labels">
            <span>Value spread across cards</span>
            <span>Value depends on one chase</span>
          </div>
          <div
            className="risk-bar"
            aria-label={`${Math.round(slot.chaseShare * 100)}% of counted EV comes from the top card`}
          >
            <span style={{ width: `${Math.min(100, slot.chaseShare * 100)}%` }} />
          </div>
        </div>
        <div className="metric-row risk-metrics">
          <div>
            <span>
              #1 card share
              <Tip text="The percentage of this slot's counted EV supplied by its single largest card contributor. Higher means the slot is more chase-dependent." />
            </span>
            <b>{Math.round(slot.chaseShare * 100)}%</b>
          </div>
          <div>
            <span>
              EV without #1
              <Tip text="The slot's counted expected value after removing its largest card contributor. This is not a guaranteed floor." />
            </span>
            <b>{fmt(slot.withoutChase)}</b>
          </div>
          <div>
            <span>
              Printings counted
              <Tip text={`Distinct ${SLOT_NAMES[selected].toLowerCase()} card printings with a market price of ${fmt(result.threshold)} or more.`} />
            </span>
            <b>{slot.contributors.length}</b>
          </div>
        </div>
        <details open className="contributors">
          <summary>
            <span>
              Cards driving this EV
              <small>Sorted by EV contribution—not pull frequency</small>
            </span>
          </summary>
          {!slot.contributors.length ? (
            <p className="no-contributors">
              No {SLOT_NAMES[selected].toLowerCase()} cards meet the {fmt(result.threshold)} threshold.
            </p>
          ) : (
            <>
              <div className="contributor-columns">
                <span>Card · pull chance · market price</span>
                <span>EV contribution</span>
              </div>
              {slot.contributors.slice(0, 8).map((row) => (
                <article className="card-row" key={row.card.id}>
                  {row.card.image ? (
                    <img src={row.card.image} alt="" />
                  ) : (
                    <span className="card-placeholder" />
                  )}
                  <span>
                    <button
                      className="card-name"
                      onClick={() => setInspectedCard(row)}
                    >
                      {row.card.name}
                    </button>
                    <small>
                      {oddsLabel(row.sellablePullProbability)} pull chance · {countedMarketLabel(row)} market
                    </small>
                  </span>
                  <span className="ev-contribution">
                    <b>{fmt(row.sellableValue)}</b>
                  </span>
                </article>
              ))}
            </>
          )}
        </details>
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

function EnticementLab() {
  type ScenarioKey = keyof typeof WHATNOT_ENTICEMENTS;
  const [selected, setSelected] = useState<ScenarioKey>("fixedCollectorBooster");
  const [cost, setCost] = useState(25);
  const [buyerValue, setBuyerValue] = useState(18);
  const [probability, setProbability] = useState(40);
  const [approvalEvidence, setApprovalEvidence] = useState("");
  const scenario: EnticementScenario = selected === "thresholdPack"
      ? { ...WHATNOT_ENTICEMENTS.thresholdPack, approvalEvidence }
      : WHATNOT_ENTICEMENTS[selected];
  const conditional = selected === "thresholdPack" || selected === "whiffInsurance";
  const economics = scenarioEconomics({
    kind: selected === "thresholdPack" ? "threshold-product" : selected === "whiffInsurance" ? "whiff-insurance" : "fixed-product",
    cost,
    buyerValue,
    probability: probability / 100,
  });
  const exportState = canExportScenario(scenario);
  const complianceLabel = scenario.compliance === "permitted" ? "Whatnot permitted"
    : scenario.compliance === "prohibited" ? "Prohibited on Whatnot" : "Written approval required";
  const exportRule = async () => {
    if (!exportState.allowed) return;
    await navigator.clipboard.writeText(
      `${scenario.name}: disclosed before the first sale. Estimated seller cost ${fmt(economics.expectedSellerCost)}. All cards route through the published color-slot rules.`,
    );
  };
  return (
    <section className="panel enticement-lab">
      <header>
        <div><p className="section-label">ENTICEMENT FRONTIER</p><h2>Design a disclosed break</h2></div>
        <span className={`compliance-badge compliance-${scenario.compliance}`}>{complianceLabel}</span>
      </header>
      <p className="enticement-intro">Compare expected buyer value delivered per seller dollar. Inputs are planning assumptions until the product is added to the break above.</p>
      <div className="scenario-tabs" role="tablist" aria-label="Enticement scenario">
        {(Object.entries(WHATNOT_ENTICEMENTS) as Array<[ScenarioKey, EnticementScenario]>).map(([key, option]) => (
          <button key={key} className={selected === key ? "active" : ""} onClick={() => setSelected(key)}>{option.name}</button>
        ))}
      </div>
      <div className="frontier-plot" aria-label="Enticement cost versus expected buyer value">
        <span className="axis-y">Buyer value</span>
        <span className="axis-x">Seller cost</span>
        <i className="frontier-baseline" style={{ left: "8%", bottom: "12%" }}>Baseline</i>
        <i
          className={`frontier-point compliance-${scenario.compliance}`}
          style={{
            left: `${Math.min(88, 15 + economics.expectedSellerCost / Math.max(1, cost) * 65)}%`,
            bottom: `${Math.min(82, 15 + economics.expectedBuyerValue / Math.max(1, buyerValue) * 60)}%`,
          }}
        >{scenario.name}</i>
      </div>
      <div className="enticement-inputs">
        <NumberField label="Seller cost if activated" value={cost} onChange={(value) => setCost(value ?? 0)} />
        <NumberField label="Buyer value if activated" value={buyerValue} onChange={(value) => setBuyerValue(value ?? 0)} />
        {conditional && <NumberField label={selected === "whiffInsurance" ? "Modeled whiff chance" : "Modeled trigger chance"} value={probability} onChange={(value) => setProbability(value ?? 0)} prefix="%" />}
      </div>
      <div className="enticement-result">
        <div><span>Expected seller cost</span><b>{fmt(economics.expectedSellerCost)}</b></div>
        <div><span>Expected buyer value</span><b>{fmt(economics.expectedBuyerValue)}</b></div>
        <div><span>Value per $1 cost</span><b>{economics.expectedSellerCost ? (economics.expectedBuyerValue / economics.expectedSellerCost).toFixed(2) : "—"}</b></div>
      </div>
      {scenario.compliance === "written-approval-required" && (
        <label className="approval-evidence"><span>Written approval reference</span><input value={approvalEvidence} onChange={(event) => setApprovalEvidence(event.target.value)} placeholder="Required before export" /></label>
      )}
      {!exportState.allowed && <p className="compliance-warning"><ShieldAlert />{exportState.reason}</p>}
      <div className="enticement-actions">
        <a href={scenario.evidenceUrls[0]} target="_blank" rel="noreferrer">Policy source · checked {scenario.policyCheckedAt}</a>
        <button className="quiet" disabled={!exportState.allowed} onClick={exportRule}><Copy />Copy show-note rule</button>
      </div>
    </section>
  );
}

function SellerView({
  result,
  lines,
  update,
}: {
  result: ValuationResult;
  lines: BreakLine[];
  update: (id: string, p: Partial<BreakLine>) => void;
}) {
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
      <EnticementLab />
      <section className="panel seller-plan">
        <header>
          <div>
            <p className="section-label">TARGET PLAN</p>
            <h2>{costsComplete ? fmt(target) : "Add your costs"}</h2>
          </div>
          <span className="market-badge">
            <Store />
            {marketplace.name}
          </span>
        </header>
        <div className="cost-lines">
          {lines.map((line) => (
            <div key={line.id}>
              <span>
                <strong>{line.productLabel}</strong>
                <small>
                  {line.quantity} × product
                  {line.marketCost != null && ` · market ${fmt(line.marketCost)}`}
                </small>
              </span>
              <NumberField
                label="My unit cost"
                value={line.myCost}
                onChange={(n) => update(line.id, { myCost: n })}
              />
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
        <section className="panel ask-grid">
          <header>
            <div>
              <p className="section-label">ASKS TO CLEAR</p>
              <h2>{fmt(askTotal)} total</h2>
            </div>
            <button
              className="quiet"
              onClick={() =>
                setActual(
                  Object.fromEntries(soldIds.map((id) => [id, asks[id]])),
                )
              }
            >
              <Copy />
              Use plan
            </button>
          </header>
          <p className="muted">
            Target {fmt(target)} · allocated by counted EV. Lock a strong
            slot or remove an unsold slot; the rest redistributes automatically.
          </p>
          {result.slots.map((slot) => (
            <div
              className={`ask slot-${slot.id} ${unsold.has(slot.id) ? "unsold" : ""}`}
              key={slot.id}
            >
              <span className="slot-letter">{slot.id}</span>
              <span>
                <strong>{slot.name}</strong>
                <small>{fmt(slot.sellableEV)} counted EV</small>
              </span>
              <b>{fmt(asks[slot.id])}</b>
              <div className="ask-actions">
                <button
                  title={locked[slot.id] == null ? "Lock target" : "Unlock target"}
                  onClick={() =>
                    setLocked((current) => {
                      const next = { ...current };
                      if (next[slot.id] == null) next[slot.id] = asks[slot.id];
                      else delete next[slot.id];
                      return next;
                    })
                  }
                >
                  {locked[slot.id] == null ? <Unlock /> : <Lock />}
                </button>
                <button
                  title={unsold.has(slot.id) ? "Sell this slot" : "Mark unsold"}
                  onClick={() =>
                    setUnsold((current) => {
                      const next = new Set(current);
                      if (next.has(slot.id)) next.delete(slot.id);
                      else next.add(slot.id);
                      return next;
                    })
                  }
                >
                  {unsold.has(slot.id) ? <DollarSign /> : <X />}
                </button>
              </div>
              <label>
                <small>Actual</small>
                <NumericInput
                  placeholder={unsold.has(slot.id) ? "unsold" : "—"}
                  disabled={unsold.has(slot.id)}
                  value={actual[slot.id]}
                  onCommit={(value) =>
                    setActual({
                      ...actual,
                      [slot.id]: value,
                    })
                  }
                />
              </label>
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
          <p className="section-label">ACTUAL OUTCOME</p>
          <h2>{fmt(profit.profit)} profit</h2>
          <div className="metric-row">
            <div>
              <span>Hammer</span>
              <b>{fmt(profit.hammer)}</b>
            </div>
            <div>
              <span>Fees</span>
              <b>−{fmt(profit.fees)}</b>
            </div>
            <div>
              <span>Fulfillment</span>
              <b>−{fmt(profit.shipmentCosts)}</b>
            </div>
          </div>
        </section>
      )}
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
    [threshold, setThreshold] = useState(2),
    [busy, setBusy] = useState(false);
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
  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set("b", encodeComposition(lines));
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
          <button
            className="icon-button"
            onClick={() => setBuilder(true)}
            title="Add product"
          >
            <PackagePlus />
          </button>
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
          {lines.length > 0 && (
            <label className="threshold">
              <Settings2 />
              <span>Ignore bulk under</span>
              <b>$</b>
              <NumericInput
                value={threshold}
                onCommit={(value) => setThreshold(value ?? 0)}
              />
              <Tip
                text={`Cards with a current market price below ${fmt(threshold)} are excluded from every EV total, color-slot value, risk metric, contributor list, buyer verdict, and seller ask. Cards priced at exactly ${fmt(threshold)} are included.`}
              />
            </label>
          )}
        </header>
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
                  <ValueSummary result={analysis.valuation} />
                  {mode === "buyer" ? (
                    <BuyerView analysis={analysis} auction={auction} setAuction={setAuction} />
                  ) : (
                    <SellerView result={analysis.valuation} lines={lines} update={update} />
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
