"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, Check, Cloud, Droplets, Eye, Sparkles, Upload } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getWeeklyForecast, rememberForecastPalette, uploadObservation } from "@/lib/api";
import type { Evaluation, Location } from "@/lib/types";
import { LocationSearch } from "./location-search";
import { type CopyKey, type Locale, useLocale } from "./locale-provider";
import { SkyVisualization } from "./sky-visualization";

const DEFAULT_LOCATION: Location = {
  name: "San Francisco",
  region: "California",
  country: "United States",
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: "America/Los_Angeles",
};

function formatDay(date: string, index: number, locale: Locale, tonight: string) {
  if (index === 0) return tonight;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

function Palette({ colors, label, small = false }: { colors: string[]; label: string; small?: boolean }) {
  return <div className={`palette ${small ? "palette--small" : ""}`} aria-label={`${label}: ${colors.join(", ")}`}>
    {colors.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
  </div>;
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="score-ring" style={{ "--score": value } as React.CSSProperties} aria-label={`${label}: ${value}`}>
      <div><strong>{value}</strong><span>/100</span></div>
    </div>
  );
}

const colorNames: Record<string, string> = {
  Peach: "桃色", Rose: "玫瑰色", Lavender: "薰衣草紫", Amber: "琥珀色", Plum: "梅子紫", Pewter: "青灰色",
  Mauve: "淡紫红", Slate: "石板蓝", Apricot: "杏色", Coral: "珊瑚色", Violet: "紫罗兰色",
};

const summaryZh: Record<string, string> = {
  "Soft color with a gentle, lingering afterglow.": "柔和的色彩，将留下一段轻盈而绵长的余晖。",
  "Quiet color behind a soft, clouded horizon.": "柔和的云层之后，是一场安静含蓄的晚霞。",
  "A layered sky with a strong chance of dramatic color.": "层云将托住余晖，很可能出现浓烈而戏剧性的色彩。",
  "A clean horizon, warm at first and violet after.": "地平线清朗，先是暖色，随后沉入紫罗兰。",
};

function localizedLocation(location: Location, locale: Locale) {
  if (locale !== "zh") return [location.name, location.region].filter(Boolean).join(", ");
  const known: Record<string, string> = { "San Francisco": "旧金山", California: "加利福尼亚州", "United States": "美国", "Current location": "当前位置" };
  return [known[location.name] ?? location.name, location.region ? (known[location.region] ?? location.region) : ""].filter(Boolean).join("，");
}

function localError(message: string, locale: Locale, t: (key: CopyKey) => string) {
  if (locale === "en") return message;
  if (message.includes("10 MB")) return t("uploadTooLarge");
  if (message.includes("JPEG") || message.includes("WebP")) return t("uploadType");
  if (message.includes("read the image")) return t("imageUnreadable");
  if (message.includes("Location search")) return t("locationSearchUnavailable");
  if (message.includes("atmosphere") || message.includes("forecast")) return t("forecastUnavailable");
  return t("serviceUnavailable");
}

export function ForecastExperience() {
  const { locale, t } = useLocale();
  const [location, setLocation] = useState<Location>(DEFAULT_LOCATION);
  const [recent, setRecent] = useState<Location[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("afterglow:recent");
    if (saved) {
      try { setRecent(JSON.parse(saved)); } catch { /* ignore invalid local data */ }
    }
  }, []);

  function selectLocation(next: Location) {
    setLocation(next);
    setEvaluation(null);
    const updated = [next, ...recent.filter((item) => item.latitude !== next.latitude || item.longitude !== next.longitude)].slice(0, 5);
    setRecent(updated);
    window.localStorage.setItem("afterglow:recent", JSON.stringify(updated));
  }

  const forecast = useQuery({
    queryKey: ["weekly-forecast", location.latitude, location.longitude, location.timezone],
    queryFn: () => getWeeklyForecast(location),
  });
  const upload = useMutation({
    mutationFn: ({ predictionId, file }: { predictionId: string; file: File }) => uploadObservation(predictionId, file),
    onSuccess: setEvaluation,
  });
  const tonight = forecast.data?.days[0];

  useEffect(() => {
    if (tonight) rememberForecastPalette(tonight.prediction_id, tonight.palette);
  }, [tonight]);

  return (
    <section id="forecast" className="forecast-section">
      <div className="section-kicker"><span>01</span><p>{t("tonightForecast")}</p></div>
      <AnimatePresence mode="wait">
        {forecast.isLoading && (
          <motion.div className="forecast-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="loading-sky" /><p>{t("loading")}</p>
          </motion.div>
        )}
        {forecast.error && (
          <motion.div className="forecast-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="eyebrow">{t("errorEyebrow")}</p>
            <h2>{t("errorTitle")}</h2>
            <p>{localError(forecast.error.message, locale, t)}</p>
            <button onClick={() => forecast.refetch()}>{t("tryAgain")} <ArrowRight size={16} /></button>
          </motion.div>
        )}
        {tonight && (
          <motion.div key={tonight.prediction_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="forecast-heading">
              <div>
                <p className="eyebrow">{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${tonight.date}T12:00:00`))}</p>
                <h2>{localizedLocation(tonight.location, locale)}</h2>
              </div>
              <LocationSearch onSelect={selectLocation} recent={recent} />
            </div>

            <div className="forecast-card">
              <div className="forecast-visual">
                <SkyVisualization palette={tonight.palette} cloudCover={tonight.atmosphere.cloud_cover} interpretationLabel={t("forecastInterpretation")} interactionLabel={t("moveToExplore")} />
              </div>
              <div className="forecast-details">
                <div className="sunset-time"><span>{t("sunset")}</span><strong>{tonight.sunset_display}</strong></div>
                <p className="forecast-summary">“{locale === "zh" ? (summaryZh[tonight.summary] ?? tonight.summary) : tonight.summary}”</p>
                <div className="palette-block">
                  <p>{t("predictedColors")}</p>
                  <Palette colors={tonight.palette} label={t("paletteLabel")} />
                  <span>{tonight.dominant_colors.map((color) => locale === "zh" ? (colorNames[color] ?? color) : color).join(" · ")}</span>
                </div>
                <div className="score-row">
                  <ScoreRing value={tonight.vibrancy} label={`${t("scoreLabel")} ${t("outOf")}`} />
                  <div><span>{t("vibrancy")}</span><strong>{tonight.vibrancy >= 80 ? t("exceptional") : tonight.vibrancy >= 65 ? t("beautiful") : tonight.vibrancy >= 45 ? t("gentle") : t("subtle")}</strong><p>{tonight.confidence}% {t("confidence")}</p></div>
                </div>
                <div className="viewing-window"><Sparkles size={18} /><div><span>{t("bestTime")}</span><strong>{tonight.best_window_display}</strong></div></div>
              </div>
            </div>

            <div className="atmosphere-grid">
              <article><Cloud /><span>{t("cloudCover")}</span><strong>{tonight.atmosphere.cloud_cover}%</strong><small>{tonight.atmosphere.high_clouds}% {t("highCloud")}</small></article>
              <article><Droplets /><span>{t("humidity")}</span><strong>{tonight.atmosphere.humidity}%</strong><small>{tonight.atmosphere.precipitation_probability}% {t("rainChance")}</small></article>
              <article><Eye /><span>{t("visibility")}</span><strong>{tonight.atmosphere.visibility_km} km</strong><small>{t("sunsetHour")}</small></article>
            </div>
            <p className="method-note"><span>{t("heuristic")}</span> {t("method")}</p>

            <div className="weekly-block" id="explore">
              <div className="weekly-heading"><div><p className="eyebrow">{t("weekAhead")}</p><h3>{t("weekTitle")}</h3></div><p>{t("weekNote")}</p></div>
              <div className="week-grid">
                {forecast.data?.days.map((day, index) => (
                  <article className={day.prediction_id === forecast.data?.best_prediction_id ? "best-day" : ""} key={day.prediction_id}>
                    {day.prediction_id === forecast.data?.best_prediction_id && <span className="best-label">{t("best")}</span>}
                    <p>{formatDay(day.date, index, locale, t("tonight"))}</p>
                    <strong>{day.sunset_display}</strong>
                    <Palette colors={day.palette} label={t("paletteLabel")} small />
                    <div><b>{day.vibrancy}</b><span>{t("vibrancy")}</span></div>
                    <small>{day.confidence}% {t("confidence")}</small>
                  </article>
                ))}
              </div>
            </div>

            <div className="verify-block">
              <div className="verify-copy"><p className="eyebrow">{t("closeLoop")}</p><h3>{t("verifyTitle")}</h3><p>{t("verifyBody")}</p></div>
              <label className={`upload-card ${upload.isPending ? "uploading" : ""}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate({ predictionId: tonight.prediction_id, file });
                }} />
                {upload.isPending ? <><span className="spinner" /><strong>{t("readingColors")}</strong></> : <><Upload /><strong>{t("choosePhoto")}</strong><span>{t("photoRequirements")}</span></>}
              </label>
              {upload.error && <p className="upload-error">{localError(upload.error.message, locale, t)}</p>}
              {evaluation && (
                <motion.div className="evaluation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Check /><div><p>{t("comparison")}</p><strong>{evaluation.palette_accuracy}% {t("paletteSimilarity")}</strong><span>{t("meanDifference")}: {evaluation.mean_delta_e} ΔE</span></div>
                  <div><small>{t("forecast")}</small><Palette colors={evaluation.forecast_palette} label={t("paletteLabel")} small /></div>
                  <div><small>{t("observed")}</small><Palette colors={evaluation.observed_palette} label={t("paletteLabel")} small /></div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

