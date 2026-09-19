import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOwnership } from "./Primitives";

/** One owned information layer for pointer, touch and keyboard explanations. */
export function InformationButton({ title, children, content, className = "", label, onOpen, pressed }: {
  title: string; children: ReactNode; content: ReactNode; className?: string; label?: string; onOpen?: () => void; pressed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  useDialogOwnership(open, () => setOpen(false), dialog, close, trigger.current);
  return <>
    <button ref={trigger} type="button" className={`information-trigger ${className}`} aria-label={label ?? title} aria-haspopup="dialog" aria-expanded={open} aria-pressed={pressed}
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); }}
      onClick={(event) => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); onOpen?.(); setOpen(true); }}>{children}</button>
    {open && createPortal(<div className="information-scrim" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className="information-layer" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header><h2 id={id}>{title}</h2><button ref={close} type="button" className="icon-button" aria-label={`Close ${title}`} onClick={() => setOpen(false)}><X aria-hidden="true" /></button></header>
        <div className="information-content">{content}</div>
      </section>
    </div>, document.body)}
  </>;
}
