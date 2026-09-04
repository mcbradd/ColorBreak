import { useEffect, useState } from "react";

/**
 * Card art, with the initial-letter tile as its fallback rather than its
 * only state. Scryfall serves the images; a card that has no image URL, or
 * whose image fails to load, keeps the tile so a row never collapses.
 */
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
