"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildForecastShareUrl } from "@/lib/forecast-share";
import type { Location } from "@/lib/types";
import { useLocale } from "./locale-provider";

type ShareFeedback = { kind: "copied" } | { kind: "manual"; url: string } | null;

export function ForecastShareButton({ location, disabled }: { location: Location; disabled: boolean }) {
  const { t } = useLocale();
  const [feedback, setFeedback] = useState<ShareFeedback>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const linkField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (feedback?.kind === "manual") {
      linkField.current?.focus({ preventScroll: true });
      linkField.current?.select();
    }
    if (feedback?.kind === "copied") {
      const timer = window.setTimeout(() => setFeedback(null), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [feedback]);

  async function shareForecast() {
    const url = buildForecastShareUrl(location, window.location.origin);

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setFeedback({ kind: "copied" });
        return;
      } catch { /* Offer a selectable link if the browser blocks clipboard access. */ }
    }
    setFeedback({ kind: "manual", url });
  }

  const copied = feedback?.kind === "copied";

  return (
    <div className="forecast-share">
      <button className="location-trigger" type="button" ref={trigger} disabled={disabled} onClick={shareForecast}>
        {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
        {t(copied ? "forecastLinkCopied" : "shareForecast")}
      </button>
      <span className="sr-only" role="status">{copied ? t("forecastLinkCopied") : ""}</span>
      {feedback?.kind === "manual" && (
        <label className="forecast-share-link">
          <span>{t("copyForecastLink")}</span>
          <input
            ref={linkField}
            type="url"
            value={feedback.url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setFeedback(null);
                trigger.current?.focus();
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
