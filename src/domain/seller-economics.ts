/**
 * Seller-only economics.  This module deliberately has no buyer inputs: it is
 * safe to use for a private plan or reconciliation without changing buyer
 * analysis or any public declaration.
 */

export type CostState =
  | { kind: "measured"; amount: number }
  | { kind: "estimated"; amount: number }
  | { kind: "not-applicable"; reason: string }
  | { kind: "included-in"; lineId: string }
  | { kind: "unknown" };

export interface CostLine {
  id: string;
  label: string;
  /** A required unknown blocks planned-net as well as actual-net. */
  required?: boolean;
  state: CostState;
}

export interface CostLedgerSummary {
  total: number;
  unknown: string[];
  estimated: string[];
}

export type ProductBasis =
  | { kind: "cash"; amount: number; source: string }
  | {
      kind: "decision";
      ownership: "committed-acquisition" | "owned-inventory";
      amount: number;
      source: string;
    };

export type RevenueScenario =
  | { kind: "posted-minimum"; amount: number }
  | { kind: "seller-hammer-hypothesis"; amount: number }
  | { kind: "required-threshold"; amount: number }
  | { kind: "start"; amount: number }
  | { kind: "actual-hammer"; amount: number };

export type EconomicsResult =
  | { label: "Modeled contribution profit"; amount: number; ledger: CostLedgerSummary }
  | { label: "Planned net profit"; amount: number; ledger: CostLedgerSummary }
  | { label: "Actual net profit"; amount: number; ledger: CostLedgerSummary }
  | { label: "Cash margin only"; amount: number; ledger: CostLedgerSummary }
  | { label: "Provisional actuals"; amount: number; ledger: CostLedgerSummary; reason: string }
  | { label: "No conditional profit status"; ledger: CostLedgerSummary; reason: string };

function assertAmount(amount: number, subject: string) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${subject} must be a finite non-negative amount`);
  }
}

function lineMap(lines: readonly CostLine[]) {
  const map = new Map<string, CostLine>();
  for (const line of lines) {
    if (!line.id) throw new Error("Cost lines require an id");
    if (map.has(line.id)) throw new Error(`Duplicate cost line: ${line.id}`);
    if (line.state.kind === "measured" || line.state.kind === "estimated") {
      assertAmount(line.state.amount, `Cost line ${line.id}`);
    }
    if (line.state.kind === "not-applicable" && !line.state.reason.trim()) {
      throw new Error(`Not-applicable cost line ${line.id} requires a reason`);
    }
    map.set(line.id, line);
  }
  return map;
}

/** Validates inclusion references and cycles before deriving any total. */
export function summarizeCostLedger(lines: readonly CostLine[]): CostLedgerSummary {
  const byId = lineMap(lines);
  const visiting = new Set<string>();
  const checked = new Set<string>();

  const visit = (id: string): void => {
    if (checked.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cost ledger inclusion cycle at ${id}`);
    const line = byId.get(id);
    if (!line) throw new Error(`Unknown cost line: ${id}`);
    visiting.add(id);
    if (line.state.kind === "included-in") {
      if (!byId.has(line.state.lineId)) {
        throw new Error(`Cost line ${id} is included in unknown line ${line.state.lineId}`);
      }
      visit(line.state.lineId);
    }
    visiting.delete(id);
    checked.add(id);
  };

  for (const line of lines) visit(line.id);

  const resolvesToUnknown = (line: CostLine): boolean => {
    if (line.state.kind === "unknown") return true;
    if (line.state.kind !== "included-in") return false;
    // visit() above has established that the reference exists and is acyclic.
    return resolvesToUnknown(byId.get(line.state.lineId)!);
  };

  const unknown: string[] = [];
  const estimated: string[] = [];
  let total = 0;
  for (const line of lines) {
    const state = line.state;
    if (state.kind === "measured") total += state.amount;
    if (state.kind === "estimated") {
      total += state.amount;
      estimated.push(line.id);
    }
    if (line.required !== false && resolvesToUnknown(line)) unknown.push(line.id);
    // included-in contributes through its ancestor's amount, never a second time.
  }
  return { total, unknown, estimated };
}

/**
 * Owned inventory needs a declared opportunity comparison; selecting the
 * highest credible alternative prevents a convenient historic-cost override.
 */
export function decisionBasisForOwnedInventory(
  alternatives: readonly { amount: number; source: string }[],
): Extract<ProductBasis, { kind: "decision" }> {
  if (alternatives.length === 0) throw new Error("Owned inventory needs a decision alternative");
  for (const alternative of alternatives) assertAmount(alternative.amount, "Decision alternative");
  const selected = alternatives.reduce((highest, alternative) =>
    alternative.amount > highest.amount ? alternative : highest,
  );
  return {
    kind: "decision",
    ownership: "owned-inventory",
    amount: selected.amount,
    source: selected.source,
  };
}

/** Starts, posted minimums, and required thresholds are not accepted revenue. */
export function acceptedRevenue(scenario: RevenueScenario): number | null {
  assertAmount(scenario.amount, "Revenue scenario");
  return scenario.kind === "seller-hammer-hypothesis" || scenario.kind === "actual-hammer"
    ? scenario.amount
    : null;
}

function resultAmount(revenue: number, basis: ProductBasis, ledger: CostLedgerSummary) {
  assertAmount(basis.amount, "Product basis");
  return revenue - basis.amount - ledger.total;
}

export function modeledContributionProfit(
  scenario: RevenueScenario,
  basis: ProductBasis | null,
  lines: readonly CostLine[],
): EconomicsResult {
  const ledger = summarizeCostLedger(lines);
  const revenue = acceptedRevenue(scenario);
  if (revenue == null) {
    return { label: "No conditional profit status", ledger, reason: "Revenue is a start, minimum, or requirement—not accepted revenue." };
  }
  if (!basis || basis.kind === "cash") {
    return {
      label: "Cash margin only",
      amount: revenue - (basis?.amount ?? 0) - ledger.total,
      ledger,
    };
  }
  return { label: "Modeled contribution profit", amount: resultAmount(revenue, basis, ledger), ledger };
}

export function plannedNetProfit(
  scenario: RevenueScenario,
  basis: ProductBasis | null,
  lines: readonly CostLine[],
): EconomicsResult {
  const ledger = summarizeCostLedger(lines);
  const revenue = acceptedRevenue(scenario);
  if (revenue == null || !basis || basis.kind !== "decision") {
    return { label: "No conditional profit status", ledger, reason: "Planned net needs accepted revenue and a decision basis." };
  }
  if (ledger.unknown.length > 0) {
    return { label: "Modeled contribution profit", amount: resultAmount(revenue, basis, ledger), ledger };
  }
  return { label: "Planned net profit", amount: resultAmount(revenue, basis, ledger), ledger };
}

export function actualNetProfit(
  scenario: RevenueScenario,
  basis: ProductBasis | null,
  lines: readonly CostLine[],
): EconomicsResult {
  const ledger = summarizeCostLedger(lines);
  if (scenario.kind !== "actual-hammer" || !basis) {
    return { label: "Provisional actuals", amount: 0, ledger, reason: "Actual net needs reconciled actual revenue and a product basis." };
  }
  const amount = resultAmount(scenario.amount, basis, ledger);
  if (ledger.unknown.length > 0 || ledger.estimated.length > 0) {
    return { label: "Provisional actuals", amount, ledger, reason: "Actual net cannot contain unknown or estimated cost leaves." };
  }
  return { label: "Actual net profit", amount, ledger };
}
