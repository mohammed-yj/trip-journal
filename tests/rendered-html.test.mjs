import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the private field archive application shell", async () => {
  const [page, layout, app] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ArchiveApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ArchiveApp \/>/);
  assert.match(layout, /<html lang="zh-CN">/i);
  assert.match(layout, /观迹 · 旅行与城市观察档案/);
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(app, /正在打开你的私人档案/);
  assert.match(app, /Private Field Archive/);
  assert.match(app, /role="status"/);
  assert.doesNotMatch(`${page}\n${layout}\n${app}`, /codex-preview|react-loading-skeleton/i);
});

test("declares durable storage, archive routes, and a versioned relational schema", async () => {
  const [page, layout, hosting, archive, upload, migration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/archive/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/upload/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0000_fearless_sentinels.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /<ArchiveApp \/>/);
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "PHOTOS");
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.match(archive, /action === "startVisit"/);
  assert.match(archive, /action === "batchOrganize"/);
  assert.match(archive, /action === "softDelete"/);
  assert.match(archive, /action === "restoreJson"/);
  assert.match(upload, /bucket\.put\(storageKey,\s*bytes/);
  assert.match(upload, /file\.arrayBuffer\(\)/);
  assert.doesNotMatch(upload, /base64/i);
  for (const table of [
    "venues",
    "exhibitions",
    "trips",
    "visits",
    "object_records",
    "photo_groups",
    "photo_assets",
    "captures",
    "tags",
    "tag_links",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE \\\`${table}\\\``));
  }
});

test("provides Chinese-first English and French UI without numbered navigation", async () => {
  const [app, translations, layout] = await Promise.all([
    readFile(new URL("../app/ArchiveApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(app, /useState<Locale>\("zh"\)/);
  assert.match(app, /localStorage\.getItem\("guanji-locale"\)/);
  assert.match(app, /localStorage\.setItem\("guanji-locale", locale\)/);
  assert.match(app, /\["zh", "en", "fr"\]/);
  assert.match(app, /className="language-switcher"/);
  assert.match(app, /data-release="multilingual-v2"/);
  assert.match(layout, /import "\.\/i18n-overrides\.css"/);
  assert.doesNotMatch(app, /\["home", "概览", "01"\]/);
  assert.doesNotMatch(app, /\["visits", "到访", "02"\]/);
  assert.match(translations, /"概览": "Overview"/);
  assert.match(translations, /"概览": "Aperçu"/);
  assert.match(translations, /"设置与数据": "Réglages et données"/);
});

test("provides a persistent hierarchical travel footprint map", async () => {
  const [app, map, mapData, mapLogic, adminLocales, styles, archive, mapMarks, migration, world] = await Promise.all([
    readFile(new URL("../app/ArchiveApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TravelMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/map-logic.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin1-locales.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/archive/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/map-marks.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_fine_living_mummy.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/maps/world-countries.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /<TravelMap/);
  assert.match(app, /＋ 添加新旅程/);
  assert.match(map, /setZoom/);
  assert.match(map, /onAddMark/);
  assert.match(map, /neighbors\(topology\.objects\.countries\.geometries\)/);
  assert.match(map, /featureAdjacency\(adminFeatures\)/);
  assert.match(map, /applyBoundaryPolicy\(collection\.features as WorldFeature\[\]\)/);
  assert.match(map, /worldCode\(item\) === "UKR"/);
  assert.match(map, /onPointerMove=\{moveDrag\}/);
  assert.match(map, /className="map-hover-outline"/);
  assert.match(map, /className="map-selected-outline"/);
  assert.match(map, /data-map-release="map-final-v7"/);
  assert.match(map, /data-country-code=\{code\}/);
  assert.match(map, /const ZOOM_LEVELS = \[1, 2, 4, 8\]/);
  assert.match(map, /DETAIL_FOCUS_BOUNDS/);
  assert.match(map, /USA: \[-125, 24, -66, 50\]/);
  assert.match(map, /RUS: \[19, 41, 179\.5, 78\]/);
  assert.match(map, /key="selected-outline"/);
  assert.match(map, /const selectedWorldFeature = selectedCountry\s*\?/);
  assert.match(map, /clearHoverOutsideMap/);
  assert.match(map, /className="map-admin-outer-outline"/);
  assert.match(map, /adminOuterBoundary\(adminFeatures/);
  assert.match(map, /detailTerritoryFeatures/);
  assert.match(map, /detailHomeCamera/);
  assert.match(map, /className="map-country-jump"/);
  assert.match(map, /className="map-visited-outline"/);
  assert.match(map, /className="map-library"/);
  assert.match(map, /scope=\{scope\}/);
  assert.match(map, /selectedWorldFeature && !selectedAdminBoundary/);
  assert.match(map, /toggleAllManualMarks/);
  assert.match(map, /deleteSelectedMarks/);
  assert.doesNotMatch(map, /className="manual-marks"/);
  assert.doesNotMatch(map, /<strong>\{regionCount\}<\/strong>/);
  assert.match(map, /lastWheelAtRef/);
  assert.match(styles, /\.map-admin-outer-outline/);
  assert.match(styles, /\.map-zoom-control/);
  assert.match(styles, /\.map-country\.map-color-3/);
  assert.match(styles, /\.map-hover-outline/);
  assert.match(styles, /\.map-selected-outline/);
  assert.match(styles, /\.map-admin:not\(\.is-visited\)/);
  assert.match(styles, /\.map-country-jump select/);
  assert.match(styles, /\.map-visited-outline/);
  assert.match(styles, /\.map-library-row/);
  assert.match(mapData, /"CHN"[\s\S]*"USA"[\s\S]*"RUS"[\s\S]*"GBR"/);
  assert.match(mapData, /"FRA"[\s\S]*"DEU"[\s\S]*"ITA"[\s\S]*"JPN"/);
  assert.match(mapData, /CHN:\s*"\/maps\/admin1\/CHN\.json"/);
  assert.match(mapData, /geoArea/);
  assert.match(mapData, /orientAdminFeatureForD3/);
  assert.match(mapData, /\.map\(orientAdminFeatureForD3\)/);
  assert.match(mapData, /if \(code === "TWN"\) return TAIWAN_NAMES/);
  assert.match(mapData, /worldFeatureName/);
  assert.match(mapData, /DETAIL_TERRITORY_CODES/);
  assert.match(mapData, /CHN:\s*\["HKG", "MAC"\]/);
  assert.match(mapData, /USA:\s*\["ASM", "GUM", "MNP", "PRI", "UMI", "VIR"\]/);
  assert.match(mapData, /GBR:[\s\S]*"GIB"[\s\S]*"VGB"/);
  assert.match(mapData, /FRA:\s*\["ATF", "BLM", "MAF", "NCL", "PYF", "SPM", "WLF"\]/);
  assert.match(adminLocales, /"Beijing Municipality": "CN-BJ"/);
  assert.match(adminLocales, /if \(shapeIso === "SU-SD"\) return "US-SD"/);
  assert.match(mapLogic, /normalizeMapMarkInput/);
  assert.match(mapLogic, /sourceAssociationKey/);
  assert.match(mapLogic, /parseMapCoordinate/);
  assert.match(archive, /action === "addMapMark"/);
  assert.match(mapMarks, /ON CONFLICT\(mark_key\)/);
  assert.match(migration, /CREATE TABLE `map_marks`/);
  assert.match(world, /"countries"/);
});

test("ships readable ADM1 JSON for every detailed country", async () => {
  const detailedCountries = ["CHN", "USA", "RUS", "GBR", "FRA", "DEU", "JPN"];
  const featureCounts = await Promise.all(
    detailedCountries.map(async (code) => {
      const source = await readFile(
        new URL(`../public/maps/admin1/${code}.json`, import.meta.url),
        "utf8",
      );
      const collection = JSON.parse(source);
      assert.equal(collection.type, "FeatureCollection");
      return collection.features.length;
    }),
  );
  featureCounts.forEach((count) => assert.ok(count > 1));
});
