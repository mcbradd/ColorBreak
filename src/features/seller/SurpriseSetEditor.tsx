import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SLOT_IDS, SLOT_NAMES } from "../../domain/types";
import type { BreakAnalysis } from "../../data/evaluate";
import { autofillStandardColorTeams } from "../../domain/surprise-set";
import type { SurpriseSetCard } from "../../domain/surprise-set";
import { DisclosureArrow, NumberField } from "../shared/Primitives";

function nextId() {
  return globalThis.crypto?.randomUUID?.() ?? `seller-card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SurpriseSetEditor({ cards, analysis, onChange }: {
  cards: SurpriseSetCard[];
  analysis?: BreakAnalysis;
  onChange: (cards: SurpriseSetCard[]) => void;
}) {
  const [notice, setNotice] = useState("");
  const cardCount = cards.filter((card) => card.name.trim()).length;

  function autofill() {
    if (!analysis) {
      setNotice("Add a product before filling teams from its card model.");
      return;
    }
    const existing = new Set(cards.map((card) => `${card.slot}|${card.name.trim().toLowerCase()}`));
    const additions = autofillStandardColorTeams(analysis).filter((card) => !existing.has(`${card.slot}|${card.name.trim().toLowerCase()}`));
    if (!additions.length) {
      setNotice("No additional modeled cards are available. You can add the cards and values manually.");
      return;
    }
    onChange([...cards, ...additions]);
    setNotice(`Added ${additions.length} modeled cards to their matching color teams.`);
  }

  function add(slot: SurpriseSetCard["slot"]) {
    onChange([...cards, { id: nextId(), slot, name: "", value: 0 }]);
    setNotice("");
  }

  function edit(id: string, patch: Partial<SurpriseSetCard>) {
    onChange(cards.map((card) => card.id === id ? { ...card, ...patch } : card));
  }

  return <details className="seller-surprise-set">
    <summary className="disclosure-summary"><span>Configure Surprise Set contents<small>{cardCount} cards across 8 color teams</small></span><DisclosureArrow /></summary>
    <p className="seller-surprise-set-note">Enter the card names and values that will be listed for each team. These seller-entered contents drive the Values panel and seller plan. A card value of $0 keeps the card in its team while marking its value unknown.</p>
    <button type="button" className="quiet seller-surprise-autofill" onClick={autofill}>Autofill standard 8 color teams</button>
    {notice && <p role="status" className="seller-surprise-set-status">{notice}</p>}
    <div className="seller-surprise-teams">
      {SLOT_IDS.map((slot) => {
        const teamCards = cards.filter((card) => card.slot === slot);
        return <fieldset className="seller-surprise-team" key={slot}>
          <legend><span className={`slot-letter slot-letter-${slot}`}>{slot}</span> {SLOT_NAMES[slot]} <small>{teamCards.filter((card) => card.name.trim()).length} cards</small></legend>
          {teamCards.map((card) => <div className="seller-surprise-card" key={card.id}>
            <label>Card name<input type="text" value={card.name} placeholder="Enter card name" onChange={(event) => edit(card.id, { name: event.currentTarget.value })} /></label>
            <NumberField label="Card value" value={card.value} onChange={(value) => edit(card.id, { value: Math.max(0, value ?? 0) })} live />
            <button type="button" className="quiet seller-surprise-remove" aria-label={`Remove ${card.name || "unnamed card"} from ${SLOT_NAMES[slot]}`} onClick={() => onChange(cards.filter((item) => item.id !== card.id))}><Trash2 size={16} aria-hidden="true" /></button>
          </div>)}
          <button type="button" className="quiet seller-surprise-add" onClick={() => add(slot)}><Plus size={15} aria-hidden="true" /> Add card to {SLOT_NAMES[slot]}</button>
        </fieldset>;
      })}
    </div>
  </details>;
}
