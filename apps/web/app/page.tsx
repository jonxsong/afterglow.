"use client";

import { ArrowDown, Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ForecastExperience } from "@/components/forecast-experience";
import { LanguageToggle, useLocale } from "@/components/locale-provider";
import { SkyVisualization } from "@/components/sky-visualization";

const heroPalette = ["#F7D4AA", "#EEAD7E", "#DA7E7A", "#A66F92", "#665E8B"];

export default function Home() {
  const { locale, t } = useLocale();
  return (
    <main>
      <header className="site-header">
        <a href="#top" aria-label={t("home")}><BrandLogo /></a>
        <div className="header-actions">
          <nav aria-label={t("navigation")}><a href="#explore">{t("explore")}</a><a href="#about">{t("about")}</a></nav>
          <LanguageToggle />
          <details className="mobile-menu">
            <summary aria-label={t("openMenu")}><Menu /></summary>
            <div><a href="#explore">{t("explore")}</a><a href="#about">{t("about")}</a></div>
          </details>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t("heroEyebrow")}</p>
          <h1 className={locale === "zh" ? "hero-title-zh" : ""}>{t("heroLineOne")}<br /><em>{t("heroLineTwo")}</em></h1>
          <p className="hero-description">{t("heroDescription")}</p>
          <a className="primary-cta" href="#forecast">{t("heroCta")} <ArrowDown size={17} /></a>
        </div>
        <div className="hero-art">
          <SkyVisualization palette={heroPalette} cloudCover={46} interpretationLabel={t("forecastInterpretation")} interactionLabel={t("moveToExplore")} />
          <p><span>{t("tonightPalette")}</span><b>{t("heroColors")}</b></p>
        </div>
        <div className="hero-index">35.7° N<br />{t("california")}</div>
      </section>

      <ForecastExperience />

      <section id="about" className="about-section">
        <div className="section-kicker"><span>02</span><p>{t("howItWorks")}</p></div>
        <div className="about-grid">
          <h2>{t("aboutLeadOne")}<br /><em>{t("aboutLeadTwo")}</em></h2>
          <div><p>{t("aboutBodyOne")}</p><p>{t("aboutBodyTwo")}</p></div>
        </div>
        <div className="steps">
          <article><span>01</span><h3>{t("stepOneTitle")}</h3><p>{t("stepOneBody")}</p></article>
          <article><span>02</span><h3>{t("stepTwoTitle")}</h3><p>{t("stepTwoBody")}</p></article>
          <article><span>03</span><h3>{t("stepThreeTitle")}</h3><p>{t("stepThreeBody")}</p></article>
        </div>
      </section>

      <footer><a href="#top" aria-label={t("home")}><BrandLogo /></a><p>{t("footerTagline")}</p><small>{t("footerDisclaimer")}</small></footer>
    </main>
  );
}

