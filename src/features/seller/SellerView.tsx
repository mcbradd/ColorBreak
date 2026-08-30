import { useEffect, useMemo, useState } from "react";
import { DollarSign, Lock, PackagePlus, Trash2, Unlock, X } from "lucide-react";
import { evaluateBreakAnalysis } from "../../data/evaluate";
import type { BreakAnalysis } from "../../data/evaluate";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { requiredHammer, WHATNOT_US } from "../../domain/marketplace";
import { completeCost } from "../../domain/seller-plan";
import { productsForSet } from "../../data/catalog";
import { actualLedgerSummary, validateActualLedger, type ActualOrder, type ActualShipment } from "../../domain/actual-ledger";
import type { DistributionSummary } from "../../domain/simulation";
import type {
  BreakLine,
  MarketplacePreset,
  ProductChoice,
  SlotId,
  ValuationResult,
} from "../../domain/types";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import {
  defaultSellerPlanDraft,
  readSellerPlanDraft,
  writeSellerPlanDraft,
  sellerPlanMatches,
  sellerPlanOwner,
  type SellerPlanDraft,
} from "../../persistence";
import { DisclosureArrow, fmt, InformationLabel, NumberField, PanelHeading, Tip, useDeferredOwnedFocus } from "../shared/Primitives";
import { NextSteps, QuantityControl } from "../shared/ProductBuilder";
import { CompactWarning } from "../shared/Feedback";
import { IncompleteDataWarning, useOutcomeSimulation } from "../shared/OutcomeFeedback";

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
      <p role="alert">{bonusSimulation.error ?? baseSimulation.error}</p>
      <button type="button" className="quiet" onClick={() => { baseSimulation.retry(); bonusSimulation.retry(); }}>Retry pull ranges</button>
    </CompactWarning>
  );
  if (!baseSimulation.result || !bonusSimulation.result) return <p className="calculating" role="status" aria-live="polite"><span />Building pull ranges…</p>;
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

export function SellerScenarioLab({
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
  add: (opener?: HTMLElement) => void;
  update: (id: string, patch: Partial<BreakLine>) => void;
  remove: (id: string) => void;
}) {
  const owner = useMemo(() => sellerPlanOwner(lines, analysis.valuation.dataVersion), [lines, analysis.valuation.dataVersion]);
  const [draft, setDraft] = useState<SellerPlanDraft>(readSellerPlanDraft);
  const [orderDraft, setOrderDraft] = useState({ slots: [] as SlotId[], receipt: "", fee: "", reference: "" });
  const [shipmentDraft, setShipmentDraft] = useState({ orderId: "", postage: "", packing: "", reference: "" });
  const [ledgerError, setLedgerError] = useState<string>();
  const [pendingLedgerRemoval, setPendingLedgerRemoval] = useState<{ kind: "order"; record: ActualOrder } | { kind: "shipment"; record: ActualShipment }>();
  const hasSavedPlanValues = draft.targetsApplied || Object.keys(draft.lockedAsks).length > 0 || draft.unsoldSlots.length > 0 || draft.acceptedEstimateIds.length > 0 || draft.plannedBidOverride != null || draft.actualLedger.orders.length > 0 || draft.actualLedger.shipments.length > 0;
  const planMismatch = hasSavedPlanValues && !sellerPlanMatches(draft, owner);
  const activeDraft = planMismatch ? { ...defaultSellerPlanDraft(), owner } : draft;
  useEffect(() => {
    if (!draft.owner && !hasSavedPlanValues) setDraft((current) => ({ ...current, owner }));
  }, [draft.owner, hasSavedPlanValues, owner]);
  const setPlan = (patch: Partial<SellerPlanDraft>) => setDraft((current) =>
    sellerPlanMatches(current, owner) || !hasSavedPlanValues
      ? { ...current, owner, ...patch }
      : { ...defaultSellerPlanDraft(), owner, ...patch },
  );
  useEffect(() => { writeSellerPlanDraft(draft); }, [draft]);
  const {
    buyerShipping, packing, postage, shipments, mailingMethod, labor, tax,
    giveaways, refundReserve, overhead, commission, processing, processingFlat,
    plannedBidOverride, minimumAsk,
  } = activeDraft;
  // An estimate is meaningful only for a line in this exact composition.
  const acceptedEstimateIds = new Set(activeDraft.acceptedEstimateIds.filter((id) => lines.some((line) => line.id === id)));
  const priceAvailability = analysis.priceAvailability ?? { status: "available" as const, source: "none" as const, message: "Price source metadata unavailable" };
  const acceptEstimatesForPlanning = (ids: string[]) => setDraft((current) => {
    const base = sellerPlanMatches(current, owner) || !hasSavedPlanValues ? current : { ...defaultSellerPlanDraft(), owner };
    const eligible = new Set(lines.filter((line) => line.myCost == null && line.marketCost != null).map((line) => line.id));
    return { ...base, owner, acceptedEstimateIds: [...new Set([...base.acceptedEstimateIds, ...ids.filter((id) => eligible.has(id))])] };
  });
  const removeAcceptedEstimate = (id: string) => setDraft((current) => ({ ...current, owner, acceptedEstimateIds: current.acceptedEstimateIds.filter((accepted) => accepted !== id) }));
  const [productsOpen, setProductsOpen] = useState(false);
  const deferOwnedFocus = useDeferredOwnedFocus();
  const focusManualCost = (id: string) => {
    setProductsOpen(true);
    deferOwnedFocus(`seller-cost-${id}`);
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
  const unsoldSlots = new Set(activeDraft.unsoldSlots);
  const soldSlots = analysis.valuation.slots.filter((slot) => slot.sellableEV > 0 && !unsoldSlots.has(slot.id));
  const asks = plannedBid == null ? undefined : allocate(
    analysis.valuation,
    plannedBid * transactionCount,
    minimumAsk,
    activeDraft.lockedAsks,
    unsoldSlots,
  );
  const saleableSlotIds = soldSlots.map((slot) => slot.id);
  const actualAcquisitionCents = lines.every((line) => line.myCost != null)
    ? Math.round(lines.reduce((total, line) => total + (line.myCost ?? 0) * line.quantity, 0) * 100) : undefined;
  const ledgerSummary = actualLedgerSummary(activeDraft.actualLedger, saleableSlotIds, actualAcquisitionCents);
  const reconciliationState = ledgerSummary.incomplete ? "reconciliation_incomplete" : "actuals_reconciled";
  const readiness = actualAcquisitionCents == null
    ? (costsComplete ? "Rehearsal economics only — verify actual cost." : "Economics not ready — add actual acquisition cost.")
    : reconciliationState === "actuals_reconciled" ? "Actual result reconciled for this session."
      : "Planning inputs complete — demand and actual reconciliation still pending.";
  /** Validate, persist, then render one immutable ledger envelope. */
  const commitLedger = (next: SellerPlanDraft["actualLedger"]): boolean => {
    try {
      const actualLedger = validateActualLedger(next, saleableSlotIds);
      const nextDraft = { ...activeDraft, owner, actualLedger };
      if (!writeSellerPlanDraft(nextDraft)) throw new Error("This browser could not save the reconciliation record. Check private browsing/storage settings and try again.");
      setDraft(nextDraft);
      setLedgerError(undefined);
      return true;
    } catch (error) {
      setLedgerError(error instanceof Error ? error.message : "Ledger could not be saved");
      return false;
    }
  };
  const centsFrom = (value: string, label: string) => {
    if (!value.trim()) throw new Error(`${label} is required.`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative amount.`);
    return Math.round(parsed * 100);
  };
  const addOrder = () => {
    try {
      if (!orderDraft.slots.length) throw new Error("Choose at least one unrecorded slot.");
      const order: ActualOrder = { id: `order-${crypto.randomUUID()}`, slotIds: orderDraft.slots, receiptCents: centsFrom(orderDraft.receipt, "Receipt total"), feeCents: centsFrom(orderDraft.fee, "Actual fee"), reference: orderDraft.reference.trim() || undefined };
      if (commitLedger({ ...activeDraft.actualLedger, orders: [...activeDraft.actualLedger.orders, order] })) setOrderDraft({ slots: [], receipt: "", fee: "", reference: "" });
    } catch (error) { setLedgerError(error instanceof Error ? error.message : "Order could not be recorded"); }
  };
  const addShipment = () => {
    const order = activeDraft.actualLedger.orders.find((candidate) => candidate.id === shipmentDraft.orderId);
    if (!order) { setLedgerError("Choose an order to fulfill."); return; }
    if (order.shipmentId || activeDraft.actualLedger.shipments.some((shipment) => shipment.orderIds.includes(order.id))) { setLedgerError("This order already has a shipment. Remove / correct it before recording another; split shipments are unsupported."); return; }
    try {
      const shipment: ActualShipment = { id: `shipment-${crypto.randomUUID()}`, orderIds: [order.id], postageCents: centsFrom(shipmentDraft.postage, "Actual postage"), packingCents: centsFrom(shipmentDraft.packing, "Actual packing"), reference: shipmentDraft.reference.trim() || undefined };
      if (commitLedger({ version: 1, orders: activeDraft.actualLedger.orders.map((candidate) => candidate.id === order.id ? { ...candidate, shipmentId: shipment.id } : candidate), shipments: [...activeDraft.actualLedger.shipments, shipment] })) setShipmentDraft({ orderId: "", postage: "", packing: "", reference: "" });
    } catch (error) { setLedgerError(error instanceof Error ? error.message : "Shipment could not be recorded"); }
  };
  /** Corrections are an explicit, persisted remove-then-record transaction. */
  const confirmLedgerRemoval = () => {
    if (!pendingLedgerRemoval) return;
    const committed = pendingLedgerRemoval.kind === "order"
      ? commitLedger({ version: 1, orders: activeDraft.actualLedger.orders.filter((item) => item.id !== pendingLedgerRemoval.record.id), shipments: activeDraft.actualLedger.shipments.filter((shipment) => !shipment.orderIds.includes(pendingLedgerRemoval.record.id)) })
      : commitLedger({ version: 1, orders: activeDraft.actualLedger.orders.map((order) => pendingLedgerRemoval.record.orderIds.includes(order.id) ? { ...order, shipmentId: undefined } : order), shipments: activeDraft.actualLedger.shipments.filter((item) => item.id !== pendingLedgerRemoval.record.id) });
    if (committed) {
      setLedgerError(pendingLedgerRemoval.kind === "order" ? "Order and any linked shipment removed. Its slots are available to record again." : "Shipment removed. Its linked order needs fulfillment again; re-record it to correct the costs.");
      setPendingLedgerRemoval(undefined);
    }
  };
  return (
    <section className="seller-command-center">
      <aside className="shared-calculation-notice" aria-label="Seller plan summary"><span><b>Seller plan</b><small>Set costs and targets to model the break before it starts.</small></span></aside>
      {planMismatch && <aside className="buyer-recovery-choice" aria-label="Saved seller plan recovery">
        <div><strong>Saved seller plan belongs to another break</strong><p>Its targets, locked asks, unsold slots, and accepted estimates are not applied to this composition.</p></div>
        <div className="buyer-recovery-actions">
          <button type="button" className="primary" onClick={() => setDraft({ ...defaultSellerPlanDraft(), owner })}>Use this break with a clean plan</button>
          <button type="button" className="quiet" onClick={() => setDraft({ ...defaultSellerPlanDraft(), owner })}>Start clean</button>
        </div>
      </aside>}
      <section className="seller-contents" aria-labelledby="seller-contents-heading">
        <div className="seller-section-heading">
          <div><InformationLabel>1 · BREAK</InformationLabel><h2 id="seller-contents-heading">Contents &amp; cost basis</h2></div>
          <button className="primary seller-add-products" onClick={(event) => add(event.currentTarget)}><PackagePlus />Add products</button>
        </div>
        <div className="seller-break-reconciliation" aria-label="Seller break composition summary">
          <strong>{lines.length} lines · {totalOpenings} openings · {transactionCount} spots</strong>
          <span id="seller-cost-status" tabIndex={-1} role="status">{costsComplete ? acceptedEstimateIds.size ? "Estimated cost basis ready for rehearsal" : "Cost basis ready" : "Cost basis incomplete"}</span>
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
                <div className="seller-market-price"><span>{line.myCost != null ? "Actual acquisition cost" : !analysis.priceAvailability ? "Current market" : priceAvailability.status === "available" && analysis.valuation.status !== "incomplete" ? "Market estimate" : "Stale/incomplete estimate"}</span><b>{fmt(line.myCost ?? line.marketCost)}</b><small>{line.myCost != null ? "Actual cost entered" : line.marketCost == null ? "Estimate unavailable — enter your cost" : `${priceAvailability.source} · ${priceAvailability.observedAt ? new Date(priceAvailability.observedAt).toLocaleString() : "date unavailable"} · ${estimateAccepted(line) ? "accepted for rehearsal" : "not accepted"}`}</small></div>
                <NumberField id={`seller-cost-${line.id}`} label="My cost basis" value={line.myCost} onChange={(value) => update(line.id, { myCost: value })} live />
                {line.myCost == null && line.marketCost != null && <button type="button" className="quiet" onClick={() => { if (estimateAccepted(line)) removeAcceptedEstimate(line.id); else acceptEstimatesForPlanning([line.id]); deferOwnedFocus("seller-cost-status"); }}>{estimateAccepted(line) ? "Stop using estimate" : "Use estimate"}</button>}
                {line.myCost == null && line.marketCost == null && <button type="button" className="quiet" onClick={() => focusManualCost(line.id)}>Enter actual cost</button>}
                <QuantityControl line={line} update={(quantity) => update(line.id, { quantity })} />
                <button className="remove-line" aria-label={`Remove ${line.productLabel} from break`} onClick={() => remove(line.id)}><Trash2 /></button>
              </div>
            ))}
          </div>
        </details>
      </section>

      {marketEstimateLines.length > 0 && <section className="cost-basis-policy" aria-label="Cost basis policy">
        <div><InformationLabel>COST BASIS</InformationLabel><h3>{costsComplete && acceptedEstimateIds.size ? "Estimated cost basis ready for rehearsal" : costsComplete ? "Cost basis ready" : "Actual costs are still blank"}</h3><p>Estimated cost basis for rehearsal — source {priceAvailability.source}, observed {priceAvailability.observedAt ? new Date(priceAvailability.observedAt).toLocaleString() : "unknown"}; replace estimates with your actual cost when known.</p></div>
        <button type="button" className="quiet" onClick={() => { if (acceptedEstimateIds.size === marketEstimateLines.length) setPlan({ acceptedEstimateIds: [] }); else acceptEstimatesForPlanning(marketEstimateLines.map((line) => line.id)); deferOwnedFocus("seller-cost-status"); }}>{acceptedEstimateIds.size === marketEstimateLines.length ? "Stop using estimates" : `Use ${marketEstimateLines.length} market estimates`}</button>
      </section>}

      {missingCostLine && <CompactWarning title={<a href={`#seller-cost-${missingCostLine.id}`} onClick={() => focusManualCost(missingCostLine.id)}>Enter your cost for {missingCostLine.productLabel}</a>} summary="Needed to calculate break-even and profit." className="missing-input-warning">
        <p>No sealed-market price is available for this product, so ColorBreak needs your cost instead.</p>
      </CompactWarning>}

      {activeDraft.reconciliationNeeded && <CompactWarning title="Previous actual asks need reconciliation" summary="Older saved asks were not receipts, so none were carried into actual results." className="missing-input-warning">
        <p>Record the completed orders and their shipments before treating any revenue as actual.</p>
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
        <details className="seller-assumptions"><summary className="disclosure-summary" data-testid="seller-assumptions-toggle"><span>Assumptions used</span><DisclosureArrow /></summary><p>{acceptedEstimateIds.size ? "Acquisition includes accepted estimated market inputs; " : "Acquisition uses seller-entered costs; "}fees checked {WHATNOT_US.policyDate}; buyer shipping {fmt(buyerShipping)}; packaging/postage {fmt(packing + postage)} per shipment; up to one combined shipment per sold spot ({shipmentCount} expected). Change this if you expect consolidation. Scenarios are sell-through math, not a demand prediction.</p></details>
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
          accessory={<button type="button" className="quiet" onClick={() => setPlan({ targetsApplied: true })}>{activeDraft.targetsApplied ? "Targets applied" : "Apply targets"}</button>}
        />
        <p className="muted">These are planned targets, not receipts. Locking preserves a target; completed orders and shipments must be reconciled separately before an actual result is shown.</p>
        {analysis.valuation.slots.map((slot) => {
          const unsold = unsoldSlots.has(slot.id);
          const eligible = slot.sellableEV > 0;
          const locked = activeDraft.lockedAsks[slot.id] != null;
          return <div className={`ask-entry ${!eligible ? "ineligible" : ""}`} key={slot.id}>
            <div className={`ask ${unsold ? "unsold" : ""}`}>
              <span className={`slot-letter slot-letter-${slot.id}`}>{slot.id}</span>
              <span><strong>{slot.name}</strong><small>{eligible ? `${fmt(slot.sellableEV)} sellable EV` : "No modeled sellable value"}</small></span>
              <b>{eligible && !unsold ? fmt(asks[slot.id]) : unsold ? "Unsold" : "—"}</b>
              {eligible && <div className="ask-actions">
                <button type="button" title={locked ? "Unlock target" : "Lock target"} onClick={() => setPlan({ lockedAsks: locked ? Object.fromEntries(Object.entries(activeDraft.lockedAsks).filter(([id]) => id !== slot.id)) : { ...activeDraft.lockedAsks, [slot.id]: asks[slot.id] } })}>{locked ? <Lock /> : <Unlock />}</button>
                <button type="button" title={unsold ? "Sell this slot" : "Mark unsold"} onClick={() => activeDraft.actualLedger.orders.some((order) => order.slotIds.includes(slot.id)) ? setLedgerError("Remove or edit the receipt-linked order before changing this slot to unsold.") : setPlan({ unsoldSlots: unsold ? activeDraft.unsoldSlots.filter((id) => id !== slot.id) : [...activeDraft.unsoldSlots, slot.id] })}>{unsold ? <DollarSign /> : <X />}</button>
              </div>}
            </div>
          </div>;
        })}
        <div className="min-row"><NumberField label="Minimum ask" value={minimumAsk} onChange={(value) => setPlan({ minimumAsk: value ?? 0 })} live /></div>
      </section>}

      <section className="panel seller-reconciliation" aria-label="Seller actual reconciliation">
        <InformationLabel>ACTUALS · SESSION ONLY</InformationLabel>
        <h2>Receipt-backed reconciliation</h2><span className="sr-only">Reconciliation in progress</span>
        <p>Targets are never receipts. Record the paid receipt and actual fee once per order, then actual postage and packing once per shipment.</p>
        {ledgerError && <p role="alert" className="missing-input-warning">{ledgerError}</p>}
        <form className="actual-ledger-form" onSubmit={(event) => { event.preventDefault(); addOrder(); }}>
          <h3>Actual orders</h3>
          <div className="actual-slot-list">{saleableSlotIds.map((slot) => <label key={slot}><input type="checkbox" checked={orderDraft.slots.includes(slot)} disabled={activeDraft.actualLedger.orders.some((order) => order.slotIds.includes(slot))} onChange={(event) => setOrderDraft((current) => ({ ...current, slots: event.target.checked ? [...current.slots, slot] : current.slots.filter((id) => id !== slot) }))} /> {SLOT_NAMES[slot]}</label>)}</div>
          <label>Receipt total<input aria-label="Receipt total" required min="0" step="0.01" type="number" value={orderDraft.receipt} onChange={(event) => setOrderDraft({ ...orderDraft, receipt: event.target.value })} /></label>
          <label>Actual fee from receipt / statement<input aria-label="Actual fee from receipt or statement" required min="0" step="0.01" type="number" value={orderDraft.fee} onChange={(event) => setOrderDraft({ ...orderDraft, fee: event.target.value })} /></label>
          <label>Receipt / reference (required for reconciliation)<input aria-label="Receipt reference" value={orderDraft.reference} onChange={(event) => setOrderDraft({ ...orderDraft, reference: event.target.value })} /></label>
          <button className="primary" type="submit" disabled={!orderDraft.slots.length}>Record order</button>
        </form>
        {activeDraft.actualLedger.orders.length > 0 && <ul className="actual-ledger-list">{activeDraft.actualLedger.orders.map((order) => <li key={order.id}><span>{order.slotIds.join(", ")} · {fmt(order.receiptCents / 100)} receipt · {fmt(order.feeCents / 100)} fee {order.reference ? `· ${order.reference}` : "· receipt reference missing"}</span><button type="button" className="quiet" onClick={() => setPendingLedgerRemoval({ kind: "order", record: order })}>Remove / correct</button></li>)}</ul>}
        <form className="actual-ledger-form" onSubmit={(event) => { event.preventDefault(); addShipment(); }}>
          <h3>Shipments &amp; fulfillment costs</h3><p className="muted">One order can have one shipment in this browser-local demo; split shipments are intentionally unsupported.</p>
          <label>Order<select aria-label="Order to fulfill" value={shipmentDraft.orderId} onChange={(event) => setShipmentDraft({ ...shipmentDraft, orderId: event.target.value })}><option value="">Choose an unshipped order</option>{activeDraft.actualLedger.orders.filter((order) => !order.shipmentId).map((order) => <option key={order.id} value={order.id}>{order.reference || order.id}</option>)}</select></label>
          <label>Actual postage<input aria-label="Actual postage" required min="0" step="0.01" type="number" value={shipmentDraft.postage} onChange={(event) => setShipmentDraft({ ...shipmentDraft, postage: event.target.value })} /></label>
          <label>Actual packing<input aria-label="Actual packing" required min="0" step="0.01" type="number" value={shipmentDraft.packing} onChange={(event) => setShipmentDraft({ ...shipmentDraft, packing: event.target.value })} /></label>
          <button className="primary" type="submit" disabled={!shipmentDraft.orderId}>Record shipment</button>
        </form>
        {activeDraft.actualLedger.shipments.length > 0 && <ul className="actual-ledger-list" aria-label="Recorded shipments">{activeDraft.actualLedger.shipments.map((shipment) => {
          const order = activeDraft.actualLedger.orders.find((candidate) => shipment.orderIds.includes(candidate.id));
          return <li key={shipment.id}><span>{order?.reference || order?.id || "Recorded order"} · {fmt(shipment.postageCents / 100)} postage · {fmt(shipment.packingCents / 100)} packing · {fmt((shipment.postageCents + shipment.packingCents) / 100)} fulfillment</span><button type="button" className="quiet" onClick={() => setPendingLedgerRemoval({ kind: "shipment", record: shipment })}>Remove / correct</button></li>;
        })}</ul>}
        {pendingLedgerRemoval && <aside className="buyer-recovery-choice" aria-label={`Confirm ${pendingLedgerRemoval.kind} removal`}>
          <div><strong>Remove this {pendingLedgerRemoval.kind}?</strong><p>{pendingLedgerRemoval.kind === "order" ? "This also removes its linked shipment and restores the order slots. You can record a corrected receipt afterward." : "This restores its linked order as missing shipment. You can record corrected fulfillment costs afterward."}</p></div>
          <div className="buyer-recovery-actions"><button type="button" className="primary" onClick={confirmLedgerRemoval}>Confirm remove and correct</button><button type="button" className="quiet" onClick={() => setPendingLedgerRemoval(undefined)}>Cancel</button></div>
        </aside>}
        <div className="actual-result" role="status"><strong>{ledgerSummary.incomplete ? "Actual result unavailable" : `Actual profit / loss: ${fmt(ledgerSummary.profitCents! / 100)}`}</strong><p>{ledgerSummary.sold} sold and receipt-linked · {activeDraft.unsoldSlots.length} unsold · {ledgerSummary.pending.length} pending/reconciliation missing. {ledgerSummary.missingReceipt.length} order receipt reference missing. {ledgerSummary.missingShipment.length} order shipment missing. {actualAcquisitionCents == null ? "Actual acquisition cost missing." : ""}</p>{!ledgerSummary.incomplete && <p>Realized gross {fmt(ledgerSummary.gross / 100)} · actual fees {fmt(ledgerSummary.fees / 100)} · fulfillment {fmt(ledgerSummary.fulfillment / 100)} · actual cost basis {fmt((actualAcquisitionCents ?? 0) / 100)}.</p>}</div>
      </section>

      {(ledgerSummary.incomplete || actualAcquisitionCents == null) && <NextSteps reason={actualAcquisitionCents == null ? "This plan remains a rehearsal until an actual acquisition cost is entered and receipt-backed orders and shipments reconcile." : "Actual profit or loss is unavailable until every required receipt and shipment record reconciles."} />}

      <SellerEnticement
        baseAnalysis={analysis}
        lines={lines}
        transactionCount={transactionCount}
        baseProfitAtAll={allSoldProfit}
      />
      <p className="seller-demand-checkpoint"><strong>{readiness}</strong> Demand validation remains separate: record audience/pre-interest, a comparable break and date, and your planned time window. This is not launch or bid authorization.</p>
    </section>
  );
}

