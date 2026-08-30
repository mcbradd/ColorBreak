import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  ChevronRight,
  CircleHelp,
  RotateCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { Contributor, ValuationResult } from "../../domain/types";

export type Mode = "home" | "buyer" | "seller";
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
function useDialogOwnership(open: boolean, onClose: () => void, dialogRef: RefObject<HTMLElement | null>, initialFocus?: RefObject<HTMLElement | null>, invokingElement?: HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    // The launcher captures this before React mounts the portal. Reading only
    // activeElement here loses pointer launchers and native Escape ownership.
    opener.current = invokingElement ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
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
      const candidate = opener.current;
      const canRestore = candidate?.isConnected
        && !candidate.matches(":disabled, [inert]")
        && !candidate.closest("[inert]");
      const fallback = document.querySelector<HTMLElement>("[data-focus-fallback]")
        ?? document.querySelector<HTMLElement>("main");
      // The exit animation and inert teardown complete after this effect.
      // Restore in a microtask so every dismissal path has one ownership rule.
      queueMicrotask(() => (canRestore ? candidate : fallback)?.focus({ preventScroll: true }));
      window.scrollTo(0, scrollY);
      opener.current = null;
    };
  }, [open]); // onClose/opener intentionally live outside dependencies: close retains its original caller.
}

/** Schedules focus only while the originating control still owns it. */
function useDeferredOwnedFocus() {
  const timer = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  const token = useRef(0);
  useEffect(() => () => {
    token.current += 1;
    if (timer.current != null) window.clearTimeout(timer.current);
  }, []);
  return useCallback((id: string) => {
    token.current += 1;
    const request = token.current;
    if (timer.current != null) window.clearTimeout(timer.current);
    const owner = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    timer.current = window.setTimeout(() => {
      if (request !== token.current || (owner && document.activeElement !== owner)) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLElement && target.isConnected && !target.matches(":disabled, [inert]")) target.focus({ preventScroll: true });
    }, 0);
  }, []);
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

export function Home({ choose, buildId, recentBuyerCount = 0, recentSellerCount = 0, onClearDevice }: { choose: (mode: Mode, fresh?: boolean, ready?: boolean) => void; buildId?: string; recentBuyerCount?: number; recentSellerCount?: number; onClearDevice?: () => Promise<void> }) {
  const supportUrl = import.meta.env.VITE_SUPPORT_URL as string | undefined;
  const [cleared, setCleared] = useState(false);
  const clearDevice = async () => {
    await onClearDevice?.();
    setCleared(true);
  };
  return (
    <main className="home page">
      <header className="launcher-bar">
        <div className="brand">
          <span className="brand-mark"><Sparkles /></span>
          <span>COLORBREAK</span>
        </div>
        <span className="engine-ready" aria-label="Catalog ready"><i /> READY TO EXPLORE</span>
      </header>
      <section className="launcher-intro">
        <InformationLabel>COLOR BREAK PLANNER</InformationLabel>
        <h1>Know the break before you buy in.</h1>
        <p>Build the exact boxes, choose a color, and see modeled value, pull ranges, and a bid ceiling in one place.</p>
      </section>
      <section className="mode-grid" aria-label="Choose a job">
        <button
          data-home-focus
          className="mode-card buyer-card"
          aria-label="Bid Check"
          onClick={() => choose("buyer", true)}
        >
          <span className="mode-number">01</span>
          <span className="mode-copy">
            <small>BUYING A COLOR SLOT</small>
          <strong>Check a bid</strong>
            <p>Set your color, price, and shipping to find a modeled ceiling before the hammer falls.</p>
          </span>
          <span className="mode-output"><small>BUYER TOOL</small><b>Bid ceiling</b><span>Value · pull range · risk</span></span>
          <ChevronRight />
        </button>
        <button
          className="mode-card seller-card"
          aria-label="Seller break planner"
          onClick={() => choose("seller")}
        >
          <span className="mode-number">02</span>
          <span className="mode-copy">
            <small>PLANNING A BREAK</small>
            <strong>Plan a break</strong>
            <p>Build a slot plan, model costs, and see where the break balances.</p>
          </span>
          <span className="mode-output"><small>SELLER TOOL</small><b>Slot plan</b><span>Costs · scenarios · balance</span></span>
          <ChevronRight />
        </button>
      </section>
      {recentBuyerCount > 0 && (
        <button className="resume-action" onClick={() => choose("buyer", false)}>
          <RotateCw />
          <span><small>LAST BUYER SETUP</small><strong>Resume {recentBuyerCount} product{recentBuyerCount === 1 ? "" : "s"}</strong></span>
          <ChevronRight />
        </button>
      )}
      {recentSellerCount > 0 && <button className="resume-action" onClick={() => choose("seller", false)}>
        <RotateCw /><span><small>THIS BROWSER SESSION</small><strong>Resume seller plan · costs are session-only</strong></span><ChevronRight />
      </button>}
      <footer className="launcher-footer">
        <span>Exact-printing prices · Modeled pull ranges · No login</span>
        <span><a href="./methodology.html">Methodology</a>{supportUrl && <> · <a href={supportUrl} rel="noreferrer" target="_blank">Support</a></>} {buildId && <> · <small aria-label="Build identifier">Build {buildId.slice(0, 12)}</small></>}</span>
      </footer>
      <button type="button" className="quiet" onClick={() => void clearDevice()}>Clear local ColorBreak app data</button>
      {cleared && <p role="status">Local ColorBreak data cleared.</p>}
    </main>
  );
}

export { fmt, fmtChart, oddsLabel, useDialogOwnership, useDeferredOwnedFocus, DisclosureArrow, countedPriceLabel, NumericInput, InformationLabel, PanelHeading, Status, plainEvidence };

