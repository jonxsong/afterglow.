"use client";

import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchLocations } from "@/lib/api";
import type { Location } from "@/lib/types";
import { useLocale } from "./locale-provider";

type Props = {
  onSelect: (location: Location) => void;
  recent: Location[];
};

export function LocationSearch({ onSelect, recent }: Props) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [geoMessage, setGeoMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useQuery({
    queryKey: ["locations", debounced, locale],
    queryFn: () => searchLocations(debounced, locale),
    enabled: debounced.length >= 2,
  });

  function choose(location: Location) {
    onSelect(location);
    setOpen(false);
    setQuery("");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoMessage(t("unavailableLocation"));
      return;
    }
    setGeoMessage(t("findingHorizon"));
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        choose({
          name: t("currentLocationName"),
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone,
        });
      },
      () => setGeoMessage(t("permissionDenied")),
      { timeout: 8000 },
    );
  }

  return (
    <>
      <button className="location-trigger" onClick={() => setOpen(true)}>
        <MapPin size={16} aria-hidden /> {t("changeLocation")}
      </button>
      {open && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label={t("chooseLocation")}>
          <div className="search-panel">
            <button className="icon-button search-close" onClick={() => setOpen(false)} aria-label={t("closeLocation")}><X /></button>
            <p className="eyebrow">{t("findSky")}</p>
            <h2>{t("watchWhere")}</h2>
            <label className="search-field">
              <Search size={20} aria-hidden />
              <span className="sr-only">{t("searchRegion")}</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("cityRegion")} />
            </label>
            <button className="current-location" onClick={useCurrentLocation}><LocateFixed size={18} /> {t("currentLocation")}</button>
            {geoMessage && <p className="search-note" role="status">{geoMessage}</p>}
            <div className="search-results">
              {results.isFetching && <p className="search-note">{t("searchingMap")}</p>}
              {results.error && <p className="search-error">{locale === "zh" ? t("locationSearchUnavailable") : results.error.message}</p>}
              {results.data?.map((location) => (
                <button key={`${location.latitude}-${location.longitude}`} onClick={() => choose(location)}>
                  <MapPin size={17} />
                  <span><strong>{location.name}</strong><small>{[location.region, location.country].filter(Boolean).join(", ")}</small></span>
                </button>
              ))}
              {!query && recent.length > 0 && (
                <>
                  <p className="results-heading">{t("recent")}</p>
                  {recent.map((location) => (
                    <button key={`${location.latitude}-${location.longitude}`} onClick={() => choose(location)}>
                      <MapPin size={17} /><span><strong>{location.name}</strong><small>{location.region || location.country}</small></span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

