import { useEffect, useRef, type RefObject } from "react";

const focusable = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
type OwnedDialog = { element: HTMLElement };
const owners: OwnedDialog[] = [];
let restoreApplication: (() => void) | undefined;
let restorationEpoch = 0;

function preserveAttributes(element: HTMLElement | null) {
  const inert = element?.getAttribute("inert");
  const hidden = element?.getAttribute("aria-hidden");
  return () => {
    if (!element) return;
    if (inert == null) element.removeAttribute("inert"); else element.setAttribute("inert", inert);
    if (hidden == null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", hidden);
  };
}

/** Only the top layer owns keyboard input; every layer retains its caller's exact scroll context. */
export function useDialogOwnership(open: boolean, onClose: () => void, dialogRef: RefObject<HTMLElement | null>, initialFocus?: RefObject<HTMLElement | null>, invokingElement?: HTMLElement | null) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialogRef.current;
    if (!open || !element) return;
    const caller = invokingElement ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const scroll: { element: HTMLElement; top: number; left: number }[] = [];
    for (let ancestor = caller?.parentElement; ancestor; ancestor = ancestor.parentElement) {
      scroll.push({ element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft });
    }
    const [x, y] = [window.scrollX, window.scrollY];
    const restoreDialog = preserveAttributes(element);
    const surface = element.closest<HTMLElement>(".scrim, .information-scrim");
    const previousLayer = surface?.style.zIndex ?? "";
    if (surface) surface.style.zIndex = String(400 + owners.length * 2);
    const owner = { element };
    restorationEpoch++;
    if (!owners.length) {
      const application = document.getElementById("root");
      const attributes = preserveAttributes(application);
      const overflow = document.body.style.overflow;
      restoreApplication = () => { attributes(); document.body.style.overflow = overflow; };
      document.body.style.overflow = "hidden";
      application?.setAttribute("inert", "");
      application?.setAttribute("aria-hidden", "true");
    }
    for (const prior of owners) {
      prior.element.setAttribute("inert", "");
      prior.element.setAttribute("aria-hidden", "true");
    }
    owners.push(owner);
    initialFocus?.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (owners.at(-1) !== owner) return;
      if (event.key === "Escape" && document.querySelector('[role="tooltip"]')) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return; }
      if (event.key !== "Tab") return;
      const controls = [...element.querySelectorAll<HTMLElement>(focusable)].filter(control => control.getClientRects().length > 0 && !control.closest("[inert]"));
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const wasTop = owners.at(-1) === owner;
      owners.splice(owners.indexOf(owner), 1);
      restoreDialog();
      if (surface) surface.style.zIndex = previousLayer;
      const parent = owners.at(-1);
      if (parent) { parent.element.removeAttribute("inert"); parent.element.removeAttribute("aria-hidden"); }
      else { restoreApplication?.(); restoreApplication = undefined; }
      if (!wasTop) return;
      const epoch = ++restorationEpoch;
      queueMicrotask(() => {
        if (epoch !== restorationEpoch) return;
        const canRestore = caller?.isConnected && !caller.matches(":disabled") && !caller.closest("[inert]");
        const fallback = parent?.element.querySelector<HTMLElement>(focusable) ?? document.querySelector<HTMLElement>("[data-focus-fallback], main");
        (canRestore ? caller : fallback)?.focus({ preventScroll: true });
        for (const position of scroll) if (position.element.isConnected) {
          position.element.scrollTop = position.top; position.element.scrollLeft = position.left;
        }
        window.scrollTo(x, y);
      });
    };
  }, [open]);
}
