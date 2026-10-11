import test from "node:test";
import assert from "node:assert/strict";
import {readFile, access} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {CATEGORIES, safeImagePath, validateLocation} from "../scripts/model.js";

const base = fileURLToPath(new URL("../", import.meta.url));
const atlas = JSON.parse(await readFile(path.join(base, "data/atlas.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(base, "module.json"), "utf8"));
const atlasDistrictCounts = {a: 13, b: 13, c: 5, d: 4, e: 5, f: 9, g: 13, h: 6, i: 8, j: 7, k: 1, l: 4, m: 2, n: 13, o: 2, p: 11, q: 4, r: 0, s: 1, t: 10, u: 5, v: 7, w: 8, x: 5};
const text = value => typeof value === "string" && value.trim().length > 0;
const citation = value => text(value) || (value && text(value.title) && text(value.url));
const coords = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (p, a, b) => Math.abs(cross(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;

function contains(polygon, point) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (onSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function properIntersection(a, b, c, d) {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

test(`atlas has valid dimensions, schema, coverage, ${atlas.districts?.length} districts, and ${atlas.locations?.length} places`, () => {
  assert.equal(atlas.schemaVersion, 1);
  assert.equal(atlas.width, 1600);
  assert.equal(atlas.height, 2473);
  assert.ok(Array.isArray(atlas.districts) && atlas.districts.length > 0);
  assert.ok(Array.isArray(atlas.locations) && atlas.locations.length > 0);
  assert.ok(text(atlas.coverage?.title));
  assert.ok(text(atlas.coverage?.detail));
  assert.ok(Array.isArray(atlas.coverage?.sources) && atlas.coverage.sources.length > 0);
  for (const source of atlas.coverage.sources) assert.ok(citation(source), "Every source must be a citation or title+URL.");
});

test("catalog covers all 156 markers in the free Atlas, including both Forlorn Hope addresses", () => {
  // Counts independently checked against Night City Atlas v1.01: 24 districts,
  // 156 map markers. E3 and T6 are two addresses for one named establishment.
  assert.equal(atlas.districts.length, 24);
  assert.equal(atlas.locations.length, 156);
  for (const [districtId, expected] of Object.entries(atlasDistrictCounts)) {
    assert.equal(atlas.locations.filter(point => point.districtId === districtId).length, expected, `${districtId}: Atlas coverage count differs.`);
  }
  const forlorn = atlas.locations.filter(point => point.nameEn === "Forlorn Hope");
  assert.equal(forlorn.length, 2);
  assert.deepEqual(new Set(forlorn.map(point => point.districtId)), new Set(["e", "t"]));
});

test("canonical source codes include every published Atlas marker exactly once", () => {
  const expected = new Set(Object.entries(atlasDistrictCounts).flatMap(([district, count]) => Array.from({length: count}, (_, index) => `${district.toUpperCase()}${index + 1}`)));
  const actual = new Set(atlas.locations.map(point => point.sourceCode));
  assert.equal(actual.size, atlas.locations.length, "Source codes must not be duplicated.");
  assert.deepEqual(actual, expected);
  for (const point of atlas.locations) {
    assert.equal(point.sourceCode[0].toLowerCase(), point.districtId);
    assert.equal(point.sourceUrl, "https://rtalsoriangames.com/wp-content/uploads/2025/01/RTG-CPR-DLC-NightCityAtlasv1.01.pdf");
  }
});

test("zones, districts, and canonical location IDs are unique and all relationships resolve", () => {
  assert.ok(Array.isArray(atlas.zones) && atlas.zones.length > 0);
  const zones = new Set(atlas.zones.map(z => z.id));
  const districts = new Set(atlas.districts.map(d => d.id));
  const locations = new Set(atlas.locations.map(p => p.id));
  assert.equal(zones.size, atlas.zones.length);
  assert.equal(districts.size, atlas.districts.length);
  assert.equal(locations.size, atlas.locations.length);
  for (const zone of atlas.zones) {
    assert.ok(text(zone.id)); assert.ok(text(zone.name));
    assert.match(zone.color, /^#[\da-f]{6}$/i);
  }
  for (const district of atlas.districts) assert.ok(zones.has(district.zone), `${district.id} refers to an unknown zone.`);
  for (const point of atlas.locations) assert.ok(districts.has(point.districtId), `${point.id} refers to an unknown district.`);
});

test("district hover targets are simple nonempty polygons with labels inside them", () => {
  for (const district of atlas.districts) {
    assert.ok(Array.isArray(district.polygon) && district.polygon.length >= 3, district.id);
    let area = 0;
    for (let i = 0; i < district.polygon.length; i++) {
      const a = district.polygon[i], b = district.polygon[(i + 1) % district.polygon.length];
      assert.ok(coords(a), `${district.id}: malformed polygon vertex.`);
      assert.ok(a[0] >= 0 && a[0] <= atlas.width && a[1] >= 0 && a[1] <= atlas.height, `${district.id}: vertex outside map.`);
      assert.notDeepEqual(a, b, `${district.id}: zero-length polygon edge.`);
      area += a[0] * b[1] - b[0] * a[1];
      for (let j = i + 2; j < district.polygon.length; j++) {
        if (i === 0 && j === district.polygon.length - 1) continue;
        assert.ok(!properIntersection(a, b, district.polygon[j], district.polygon[(j + 1) % district.polygon.length]), `${district.id}: polygon intersects itself.`);
      }
    }
    assert.ok(Math.abs(area) > 1, `${district.id}: empty polygon area.`);
    assert.ok(coords(district.label), `${district.id}: malformed label coordinate.`);
    assert.ok(contains(district.polygon, district.label), `${district.id}: label is outside its district.`);
  }
});

test("every district supplies Russian summaries, English identification, and illustration references", () => {
  for (const district of atlas.districts) {
    for (const key of ["name", "nameEn", "summary", "image"]) assert.ok(text(district[key]), `${district.id}: missing ${key}.`);
    assert.ok(citation(district.source), `${district.id}: missing citation.`);
    assert.ok(Array.isArray(district.details) && district.details.length > 0 && district.details.every(text), `${district.id}: missing district details.`);
    assert.ok(Array.isArray(district.tags) && district.tags.every(text), `${district.id}: malformed tags.`);
    assert.equal(safeImagePath(district.image), district.image);
  }
});

test("canonical map places validate as public and belong to their indicated district", () => {
  const districts = new Map(atlas.districts.map(d => [d.id, d]));
  for (const point of atlas.locations) {
    assert.doesNotThrow(() => validateLocation(point, atlas, {custom: false}), point.id);
    assert.equal(point.hidden, false, `${point.id}: canonical pin must be public.`);
    assert.ok(text(point.nameEn), `${point.id}: missing English name.`);
    assert.ok(text(point.summary), `${point.id}: missing summary.`);
    assert.ok(text(point.source), `${point.id}: missing citation.`);
    assert.ok(CATEGORIES.includes(point.category), `${point.id}: unsupported category.`);
    assert.ok(["atlas", "approximate"].includes(point.precision), `${point.id}: precision is not disclosed.`);
    if (point.sourceCode === "B4") {
      // Official Atlas discrepancy: B4 is catalogued under Upper Marina, but
      // its map pin is near Kabuki. Preserve the source and disclose the issue.
      assert.equal(point.districtId, "b");
      assert.ok(text(point.placementNote), "B4 must disclose its source map/catalog discrepancy.");
    } else {
      assert.ok(contains(districts.get(point.districtId).polygon, [point.x, point.y]), `${point.id}: pin is outside district ${point.districtId}.`);
    }
  }
});

test("every local district and point image exists and SVG files contain no executable content", async () => {
  const paths = new Set(["assets/map-base.svg", ...atlas.districts.map(d => d.image), ...atlas.locations.map(p => p.image).filter(Boolean)]);
  for (const image of paths) {
    safeImagePath(image);
    if (/^https:\/\//.test(image)) continue;
    const local = path.resolve(base, image.replace(/^modules\/night-city-atlas\//, ""));
    assert.ok(local.startsWith(base), `Image escapes package directory: ${image}`);
    await access(local);
    if (local.endsWith(".svg")) {
      const svg = await readFile(local, "utf8");
      assert.match(svg, /<svg\b/);
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son\w+\s*=|javascript\s*:/i, image);
    }
  }
});

test("manifest targets Foundry 12 and all runtime entry points are packaged", async () => {
  assert.equal(manifest.id, "night-city-atlas");
  assert.equal(manifest.compatibility.minimum, "12");
  assert.ok(manifest.compatibility.verified === undefined || manifest.compatibility.verified === "12");
  assert.equal(manifest.compatibility.maximum, "12");
  assert.ok(manifest.relationships.systems.some(system => system.id === "cyberpunk-red-core"));
  for (const file of [...manifest.esmodules, ...manifest.styles, manifest.license, manifest.readme, "templates/atlas.hbs", "templates/location-editor.hbs"]) await access(path.join(base, file));
});
