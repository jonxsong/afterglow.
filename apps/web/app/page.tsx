import { ArrowDown, Menu } from "lucide-react";
import { ForecastExperience } from "@/components/forecast-experience";
import { SkyVisualization } from "@/components/sky-visualization";

const heroPalette = ["#F7D4AA", "#EEAD7E", "#DA7E7A", "#A66F92", "#665E8B"];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Afterglow home">afterglow<span>.</span></a>
        <nav aria-label="Main navigation"><a href="#explore">Explore</a><a href="#about">About</a></nav>
        <details className="mobile-menu">
          <summary aria-label="Open menu"><Menu /></summary>
          <div><a href="#explore">Explore</a><a href="#about">About</a></div>
        </details>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THE SKY, BEFORE IT HAPPENS.</p>
          <h1>Chase the<br /><em>beautiful.</em></h1>
          <p className="hero-description">A little forecast for the most beautiful part of your day.</p>
          <a className="primary-cta" href="#forecast">See tonight’s sky <ArrowDown size={17} /></a>
        </div>
        <div className="hero-art">
          <SkyVisualization palette={heroPalette} cloudCover={46} />
          <p><span>Tonight’s palette</span><b>Peach · Rose · Lavender</b></p>
        </div>
        <div className="hero-index">35.7° N<br />CALIFORNIA</div>
      </section>

      <ForecastExperience />

      <section id="about" className="about-section">
        <div className="section-kicker"><span>02</span><p>HOW IT WORKS</p></div>
        <div className="about-grid">
          <h2>Weather tells you if it will rain.<br /><em>Afterglow tells you to look up.</em></h2>
          <div><p>We translate cloud layers, moisture, visibility, precipitation, forecast uncertainty, and the sun’s position into a simple color outlook.</p><p>It is a scientifically grounded interpretation—not a promise. The atmosphere keeps some mystery for itself.</p></div>
        </div>
        <div className="steps">
          <article><span>01</span><h3>Read the atmosphere</h3><p>Live weather forecasts reveal the cloud structure and clarity around sunset.</p></article>
          <article><span>02</span><h3>Follow the light</h3><p>Solar geometry shows how evening light will meet those atmospheric layers.</p></article>
          <article><span>03</span><h3>Learn from the sky</h3><p>Observed sunset photos help measure where the color forecast was right—or beautifully wrong.</p></article>
        </div>
      </section>

      <footer><a className="wordmark" href="#top">afterglow<span>.</span></a><p>Chase the beautiful.</p><small>Forecasts are atmospheric interpretations, not safety-critical weather advice.</small></footer>
    </main>
  );
}

