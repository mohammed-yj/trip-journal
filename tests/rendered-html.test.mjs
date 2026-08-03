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
