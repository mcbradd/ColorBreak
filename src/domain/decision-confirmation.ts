import { useCallback, useEffect, useState } from "react";

export const DECISION_CONFIRMATION_MS = 60_000;

export type DecisionConfirmation = Readonly<{ fingerprint: string; confirmedAt: number }>;

/** A single scheduled transition keeps acknowledgement and its visible expiry in sync. */
export function useDecisionConfirmation(fingerprint: string) {
  const [confirmation, setConfirmation] = useState<DecisionConfirmation>();
  const confirmed = confirmation?.fingerprint === fingerprint ? confirmation : undefined;

  useEffect(() => {
    if (!confirmation || confirmation.fingerprint !== fingerprint) {
      if (confirmation) setConfirmation(undefined);
      return;
    }
    const remaining = confirmation.confirmedAt + DECISION_CONFIRMATION_MS - Date.now();
    if (remaining <= 0) {
      setConfirmation(undefined);
      return;
    }
    const timeout = window.setTimeout(() => setConfirmation(undefined), remaining);
    return () => window.clearTimeout(timeout);
  }, [confirmation, fingerprint]);

  const reconfirm = useCallback(() => setConfirmation({ fingerprint, confirmedAt: Date.now() }), [fingerprint]);
  return { confirmation: confirmed, reconfirm };
}
