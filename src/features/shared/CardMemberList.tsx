import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { resolveCardPrice } from "../../domain/card-price";
import type { Contributor, Finish } from "../../domain/types";
import { fmt, oddsLabel } from "./Primitives";
import { PublicCardPlaceholder } from "./CardPlaceholder";

type SortKey = "name" | "price" | "chance" | "adds";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 10;

function selectedFinish(row: Contributor): Finish {
  return row.finish ?? (row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
}

function marketPrice(row: Contributor): number | null {
  return row.marketPrice ?? resolveCardPrice(row.card, selectedFinish(row))?.amount ?? null;
}

export function CardMemberList({
  rows,
  onInspect,
  emptyMessage = "No cards are available in this group.",
  groupName = "team",
}: {
  rows: Contributor[];
  onInspect: (row: Contributor) => void;
  emptyMessage?: string;
  groupName?: string;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "price", direction: "desc" });

  useEffect(() => { setShown(PAGE_SIZE); }, [query, rows]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? rows.filter((row) => cardDisplayName(row.card, row.finish).toLocaleLowerCase().includes(normalized))
      : rows;
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      switch (sort.key) {
        case "name": comparison = cardDisplayName(left.card, left.finish).localeCompare(cardDisplayName(right.card, right.finish)); break;
        case "price": comparison = (marketPrice(left) ?? -1) - (marketPrice(right) ?? -1); break;
        case "chance": comparison = left.sellablePullProbability - right.sellablePullProbability; break;
        case "adds": comparison = left.sellableValue - right.sellableValue; break;
      }
      return comparison * (sort.direction === "asc" ? 1 : -1)
        || cardDisplayName(left.card, left.finish).localeCompare(cardDisplayName(right.card, right.finish));
    });
  }, [query, rows, sort]);

  const toggleSort = (key: SortKey) => setSort((current) => current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "name" ? "asc" : "desc" });

  if (!rows.length) return <p className="no-contributors">{emptyMessage}</p>;

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: "name", label: "Card" },
    { key: "price", label: "Price" },
    { key: "chance", label: "Chance" },
    { key: "adds", label: "Adds" },
  ];

  return <div className="card-member-list">
    {rows.length > PAGE_SIZE && <label className="card-member-search">
      <Search aria-hidden="true" />
      <input type="search" value={query} placeholder="Find a card" aria-label={`Find a card in ${groupName}`} onChange={(event) => setQuery(event.target.value)} />
    </label>}
    <div className="card-member-table" role="table" aria-label={`Cards in ${groupName}`}>
      <div className="card-member-columns" role="row">
        {headers.map(({ key, label }) => <div role="columnheader" key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
          <button type="button" onClick={() => toggleSort(key)} aria-label={`Sort by ${label}${sort.key === key ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}>
            {label}{sort.key === key && (sort.direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />)}
          </button>
        </div>)}
      </div>
      {matches.slice(0, shown).map((row) => {
        const price = marketPrice(row);
        const cardLabel = cardDisplayName(row.card, row.finish);
        return <div className="card-member-row" role="row" key={`${row.card.id}|${row.finish ?? "nonfoil"}`}>
          <div className="card-member-identity" role="cell">
            <button type="button" className="card-member-thumbnail-button" onClick={() => onInspect(row)} aria-label={`Open ${cardLabel} card details`}>
              <PublicCardPlaceholder name={row.card.name} image={row.card.image} className="card-thumbnail" />
            </button>
            <button type="button" className="card-member-name" onClick={() => onInspect(row)}>
              <strong>{row.card.name}</strong><small>{cardTreatmentLabel(row.card, selectedFinish(row))} · {row.card.set}</small>
            </button>
          </div>
          <span role="cell" className="card-member-price">{price == null ? "—" : fmt(price)}</span>
          <span role="cell" className="card-member-chance">{oddsLabel(row.sellablePullProbability)}</span>
          <span role="cell" className="card-member-adds">{fmt(row.sellableValue)}</span>
        </div>;
      })}
    </div>
    {!matches.length && <p className="no-contributors">No card in this {groupName} matches “{query}”.</p>}
    {matches.length > shown && <button type="button" className="quiet show-more-cards" onClick={() => setShown((current) => current + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, matches.length - shown)} more</button>}
  </div>;
}
