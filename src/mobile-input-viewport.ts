import { useEffect } from "react";

const EDITABLE_SELECTOR = [
  "input:not([type='button']):not([type='checkbox']):not([type='radio']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[contenteditable='true']",
].join(",");

type ScrollPosition = { element: Element; left: number; top: number };
type FocusSession = {
  baselineHeight: number;
  element: HTMLElement;
  left: number;
  scrollParents: ScrollPosition[];
  top: number;
  restorePosition: boolean;
  followViewport: boolean;
};

function editableTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement && target.matches(EDITABLE_SELECTOR)
    ? target
    : null;
}

function scrollParents(element: HTMLElement): ScrollPosition[] {
  const positions: ScrollPosition[] = [];
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(`${style.overflow} ${style.overflowY} ${style.overflowX}`)) {
      positions.push({ element: parent, left: parent.scrollLeft, top: parent.scrollTop });
    }
    parent = parent.parentElement;
  }
  return positions;
}

export function installMobileInputViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let session: FocusSession | null = null;
  let revealTimer: number | undefined;
  let restoreTimer: number | undefined;
  let orientationTimer: number | undefined;
  let orientationPending = false;
  let revealPending = false;

  const viewportHeight = () => viewport?.height ?? window.innerHeight;
  const viewportTop = () => viewport?.offsetTop ?? 0;
  // Pinch zoom reduces CSS-pixel height without opening a keyboard.
  const unscaledHeight = () => viewportHeight() * (viewport?.scale || 1);

  const syncViewport = () => {
    root.style.setProperty("--visual-viewport-height", `${viewportHeight()}px`);
    root.style.setProperty("--visual-viewport-top", `${viewportTop()}px`);
    root.style.setProperty("--visual-viewport-inset-bottom", `${Math.max(0, window.innerHeight - viewportHeight() - viewportTop())}px`);
    root.classList.toggle("viewport-short", viewportHeight() < 320);
    // Browser bars and keyboard animations can report many small deltas.
    // Detection controls compact styling only; geometry never depends on it.
    root.classList.toggle("keyboard-open", Boolean(session &&
      session.baselineHeight - unscaledHeight() > (root.classList.contains("keyboard-open") ? 80 : 120)));
  };

  const boundsFor = (element: HTMLElement, availableHeight: number) => {
    const group = element.closest<HTMLElement>(".numeric-input") ?? element;
    const rect = group.getBoundingClientRect();
    const inputRect = element.getBoundingClientRect();
    const top = Math.min(rect.top, inputRect.top);
    let bottom = Math.max(rect.bottom, inputRect.bottom);
    // Leave a tappable match beneath search, including while results load.
    if (element.closest(".quick-search-field")) {
      const reserve = root.classList.contains("keyboard-open") || root.classList.contains("viewport-short") ? availableHeight : 120;
      bottom += Math.max(0, Math.min(reserve, availableHeight - (bottom - top)));
    }
    return { top, bottom };
  };

  const scrollDelta = (element: HTMLElement, top: number, bottom: number) => {
    if (bottom <= top) return 0;
    const bounds = boundsFor(element, bottom - top);
    if (bounds.bottom - bounds.top > bottom - top || bounds.top < top) return bounds.top - top;
    return bounds.bottom > bottom ? bounds.bottom - bottom : 0;
  };

  const revealFocused = () => {
    window.clearTimeout(revealTimer);
    revealPending = true;
    revealTimer = window.setTimeout(() => {
      revealPending = false;
      if (!session || document.activeElement !== session.element) return;
      const element = session.element;
      const sheet = session.element.closest(".sheet");
      const stickyHeader = sheet?.querySelector<HTMLElement>(":scope > header");
      const stickyActions = sheet?.querySelector<HTMLElement>(".composer-actions");
      const actionsRect = stickyActions?.getBoundingClientRect();
      const nav = !sheet ? document.querySelector<HTMLElement>("#root nav") : null;
      const navBottom = nav && /^(sticky|fixed)$/.test(getComputedStyle(nav).position)
        ? nav.getBoundingClientRect().bottom : 0;
      const valueDock = document.querySelector<HTMLElement>(".seller-value-dock");
      const valueDockTop = valueDock && getComputedStyle(valueDock).display !== "none"
        ? valueDock.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      const safeTop = Math.max(
        viewportTop() + 12,
        navBottom + 12,
        (stickyHeader?.getBoundingClientRect().bottom ?? 0) + 12,
      );
      const safeBottom = Math.min(
        viewportTop() + viewportHeight() - 12,
        (actionsRect?.height ? actionsRect.top : Number.POSITIVE_INFINITY) - 12,
        valueDockTop - 12,
      );
      // Reveal in each scrollport before scrolling the page. In particular,
      // the last quantity's Done control must clear the bounded product list.
      for (const { element: parent } of scrollParents(element)) {
        if (!(parent instanceof HTMLElement) || !parent.clientHeight) continue;
        const rect = parent.getBoundingClientRect();
        let top = rect.top + parent.clientTop + 4;
        let bottom = top + parent.clientHeight - 8;
        const bounds = boundsFor(element, safeBottom - safeTop);
        if (Math.min(bottom, safeBottom) - Math.max(top, safeTop) >= bounds.bottom - bounds.top) {
          top = Math.max(top, safeTop);
          bottom = Math.min(bottom, safeBottom);
        }
        const delta = scrollDelta(element, top, bottom);
        if (Math.abs(delta) > 1) parent.scrollTo?.({ behavior: "instant", left: parent.scrollLeft,
          top: Math.max(0, Math.min(parent.scrollTop + delta, parent.scrollHeight - parent.clientHeight)) });
      }
      const delta = scrollDelta(element, safeTop, safeBottom);
      // Fixed sheets own their scrolling; moving the underlying page cannot
      // reveal a field inside them. Avoid smooth scrolling against native pan.
      if (!sheet && Math.abs(delta) > 1) window.scrollBy({ behavior: "instant", top: delta, left: 0 });
    }, 50);
  };

  const restore = () => {
    if (!session) return;
    const saved = session;
    session = null;
    root.classList.remove("input-focus-active");
    root.classList.remove("keyboard-open");
    // An explicit on-page navigation owns its new position after keyboard close.
    if (!saved.restorePosition || document.activeElement?.hasAttribute("data-viewport-navigation")) return;
    saved.scrollParents.forEach(({ element, left, top }) => {
      element.scrollTo?.({ behavior: "auto", left, top });
    });
    window.scrollTo({ behavior: "auto", left: saved.left, top: saved.top });
  };

  const keyboardIsClosed = () =>
    !session || unscaledHeight() >= session.baselineHeight - 80;

  const requestRestore = () => {
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => {
      if (editableTarget(document.activeElement)) return;
      if (keyboardIsClosed()) restore();
      else restoreTimer = window.setTimeout(() => {
        if (editableTarget(document.activeElement)) return;
        // Never force the page back while a native keyboard is still closing.
        if (session && !keyboardIsClosed()) session.restorePosition = false;
        restore();
      }, 900);
    }, 120);
  };

  const onFocusIn = (event: FocusEvent) => {
    const element = editableTarget(event.target);
    if (!element) return;
    window.clearTimeout(restoreTimer);
    if (session) {
      session.element = element;
      session.followViewport = true;
      session.baselineHeight = Math.max(session.baselineHeight, unscaledHeight());
      for (const position of scrollParents(element)) {
        if (!session.scrollParents.some((saved) => saved.element === position.element)) session.scrollParents.push(position);
      }
    } else {
      session = {
        baselineHeight: unscaledHeight(),
        element,
        left: window.scrollX,
        scrollParents: scrollParents(element),
        top: window.scrollY,
        restorePosition: true,
        followViewport: true,
      };
    }
    root.classList.add("input-focus-active");
    syncViewport();
    revealFocused();
  };

  const onFocusOut = () => requestRestore();
  const onViewportResize = () => {
    if (orientationPending && session) session.baselineHeight = Math.max(unscaledHeight(), window.innerHeight);
    syncViewport();
    if (session && document.activeElement === session.element) {
      if (session.followViewport && (viewport?.scale || 1) === 1) revealFocused();
    } else if (session) requestRestore();
  };
  const onViewportScroll = () => {
    syncViewport();
    // Native panning often follows resize. Let the pending focus correction
    // settle after it, but don't drag a manually scrolled page back to a field.
    if (revealPending) revealFocused();
  };
  const onOrientationChange = () => {
    // Some engines dispatch orientationchange before their dimensions settle.
    // Rebase subsequent resize frames too, never from the old portrait height.
    orientationPending = true;
    window.clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(() => { orientationPending = false; }, 250);
    if (session) {
      session.baselineHeight = Math.max(unscaledHeight(), window.innerHeight);
      session.restorePosition = false;
    }
    syncViewport();
    if (session && document.activeElement === session.element) revealFocused();
  };
  const onScrollIntent = () => {
    if (session) { session.restorePosition = false; session.followViewport = false; }
    window.clearTimeout(revealTimer);
    revealPending = false;
  };
  const onEditIntent = (event: Event) => {
    if (session && event.target === session.element) {
      session.followViewport = true;
      revealFocused();
    }
  };

  syncViewport();
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  viewport?.addEventListener("resize", onViewportResize);
  viewport?.addEventListener("scroll", onViewportScroll);
  window.addEventListener("resize", onViewportResize);
  window.addEventListener("orientationchange", onOrientationChange);
  document.addEventListener("touchmove", onScrollIntent, { passive: true });
  document.addEventListener("wheel", onScrollIntent, { passive: true });
  document.addEventListener("input", onEditIntent);
  document.addEventListener("pointerdown", onEditIntent, { passive: true });

  return () => {
    window.clearTimeout(revealTimer);
    window.clearTimeout(restoreTimer);
    window.clearTimeout(orientationTimer);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    viewport?.removeEventListener("resize", onViewportResize);
    viewport?.removeEventListener("scroll", onViewportScroll);
    window.removeEventListener("resize", onViewportResize);
    window.removeEventListener("orientationchange", onOrientationChange);
    document.removeEventListener("touchmove", onScrollIntent);
    document.removeEventListener("wheel", onScrollIntent);
    document.removeEventListener("input", onEditIntent);
    document.removeEventListener("pointerdown", onEditIntent);
    root.classList.remove("input-focus-active");
    root.classList.remove("keyboard-open");
    root.classList.remove("viewport-short");
    root.style.removeProperty("--visual-viewport-height");
    root.style.removeProperty("--visual-viewport-top");
    root.style.removeProperty("--visual-viewport-inset-bottom");
  };
}

export function useMobileInputViewport() {
  useEffect(() => installMobileInputViewport(), []);
}
