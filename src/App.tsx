import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { decodeLegacySearch } from "./domain/legacy";
import { useMobileInputViewport } from "./mobile-input-viewport";
import { runtimeReleaseContext, type ReleaseContext } from "./release-context";
import { Home } from "./features/shared/Primitives";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";
import { SellerWorkspace } from "./features/seller/SellerWorkspace";

type Mode = "home" | "buyer" | "seller";

/** Application shell: route selection and feature composition only. */
export function App({ releaseContext = runtimeReleaseContext }: { releaseContext?: ReleaseContext } = {}) {
  useMobileInputViewport();
  const hasSharedBreak = decodeLegacySearch(location.search).length > 0;
  const initial: Mode = location.hash === "#seller" ? "seller" : location.hash === "#buyer" || hasSharedBreak ? "buyer" : "home";
  const [mode, setMode] = useState<Mode>(initial);
  const [startFreshBuyer, setStartFreshBuyer] = useState(false);
  const [startReadyBuyer, setStartReadyBuyer] = useState(false);
  const choose = (next: Mode, fresh = next === "buyer" && mode === "home", ready = false) => {
    setStartFreshBuyer(fresh); setStartReadyBuyer(ready); setMode(next);
    history.replaceState(null, "", next === "home" ? location.pathname : `#${next}`);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (next === "home") window.setTimeout(() => document.querySelector<HTMLElement>("[data-home-focus]")?.focus({ preventScroll: true }), 220);
  };
  return <AnimatePresence mode="wait"><motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
    {mode === "home" ? <Home choose={choose} buildId={releaseContext.buildId} /> : mode === "buyer" ? <BuyerWorkspace exit={() => choose("home")} startFresh={startFreshBuyer} startReady={startReadyBuyer} /> : <SellerWorkspace exit={() => choose("home")} />}
  </motion.div></AnimatePresence>;
}
