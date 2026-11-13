"use client";

type Props = {
  palette: string[];
  cloudCover: number;
  compact?: boolean;
  interpretationLabel?: string;
};

export function SkyVisualization({ palette, cloudCover, compact = false, interpretationLabel = "Forecast interpretation" }: Props) {
  const colors = palette.length >= 5 ? palette : ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"];
  return (
    <div
      className={`sky ${compact ? "sky--compact" : ""}`}
      style={{ background: `linear-gradient(180deg, ${colors[4]} 0%, ${colors[3]} 33%, ${colors[1]} 69%, ${colors[0]} 100%)` }}
      role="img"
      aria-label={interpretationLabel}
    >
      <div
        className="sun-orb"
        style={{ background: colors[0], boxShadow: `0 0 80px 24px ${colors[1]}88` }}
      />
      <div
        className="cloud cloud--one"
        style={{ opacity: 0.07 + cloudCover / 300 }}
      />
      <div
        className="cloud cloud--two"
        style={{ opacity: 0.05 + cloudCover / 380 }}
      />
      <div className="horizon" />
      {!compact && <span className="visual-label">{interpretationLabel}</span>}
    </div>
  );
}

