"use client";

import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRequest = useRef(0);
  const searchReady = open && debounced.length >= 2 && debounced === query.trim();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const results = useQuery({
    queryKey: ["locations", debounced, locale],
    queryFn: () => searchLocations(debounced, locale),
    enabled: searchReady,
  });

  function openSearch() {
    dialogRef.current?.showModal();
    setOpen(true);
    inputRef.current?.focus();
  }

  function resetSearch() {
    locationRequest.current += 1;
    setOpen(false);
    setQuery("");
    setDebounced("");
    setGeoMessage("");
    triggerRef.current?.focus({ preventScroll: true });
  }

  function choose(location: Location) {
    dialogRef.current?.close();
    onSelect(location);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoMessage(t("unavailableLocation"));
      return;
    }
    setGeoMessage(t("findingHorizon"));
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current || !dialogRef.current?.open) return;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        choose({
          name: t("currentLocationName"),
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone,
        });
      },
      () => {
        if (request === locationRequest.current && dialogRef.current?.open) {
          setGeoMessage(t("permissionDenied"));
        }
      },
      { timeout: 8000 },
    );
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="location-trigger" onClick={openSearch} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}>
        <MapPin size={16} aria-hidden /> {t("changeLocation")}
      </button>
      <dialog ref={dialogRef} id={dialogId} className="search-overlay" aria-labelledby={`${dialogId}-heading`} onClose={resetSearch}>
        <div className="search-panel">
          <button type="button" className="icon-button search-close" onClick={() => dialogRef.current?.close()} aria-label={t("closeLocation")}><X aria-hidden /></button>
          <p className="eyebrow">{t("findSky")}</p>
          <h2 id={`${dialogId}-heading`}>{t("watchWhere")}</h2>
          <label className="search-field">
            <Search size={20} aria-hidden />
            <span className="sr-only">{t("searchRegion")}</span>
            <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("cityRegion")} />
          </label>
          <button type="button" className="current-location" onClick={useCurrentLocation}><LocateFixed size={18} aria-hidden /> {t("currentLocation")}</button>
          {geoMessage && <p className="search-note" role="status">{geoMessage}</p>}
          <div className="search-results">
            {searchReady && results.isFetching && <p className="search-note" role="status">{t("searchingMap")}</p>}
            {searchReady && results.error && <p className="search-error" role="status">{locale === "zh" ? t("locationSearchUnavailable") : results.error.message}</p>}
            {searchReady && !results.isFetching && results.data?.length === 0 && <p className="search-note" role="status">{t("noCities")}</p>}
            {searchReady && results.data?.map((location) => (
              <button type="button" key={`${location.latitude}-${location.longitude}`} onClick={() => choose(location)}>
                <MapPin size={17} aria-hidden />
                <span><strong>{location.name}</strong><small>{[location.region, location.country].filter(Boolean).join(", ")}</small></span>
              </button>
            ))}
            {!query.trim() && recent.length > 0 && (
              <>
                <p className="results-heading">{t("recent")}</p>
                {recent.map((location) => (
                  <button type="button" key={`${location.latitude}-${location.longitude}`} onClick={() => choose(location)}>
                    <MapPin size={17} aria-hidden /><span><strong>{location.name}</strong><small>{location.region || location.country}</small></span>
                  </button>
                ))}
              </>
            )}
          </div>
          <p className="search-note source-credit">{t("cityIndexCredit")} <a href="https://www.geonames.org/">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
        </div>
      </dialog>
    </>
  );
}

