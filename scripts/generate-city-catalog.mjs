import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cityRows = JSON.parse(
  await readFile(
    join(projectRoot, "node_modules/country-state-city/lib/assets/city.json"),
    "utf8",
  ),
);
const countryCodes = JSON.parse(
  await readFile(
    join(projectRoot, "node_modules/i18n-iso-countries/codes.json"),
    "utf8",
  ),
);
const alpha2To3 = new Map(countryCodes.map(([alpha2, alpha3]) => [alpha2, alpha3]));
const outputDir = join(projectRoot, "public/maps/cities");
const byCountry = new Map();

for (const [name, alpha2, stateCode, latitude, longitude] of cityRows) {
  const alpha3 = alpha2To3.get(alpha2);
  if (!alpha3 || !name || !latitude || !longitude) continue;
  const rows = byCountry.get(alpha3) || [];
  rows.push([
    name,
    stateCode ? `${alpha2}-${stateCode}` : "",
    Number(latitude),
    Number(longitude),
  ]);
  byCountry.set(alpha3, rows);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const [countryCode, rows] of byCountry) {
  rows.sort((left, right) => left[0].localeCompare(right[0], "en"));
  await writeFile(
    join(outputDir, `${countryCode}.json`),
    `${JSON.stringify(rows)}\n`,
  );
}

await writeFile(
  join(outputDir, "README.md"),
  [
    "# City catalog",
    "",
    "Generated from `country-state-city` 3.2.1 (MIT) with `npm run data:cities`.",
    "Each country file contains compact `[name, admin1 code, latitude, longitude]` rows.",
    "",
  ].join("\n"),
);
