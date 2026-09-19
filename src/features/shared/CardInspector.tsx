import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { RotateCw, X } from "lucide-react";
import type { Contributor, ValuationResult } from "../../domain/types";
import { FINISH_LABELS, cardDisplayName } from "../../domain/card-label";
import { InformationLabel, Tip, useDialogOwnership } from "./Primitives";
import { AnswerGroup, AnswerNote, AnswerValue } from "./Answer";
import { PublicCardPlaceholder } from "./CardPlaceholder";

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
  const [faceIndex, setFaceIndex] = useState(0);

  useEffect(() => setFaceIndex(0), [row?.card.id, row?.finish]);

  useDialogOwnership(Boolean(row), onClose, dialogRef, closeRef);

  const affiliateTemplate = import.meta.env.VITE_TCGPLAYER_AFFILIATE_URL as
    | string
    | undefined;
  const affiliateUrl = row
    ? affiliateTemplate?.replace("{card}", encodeURIComponent(row.card.name))
    : undefined;
  const odds = row?.pullProbability ?? 0;
  const selectedFinish = row?.finish ?? (row && row.sellableFoilCopies > 0 ? "foil" : "nonfoil");
  const selectedPrice = row
    ? row.marketPrice ?? (selectedFinish === "foil" ? row.card.foil : row.card.nonfoil) ?? undefined
    : undefined;
  const selectedPriceSource = row?.priceBasis === "listed-tcg"
    ? "Exact-printing listed TCG price"
    : row?.priceBasis === "same-printing-foil-market"
      ? "Same-printing foil market price"
      : "Exact-printing market price";
  const faces = row?.card.faces ?? [];
  const activeFace = faces[faceIndex];
  const activeOracleText = activeFace?.oracleText ?? row?.card.oracleText;
  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          className="scrim card-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={onClose}
        >
          <AnswerGroup><motion.section
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
                <div className="section-heading-row"><InformationLabel>CARD DETAILS</InformationLabel><span className="section-help"><Tip label="About this card’s numbers" text="Pull chance means at least one copy of this card version in the entire break. Market price is for one card, before selling costs." /><AnswerNote primary label="What affects this card" detail={`${selectedPrice == null ? "No market price is available yet; $0 is not a confirmed value" : selectedPriceSource}. ${row.pullRateVerified === false ? "Pull odds are estimated." : "Pull odds follow the available pack rules."} ${status !== "verified" ? "Missing product details can change these figures." : ""}${threshold > 0 ? ` Your $${threshold} filter changes counted value, not the physical chance of opening this card.` : ""}`} /></span></div>
                <h2 id="card-inspector-title">{cardDisplayName(row.card, row.finish)}</h2>
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
                <PublicCardPlaceholder name={activeFace?.name ?? row.card.name} image={activeFace?.image ?? row.card.image} className="card-full-image" />
                {faces.length > 1 && (
                  <button
                    type="button"
                    className="flip-card"
                    onClick={() => setFaceIndex((current) => (current + 1) % faces.length)}
                    aria-label={`Flip to ${faces[(faceIndex + 1) % faces.length]?.name ?? (faceIndex === 0 ? "back face" : "front face")}`}
                  >
                    <RotateCw aria-hidden="true" /> Flip <small>{faceIndex + 1} / {faces.length}</small>
                  </button>
                )}
              </div>
              <div className="card-info">
                <div className="card-stat primary-stat">
                  <span>Chance to pull</span>
                  <strong>{odds > 0 && odds < 1 ? odds > 2 / 3 ? "Most breaks" : `About 1 in ${Math.round(1 / odds).toLocaleString()} breaks` : odds >= 1 ? "In every modeled break" : "No known pull path"}</strong>
                </div>
                <div className="card-stat selected-finish-price">
                  <span>{FINISH_LABELS[selectedFinish ?? "nonfoil"]} market</span>
                  <strong><AnswerValue value={selectedPrice} label={`${row.card.name} market price`} detail={`${selectedPriceSource}. ${row.card.set} #${row.card.collectorNumber} · ${FINISH_LABELS[selectedFinish ?? "nonfoil"]}. One card before selling costs.`} /></strong>
                </div>
                {activeOracleText && (
                  <p className="oracle-text">{activeOracleText}</p>
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
          </motion.section></AnswerGroup>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

