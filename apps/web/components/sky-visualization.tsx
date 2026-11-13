"use client";

import { type CSSProperties, type PointerEvent, useRef } from "react";

type Props = {
  palette: string[];
  cloudCover: number;
  compact?: boolean;
  interpretationLabel?: string;
  interactionLabel?: string;
};

const particles = [
  [12, 18, 1], [23, 29, 2], [34, 14, 1], [47, 25, 2], [58, 12, 1], [69, 31, 1],
  [79, 17, 2], [88, 27, 1], [18, 46, 1], [41, 41, 1], [63, 48, 2], [84, 43, 1],
] as const;

export function SkyVisualization({
  palette,
  cloudCover,
  compact = false,
  interpretationLabel = "Forecast interpretation",
  interactionLabel = "Move to explore",
}: Props) {
  const colors = palette.length >= 5 ? palette : ["#F8D6AE", "#F4B184", "#E88772", "#B9798D", "#6F6A9B"];
  const skyRef = useRef<HTMLDivElement>(null);

  function moveSky(event: PointerEvent<HTMLDivElement>) {
    if (compact) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
    event.currentTarget.style.setProperty("--mx", x.toFixed(3));
    event.currentTarget.style.setProperty("--my", y.toFixed(3));
  }

  function settleSky() {
    skyRef.current?.style.setProperty("--mx", "0");
    skyRef.current?.style.setProperty("--my", "0");
  }

  const style = {
    "--sky-dawn": colors[0],
    "--sky-gold": colors[1],
    "--sky-rose": colors[2],
    "--sky-violet": colors[3],
    "--sky-night": colors[4],
    "--mx": 0,
    "--my": 0,
    background: `linear-gradient(180deg, ${colors[4]} 0%, ${colors[3]} 31%, ${colors[2]} 53%, ${colors[1]} 73%, ${colors[0]} 100%)`,
  } as CSSProperties;

  return (
    <div
      ref={skyRef}
      className={`sky ${compact ? "sky--compact" : ""}`}
      style={style}
      role="img"
      aria-label={interpretationLabel}
      onPointerMove={moveSky}
      onPointerLeave={settleSky}
    >
      <div className="sky-ambient" aria-hidden />
      <div className="light-rays" aria-hidden><i /><i /><i /></div>
      <div className="stardust" aria-hidden>
        {particles.map(([left, top, size], index) => <i key={index} style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${index * -.47}s` }} />)}
      </div>
      <div className="sun-path" aria-hidden>
        <div className="sun-halo sun-halo--outer" />
        <div className="sun-halo sun-halo--inner" />
        <div className="sun-orb" style={{ background: `radial-gradient(circle at 38% 32%, #fff8e8, ${colors[0]} 48%, ${colors[1]} 100%)`, boxShadow: `0 0 90px 28px ${colors[1]}77` }} />
      </div>
      <div className="cloud-layer cloud--high" style={{ opacity: 0.08 + cloudCover / 320 }} aria-hidden />
      <div className="cloud-layer cloud--middle" style={{ opacity: 0.07 + cloudCover / 280 }} aria-hidden />
      <div className="cloud-layer cloud--low" style={{ opacity: 0.06 + cloudCover / 250 }} aria-hidden />
      <div className="haze-line haze-line--one" aria-hidden />
      <div className="haze-line haze-line--two" aria-hidden />
      <div className="sun-reflection" style={{ background: `linear-gradient(180deg, ${colors[0]}88, transparent)` }} aria-hidden />
      <div className="horizon horizon--far" aria-hidden />
      <div className="horizon horizon--near" aria-hidden />
      {!compact && <div className="sky-labels"><span className="interaction-label">{interactionLabel}</span><span className="visual-label">{interpretationLabel}</span></div>}
    </div>
  );
}

