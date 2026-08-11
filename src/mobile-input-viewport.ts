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
  let previousViewportHeight = viewport?.height ?? window.innerHeight;

  const viewportHeight = () => viewport?.height ?? window.innerHeight;
  const viewportTop = () => viewport?.offsetTop ?? 0;

  const syncViewport = () => {
    root.style.setProperty("--visual-viewport-height", `${viewportHeight()}px`);
    root.style.setProperty("--visual-viewport-top", `${viewportTop()}px`);
  };

  const revealFocused = () => {
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => {
      if (!session || document.activeElement !== session.element) return;
      const rect = session.element.getBoundingClientRect();
      const safeTop = viewportTop() + 20;
      const safeBottom = viewportTop() + viewportHeight() - 20;
      if (rect.top < safeTop || rect.bottom > safeBottom) {
        session.element.scrollIntoView?.({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }, 50);
  };

  const restore = () => {
    if (!session) return;
    const saved = session;
    session = null;
    root.classList.remove("input-focus-active");
    saved.scrollParents.forEach(({ element, left, top }) => {
      element.scrollTo?.({ behavior: "auto", left, top });
    });
    window.scrollTo({ behavior: "auto", left: saved.left, top: saved.top });
  };

  const keyboardIsClosed = () =>
    !session || viewportHeight() >= session.baselineHeight - 48;

  const requestRestore = () => {
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => {
      if (editableTarget(document.activeElement)) return;
      if (keyboardIsClosed()) restore();
      else restoreTimer = window.setTimeout(restore, 900);
    }, 120);
  };

  const onFocusIn = (event: FocusEvent) => {
    const element = editableTarget(event.target);
    if (!element) return;
    window.clearTimeout(restoreTimer);
    if (session) {
      session.element = element;
      session.baselineHeight = Math.max(session.baselineHeight, viewportHeight());
    } else {
      session = {
        baselineHeight: viewportHeight(),
        element,
        left: window.scrollX,
        scrollParents: scrollParents(element),
        top: window.scrollY,
      };
    }
    root.classList.add("input-focus-active");
    syncViewport();
    revealFocused();
  };

  const onFocusOut = () => requestRestore();
  const onViewportResize = () => {
    const nextHeight = viewportHeight();
    const keyboardOpened = nextHeight < previousViewportHeight - 48;
    const keyboardClosed = nextHeight > previousViewportHeight + 48;
    previousViewportHeight = nextHeight;
    syncViewport();
    if (keyboardOpened && session && document.activeElement === session.element) {
      revealFocused();
    } else if (keyboardClosed && session && !editableTarget(document.activeElement)) {
      requestRestore();
    }
  };
  const onViewportScroll = () => {
    window.clearTimeout(revealTimer);
    syncViewport();
  };
  const onOrientationChange = () => {
    previousViewportHeight = viewportHeight();
    syncViewport();
    if (session && document.activeElement === session.element) revealFocused();
  };

  syncViewport();
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  viewport?.addEventListener("resize", onViewportResize);
  viewport?.addEventListener("scroll", onViewportScroll);
  window.addEventListener("orientationchange", onOrientationChange);

  return () => {
    window.clearTimeout(revealTimer);
    window.clearTimeout(restoreTimer);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    viewport?.removeEventListener("resize", onViewportResize);
    viewport?.removeEventListener("scroll", onViewportScroll);
    window.removeEventListener("orientationchange", onOrientationChange);
    root.classList.remove("input-focus-active");
    root.style.removeProperty("--visual-viewport-height");
    root.style.removeProperty("--visual-viewport-top");
  };
}

export function useMobileInputViewport() {
  useEffect(() => installMobileInputViewport(), []);
}
