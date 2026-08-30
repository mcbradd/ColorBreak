export function PublicCardPlaceholder({ name, className = "card-placeholder" }: { name: string; className?: string }) {
  return <span className={className} role="img" aria-label={`${name} card image unavailable`}>{name.slice(0, 1)}</span>;
}
