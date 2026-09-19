import { useEffect, useState } from "react";

/** Card art with a stable initial tile when the public image is missing. */
export function PublicCardPlaceholder({
  name,
  image,
  className = "card-placeholder",
}: {
  name: string;
  image?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  if (!image || failed) {
    return <span className={className} role="img" aria-label={`${name} card image unavailable`}>{name.slice(0, 1)}</span>;
  }
  return (
    <img
      className={className}
      src={image}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
