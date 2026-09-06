import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function useShareFeedback() {
  const [notice, setNotice] = useState<{ text: string; id: number }>();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ text: "Break link copied to clipboard", id: Date.now() });
    } catch {
      setNotice({ text: "Couldn’t copy. Copy the link from your address bar.", id: Date.now() });
    }
  };
  return { copy, toast: notice ? createPortal(<div className="share-toast" role="status" aria-live="polite">{notice.text}</div>, document.body) : null };
}
