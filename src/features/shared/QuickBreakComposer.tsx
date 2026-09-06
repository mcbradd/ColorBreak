import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Plus, Search, Undo2, X } from "lucide-react";
import { loadProductSearchIndex, quickProductsForSet } from "../../data/product-search";
import { breakLineKey, breakLineKeyForChoice, mergeBreakLines, productKeyForChoice } from "../../domain/break-line-identity";
import { matchingProducts, rankSearchSets, suggestedSearchSets, type ProductSearchSet } from "../../domain/product-search";
import type { BreakLine, ProductChoice } from "../../domain/types";
import { InformationLabel } from "./Primitives";
import { QuantityControl } from "./QuantityControl";

interface QuickBreakComposerProps {
  lines: BreakLine[];
  onChange: (lines: BreakLine[]) => void;
  onImport: () => void;
}

/** The working break is updated on every tap, without a draft/apply boundary. */
export function QuickBreakComposer({ lines, onChange, onImport }: QuickBreakComposerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [query, setQuery] = useState("");
  const [sets, setSets] = useState<ProductSearchSet[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, ProductChoice[]>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [removed, setRemoved] = useState<{ line: BreakLine; index: number }>();
  const candidates = useMemo(() => query.trim().length >= 2 ? rankSearchSets(sets, query) : [], [sets, query]);
  const candidateKey = candidates.map((set) => set.code).join("|");
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const suggestions = suggestedSearchSets(sets, lines.map((line) => line.set));
  const matches = candidates.flatMap((set) => matchingProducts(loaded[set.code] ?? [], query));
  const results = showAll ? matches : matches.slice(0, 6);
  const isSearching = query.trim().length >= 2;
  const isLoading = candidates.some((set) => pending.includes(set.code) || (!loaded[set.code] && !failed.includes(set.code)));
  const failedSets = candidates.filter((set) => failed.includes(set.code));

  useEffect(() => {
    let cancelled = false;
    setIndexLoading(true);
    setIndexError(false);
    void loadProductSearchIndex().then((rows) => {
      if (!cancelled) setSets(rows);
    }).catch(() => {
      if (!cancelled) setIndexError(true);
    }).finally(() => {
      if (!cancelled) setIndexLoading(false);
    });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    const relevant = candidatesRef.current;
    setPending(relevant.map((set) => set.code));
    setFailed([]);
    // Each set renders as it arrives; a slow second match cannot block the first.
    for (const set of relevant) {
      void quickProductsForSet(set).then((products) => {
        if (!cancelled) setLoaded((current) => ({ ...current, [set.code]: products }));
      }).catch(() => {
        if (!cancelled) setFailed((current) => [...current, set.code]);
      }).finally(() => {
        if (!cancelled) setPending((current) => current.filter((code) => code !== set.code));
      });
    }
    return () => { cancelled = true; };
  }, [candidateKey, retry]);

  function update(next: BreakLine[]) {
    linesRef.current = next;
    onChange(next);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setActive(0);
    setShowAll(false);
  }

  function add(product: ProductChoice) {
    const line: BreakLine = {
      id: crypto.randomUUID(), set: product.set,
      productKey: productKeyForChoice(product), productLabel: product.label,
      quantity: 1, packCount: product.packCount, tcgId: product.tcgId,
    };
    update(mergeBreakLines([...linesRef.current, line]));
    setAnnouncement(`Added ${product.setName} ${product.label}. Ready for the next product.`);
    changeQuery("");
    inputRef.current?.focus({ preventScroll: true });
  }

  function remove(line: BreakLine) {
    const current = linesRef.current;
    setRemoved({ line, index: current.findIndex((row) => breakLineKey(row) === breakLineKey(line)) });
    update(current.filter((row) => breakLineKey(row) !== breakLineKey(line)));
    setAnnouncement(`Removed ${line.set} ${line.productLabel}. Undo is available.`);
    inputRef.current?.focus({ preventScroll: true });
  }

  function quantity(line: BreakLine, value: number) {
    if (!Number.isFinite(value)) return;
    const next = Math.min(999, Math.max(0, Math.floor(value)));
    if (next === 0) { remove(line); return; }
    update(linesRef.current.map((row) => breakLineKey(row) === breakLineKey(line) ? { ...row, quantity: next } : row));
  }

  function undo() {
    if (!removed) return;
    const current = linesRef.current;
    const same = current.find((line) => breakLineKey(line) === breakLineKey(removed.line));
    if (same) {
      update(current.map((line) => line === same ? { ...line, quantity: line.quantity + removed.line.quantity } : line));
    } else {
      const next = [...current];
      next.splice(Math.max(0, removed.index), 0, removed.line);
      update(next);
    }
    setAnnouncement(`Restored ${removed.line.set} ${removed.line.productLabel}.`);
    setRemoved(undefined);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { changeQuery(""); return; }
    if (!results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next);
      document.getElementById(`${id}-option-${next}`)?.scrollIntoView?.({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      add(results[Math.min(active, results.length - 1)]);
    }
  }

  return (
    <section className="quick-break-composer" aria-labelledby={`${id}-heading`}>
      <div className="quick-composer-heading">
        <div><InformationLabel>1 · Break contents</InformationLabel><h2 id={`${id}-heading`}>Add products</h2></div>
        <button type="button" className="quick-import-button" aria-label="Paste / screenshot" title="Import a product list, break link or screenshot" onClick={onImport}>Import</button>
      </div>
      <label className="quick-search-label" htmlFor={`${id}-search`}>Find a set and product</label>
      <div className="quick-search-field">
        <Search size={19} aria-hidden="true" />
        <input ref={inputRef} id={`${id}-search`} type="search" role="combobox" autoComplete="off"
          placeholder="Set or product…" value={query}
          aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={isSearching ? `${id}-results` : undefined}
          aria-activedescendant={results.length ? `${id}-option-${Math.min(active, results.length - 1)}` : undefined}
          aria-describedby={`${id}-hint`} onChange={(event) => changeQuery(event.target.value)} onKeyDown={onSearchKeyDown} />
        {query && <button type="button" aria-label="Clear product search" onClick={() => { changeQuery(""); inputRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
      </div>
      <p className="quick-search-hint" id={`${id}-hint`}>Tap a match. Keep adding.</p>
      {indexError ? <div className="quick-composer-error" role="alert">The catalog could not load. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry catalog</button></div>
        : indexLoading ? <p className="quick-composer-status" role="status">Loading product catalog…</p>
          : !isSearching ? <div className={`quick-set-suggestions${lines.length ? " has-lines" : ""}`} aria-label="Suggested sets">
            <span>{lines.length ? "Continue with" : "Recent sets"}</span>
            {suggestions.map((set) => <button type="button" key={set.code} onClick={() => { changeQuery(`${set.code} `); inputRef.current?.focus(); }}><b>{set.code}</b> <span>{set.name}</span></button>)}
          </div> : null}
      {isSearching && !indexError && <div className="quick-search-results-wrap">
        <div id={`${id}-results`} className="quick-search-results" role="listbox" aria-label="Matching products" aria-busy={isLoading}>
          {results.map((product, index) => {
            const inBreak = lines.find((line) => breakLineKey(line) === breakLineKeyForChoice(product));
            return <button type="button" id={`${id}-option-${index}`} key={breakLineKeyForChoice(product)} role="option" aria-selected={index === Math.min(active, results.length - 1)}
              className={`quick-product-option${index === Math.min(active, results.length - 1) ? " is-active" : ""}`}
              aria-label={`Add ${product.setName} (${product.set}) ${product.label}`}
              onMouseDown={(event) => event.preventDefault()} onClick={() => add(product)}>
              <span className="quick-product-set">{product.set}</span>
              <span className="quick-product-identity"><strong>{product.label}</strong><small>{product.setName}</small></span>
              <span className="quick-product-add">{inBreak ? <><Check size={14} aria-hidden="true" /><small>×{inBreak.quantity}</small></> : null}<Plus size={18} aria-hidden="true" /></span>
            </button>;
          })}
        </div>
        {isLoading && <p className="quick-composer-status" role="status">Finding exact products…</p>}
        {failedSets.length > 0 && <div className="quick-composer-error" role="alert">Could not load {failedSets.map((set) => set.name).join(", ")}. <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry products</button></div>}
        {!isLoading && !indexLoading && !matches.length && !failedSets.length && <p className="quick-composer-status" role="status">No matching product. Try a set code or a shorter product name.</p>}
        {!showAll && matches.length > results.length && <button type="button" className="quick-show-more" onClick={() => setShowAll(true)}>Show {matches.length - results.length} more products</button>}
      </div>}
      <div className="quick-break-contents">
        <div className="quick-contents-heading"><h3>In this break</h3><span>{lines.reduce((total, line) => total + line.quantity, 0)} products</span></div>
        {!lines.length ? <p className="quick-contents-empty">Add everything being opened. Mix sets, boxes and packs in one break.</p> : <ul className="quick-break-lines">
          {lines.map((line) => <li key={breakLineKey(line)} className="quick-break-line">
            <div className="quick-line-identity"><strong>{line.productLabel}</strong><small>{sets.find((set) => set.code === line.set)?.name ?? line.set} <b>{line.set}</b></small></div>
            <QuantityControl line={line} label={`${line.set} ${line.productLabel}`} ariaLabel={`${line.set} ${line.productLabel} quantity`} update={(value) => quantity(line, value)} onEmpty={() => quantity(line, 0)} />
          </li>)}
        </ul>}
      </div>
      {removed && <div className="quick-undo"><span>Removed {removed.line.set} {removed.line.productLabel}</span><button type="button" onClick={undo}><Undo2 size={15} aria-hidden="true" /> Undo</button></div>}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </section>
  );
}
