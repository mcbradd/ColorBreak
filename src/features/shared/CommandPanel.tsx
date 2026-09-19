import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Panel = { id: string; label: string; target: string };
const Navigation = createContext<((id: string) => void) | null>(null);

/** One workspace, with mounted panels that retain their own input and disclosure state. */
export function CommandPanel({ panels, children }: { panels: Panel[]; children: ReactNode }) {
  const [active, setActive] = useState(panels[0].id);
  const root = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  function navigate(id: string) {
    const body = root.current?.querySelector<HTMLElement>(".command-body");
    if (body) positions.current.set(active, body.scrollTop);
    setActive(id);
    requestAnimationFrame(() => {
      const panel = panels.find((panel) => panel.id === id);
      const target = panel && document.getElementById(panel.target);
      if (window.matchMedia?.("(max-width: 899px)").matches) {
        if (body) body.scrollTop = positions.current.get(id) ?? 0;
      } else if (body && target) {
        body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top;
      }
      target?.focus({ preventScroll: true });
    });
  }
  return <Navigation.Provider value={navigate}><div ref={root} className="command-panels" data-active-panel={active}
    onClickCapture={(event) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
      const target = link && document.getElementById(link.hash.slice(1));
      const section = target?.closest<HTMLElement>("[data-command-panel]");
      if (section?.dataset.commandPanel) { event.preventDefault(); navigate(section.dataset.commandPanel); }
    }}>
    <nav className="command-navigation" aria-label="Workspace panels">
      {panels.map((panel) => <button key={panel.id} type="button" data-viewport-navigation aria-label={`${panel.label} panel`} aria-controls={panel.target} aria-pressed={active === panel.id} onClick={() => navigate(panel.id)}>{panel.label}</button>)}
    </nav>
    <div className="command-body">{children}</div>
  </div></Navigation.Provider>;
}

/** Shares the values already calculated by the visible decision, without a second calculation. */
export function CommandDock({ values, status, panel = "decision" }: { values: { label: string; value: string }[]; status: string; panel?: string }) {
  const navigate = useContext(Navigation);
  if (!navigate) return null;
  return createPortal(<aside className="command-dock seller-value-dock" aria-label="Live decision">
    {values.map(({ label, value }) => <button key={label} type="button" onClick={() => navigate(panel)} aria-label={`${label}: ${value}. Open ${panel} panel`}><span>{label}</span><b>{value}</b></button>)}
    <small>{status}</small>
  </aside>, document.body);
}
