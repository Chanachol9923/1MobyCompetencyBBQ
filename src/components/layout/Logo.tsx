export function Logo({ className = "" }: { className?: string }) {
  // Wordmark approximation of the 1MOBY logo used across the Figma file.
  return (
    <span
      className={`select-none font-extrabold tracking-[0.08em] text-white ${className}`}
      style={{ fontStretch: "expanded" }}
    >
      <span className="relative">1</span>
      <span className="ml-0.5">MOBY</span>
    </span>
  );
}
