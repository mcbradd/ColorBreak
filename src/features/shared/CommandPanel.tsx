import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Panel = { id: string; label: string; target: string };
const Navigation = createContext<((id: string, target?: HTMLElement | "search") => void) | null>(null);
export const useCommandNavigation = () => useContext(Navigation);

/** One workspace, with mounted panels that retain their own input and disclosure state. */
export function CommandPanel({ panels, children, actions }: { panels: Panel[]; children: ReactNode; actions?: ReactNode }) {
  const [active, setActive] = useState(panels[0].id);
  const activePanel = panels.some(panel => panel.id === active) ? active : panels[0].id;
  const root = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  function navigate(id: string, destination?: HTMLElement | "search") {
    const body = root.current?.querySelector<HTMLElement>(".command-body");
    if (body) positions.current.set(activePanel, body.scrollTop);
    setActive(id);
    requestAnimationFrame(() => {
      const panel = panels.find((panel) => panel.id === id);
      const panelRoot = panel && document.getElementById(panel.target);
      const target = destination === "search" ? panelRoot?.querySelector<HTMLElement>('[role="combobox"]') : destination ?? panelRoot;
      if (window.matchMedia?.("(max-width: 899px)").matches) {
        if (body) body.scrollTop = positions.current.get(id) ?? 0;
      } else if (body && target) {
        body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top;
      }
      if (body && target && destination) {
        const bounds = body.getBoundingClientRect(), field = target.getBoundingClientRect();
        if (field.top < bounds.top || field.bottom > bounds.bottom) body.scrollTop += field.top - bounds.top;
      }
      target?.focus({ preventScroll: true });
    });
  }
  return <Navigation.Provider value={navigate}><div ref={root} className="command-panels" data-active-panel={activePanel}
    onClickCapture={(event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
      const target = link && document.getElementById(link.hash.slice(1));
      const section = target?.closest<HTMLElement>("[data-command-panel]") ?? target?.querySelector<HTMLElement>("[data-command-panel]");
      if (section?.dataset.commandPanel && target) { event.preventDefault(); navigate(section.dataset.commandPanel, target); }
    }}>
    <nav className="command-navigation" aria-label="Workspace controls">
      {panels.map((panel) => <button key={panel.id} type="button" data-viewport-navigation aria-label={`${panel.label} panel`} aria-controls={panel.target} aria-pressed={activePanel === panel.id} onClick={() => navigate(panel.id)}>{panel.label}</button>)}
      {actions}
    </nav>
    <div className="command-body">{children}</div>
  </div></Navigation.Provider>;
}

/** Shares the values already calculated by the visible decision, without a second calculation. */
export function CommandDock({ values, status, panel = "decision" }: { values: { label: string; value: string }[]; status: string; panel?: string }) {
  const navigate = useContext(Navigation);
  const dock = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!dock.current || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const height = dock.current?.getBoundingClientRect().height;
      if (height) document.documentElement.style.setProperty("--command-dock-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dock.current);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--command-dock-height"); };
  }, [navigate != null]);
  if (!navigate) return null;
  return createPortal(<aside ref={dock} className="command-dock seller-value-dock" aria-label="Live decision">
    {values.map(({ label, value }) => <button key={label} type="button" data-viewport-navigation onClick={() => navigate(panel)} aria-label={`${label}: ${value}. Open ${panel} panel`}><span>{label}</span><b>{value}</b></button>)}
    <small>{status}</small>
  </aside>, document.body);
}
