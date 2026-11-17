export type Location = {
  id?: number;
  name: string;
  region?: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type Atmosphere = {
  cloud_cover: number;
  low_clouds: number | null;
  mid_clouds: number | null;
  high_clouds: number | null;
  humidity: number | null;
  visibility_km: number | null;
  precipitation_probability: number | null;
};

export type Forecast = {
  prediction_id: string;
  model_kind: "heuristic" | "trained";
  location: Location;
  date: string;
  sunset_at: string;
  sunset_display: string;
  best_window_start: string;
  best_window_end: string;
  best_window_display: string;
  palette: string[];
  dominant_colors: string[];
  vibrancy: number;
  confidence: number;
  summary: string;
  interpretation_label: string;
  atmosphere: Atmosphere;
  forecast_horizon_hours: number;
};

export type WeeklyForecast = {
  location: Location;
  best_prediction_id: string;
  days: Forecast[];
  weather_source?: "open-meteo" | "7timer";
  freshness?: {
    source: "live" | "cache";
    fetched_at: string;
  };
};

export type Evaluation = {
  observation_id: string;
  prediction_id: string;
  forecast_palette: string[];
  observed_palette: string[];
  mean_delta_e: number;
  palette_accuracy: number;
  privacy_note: string;
};

export type AiSkyReading = {
  title: string;
  observed_mood: string;
  color_story: string;
  atmosphere_story: string;
  forecast_match: string;
  photography_tip: string;
  confidence_note: string;
  match_score: number;
};

