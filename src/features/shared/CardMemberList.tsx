import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CreditCard, DollarSign, Percent, Search, TrendingUp } from "lucide-react";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { resolveCardPrice } from "../../domain/card-price";
import type { Contributor, Finish } from "../../domain/types";
import { fmt, oddsLabel, Tip } from "./Primitives";
import { AnswerGroup, AnswerNote, AnswerValue } from "./Answer";
import { PublicCardPlaceholder } from "./CardPlaceholder";
import { InformationButton } from "./InformationLayer";

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

  const headers: Array<{ key: SortKey; label: string; title?: string }> = [
    { key: "name", label: "Card" },
    { key: "price", label: "Price", title: "Market price" },
    { key: "chance", label: "Chance", title: "Pull chance" },
    { key: "adds", label: "Adds", title: "Value added to average" },
  ];
  const columnIcons = { name: CreditCard, price: DollarSign, chance: Percent, adds: TrendingUp };

  return <AnswerGroup><div className="card-member-list">
    <div className="card-member-toolbar">{rows.length > PAGE_SIZE && <label className="card-member-search">
      <Search aria-hidden="true" />
      <input type="search" value={query} placeholder="Find a card" aria-label={`Find a card in ${groupName}`} onChange={(event) => setQuery(event.target.value)} />
    </label>}
    <span className="section-help">
      <Tip label="What Chance and Adds mean" text={"Chance: how often at least one copy of this exact card version turns up when this break is opened.\n\nAdds: how much that card contributes to the group's average value, which is its price multiplied by the average number of copies opened."} />
      <AnswerNote primary label="What affects these card values" detail="Prices apply to the selected printing and finish. Chance and Adds use available pack rules; missing prices and estimated odds can change these values." />
    </span></div>
    <div className="card-member-list-body">
    <div className="card-member-table" role="table" aria-label={`Cards in ${groupName}`}>
      <div className="card-member-columns" role="row">
        {headers.map(({ key, label, title }) => {
          const fullLabel = title ?? label;
          const Icon = columnIcons[key];
          return <div role="columnheader" key={key} aria-sort={sort.key === key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
            <button type="button" title={fullLabel} onClick={() => toggleSort(key)} aria-label={`Sort by ${label}${sort.key === key ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}>
              {Icon && <Icon className="card-member-column-icon" aria-hidden="true" />}
              <span className="card-member-column-label">{label}</span>
              {sort.key === key && (sort.direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />)}
            </button>
          </div>;
        })}
      </div>
      {matches.slice(0, shown).map((row) => {
        const price = marketPrice(row);
        const cardLabel = cardDisplayName(row.card, row.finish);
        return <div className="card-member-row" role="row" key={`${row.card.id}|${row.finish ?? "nonfoil"}`}>
          <div className="card-member-identity" role="cell">
            <button type="button" className="card-member-thumbnail-button" aria-haspopup="dialog" onClick={(event) => inspect(row, event.currentTarget)} aria-label={`Open ${cardLabel} card details`}>
              <PublicCardPlaceholder name={row.card.name} image={row.card.image} className="card-thumbnail" />
            </button>
            <button type="button" className="card-member-name" aria-haspopup="dialog" onClick={(event) => inspect(row, event.currentTarget)}>
              <strong>{row.card.name}</strong><small>{cardTreatmentLabel(row.card, selectedFinish(row))} · {row.card.set} #{row.card.collectorNumber}</small>
            </button>
          </div>
          <span role="cell" className="card-member-price" aria-label={price == null ? "Market price unavailable" : `${fmt(price)} market price`}><AnswerValue value={price ?? undefined} compact label={`${cardLabel} market price`} detail={`Price for one ${selectedFinish(row)} card, ${row.card.set} #${row.card.collectorNumber}. ${row.priceBasis === "listed-tcg" ? "Uses the listed TCG price for this printing." : row.priceBasis === "same-printing-foil-market" ? "Uses the same printing’s foil-market estimate for this treatment." : "Uses this printing’s available market observation."} This is card value before selling fees.`} /></span>
          <span role="cell" className="card-member-chance" aria-label={`${oddsLabel(row.sellablePullProbability)} pull chance`}><InformationButton title={`${cardLabel} pull chance`} className="value-information" content={<p>{oddsLabel(row.sellablePullProbability)} chance of at least one counted copy across this break. This uses the available pack rules and your current value filter; it is not a guarantee. {row.pullRateVerified === false ? "The exact pull rate is estimated." : ""}</p>}>{oddsLabel(row.sellablePullProbability)}</InformationButton></span>
          <span role="cell" className="card-member-adds" aria-label={`${fmt(row.sellableValue)} added to average`}><AnswerValue value={row.sellableValue} compact label={`${cardLabel} average contribution`} detail="This card’s contribution to the break’s average value: counted price × expected copies. Multiple copies and the current value filter affect this amount." /></span>
        </div>;
      })}
    </div>
    </div>
    {!matches.length && <p className="no-contributors">No card in {groupName} matches “{query}”.</p>}
    {matches.length > shown && <button type="button" className="quiet show-more-cards" onClick={() => setShown((current) => current + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, matches.length - shown)} more</button>}
  </div></AnswerGroup>;
}
