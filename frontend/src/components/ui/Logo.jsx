import spotxLogo from "../../assets/spotx-logo.png";

// The source asset's "Spot" wordmark is drawn white with only a hairline
// outline — legible on a dark ground, invisible on a light one. On light
// backgrounds we back it with a small dark badge instead of the page's
// own background so the real logo stays usable everywhere.
const HEIGHTS = { sm: 26, md: 36, lg: 56 };
const BADGE_PADDING = { sm: "px-2 py-1.5", md: "px-3 py-2", lg: "px-4 py-3" };

export default function Logo({ size = "md", dark = false, className = "" }) {
  const img = (
    <img
      src={spotxLogo}
      alt="SpotX"
      style={{ height: HEIGHTS[size], width: "auto" }}
    />
  );

  if (dark) {
    return <span className={`inline-flex items-center ${className}`}>{img}</span>;
  }

  return (
    <span className={`inline-flex items-center bg-brand-black rounded-lg ${BADGE_PADDING[size]} ${className}`}>
      {img}
    </span>
  );
}
