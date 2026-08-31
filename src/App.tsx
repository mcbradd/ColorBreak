import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { decodeLegacySearch } from "./domain/legacy";
import { useMobileInputViewport } from "./mobile-input-viewport";
import { runtimeReleaseContext, type ReleaseContext } from "./release-context";
import { Home } from "./features/shared/Primitives";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";
import { SellerWorkspace } from "./features/seller/SellerWorkspace";
import { clearColorBreakBrowserStorage, readSessionDraft } from "./persistence";

type Mode = "home" | "buyer" | "seller";

/** Application shell: route selection and feature composition only. */
export function App({ releaseContext = runtimeReleaseContext }: { releaseContext?: ReleaseContext } = {}) {
  useMobileInputViewport();
  // `prefers-reduced-motion` is honored throughout the static CSS layer; this
  // mirrors that for the JS-driven route transition, which otherwise plays
  // its translateY/opacity animation unconditionally.
  const reducedMotion = useReducedMotion();
  const hasSharedBreak = decodeLegacySearch(location.search).length > 0;
  const routeMode = (): Mode => location.hash === "#seller" ? "seller" : location.hash === "#buyer" || hasSharedBreak ? "buyer" : "home";
  const initial = routeMode();
  const [mode, setMode] = useState<Mode>(initial);
  const [startFreshBuyer, setStartFreshBuyer] = useState(false);
  const [startReadyBuyer, setStartReadyBuyer] = useState(false);
  const choose = (next: Mode, fresh = next === "buyer" && mode === "home", ready = false) => {
    setStartFreshBuyer(fresh); setStartReadyBuyer(ready); setMode(next);
    history.replaceState(null, "", next === "home" ? `${location.pathname}${location.search}` : `#${next}`);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (next === "home") window.setTimeout(() => document.querySelector<HTMLElement>("[data-home-focus]")?.focus({ preventScroll: true }), 220);
  };
  useEffect(() => {
    const syncRoute = () => {
      setStartFreshBuyer(false);
      setStartReadyBuyer(false);
      setMode(routeMode());
    };
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);
  const transitionDistance = reducedMotion ? 0 : 8;
  return <AnimatePresence mode="wait"><motion.div key={mode} initial={{ opacity: 0, y: transitionDistance }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -transitionDistance }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
    {mode === "home" ? <Home choose={choose} buildId={releaseContext.buildId} recentBuyerCount={readSessionDraft("buyer").lines.length} recentSellerCount={readSessionDraft("seller").lines.length} onClearDevice={async () => { clearColorBreakBrowserStorage(); const names = await caches.keys(); await Promise.all(names.filter((name) => name.startsWith("colorbreak-")).map((name) => caches.delete(name))); history.replaceState(null, "", location.pathname); }} /> : mode === "buyer" ? <BuyerWorkspace exit={() => choose("home")} startFresh={startFreshBuyer} startReady={startReadyBuyer} /> : <SellerWorkspace exit={() => choose("home")} />}
  </motion.div></AnimatePresence>;
}
