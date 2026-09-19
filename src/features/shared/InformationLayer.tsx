import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOwnership } from "./Primitives";
import { AnchoredTip } from "./AnchoredTip";

/** One owned information layer for pointer, touch and keyboard explanations. */
export function InformationButton({ title, children, content, className = "", label, onOpen, pressed, preview }: {
  title: string; children: ReactNode; content: ReactNode; className?: string; label?: string; onOpen?: () => void; pressed?: boolean; preview?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => { clearTimeout(timer.current); };
  const dismissPreview = () => { clear(); setHovered(false); };
  const leave = () => { clear(); timer.current = setTimeout(() => setHovered(false), 120); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  useDialogOwnership(open, () => setOpen(false), dialog, close, trigger.current);
  return <>
    <button ref={trigger} type="button" className={`information-trigger ${className}`} aria-label={label ?? title} aria-haspopup="dialog" aria-expanded={open} aria-pressed={pressed}
      aria-describedby={hovered ? `${id}-preview` : undefined}
      onPointerEnter={(event) => { if (event.pointerType === "touch" || open) return; clear(); timer.current = setTimeout(() => setHovered(true), 350); }} onPointerLeave={leave} onBlur={dismissPreview}
      onPointerDown={(event) => { dismissPreview(); event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); }}
      onClick={(event) => { dismissPreview(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onOpen?.(); setOpen(true); }}>{children}</button>
    {hovered && !open && <AnchoredTip id={`${id}-preview`} text={preview ?? `${title}. Select to explore the details.`} anchor={trigger} onDismiss={dismissPreview} restoreFocus={false} onPointerEnter={clear} onPointerLeave={leave} />}
    {open && createPortal(<div className="information-scrim" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className="information-layer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header><h2 id={id}>{title}</h2><button ref={close} type="button" className="icon-button" aria-label={`Close ${title}`} onClick={() => setOpen(false)}><X aria-hidden="true" /></button></header>
        <div className="information-content">{content}</div>
      </section>
    </div>, document.body)}
  </>;
}
