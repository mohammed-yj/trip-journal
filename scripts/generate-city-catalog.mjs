import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature as topoFeature } from "topojson-client";
import {
  canonicalAdmin1Code,
  resolveAdmin1Code,
} from "../app/admin1-locales.ts";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const citiesPath = resolve(
  process.argv[2] || "/private/tmp/geonames-cities500/cities500.txt",
);
const adminCodesPath = resolve(
  process.argv[3] || "/private/tmp/geonames-admin1.txt",
);
const admin2CodesPath = resolve(
  process.argv[4] || "/private/tmp/geonames-admin2.txt",
);
const detailedCountries = new Set(["CHN", "USA", "RUS", "GBR", "FRA", "DEU", "ITA", "JPN"]);
const adminNameOverrides = new Map([
  ["RUS:Moscow Oblast", "RU-MOS"],
  ["RUS:Altai", "RU-AL"],
]);
const adminFiles = {
  CHN: "CHN.json", USA: "USA.json", RUS: "RUS.json", GBR: "GBR.json",
  FRA: "FRA.json", DEU: "DEU.json", ITA: "ITA.topo.json", JPN: "JPN.json",
};

const adminFeaturesByCountry = new Map();
for (const [countryCode, filename] of Object.entries(adminFiles)) {
  const json = JSON.parse(
    await readFile(join(projectRoot, "public/maps/admin1", filename), "utf8"),
  );
  const features = json.type === "Topology"
    ? topoFeature(json, json.objects[Object.keys(json.objects)[0]]).features
    : json.features;
  adminFeaturesByCountry.set(countryCode, features);
}

function ringContains(ring, longitude, latitude) {
  let inside = false;
  for (let left = 0, right = ring.length - 1; left < ring.length; right = left++) {
    const [leftX, leftY] = ring[left];
    const [rightX, rightY] = ring[right];
    if (
      (leftY > latitude) !== (rightY > latitude) &&
      longitude < ((rightX - leftX) * (latitude - leftY)) / (rightY - leftY) + leftX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonContains(polygon, longitude, latitude) {
  return ringContains(polygon[0], longitude, latitude) &&
    !polygon.slice(1).some((ring) => ringContains(ring, longitude, latitude));
}

function adminCodeForPoint(countryCode, longitude, latitude) {
  const match = (adminFeaturesByCountry.get(countryCode) || []).find((item) => {
    const polygons = item.geometry.type === "Polygon"
      ? [item.geometry.coordinates]
      : item.geometry.coordinates;
    return polygons.some((polygon) => polygonContains(polygon, longitude, latitude));
  });
  return match ? canonicalAdmin1Code(match.properties || {}) : "";
}

const countryCodes = JSON.parse(
  await readFile(
    join(projectRoot, "node_modules/i18n-iso-countries/codes.json"),
    "utf8",
  ),
);
const alpha2To3 = new Map(countryCodes.map(([alpha2, alpha3]) => [alpha2, alpha3]));
const adminNames = new Map(
  (await readFile(adminCodesPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [code, name, asciiName] = line.split("\t");
      return [code, asciiName || name];
    }),
);
const admin2Names = new Map(
  (await readFile(admin2CodesPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const [code, name, asciiName] = line.split("\t");
      return [code, asciiName || name];
    }),
);

function chineseName(alternateNames) {
  const matches = alternateNames
    .split(",")
    .filter((name) => /^[\p{Script=Han}·]+$/u.test(name))
    .filter(Boolean);
  const cityNames = matches.filter((name) => /市$/u.test(name));
  return ((cityNames.length ? cityNames : matches)
    .map((name) => name.replace(/[市縣县區区]$/u, ""))
    .sort((left, right) => left.length - right.length)[0] || "");
}

const byCountry = new Map();
for (const line of (await readFile(citiesPath, "utf8")).trim().split("\n")) {
  const fields = line.split("\t");
  const alpha2 = fields[8];
  const countryCode = alpha2To3.get(alpha2);
  if (!countryCode || fields[6] !== "P") continue;
  const adminName = adminNames.get(`${alpha2}.${fields[10]}`) || "";
  let admin1Code = detailedCountries.has(countryCode)
    ? adminNameOverrides.get(`${countryCode}:${adminName}`) ||
      resolveAdmin1Code(countryCode, adminName) ||
      (countryCode === "USA" && fields[10] ? `US-${fields[10]}` : "")
    : "";
  if (detailedCountries.has(countryCode) && !admin1Code) {
    admin1Code = adminCodeForPoint(countryCode, Number(fields[5]), Number(fields[4]));
  }
  if (detailedCountries.has(countryCode) && !admin1Code) continue;
  const city = {
    id: fields[0],
    name: fields[2] || fields[1],
    zh: chineseName(fields[3]),
    admin1Code,
    admin2Key: fields[11] ? `${alpha2}.${fields[10]}.${fields[11]}` : "",
    alternateNames: fields[3],
    latitude: Number(fields[4]),
    longitude: Number(fields[5]),
    featureCode: fields[7],
    population: Number(fields[14]) || 0,
  };
  const rows = byCountry.get(countryCode) || [];
  rows.push(city);
  byCountry.set(countryCode, rows);
}

const outputDir = join(projectRoot, "public/maps/cities");
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const missingDetailedAdmins = [];
for (const [countryCode, cities] of byCountry) {
  const selected = new Map();
  const add = (city) => selected.set(city.id, city);

  if (detailedCountries.has(countryCode)) {
    const byAdmin = new Map();
    for (const city of cities) {
      const rows = byAdmin.get(city.admin1Code) || [];
      rows.push(city);
      byAdmin.set(city.admin1Code, rows);
    }
    for (const [admin1Code, rows] of byAdmin) {
      rows
        .filter((city) => city.featureCode === "PPLA" || city.featureCode === "PPLC")
        .forEach(add);
      rows
        .toSorted((left, right) => right.population - left.population)
        .slice(0, 3)
        .forEach(add);
      if (!rows.length) missingDetailedAdmins.push(`${countryCode}:${admin1Code}`);
    }
    if (countryCode === "CHN") {
      const byPrefectureCity = new Map();
      for (const city of cities) {
        if (!city.admin2Key) continue;
        const rows = byPrefectureCity.get(city.admin2Key) || [];
        rows.push(city);
        byPrefectureCity.set(city.admin2Key, rows);
      }
      for (const [admin2Key, rows] of byPrefectureCity) {
        const city = rows.toSorted((left, right) => right.population - left.population)[0];
        const admin2Name = admin2Names.get(admin2Key) || city.name;
        add({
          ...city,
          name: /\sShi$/i.test(admin2Name)
            ? admin2Name.replace(/\s+Shi$/i, "")
            : city.name,
          zh: chineseName(city.alternateNames),
        });
      }
      for (const [territoryCode, admin1Code] of [["HKG", "CN-HK"], ["MAC", "CN-MO"]]) {
        const territoryCities = byCountry.get(territoryCode) || [];
        territoryCities
          .toSorted((left, right) => right.population - left.population)
          .slice(0, 3)
          .forEach((city) => add({ ...city, admin1Code }));
      }
    }
    if (countryCode === "USA") {
      for (const [territoryCode, admin1Code] of [
        ["PRI", "US-PR"], ["ASM", "US-AS"], ["VIR", "US-VI"],
        ["GUM", "US-GU"], ["MNP", "US-MP"],
      ]) {
        const territoryCities = byCountry.get(territoryCode) || [];
        territoryCities
          .toSorted((left, right) => right.population - left.population)
          .slice(0, 3)
          .forEach((city) => add({ ...city, admin1Code }));
      }
    }
  } else {
    cities
      .filter((city) => city.featureCode === "PPLC")
      .forEach(add);
    cities
      .toSorted((left, right) => right.population - left.population)
      .slice(0, 20)
      .forEach(add);
  }

  const rows = Array.from(selected.values())
    .sort((left, right) =>
      left.admin1Code.localeCompare(right.admin1Code) ||
      right.population - left.population ||
      left.name.localeCompare(right.name, "en"),
    )
    .map((city) => [
      city.name,
      city.admin1Code,
      city.latitude,
      city.longitude,
      city.zh,
    ]);
  if (rows.length) {
    await writeFile(join(outputDir, `${countryCode}.json`), `${JSON.stringify(rows)}\n`);
  }
}

await writeFile(
  join(outputDir, "README.md"),
  [
    "# City catalog",
    "",
    "Generated from the GeoNames `cities500` and `admin1CodesASCII` dumps (CC BY 4.0).",
    "Detailed countries include every ADM1 capital and the three most populous cities per ADM1.",
    "China additionally includes a representative city for every GeoNames ADM2, ensuring all prefecture-level cities are present.",
    "Other countries include the national capital and twenty most populous available cities.",
    "Each row is `[name, canonical ADM1 code, latitude, longitude, Chinese name]`.",
    "",
  ].join("\n"),
);

console.log(`Generated ${byCountry.size} country catalogs.`);
if (missingDetailedAdmins.length) {
  console.warn(`ADM1 groups without selected cities: ${missingDetailedAdmins.join(", ")}`);
}
