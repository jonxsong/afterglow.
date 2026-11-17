import type { Locale } from "@/components/locale-provider";
import cityData from "./city-fallback-data.json";
import type { Location } from "./types";

type CityRow = [
  id: number,
  name: string,
  latitude: number,
  longitude: number,
  country: string,
  region: number,
  timezone: number,
  aliases?: string[],
];

const cities = cityData.cities as CityRow[];
const displayLimit = 8;

const commonChineseNames: Record<number, string> = {
  1816670: "北京", 1796236: "上海", 1809858: "广州", 1795565: "深圳", 1791247: "武汉",
  1815286: "成都", 1814906: "重庆", 1808926: "杭州", 1799962: "南京", 1790630: "西安",
  1819729: "香港", 1668341: "台北", 1850147: "东京", 1853909: "大阪", 1835848: "首尔",
  1880252: "新加坡", 1609350: "曼谷", 1642911: "雅加达", 1735161: "吉隆坡", 1701668: "马尼拉",
  1273294: "德里", 1275339: "孟买", 292223: "迪拜", 2643743: "伦敦", 2988507: "巴黎",
  2950159: "柏林", 3117735: "马德里", 3169070: "罗马", 2759794: "阿姆斯特丹", 2761369: "维也纳",
  5128581: "纽约", 5391959: "旧金山", 5368361: "洛杉矶", 5809844: "西雅图", 4887398: "芝加哥",
  4140963: "华盛顿", 6167865: "多伦多", 6173331: "温哥华", 6077243: "蒙特利尔",
  2147714: "悉尼", 2158177: "墨尔本", 2193733: "奥克兰", 3530597: "墨西哥城",
  3448439: "圣保罗", 3435910: "布宜诺斯艾利斯", 360630: "开罗", 3369157: "开普敦",
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const index = cities.map((city) => ({
  city,
  names: [city[1], commonChineseNames[city[0]], ...(city[7] ?? [])]
    .filter((name): name is string => Boolean(name)).map(normalize),
}));

export function searchFallbackCities(query: string, locale: Locale = "en"): Location[] {
  const [queryName, queryRegion] = query.split(",", 2).map(normalize);
  if (!queryName || [...queryName].length < 2) return [];

  const countryNames = new Intl.DisplayNames([locale === "zh" ? "zh-CN" : "en"], { type: "region" });
  const englishCountries = queryRegion && locale === "zh" ? new Intl.DisplayNames(["en"], { type: "region" }) : countryNames;
  const exact: CityRow[] = [];
  const prefixes: CityRow[] = [];

  for (const { city, names } of index) {
    const match = names.includes(queryName) ? exact : prefixes;
    if (match === prefixes && (prefixes.length >= displayLimit || !names.some((name) => name.startsWith(queryName)))) continue;
    if (queryRegion) {
      const country = city[4];
      const region = cityData.regions[city[5]];
      const parts = [country, region, countryNames.of(country), englishCountries.of(country)];
      if (!parts.some((part) => part && normalize(part).startsWith(queryRegion))) continue;
    }
    match.push(city);
    if (exact.length === displayLimit) break;
  }

  return [...exact, ...prefixes].slice(0, displayLimit).map(([id, name, latitude, longitude, country, region, timezone]) => ({
    id,
    name: locale === "zh" ? (commonChineseNames[id] ?? name) : name,
    region: cityData.regions[region] || null,
    country: countryNames.of(country) ?? country,
    latitude,
    longitude,
    timezone: cityData.timezones[timezone],
  }));
}
