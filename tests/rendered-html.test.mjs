import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the private Museum Log application shell", async () => {
  const [page, layout, app] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ArchiveApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ArchiveApp \/>/);
  assert.match(layout, /<html lang="zh-CN">/i);
  assert.match(layout, /观迹 · 我的博物馆与展览档案/);
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(app, /正在打开你的私人档案/);
  assert.match(app, /Museum Log/);
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
