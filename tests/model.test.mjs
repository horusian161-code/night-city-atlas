import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STATE, escapeHTML, safeImagePath, validateLocation,
  validateImport, mergeState, visibleAtlas, splitImport
} from "../scripts/model.js";

const atlas = {
  schemaVersion: 1, width: 1600, height: 1600,
  districts: [{id: "watson"}, {id: "heywood"}],
  locations: [
    {id: "hospital", name: "Hospital", districtId: "watson", category: "medical", x: 400, y: 300, hidden: false},
    {id: "club", name: "Club", districtId: "heywood", category: "nightlife", x: 900, y: 1200, hidden: false}
  ]
};
const point = (changes = {}) => ({
  id: "campaign-point", name: "Campaign venue", districtId: "watson",
  category: "market", x: 320, y: 420, summary: "A public campaign location.",
  image: "worlds/campaign/venue.webp", source: "GM", hidden: false, ...changes
});
const payload = (locations = [], changes = {}) => ({schemaVersion: 1, locations, ...changes});

test("accepted campaign points retain coordinates, ordinary Unicode text, and journal links", () => {
  const value = validateLocation(point({name: "  Медпункт Наны  ", journalUUID: "JournalEntry.JA.Page.PB"}), atlas);
  assert.equal(value.name, "Медпункт Наны");
  assert.equal(value.journalUUID, "JournalEntry.JA.Page.PB");
  assert.equal(value.x, 320);
  assert.equal(value.y, 420);
  assert.equal(value.custom, true);
  assert.equal(value.precision, "approximate");
  assert.equal(value.hidden, false);
});

test("coordinate bounds include the map edges and reject nonfinite or coercible coordinates", () => {
  assert.doesNotThrow(() => validateLocation(point({x: 0, y: 1600}), atlas));
  for (const value of [-1, 1600.01, NaN, Infinity, -Infinity, "420", null, undefined]) {
    assert.throws(() => validateLocation(point({x: value}), atlas));
    assert.throws(() => validateLocation(point({y: value}), atlas));
  }
});

test("invalid identity, district, category, visibility, and field shapes fail before storage", () => {
  for (const value of [null, [], "point", 1]) assert.throws(() => validateLocation(value, atlas));
  for (const changes of [
    {id: ""}, {id: "../hospital"}, {id: "x".repeat(97)},
    {districtId: "unknown"}, {category: "unknown"}, {hidden: "false"},
    {name: " \t "}, {name: "x".repeat(161)}, {summary: "x".repeat(4001)},
    {journalUUID: {}}, {image: {src: "venue.webp"}}
  ]) assert.throws(() => validateLocation(point(changes), atlas));
});

test("imported executable-looking text is retained as text and cannot produce HTML markup", () => {
  const name = '<img src=x onerror="alert(1)"> & \'quoted\'';
  const result = validateLocation(point({name, summary: "<script>steal()</script>", onerror: "steal()"}), atlas);
  assert.equal(result.name, name);
  assert.ok(!Object.hasOwn(result, "onerror"));
  const renderedName = escapeHTML(result.name);
  assert.equal(renderedName, "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;");
  assert.doesNotMatch(escapeHTML(result.summary), /[<>]/);
  assert.equal(escapeHTML(null), "");
});

test("image paths support Foundry assets and HTTPS without credentials", () => {
  for (const value of ["modules/night-city-atlas/assets/districts/watson.svg", "worlds/my-world/Клуб.webp", "https://cdn.example.org/venue.webp?size=400"]) {
    assert.equal(safeImagePath(value), value);
  }
  assert.equal(safeImagePath(undefined), "");
  assert.equal(safeImagePath(""), "");
});

test("image paths reject active protocols, traversal, malformed URLs, and credentials", () => {
  for (const value of [
    "javascript:alert(1)", "data:image/svg+xml,<svg></svg>", "blob:whatever",
    "http://example.org/a.png", "//example.org/a.png", "../secret.png", "a/../secret.png",
    "a\\b.png", "a\u0000b.png", "a<img>.png", "https://user:password@example.org/a.png",
    "https://", "x".repeat(1025)
  ]) assert.throws(() => safeImagePath(value), value);
});

test("image validation also rejects obfuscated protocol and encoded traversal input", () => {
  for (const value of [
    " javascript:alert(1)", "\tdata:image/png,abc", "%2e%2e/secret.png",
    "images/%2E%2E/secret.png", "https://example.org/image\n.png", "https://example.org/a<svg>.png"
  ]) assert.throws(() => safeImagePath(value), value);
});

test("an import requires the correct schema and bounded location list", () => {
  for (const value of [null, [], "{}", {}, {schemaVersion: 2, locations: []}, {schemaVersion: 1, locations: {}}, payload(new Array(2001).fill(point()))]) {
    assert.throws(() => validateImport(value, atlas));
  }
  assert.deepEqual(validateImport(payload(), atlas), EMPTY_STATE());
});

test("one malformed point rejects the full import without modifying source data", () => {
  const data = payload([point(), point({id: "bad", districtId: "no-such-district"})]);
  const before = structuredClone(data);
  assert.throws(() => validateImport(data, atlas));
  assert.deepEqual(data, before);
});

test("custom points cannot collide with canonical IDs or duplicate an imported ID", () => {
  assert.throws(() => validateImport(payload([point({id: "hospital"})]), atlas));
  assert.throws(() => validateImport(payload([point(), point({name: "Another venue"})]), atlas));
});

test("canonical changes require an existing unique public point and a valid disabled list", () => {
  const override = point({id: "hospital", name: "Hospital campaign name"});
  const imported = validateImport(payload([], {overrides: [override], disabled: ["club", "club"]}), atlas);
  assert.equal(imported.overrides[0].custom, false);
  assert.deepEqual(imported.disabled, ["club"]);
  for (const changes of [
    {overrides: [point()]}, {overrides: [override, override]},
    {overrides: [point({id: "hospital", hidden: true})]},
    {disabled: ["unknown"]}, {disabled: [123]}, {disabled: {}}, {overrides: {}}
  ]) assert.throws(() => validateImport(payload([], changes), atlas));
});

test("additive import updates a matching custom ID once and preserves unrelated world entries", () => {
  const old = {locations: [point(), point({id: "other", name: "Other venue"})], overrides: [], disabled: ["club"]};
  const addition = validateImport(payload([point({name: "Renamed venue"})], {disabled: ["hospital", "club"]}), atlas);
  const before = structuredClone(old);
  const merged = mergeState(old, addition);
  assert.equal(merged.locations.length, 2);
  assert.equal(merged.locations.find(p => p.id === "campaign-point").name, "Renamed venue");
  assert.equal(merged.locations.find(p => p.id === "other").name, "Other venue");
  assert.deepEqual(new Set(merged.disabled), new Set(["hospital", "club"]));
  assert.deepEqual(old, before);
});

test("split import removes hidden markers from the complete shared state", () => {
  const imported = validateImport(payload([
    point({id: "public"}), point({id: "secret", name: "SECRET SAFEHOUSE", summary: "SECRET PASSWORD", hidden: true})
  ], {disabled: ["club"]}), atlas);
  const {publicState, privateLocations} = splitImport(imported);
  assert.equal(publicState.locations.length, 1);
  assert.equal(privateLocations.length, 1);
  assert.equal(privateLocations[0].id, "secret");
  assert.doesNotMatch(JSON.stringify(publicState), /SECRET|secret/);
  assert.deepEqual(publicState.disabled, ["club"]);
});

test("player data excludes private markers before search, rendering, and export", () => {
  const privatePoints = [point({id: "secret", name: "SECRET SAFEHOUSE", summary: "SECRET PASSWORD", hidden: true})];
  const shared = {
    locations: [point({id: "public"}), point({id: "accidental-secret", name: "SECRET SHARED", hidden: true})],
    overrides: [point({id: "hospital", name: "Public custom hospital"})], disabled: ["club"]
  };
  const publicData = visibleAtlas(atlas, shared, privatePoints, false);
  assert.deepEqual(publicData.locations.map(p => p.id), ["hospital", "public"]);
  assert.equal(publicData.locations[0].name, "Public custom hospital");
  assert.doesNotMatch(JSON.stringify(publicData), /SECRET|secret/);
});

test("GM visibility includes private markers without mutating original data or flags", () => {
  const privatePoints = [point({id: "secret", hidden: false, custom: false})];
  const before = structuredClone(privatePoints);
  const result = visibleAtlas(atlas, EMPTY_STATE(), privatePoints, true);
  assert.equal(result.locations.length, 3);
  assert.equal(result.locations.at(-1).hidden, true);
  assert.equal(result.locations.at(-1).custom, true);
  assert.deepEqual(privatePoints, before);
  assert.equal(atlas.locations.length, 2);
});
