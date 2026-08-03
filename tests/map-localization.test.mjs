import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { feature } from "topojson-client";
import {
  ADMIN1_LABEL_COUNT,
  admin1FeatureLabel,
  admin1LabelByCode,
  canonicalAdmin1Code,
} from "../app/admin1-locales.ts";
import { adminOuterBoundary } from "../app/map-geometry.ts";

async function adminFeatures(country) {
  if (country === "ITA") {
    const topology = JSON.parse(
      await readFile(
        new URL("../public/maps/admin1/ITA.topo.json", import.meta.url),
        "utf8",
      ),
    );
    return feature(topology, topology.objects.regions).features;
  }
  const collection = JSON.parse(
    await readFile(
      new URL(`../public/maps/admin1/${country}.json`, import.meta.url),
      "utf8",
    ),
  );
  return collection.features;
}

test("canonicalizes and localizes every ADM1 feature in all three languages", async () => {
  const counts = {
    CHN: 33,
    USA: 56,
    RUS: 83,
    GBR: 4,
    FRA: 13,
    DEU: 16,
    ITA: 20,
    JPN: 47,
  };
  assert.equal(ADMIN1_LABEL_COUNT, 272);

  for (const [country, count] of Object.entries(counts)) {
    const features = await adminFeatures(country);
    const codes = features.map((item) => canonicalAdmin1Code(item.properties));
    assert.equal(features.length, count, country);
    assert.equal(new Set(codes).size, count, `${country} codes must be unique`);
    for (const item of features) {
      for (const locale of ["zh", "en", "fr"]) {
        assert.ok(admin1FeatureLabel(item.properties, locale), `${country}/${locale}`);
      }
    }
  }

  const china = await adminFeatures("CHN");
  const beijing = china.find(
    (item) => item.properties.shapeName === "Beijing Municipality",
  );
  assert.equal(canonicalAdmin1Code(beijing.properties), "CN-BJ");
  assert.equal(admin1LabelByCode("CN-BJ", "zh"), "北京市");
  assert.equal(admin1LabelByCode("CN-BJ", "en"), "Beijing");
  assert.equal(admin1LabelByCode("CN-BJ", "fr"), "Pékin");

  const usa = await adminFeatures("USA");
  const southDakota = usa.find(
    (item) => item.properties.shapeName === "South Dakota",
  );
  assert.equal(canonicalAdmin1Code(southDakota.properties), "US-SD");

  const italy = await adminFeatures("ITA");
  const piedmont = italy.find(
    (item) => item.properties.reg_istat_code === "01",
  );
  assert.equal(canonicalAdmin1Code(piedmont.properties), "IT-21");
});

test("extracts an exact, top-layer exterior boundary for every detailed country", async () => {
  const expectedExteriorSegments = {
    CHN: 132,
    USA: 3842,
    RUS: 5180,
    GBR: 268,
    FRA: 601,
    DEU: 455,
    ITA: 6447,
    JPN: 2325,
  };

  for (const [country, expected] of Object.entries(expectedExteriorSegments)) {
    const boundary = adminOuterBoundary(await adminFeatures(country));
    assert.ok(boundary, country);
    const stitchedSegmentCount = boundary.geometry.coordinates.reduce(
      (total, line) => total + line.length - 1,
      0,
    );
    assert.equal(stitchedSegmentCount, expected, country);
    assert.ok(boundary.geometry.coordinates.length < expected, country);
    assert.ok(
      boundary.geometry.coordinates.some((line) => line.length > 2),
      `${country} should contain stitched paths`,
    );
    for (const line of boundary.geometry.coordinates) {
      assert.ok(line.length >= 2);
      for (let index = 1; index < line.length; index += 1) {
        assert.notDeepEqual(line[index - 1], line[index]);
      }
    }
  }
});
