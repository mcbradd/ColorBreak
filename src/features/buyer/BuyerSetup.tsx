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
import { catalogSets, productsForSet, readinessForProduct } from "../../data/catalog";
import type { DecisionReadiness } from "../../domain/decision-readiness";
import { evaluateBreakAnalysis } from "../../data/evaluate";
import type { BreakAnalysis } from "../../data/evaluate";
import { sealedMarketPrice } from "../../data/sealed-prices";
import { createAuction, toggleSlotTaken } from "../../domain/auction";
import type { AuctionState } from "../../domain/auction";
import { decodeLegacySearch } from "../../domain/legacy";
import { mergeBreakLines, parseBreakImport } from "../../domain/break-import";
import { createBreakShareUrl, decodeBuyerShare, type AssignmentMode } from "../../domain/share-url";
import {
  calculateProfit,
  requiredHammer,
  WHATNOT_US,
} from "../../domain/marketplace";
import { recommendBid, solveFinancialCap } from "../../domain/buyer-treatment";
import type { ValueRule } from "../../domain/buyer-treatment";
import { completeCost, sellerPlanStatus } from "../../domain/seller-plan";
import { actualLedgerSummary, validateActualLedger, type ActualOrder, type ActualShipment } from "../../domain/actual-ledger";
import { decisionAvailability, decisionEligibility, resolvedOnlyLimit } from "../../domain/valuation";
import { cardDisplayName, cardTreatmentLabel } from "../../domain/card-label";
import { deduplicateOmissions } from "../../domain/omissions";
import { simulateOutcomesAsync } from "../../domain/simulation-client";
import type { DistributionSummary, PackOutcomeModel, SimulationResult } from "../../domain/simulation";
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
} from "../../domain/types";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import { useMobileInputViewport } from "../../mobile-input-viewport";
import { track } from "../../analytics";
import { chaseMapLayout } from "../../constellation-layout";
import { runtimeReleaseContext, buyerDecisionPresentation, type ReleaseContext } from "../../release-context";
import { manualBudgetCap } from "../../domain/manual-budget";
import { READY_EXAMPLES, readyExampleLine } from "../../data/ready-examples";
import { createLargeBreakPlan, sortNamedCards, summarizeAssignmentValues } from "../../domain/large-break";
import type { TopCardSort } from "../../domain/large-break";
import {
  cleanupLegacyStorage,
  clearColorBreakBrowserStorage,
  defaultSellerPlanDraft,
  readBuyerDecisionRecord,
  readSellerPlanDraft,
  readSessionDraft,
  writeBuyerDecisionRecord,
  writeSellerPlanDraft,
  sellerPlanMatches,
  sellerPlanOwner,
  writeSessionLines,
  type SellerPlanDraft,
} from "../../persistence";
import { InformationLabel } from "../shared/Primitives";
import { Composition, SlotRail } from "./BuyerVisuals";
import { BulkFilterControl } from "./BuyerDetails";

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
  add: (opener?: HTMLElement) => void;
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

