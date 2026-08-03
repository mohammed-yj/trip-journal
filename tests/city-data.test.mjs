import assert from "node:assert/strict";
import test from "node:test";
import {
  cityDisplayName,
  cityMatches,
  findExactCity,
} from "../app/city-data.ts";

const nanjing = {
  name: "Nanjing",
  admin1Code: "CN-JS",
  latitude: 32.0603,
  longitude: 118.7969,
};

test("city search localizes Nanjing and resolves it without manual coordinates", () => {
  assert.equal(cityDisplayName("CHN", nanjing, "zh"), "南京");
  assert.equal(cityDisplayName("CHN", nanjing, "en"), "Nanjing");
  assert.equal(cityDisplayName("CHN", nanjing, "fr"), "Nankin");
  assert.equal(cityMatches("CHN", nanjing, "南京", "zh"), true);
  assert.equal(findExactCity("CHN", [nanjing], "南京", "zh"), nanjing);
});
