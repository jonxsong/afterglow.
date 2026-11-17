"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useLocale } from "./locale-provider";
import { SkyVisualization } from "./sky-visualization";

const FIRST_MINUTE = -90;
const LAST_MINUTE = 90;
const STEP = 5;
const stops = [
  { offset: -35, label: "beforeSunset" },
  { offset: 0, label: "sunset" },
  { offset: 35, label: "afterSunset" },
] as const;

type Props = {
  palette: string[];
  cloudCover: number;
  sunsetAt: string;
  timezone: string;
  sample?: boolean;
};

export function SkyTimeline({ palette, cloudCover, sunsetAt, timezone, sample = false }: Props) {
  const { locale, t } = useLocale();
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sliderId = useId();
  const noteId = useId();

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = Math.min(offset + STEP, LAST_MINUTE);
      setOffset(next);
      if (next === LAST_MINUTE) setPlaying(false);
    }, 190);
    return () => window.clearTimeout(timer);
  }, [offset, playing]);

  const clock = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const formatTime = (minutes: number) => clock.format(new Date(Date.parse(sunsetAt) + minutes * 60_000));
  const phase = offset < 0 ? "beforeSunset" : offset > 0 ? "afterSunset" : "sunset";
  const selectedTime = formatTime(offset);

  function selectTime(minutes: number) {
    setPlaying(false);
    setOffset(minutes);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (offset === 0 || offset === LAST_MINUTE) setOffset(FIRST_MINUTE);
    setPlaying(true);
  }

  return (
    <div className="forecast-visual">
      <SkyVisualization
        palette={palette}
        cloudCover={cloudCover}
        timeOffsetMinutes={offset}
        interpretationLabel={t(sample ? "sampleSky" : "forecastInterpretation")}
        interactionLabel={t("moveToExplore")}
      />
      <div className="sky-timeline">
        <div className="sky-timeline-heading">
          <div><label htmlFor={sliderId}>{t("exploreEvening")}</label><span className="sky-timeline-time">{selectedTime}</span></div>
          <button className="sky-play" type="button" onClick={togglePlayback}>
            {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            {t(playing ? "pauseEvening" : "playEvening")}
          </button>
        </div>
        <input
          id={sliderId}
          type="range"
          min={FIRST_MINUTE}
          max={LAST_MINUTE}
          step={STEP}
          value={offset}
          onChange={(event) => selectTime(Number(event.target.value))}
          aria-valuetext={`${selectedTime}, ${t(phase)}`}
          aria-describedby={noteId}
        />
        <div className="sky-timeline-marks" aria-hidden><span>{formatTime(FIRST_MINUTE)}</span><span>{formatTime(LAST_MINUTE)}</span></div>
        <div className="sky-timeline-stops">
          {stops.map((stop) => (
            <button key={stop.offset} type="button" aria-pressed={offset === stop.offset} onClick={() => selectTime(stop.offset)}>
              {t(stop.label)}
            </button>
          ))}
        </div>
        <p id={noteId}>{t(sample ? "sampleTimelineNote" : "timelineNote")}</p>
      </div>
    </div>
  );
}
