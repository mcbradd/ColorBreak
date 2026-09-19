import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { resolveCardPrice } from "../../domain/card-price";
import type { Contributor, Finish } from "../../domain/types";
import { fmt, oddsLabel, Tip } from "./Primitives";
import { AnswerGroup, AnswerNote, AnswerValue } from "./Answer";
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

  const inspect = (row: Contributor, opener: HTMLButtonElement) => {
    // Touch activation does not consistently focus buttons. Establish the
    // opener before the dialog captures focus so every dismissal returns here.
    opener.focus({ preventScroll: true });
    onInspect(row);
  };

  if (!rows.length) return <p className="no-contributors">{emptyMessage}</p>;

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: "name", label: "Card" },
    { key: "price", label: "Price" },
    { key: "chance", label: "Chance" },
    { key: "adds", label: "Adds" },
  ];

  return <AnswerGroup><div className="card-member-list">
    <div className="card-member-toolbar">{rows.length > PAGE_SIZE && <label className="card-member-search">
      <Search aria-hidden="true" />
      <input type="search" value={query} placeholder="Find a card" aria-label={`Find a card in ${groupName}`} onChange={(event) => setQuery(event.target.value)} />
    </label>}
    <span className="section-help">
      <Tip label="What Chance and Adds mean" text={"Chance: how often at least one copy of this exact card version turns up when this break is opened.\n\nAdds: how much that card contributes to the group's average value, which is its price multiplied by the average number of copies opened."} />
      <AnswerNote primary label="What affects these card values" detail="Prices apply to the selected printing and finish. Chance and Adds use available pack rules; missing prices and estimated odds can change these values." />
    </span></div>
    <div className="card-member-scroll" role="region" aria-label={`Scrollable cards in ${groupName}`} tabIndex={0}>
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
            <button type="button" className="card-member-thumbnail-button" onClick={(event) => inspect(row, event.currentTarget)} aria-label={`Open ${cardLabel} card details`}>
              <PublicCardPlaceholder name={row.card.name} image={row.card.image} className="card-thumbnail" />
            </button>
            <button type="button" className="card-member-name" onClick={(event) => inspect(row, event.currentTarget)}>
              <strong>{row.card.name}</strong><small>{cardTreatmentLabel(row.card, selectedFinish(row))} · {row.card.set} #{row.card.collectorNumber}</small>
            </button>
          </div>
          <span role="cell" className="card-member-price" aria-label={price == null ? "Market price unavailable" : `${fmt(price)} market price`}>{price == null ? "—" : <AnswerValue value={price} compact />}</span>
          <span role="cell" className="card-member-chance" aria-label={`${oddsLabel(row.sellablePullProbability)} pull chance`}>{oddsLabel(row.sellablePullProbability)}</span>
          <span role="cell" className="card-member-adds" aria-label={`${fmt(row.sellableValue)} added to average`}><AnswerValue value={row.sellableValue} compact /></span>
        </div>;
      })}
    </div>
    </div>
    {!matches.length && <p className="no-contributors">No card in {groupName} matches “{query}”.</p>}
    {matches.length > shown && <button type="button" className="quiet show-more-cards" onClick={() => setShown((current) => current + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, matches.length - shown)} more</button>}
  </div></AnswerGroup>;
}
