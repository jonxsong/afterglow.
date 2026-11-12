"use client";

import { useQuery } from "@tanstack/react-query";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchLocations } from "@/lib/api";
import type { Location } from "@/lib/types";

type Props = {
  onSelect: (location: Location) => void;
  recent: Location[];
};

export function LocationSearch({ onSelect, recent }: Props) {
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
    queryKey: ["locations", debounced],
    queryFn: () => searchLocations(debounced),
    enabled: debounced.length >= 2,
  });

  function choose(location: Location) {
    onSelect(location);
    setOpen(false);
    setQuery("");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoMessage("Location is not available in this browser.");
      return;
    }
    setGeoMessage("Finding your horizon…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        choose({
          name: "Current location",
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone,
        });
      },
      () => setGeoMessage("Permission was not granted. You can still search for a city."),
      { timeout: 8000 },
    );
  }

  return (
    <>
      <button className="location-trigger" onClick={() => setOpen(true)}>
        <MapPin size={16} aria-hidden /> Change location
      </button>
      {open && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Choose a location">
          <div className="search-panel">
            <button className="icon-button search-close" onClick={() => setOpen(false)} aria-label="Close location search"><X /></button>
            <p className="eyebrow">FIND YOUR SKY</p>
            <h2>Where will you watch?</h2>
            <label className="search-field">
              <Search size={20} aria-hidden />
              <span className="sr-only">Search city or region</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or region" />
            </label>
            <button className="current-location" onClick={useCurrentLocation}><LocateFixed size={18} /> Use my current location</button>
            {geoMessage && <p className="search-note" role="status">{geoMessage}</p>}
            <div className="search-results">
              {results.isFetching && <p className="search-note">Looking across the map…</p>}
              {results.error && <p className="search-error">{results.error.message}</p>}
              {results.data?.map((location) => (
                <button key={`${location.latitude}-${location.longitude}`} onClick={() => choose(location)}>
                  <MapPin size={17} />
                  <span><strong>{location.name}</strong><small>{[location.region, location.country].filter(Boolean).join(", ")}</small></span>
                </button>
              ))}
              {!query && recent.length > 0 && (
                <>
                  <p className="results-heading">RECENT</p>
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

