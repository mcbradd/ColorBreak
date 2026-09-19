import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import type { SellerView } from "./SellerView";

const Workbench = lazy(() => import("./SellerView").then(module => ({ default: module.SellerView })));

class PricingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert"><h2>Pricing tools couldn’t load</h2><p>Your products and break values are still available. Reload to reconnect the pricing tools; your break stays saved in this session.</p><button type="button" className="quiet" onClick={() => location.reload()}>Reload pricing tools</button></div>;
  }
}

/** Optional economics cannot delay entry or take away the available break values. */
export function SellerPlan(props: ComponentProps<typeof SellerView>) {
  return <PricingBoundary><Suspense fallback={<p role="status">Loading pricing tools… Your break values are ready in Values.</p>}><Workbench {...props} /></Suspense></PricingBoundary>;
}
