import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/** One positioning/dismissal owner for touch help and non-modal pointer previews. */
export function AnchoredTip({ id, text, anchor, onDismiss, restoreFocus = true, onPointerEnter, onPointerLeave }: {
  id: string; text: string; anchor: RefObject<HTMLElement | null>; onDismiss: () => void; restoreFocus?: boolean;
  onPointerEnter?: () => void; onPointerLeave?: () => void;
}) {
  const popover = useRef<HTMLSpanElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const place = useCallback(() => {
    if (!anchor.current || !popover.current) return;
    const box = anchor.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    popover.current.style.maxHeight = `${Math.max(24, Math.min(240, height - 24))}px`;
    popover.current.style.maxWidth = `${Math.max(24, width - 24)}px`;
    const popup = popover.current.getBoundingClientRect();
    setPosition({
      left: Math.max(left + 12, Math.min(left + width - popup.width - 12, box.left + box.width / 2 - popup.width / 2)),
      top: Math.max(top + 12, Math.min(top + height - popup.height - 12, box.top - popup.height - 8 >= top + 12 ? box.top - popup.height - 8 : box.bottom + 8)),
    });
  }, [anchor]);
  useLayoutEffect(place, [place, text]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) dismiss.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); dismiss.current();
      if (restoreFocus) anchor.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor, place, restoreFocus]);
  return createPortal(<span ref={popover} id={id} className="tip-popover" role="tooltip" style={position} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
    {text.split(/\n\s*\n/).map(paragraph => {
      const trimmed = paragraph.trim(), lead = /^([A-Z][A-Za-z' -]{0,24}):\s+(.*)$/s.exec(trimmed);
      return <span className="tip-paragraph" key={trimmed}>{lead ? <><b>{lead[1]}</b> {lead[2]}</> : trimmed}</span>;
    })}
  </span>, document.body);
}
