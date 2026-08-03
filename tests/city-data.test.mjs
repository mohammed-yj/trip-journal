import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cityDisplayName,
  cityOptionKey,
} from "../app/city-data.ts";

const nanjing = {
  name: "Nanjing",
  chineseName: "南京",
  admin1Code: "CN-JS",
  latitude: 32.06167,
  longitude: 118.77778,
};

test("city dropdown uses localized labels and stable coordinate values", () => {
  assert.equal(cityDisplayName(nanjing, "zh"), "南京");
  assert.equal(cityDisplayName(nanjing, "en"), "Nanjing");
  assert.equal(cityDisplayName(nanjing, "fr"), "Nanjing");
  assert.match(cityOptionKey(nanjing), /CN-JS:Nanjing:32\.06167:118\.77778/);
});

test("China catalog includes Sanya and broad prefecture-level coverage", async () => {
  const rows = JSON.parse(
    await readFile(new URL("../public/maps/cities/CHN.json", import.meta.url), "utf8"),
  );
  assert.ok(rows.length >= 280);
  assert.deepEqual(
    rows.find((row) => row[4] === "三亚"),
    ["Sanya", "CN-HI", 18.25435, 109.50947, "三亚"],
  );
  for (const name of ["南京", "淮安", "扬州", "泰州", "儋州"]) {
    assert.ok(rows.some((row) => row[4] === name), name);
  }
});
