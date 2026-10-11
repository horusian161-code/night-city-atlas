import test, {beforeEach} from "node:test";
import assert from "node:assert/strict";

// Adapter smoke tests use isolated Foundry-shaped mocks. They do not replace a
// live Foundry v12 smoke test and never connect to or modify a user's world.
const namespace = "night-city-atlas";
const settings = new Map();
const definitions = new Map();
const menus = new Map();
const bindings = new Map();
const hooks = {once: new Map(), on: new Map()};
const writes = [];
const exports = [];
const chats = [];
const errors = [];
const documents = new Map();
let nextId = 0;

class ApplicationMock {
  static get defaultOptions() {return {classes: []};}
  constructor() {this.options = this.constructor.defaultOptions; this.rendered = false;}
  render() {this.rendered = true; return this;}
  async close() {this.rendered = false;}
  activateListeners() {}
  bringToTop() {}
}
class FormApplicationMock extends ApplicationMock {}

const defaultAtlas = {
  schemaVersion: 1, width: 1600, height: 1600,
  districts: [{id: "watson", name: "Уотсон", nameEn: "Watson", summary: "District summary"}],
  locations: [{id: "hospital", name: "Hospital", nameEn: "Hospital", districtId: "watson", category: "medical", x: 400, y: 300, summary: "Canon hospital", image: "", source: "Atlas", precision: "atlas", hidden: false, custom: false}]
};
const campaignPoint = (changes = {}) => ({
  id: "campaign-venue", name: "Campaign venue", nameEn: "Campaign venue",
  districtId: "watson", category: "market", x: 320, y: 420,
  summary: "Campaign description", image: "worlds/test/venue.webp", source: "GM", hidden: false, ...changes
});
const settingsKey = key => `${namespace}.${key}`;

Object.assign(globalThis, {
  Application: ApplicationMock,
  FormApplication: FormApplicationMock,
  window: {innerWidth: 1440, innerHeight: 1000},
  foundry: {utils: {
    deepClone: value => structuredClone(value),
    mergeObject: (a, b) => ({...a, ...b}),
    randomID: () => `mockid${++nextId}`
  }},
  Hooks: {
    once(name, callback) {hooks.once.set(name, callback);},
    on(name, callback) {hooks.on.set(name, callback);}
  },
  CONST: {KEYBINDING_PRECEDENCE: {NORMAL: 0}},
  game: {
    user: {id: "gm-user", isGM: true}, world: {id: "test-world"},
    modules: new Map([[namespace, {}]]),
    settings: {
      register(scope, key, config) {
        const id = `${scope}.${key}`;
        definitions.set(id, config);
        settings.set(id, structuredClone(config.default));
      },
      registerMenu(scope, key, config) {
        assert.ok(config.type.prototype instanceof FormApplicationMock, "Foundry 12 settings menus must extend FormApplication.");
        menus.set(`${scope}.${key}`, config);
      },
      get(scope, key) {return settings.get(`${scope}.${key}`);},
      async set(scope, key, value) {
        const id = `${scope}.${key}`;
        const definition = definitions.get(id);
        assert.ok(definition, "Only registered settings may be written.");
        if (definition.scope === "world" && !game.user.isGM) throw new Error("Mock server rejected player world-setting write.");
        settings.set(id, structuredClone(value));
        writes.push({key, scope: definition.scope, value: structuredClone(value)});
        definition.onChange?.(value);
        return value;
      }
    },
    keybindings: {register(scope, key, config) {bindings.set(`${scope}.${key}`, config);}}
  },
  ui: {notifications: {error: message => errors.push(message), info() {}}},
  fetch: async url => {
    assert.equal(url, "modules/night-city-atlas/data/atlas.json");
    return {ok: true, json: async () => structuredClone(defaultAtlas)};
  },
  Dialog: class {
    static async confirm() {return true;}
    render() {return this;}
  },
  saveDataToFile: (content, mime, name) => exports.push({content: JSON.parse(content), mime, name}),
  ChatMessage: {getSpeaker: () => ({}), create: async data => chats.push(data)},
  fromUuid: async uuid => documents.get(uuid)
});

await import("../scripts/foundry.js");
hooks.once.get("init")();
hooks.once.get("ready")();
const api = game.modules.get(namespace).api;

beforeEach(() => {
  game.user = {id: "gm-user", isGM: true};
  settings.set(settingsKey("campaignData"), {locations: [], overrides: [], disabled: []});
  settings.set(settingsKey("privateLocations"), {});
  writes.length = 0; exports.length = 0; chats.length = 0; errors.length = 0;
  documents.clear();
});

test("initialization registers a v12 FormApplication settings launcher, two proper storage scopes, and a keybinding", () => {
  assert.equal(definitions.get(settingsKey("campaignData")).scope, "world");
  assert.equal(definitions.get(settingsKey("privateLocations")).scope, "client");
  assert.equal(menus.get(settingsKey("openAtlas")).restricted, false);
  assert.ok(menus.get(settingsKey("openAtlas")).type.prototype instanceof FormApplicationMock);
  assert.deepEqual(bindings.get(settingsKey("open")).editable, [{key: "KeyN", modifiers: ["Alt", "Shift"]}]);
  assert.ok(Object.isFrozen(api));
});

test("scene controls receive one atlas button and tolerate a missing token group", () => {
  const controls = [{name: "token", tools: []}];
  const hook = hooks.on.get("getSceneControlButtons");
  hook(controls); hook(controls);
  assert.equal(controls[0].tools.length, 1);
  assert.equal(controls[0].tools[0].name, namespace);
  assert.equal(controls[0].tools[0].button, true);
  assert.doesNotThrow(() => hook([]));
});

test("public points use the world setting and private points never enter its writes", async () => {
  await api.addLocation(campaignPoint());
  await api.addLocation(campaignPoint({id: "secret", name: "SECRET SAFEHOUSE", summary: "SECRET PASSWORD", hidden: true}));
  assert.equal(settings.get(settingsKey("campaignData")).locations.length, 1);
  assert.equal(settings.get(settingsKey("privateLocations"))["test-world:gm-user"].length, 1);
  assert.doesNotMatch(JSON.stringify(writes.filter(write => write.scope === "world")), /SECRET|secret/);
  assert.equal((await api.getData()).locations.length, 3);
  game.user = {id: "player-user", isGM: false};
  const playerData = await api.getData();
  assert.deepEqual(playerData.locations.map(point => point.id), ["hospital", "campaign-venue"]);
  assert.doesNotMatch(JSON.stringify(playerData), /SECRET|secret/);
});

test("players may read the atlas and cannot add or import campaign points", async () => {
  game.user = {id: "player-user", isGM: false};
  assert.equal((await api.getData()).locations[0].id, "hospital");
  await assert.rejects(api.addLocation(campaignPoint()), /GM/);
  await assert.rejects(api.importLocations({schemaVersion: 1, locations: [campaignPoint()]}), /GM/);
  assert.equal(writes.length, 0);
});

test("updating a point from public to private and back leaves exactly one copy", async () => {
  await api.addLocation(campaignPoint());
  await api.addLocation(campaignPoint({hidden: true, name: "SECRET VENUE"}));
  assert.equal(settings.get(settingsKey("campaignData")).locations.length, 0);
  assert.equal(settings.get(settingsKey("privateLocations"))["test-world:gm-user"].length, 1);
  await api.addLocation(campaignPoint({name: "Public venue"}));
  assert.equal(settings.get(settingsKey("campaignData")).locations.length, 1);
  assert.equal(settings.get(settingsKey("privateLocations"))["test-world:gm-user"].length, 0);
  assert.equal((await api.getData()).locations.filter(point => point.id === "campaign-venue").length, 1);
});

test("additive imports preserve unrelated records and update opposite visibility storage", async () => {
  await api.addLocation(campaignPoint({id: "unrelated"}));
  await api.addLocation(campaignPoint({hidden: true, name: "SECRET VENUE"}));
  const count = await api.importLocations({schemaVersion: 1, locations: [campaignPoint({name: "Imported public venue"}), campaignPoint({id: "new-secret", name: "SECRET NEW", hidden: true})]});
  assert.equal(count, 2);
  const publicState = settings.get(settingsKey("campaignData"));
  assert.deepEqual(new Set(publicState.locations.map(point => point.id)), new Set(["unrelated", "campaign-venue"]));
  assert.doesNotMatch(JSON.stringify(publicState), /SECRET|secret/);
  const privatePoints = settings.get(settingsKey("privateLocations"))["test-world:gm-user"];
  assert.deepEqual(privatePoints.map(point => point.id), ["new-secret"]);
});

test("a malformed import fails atomically and subsequent valid writes still succeed", async () => {
  await api.addLocation(campaignPoint({id: "existing"}));
  const before = structuredClone([...settings]);
  const writeCount = writes.length;
  await assert.rejects(api.importLocations({schemaVersion: 1, locations: [campaignPoint(), campaignPoint({id: "bad", x: -1})]}));
  assert.deepEqual([...settings], before);
  assert.equal(writes.length, writeCount);
  await api.addLocation(campaignPoint());
  assert.equal(settings.get(settingsKey("campaignData")).locations.length, 2);
});

test("combined custom marker limit rejects an oversized merge without a partial private save", async () => {
  settings.set(settingsKey("campaignData"), {
    locations: Array.from({length: 1999}, (_, i) => campaignPoint({id: `existing-${i}`})),
    overrides: [], disabled: []
  });
  const before = structuredClone([...settings]);
  await assert.rejects(api.importLocations({schemaVersion: 1, locations: [
    campaignPoint({id: "new-public"}), campaignPoint({id: "new-secret", hidden: true})
  ]}), /2000/);
  assert.deepEqual([...settings], before);
  assert.equal(writes.length, 0);
  await api.addLocation(campaignPoint({id: "last-allowed"}));
  assert.equal(settings.get(settingsKey("campaignData")).locations.length, 2000);
});

test("simultaneous operations on one client retain every unrelated new point", async () => {
  await Promise.all(Array.from({length: 20}, (_, i) => api.addLocation(campaignPoint({id: `parallel-${i}`}))));
  const ids = settings.get(settingsKey("campaignData")).locations.map(point => point.id);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
});

test("canonical removal is restored by an explicit validated override import", async () => {
  const app = await api.open();
  await app.deletePoint(defaultAtlas.locations[0]);
  assert.ok(!(await api.getData()).locations.some(point => point.id === "hospital"));
  assert.deepEqual(settings.get(settingsKey("campaignData")).disabled, ["hospital"]);
  await api.importLocations({schemaVersion: 1, locations: [], overrides: [campaignPoint({id: "hospital", name: "Campaign hospital"})]});
  assert.equal((await api.getData()).locations.find(point => point.id === "hospital").name, "Campaign hospital");
  assert.deepEqual(settings.get(settingsKey("campaignData")).disabled, []);
});

test("public export omits local notes while explicit full GM backup retains them", async () => {
  await api.addLocation(campaignPoint());
  await api.addLocation(campaignPoint({id: "secret", name: "SECRET", hidden: true}));
  const app = await api.open();
  app.exportData(false);
  app.exportData(true);
  assert.doesNotMatch(JSON.stringify(exports[0].content), /SECRET|secret/);
  assert.equal(exports[0].content.schemaVersion, 1);
  assert.equal(exports[1].content.locations.find(point => point.id === "secret").hidden, true);
  assert.equal(exports[0].mime, "application/json");
});

test("shared chat cards deny private points and escape public names and descriptions", async () => {
  await api.addLocation(campaignPoint({name: '<img src=x onerror="alert(1)">', summary: "<script>steal()</script>"}));
  await api.addLocation(campaignPoint({id: "secret", hidden: true}));
  const app = await api.open();
  await assert.rejects(app.shareReference({type: "location", id: "secret"}));
  assert.equal(chats.length, 0);
  await app.shareReference({type: "location", id: "campaign-venue"});
  assert.equal(chats.length, 1);
  assert.doesNotMatch(chats[0].content, /<img|<script/i);
  assert.match(chats[0].content, /&lt;img/);
  assert.match(chats[0].content, /data-nca-id="campaign-venue"/);
});

test("journal links check observer permission before rendering and select the permitted page", async () => {
  const app = await api.open();
  let rendered;
  documents.set("JournalEntry.test.JournalEntryPage.page", {
    documentName: "JournalEntryPage", id: "page", testUserPermission: () => false,
    parent: {sheet: {render: (...args) => {rendered = args;}}}
  });
  const point = campaignPoint({journalUUID: "JournalEntry.test.JournalEntryPage.page"});
  await assert.rejects(app.openJournal(point), /недоступен/);
  assert.equal(rendered, undefined);
  documents.get(point.journalUUID).testUserPermission = (user, permission) => permission === "OBSERVER";
  await app.openJournal(point);
  assert.deepEqual(rendered, [true, {pageId: "page"}]);
});
