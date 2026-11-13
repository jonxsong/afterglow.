"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "zh";

const copy = {
  en: {
    home: "Afterglow home", navigation: "Main navigation", explore: "Explore", about: "About", openMenu: "Open menu",
    language: "Language", english: "English", chinese: "中文", heroEyebrow: "THE SKY, BEFORE IT HAPPENS.",
    heroLineOne: "Chase the", heroLineTwo: "beautiful.", heroDescription: "A little forecast for the most beautiful part of your day.",
    heroCta: "See tonight’s sky", tonightPalette: "Tonight’s palette", heroColors: "Peach · Rose · Lavender", california: "CALIFORNIA",
    howItWorks: "HOW IT WORKS", aboutLeadOne: "Weather tells you if it will rain.", aboutLeadTwo: "Afterglow tells you to look up.",
    aboutBodyOne: "We translate cloud layers, moisture, visibility, precipitation, forecast uncertainty, and the sun’s position into a simple color outlook.",
    aboutBodyTwo: "It is a scientifically grounded interpretation—not a promise. The atmosphere keeps some mystery for itself.",
    stepOneTitle: "Read the atmosphere", stepOneBody: "Live weather forecasts reveal the cloud structure and clarity around sunset.",
    stepTwoTitle: "Follow the light", stepTwoBody: "Solar geometry shows how evening light will meet those atmospheric layers.",
    stepThreeTitle: "Learn from the sky", stepThreeBody: "Observed sunset photos help measure where the color forecast was right—or beautifully wrong.",
    footerTagline: "Chase the beautiful.", footerDisclaimer: "Forecasts are atmospheric interpretations, not safety-critical weather advice.",
    tonightForecast: "TONIGHT’S FORECAST", loading: "Reading the evening atmosphere…", errorEyebrow: "THE SKY WENT QUIET",
    errorTitle: "We couldn’t read this evening yet.", tryAgain: "Try again", sunset: "Sunset", predictedColors: "Predicted colors",
    vibrancy: "Vibrancy", exceptional: "Exceptional", beautiful: "Beautiful", gentle: "Gentle", subtle: "Subtle",
    confidence: "forecast confidence", bestTime: "Best time to step outside", cloudCover: "Cloud cover", highCloud: "high cloud",
    humidity: "Humidity", rainChance: "chance of rain", visibility: "Visibility", sunsetHour: "At the sunset hour",
    heuristic: "Heuristic forecast", method: "Based on live weather data and solar geometry—not a photograph or trained-ML claim.",
    weekAhead: "THE WEEK AHEAD", weekTitle: "Seven evenings, at a glance.", weekNote: "Confidence naturally decreases farther into the forecast.",
    tonight: "Tonight", best: "BEST", closeLoop: "CLOSE THE LOOP", verifyTitle: "What did the sky actually do?",
    verifyBody: "Upload tonight’s sunset and Afterglow will compare its colors with this saved forecast. Your image remains private.",
    readingColors: "Reading the colors…", choosePhoto: "Choose a sunset photo", photoRequirements: "JPEG, PNG or WebP · 10 MB max",
    comparison: "Forecast comparison", paletteSimilarity: "palette similarity", meanDifference: "Mean color difference", forecast: "FORECAST", observed: "OBSERVED",
    changeLocation: "Change location", chooseLocation: "Choose a location", closeLocation: "Close location search", findSky: "FIND YOUR SKY",
    watchWhere: "Where will you watch?", searchRegion: "Search city or region", cityRegion: "City or region", currentLocation: "Use my current location",
    unavailableLocation: "Location is not available in this browser.", findingHorizon: "Finding your horizon…",
    permissionDenied: "Permission was not granted. You can still search for a city.", currentLocationName: "Current location",
    searchingMap: "Looking across the map…", recent: "RECENT", forecastInterpretation: "Forecast interpretation",
    paletteLabel: "Palette", scoreLabel: "Vibrancy score", outOf: "out of 100", locationSearchUnavailable: "Location search is temporarily unavailable.",
    forecastUnavailable: "The atmosphere is temporarily out of reach.", moveToExplore: "Move to explore", uploadTooLarge: "Image exceeds the 10 MB upload limit.",
    uploadType: "Upload a JPEG, PNG, or WebP image.", imageUnreadable: "This browser could not read the image.", serviceUnavailable: "Afterglow could not reach the forecast service.",
  },
  zh: {
    home: "Afterglow 首页", navigation: "主导航", explore: "探索", about: "关于", openMenu: "打开菜单",
    language: "语言", english: "English", chinese: "中文", heroEyebrow: "在天空绽放之前，先看见它。",
    heroLineOne: "追逐每一场", heroLineTwo: "绚烂。", heroDescription: "为一天中最美的时刻，准备的一份小小预报。",
    heroCta: "查看今晚的天空", tonightPalette: "今晚色盘", heroColors: "桃色 · 玫瑰色 · 薰衣草紫", california: "加利福尼亚",
    howItWorks: "工作原理", aboutLeadOne: "天气预报告诉你会不会下雨。", aboutLeadTwo: "Afterglow 提醒你抬头看天。",
    aboutBodyOne: "我们将云层、湿度、能见度、降水、预报不确定性与太阳位置，转译成一目了然的晚霞色彩展望。",
    aboutBodyTwo: "这是有科学依据的解读，却不是承诺。大气永远为自己保留一点神秘。",
    stepOneTitle: "读懂大气", stepOneBody: "实时天气预报揭示日落前后的云层结构与天空通透度。",
    stepTwoTitle: "追随光线", stepTwoBody: "太阳几何关系告诉我们，暮光将如何穿过不同的大气层。",
    stepThreeTitle: "向天空学习", stepThreeBody: "真实的晚霞照片帮助我们了解色彩预报何时准确，又何时美丽地出乎意料。",
    footerTagline: "追逐每一场绚烂。", footerDisclaimer: "本预报是对大气的色彩解读，不能替代关键天气与安全信息。",
    tonightForecast: "今晚预报", loading: "正在读取傍晚的大气…", errorEyebrow: "天空暂时沉默了",
    errorTitle: "暂时无法读取今晚的天空。", tryAgain: "重试", sunset: "日落", predictedColors: "预测色彩",
    vibrancy: "绚丽指数", exceptional: "惊艳", beautiful: "绚丽", gentle: "柔和", subtle: "淡雅",
    confidence: "预报可信度", bestTime: "最佳观赏时间", cloudCover: "云量", highCloud: "高云",
    humidity: "湿度", rainChance: "降雨概率", visibility: "能见度", sunsetHour: "日落时刻",
    heuristic: "启发式预报", method: "基于实时天气数据与太阳几何关系，并非照片或训练型机器学习结论。",
    weekAhead: "未来一周", weekTitle: "七个傍晚，一眼看尽。", weekNote: "日期越远，预报可信度会自然降低。",
    tonight: "今晚", best: "最佳", closeLoop: "让预报形成闭环", verifyTitle: "今晚的天空，究竟如何？",
    verifyBody: "上传今晚的晚霞照片，Afterglow 会将其色彩与保存的预报进行比较。照片始终保持私密。",
    readingColors: "正在读取色彩…", choosePhoto: "选择晚霞照片", photoRequirements: "JPEG、PNG 或 WebP · 最大 10 MB",
    comparison: "预报对比", paletteSimilarity: "色盘相似度", meanDifference: "平均色差", forecast: "预报", observed: "实景",
    changeLocation: "更改地点", chooseLocation: "选择地点", closeLocation: "关闭地点搜索", findSky: "寻找你的天空",
    watchWhere: "你会在哪里看晚霞？", searchRegion: "搜索城市或地区", cityRegion: "城市或地区", currentLocation: "使用我的当前位置",
    unavailableLocation: "此浏览器无法获取位置信息。", findingHorizon: "正在寻找你的地平线…",
    permissionDenied: "未获得定位权限，你仍可搜索城市。", currentLocationName: "当前位置",
    searchingMap: "正在搜索地图…", recent: "最近使用", forecastInterpretation: "晚霞预报示意图",
    paletteLabel: "色盘", scoreLabel: "绚丽指数", outOf: "满分 100", locationSearchUnavailable: "地点搜索暂时不可用。",
    forecastUnavailable: "暂时无法获取大气数据。", moveToExplore: "移动光标，探索天空", uploadTooLarge: "图片超过 10 MB 上传限制。",
    uploadType: "请上传 JPEG、PNG 或 WebP 图片。", imageUnreadable: "此浏览器无法读取这张图片。", serviceUnavailable: "Afterglow 暂时无法连接预报服务。",
  },
} as const;

export type CopyKey = keyof typeof copy.en;
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: CopyKey) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  useEffect(() => {
    const saved = window.localStorage.getItem("afterglow:locale");
    if (saved === "en" || saved === "zh") setLocaleState(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("afterglow:locale", locale);
    const title = locale === "zh" ? "Afterglow — 追逐每一场绚烂" : "Afterglow — Chase the beautiful";
    const syncDocument = () => {
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
      if (document.title !== title) document.title = title;
    };
    syncDocument();
    const timer = window.setTimeout(syncDocument, 250);
    return () => window.clearTimeout(timer);
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale: setLocaleState, t: (key: CopyKey) => copy[locale][key] }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="language-toggle" role="group" aria-label={t("language")}>
      <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
      <span aria-hidden>/</span>
      <button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")} aria-pressed={locale === "zh"}>中文</button>
    </div>
  );
}
