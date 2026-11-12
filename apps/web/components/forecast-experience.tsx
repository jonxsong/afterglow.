"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Camera, Check, Cloud, Droplets, Eye, Sparkles, Upload } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getWeeklyForecast, rememberForecastPalette, uploadObservation } from "@/lib/api";
import type { Evaluation, Location } from "@/lib/types";
import { LocationSearch } from "./location-search";
import { SkyVisualization } from "./sky-visualization";

const DEFAULT_LOCATION: Location = {
  name: "San Francisco",
  region: "California",
  country: "United States",
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: "America/Los_Angeles",
};

function formatDay(date: string, index: number) {
  if (index === 0) return "Tonight";
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

function Palette({ colors, small = false }: { colors: string[]; small?: boolean }) {
  return <div className={`palette ${small ? "palette--small" : ""}`} aria-label={`Palette: ${colors.join(", ")}`}>
    {colors.map((color) => <span key={color} style={{ backgroundColor: color }} title={color} />)}
  </div>;
}

function ScoreRing({ value }: { value: number }) {
  return (
    <div className="score-ring" style={{ "--score": value } as React.CSSProperties} aria-label={`Vibrancy score ${value} out of 100`}>
      <div><strong>{value}</strong><span>/100</span></div>
    </div>
  );
}

export function ForecastExperience() {
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
      <div className="section-kicker"><span>01</span><p>TONIGHT’S FORECAST</p></div>
      <AnimatePresence mode="wait">
        {forecast.isLoading && (
          <motion.div className="forecast-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="loading-sky" /><p>Reading the evening atmosphere…</p>
          </motion.div>
        )}
        {forecast.error && (
          <motion.div className="forecast-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="eyebrow">THE SKY WENT QUIET</p>
            <h2>We couldn’t read this evening yet.</h2>
            <p>{forecast.error.message}</p>
            <button onClick={() => forecast.refetch()}>Try again <ArrowRight size={16} /></button>
          </motion.div>
        )}
        {tonight && (
          <motion.div key={tonight.prediction_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="forecast-heading">
              <div>
                <p className="eyebrow">{tonight.date}</p>
                <h2>{tonight.location.name}{tonight.location.region ? `, ${tonight.location.region}` : ""}</h2>
              </div>
              <LocationSearch onSelect={selectLocation} recent={recent} />
            </div>

            <div className="forecast-card">
              <div className="forecast-visual">
                <SkyVisualization palette={tonight.palette} cloudCover={tonight.atmosphere.cloud_cover} />
              </div>
              <div className="forecast-details">
                <div className="sunset-time"><span>Sunset</span><strong>{tonight.sunset_display}</strong></div>
                <p className="forecast-summary">“{tonight.summary}”</p>
                <div className="palette-block">
                  <p>Predicted colors</p>
                  <Palette colors={tonight.palette} />
                  <span>{tonight.dominant_colors.join(" · ")}</span>
                </div>
                <div className="score-row">
                  <ScoreRing value={tonight.vibrancy} />
                  <div><span>Vibrancy</span><strong>{tonight.vibrancy >= 80 ? "Exceptional" : tonight.vibrancy >= 65 ? "Beautiful" : tonight.vibrancy >= 45 ? "Gentle" : "Subtle"}</strong><p>{tonight.confidence}% forecast confidence</p></div>
                </div>
                <div className="viewing-window"><Sparkles size={18} /><div><span>Best time to step outside</span><strong>{tonight.best_window_display}</strong></div></div>
              </div>
            </div>

            <div className="atmosphere-grid">
              <article><Cloud /><span>Cloud cover</span><strong>{tonight.atmosphere.cloud_cover}%</strong><small>{tonight.atmosphere.high_clouds}% high cloud</small></article>
              <article><Droplets /><span>Humidity</span><strong>{tonight.atmosphere.humidity}%</strong><small>{tonight.atmosphere.precipitation_probability}% chance of rain</small></article>
              <article><Eye /><span>Visibility</span><strong>{tonight.atmosphere.visibility_km} km</strong><small>At the sunset hour</small></article>
            </div>
            <p className="method-note"><span>Heuristic forecast</span> Based on live weather data and solar geometry—not a photograph or trained-ML claim.</p>

            <div className="weekly-block" id="explore">
              <div className="weekly-heading"><div><p className="eyebrow">THE WEEK AHEAD</p><h3>Seven evenings, at a glance.</h3></div><p>Confidence naturally decreases farther into the forecast.</p></div>
              <div className="week-grid">
                {forecast.data?.days.map((day, index) => (
                  <article className={day.prediction_id === forecast.data?.best_prediction_id ? "best-day" : ""} key={day.prediction_id}>
                    {day.prediction_id === forecast.data?.best_prediction_id && <span className="best-label">BEST</span>}
                    <p>{formatDay(day.date, index)}</p>
                    <strong>{day.sunset_display}</strong>
                    <Palette colors={day.palette} small />
                    <div><b>{day.vibrancy}</b><span>vibrancy</span></div>
                    <small>{day.confidence}% confidence</small>
                  </article>
                ))}
              </div>
            </div>

            <div className="verify-block">
              <div className="verify-copy"><p className="eyebrow">CLOSE THE LOOP</p><h3>What did the sky actually do?</h3><p>Upload tonight’s sunset and Afterglow will compare its colors with this saved forecast. Your image remains private.</p></div>
              <label className={`upload-card ${upload.isPending ? "uploading" : ""}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate({ predictionId: tonight.prediction_id, file });
                }} />
                {upload.isPending ? <><span className="spinner" /><strong>Reading the colors…</strong></> : <><Upload /><strong>Choose a sunset photo</strong><span>JPEG, PNG or WebP · 10 MB max</span></>}
              </label>
              {upload.error && <p className="upload-error">{upload.error.message}</p>}
              {evaluation && (
                <motion.div className="evaluation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Check /><div><p>Forecast comparison</p><strong>{evaluation.palette_accuracy}% palette similarity</strong><span>Mean color difference: {evaluation.mean_delta_e} ΔE</span></div>
                  <div><small>FORECAST</small><Palette colors={evaluation.forecast_palette} small /></div>
                  <div><small>OBSERVED</small><Palette colors={evaluation.observed_palette} small /></div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

