import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMobileInputViewport } from "./mobile-input-viewport";
import { runtimeReleaseContext, type ReleaseContext } from "./release-context";
import { Home } from "./features/shared/Primitives";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";
import { SellerWorkspace } from "./features/seller/SellerWorkspace";
import { clearColorBreakBrowserStorage, readSessionDraft } from "./persistence";
import { hashForMode, modeFromHash, type Mode } from "./route-mode";

/** Application shell: route selection and feature composition only. */
export function App({ releaseContext = runtimeReleaseContext }: { releaseContext?: ReleaseContext } = {}) {
  useMobileInputViewport();
  // `prefers-reduced-motion` is honored throughout the static CSS layer; this
  // mirrors that for the JS-driven route transition, which otherwise plays
  // its translateY/opacity animation unconditionally.
  const reducedMotion = useReducedMotion();
  const routeMode = (): Mode => modeFromHash(location.hash, location.search);
  const initial = routeMode();
  const [mode, setMode] = useState<Mode>(initial);
  const [startFreshBuyer, setStartFreshBuyer] = useState(initial === "buyer" && !location.search);
  const [startReadyBuyer, setStartReadyBuyer] = useState(false);
  const choose = (next: Mode, fresh = next === "buyer" && mode === "home", ready = false) => {
    setStartFreshBuyer(fresh); setStartReadyBuyer(ready); setMode(next);
    // Every mode - including "home" - gets its own hash, so a real (non-SPA)
    // navigation back to this URL resolves to the same mode instead of
    // falling through to the buyer-workspace default. See route-mode.ts.
    history.replaceState(null, "", `${location.pathname}${location.search}${hashForMode(next)}`);
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
