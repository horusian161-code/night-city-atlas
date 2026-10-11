/** Pure validation/model functions. Never render untrusted imported HTML. */
export const MODULE_ID = "night-city-atlas";
export const CATEGORIES = ["nightlife", "medical", "corporate", "civic", "transport", "market", "landmark", "gang"];
export const EMPTY_STATE = () => ({locations: [], overrides: [], disabled: []});
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const MAX_POINTS = 2000;

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[char]));
}

export function safeImagePath(value) {
  if (!value) return "";
  if (typeof value !== "string" || value.length > 1024) throw new Error("Недопустимый путь изображения.");
  value = value.trim();
  let decoded = value;
  try { for (let i=0;i<3;i++) {const next=decodeURIComponent(decoded); if(next===decoded) break; decoded=next;} } catch {throw new Error("Некорректное кодирование пути изображения.");}
  if (/[\\<>\x00-\x1f]/.test(value) || /[\\<>\x00-\x1f]/.test(decoded)) throw new Error("Недопустимые символы в пути изображения.");
  if (/^https:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password) throw new Error("В адресе изображения не должно быть учётных данных.");
    return value;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith("//") || decoded.split("/").includes("..")) {
    throw new Error("Изображение: используйте локальный путь Foundry или HTTPS URL.");
  }
  return value;
}

function str(value, field, max, required = false) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`Поле «${field}» неверно или слишком длинное.`);
  return value.trim();
}

export function validateLocation(raw, atlas, {custom = true} = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Метка должна быть объектом.");
  if (typeof raw.id !== "string" || !ID.test(raw.id)) throw new Error("ID метки: 1–96 латинских букв, цифр, - или _.");
  if (typeof raw.x !== "number" || !Number.isFinite(raw.x) || raw.x < 0 || raw.x > atlas.width || typeof raw.y !== "number" || !Number.isFinite(raw.y) || raw.y < 0 || raw.y > atlas.height) {
    throw new Error(`Метка «${raw.id}»: координаты за пределами карты ${atlas.width}×${atlas.height}.`);
  }
  if (!atlas.districts.some(d => d.id === raw.districtId)) throw new Error(`Метка «${raw.id}»: неизвестный район.`);
  if (!CATEGORIES.includes(raw.category)) throw new Error(`Метка «${raw.id}»: неизвестная категория.`);
  if (raw.hidden !== undefined && typeof raw.hidden !== "boolean") throw new Error("hidden должен быть boolean.");
  const sourceUrl = str(raw.sourceUrl, "URL источника", 1000);
  if (sourceUrl) {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password || /[<>\x00-\x1f]/.test(sourceUrl)) throw new Error("Источник: используйте HTTPS URL без учётных данных.");
  }
  return {
    id: raw.id, name: str(raw.name, "название", 160, true), nameEn: str(raw.nameEn, "английское название", 160),
    districtId: raw.districtId, category: raw.category, x: raw.x, y: raw.y,
    summary: str(raw.summary, "описание", 4000), image: safeImagePath(raw.image),
    source: str(raw.source, "источник", 1000),
    sourceUrl, sourceCode: str(raw.sourceCode, "код места в источнике", 32),
    placementNote: str(raw.placementNote, "примечание к положению", 1000),
    precision: raw.precision === "atlas" ? "atlas" : "approximate",
    hidden: raw.hidden === true, custom,
    journalUUID: str(raw.journalUUID, "UUID журнала", 200)
  };
}

/** Import is additive/upsert. Entire input validated before any settings write. */
export function validateImport(payload, atlas) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.schemaVersion !== 1) throw new Error("Ожидается JSON объекта со schemaVersion: 1.");
  if (!Array.isArray(payload.locations) || payload.locations.length > MAX_POINTS) throw new Error(`locations должен быть массивом не более ${MAX_POINTS} меток.`);
  const ids = new Set();
  const defaults = new Set(atlas.locations.map(p => p.id));
  const locations = payload.locations.map(p => {
    const point = validateLocation(p, atlas);
    if (ids.has(point.id) || defaults.has(point.id)) throw new Error(`Повтор ID или совпадение с канонической меткой: ${point.id}.`);
    ids.add(point.id);
    return point;
  });
  const overrides = payload.overrides ?? [];
  const disabled = payload.disabled ?? [];
  if (!Array.isArray(overrides) || overrides.length > atlas.locations.length || !Array.isArray(disabled) || disabled.length > atlas.locations.length) throw new Error("Неверный список изменений канонических точек.");
  const overrideIds = new Set();
  const checkedOverrides = overrides.map(p => {
    const point = validateLocation(p, atlas, {custom: false});
    if (!defaults.has(point.id) || overrideIds.has(point.id) || point.hidden) throw new Error(`Неверное изменение канонической точки: ${point.id}.`);
    overrideIds.add(point.id);
    return point;
  });
  if (disabled.some(id => !defaults.has(id))) throw new Error("Неизвестная отключённая каноническая точка.");
  return {locations, overrides: checkedOverrides, disabled: [...new Set(disabled)]};
}

export function mergeState(oldState, addition) {
  const upsert = (a, b) => [...new Map([...a, ...b].map(p => [p.id, p])).values()];
  return {
    locations: upsert(oldState?.locations ?? [], addition.locations ?? []),
    overrides: upsert(oldState?.overrides ?? [], addition.overrides ?? []),
    disabled: [...new Set([...(oldState?.disabled ?? []), ...(addition.disabled ?? [])])]
  };
}

export function visibleAtlas(atlas, state = EMPTY_STATE(), privateLocations = [], isGM = false) {
  const overrides = new Map((state.overrides ?? []).filter(p => !p.hidden).map(p => [p.id, p]));
  const disabled = new Set(state.disabled ?? []);
  const locations = atlas.locations.filter(p => !disabled.has(p.id) && !p.hidden).map(p => overrides.get(p.id) ?? p);
  for (const point of state.locations ?? []) if (!point.hidden) locations.push(point);
  if (isGM) for (const point of privateLocations) locations.push({...point, hidden: true, custom: true});
  return {...atlas, locations};
}

export function splitImport(state) {
  return {
    publicState: {...state, locations: state.locations.filter(p => !p.hidden)},
    privateLocations: state.locations.filter(p => p.hidden)
  };
}
