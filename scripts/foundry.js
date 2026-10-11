import {AtlasUI} from "./atlas-ui.js";
import {MODULE_ID, CATEGORIES, EMPTY_STATE, escapeHTML, validateLocation, validateImport, mergeState, visibleAtlas, splitImport} from "./model.js";

const BASE = `modules/${MODULE_ID}`;
const CATEGORY_NAMES = {nightlife:"Ночная жизнь", medical:"Медицина", corporate:"Корпорации", civic:"Городские службы", transport:"Транспорт", market:"Торговля", landmark:"Достопримечательности", gang:"Улица и банды"};
let atlasPromise;
let windowInstance;
let writeQueue = Promise.resolve();
const clone = value => foundry.utils.deepClone(value);
const requireGM = () => {if (!game.user.isGM) throw new Error("Изменять атлас может только GM.");};
const notice = error => {console.error(`${MODULE_ID} |`, error); ui.notifications.error(error.message ?? String(error));};
const guard = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(notice);
const privateKey = () => `${game.world.id}:${game.user.id}`;
function getPrivate() {return game.user.isGM ? clone(game.settings.get(MODULE_ID, "privateLocations")[privateKey()] ?? []) : [];}
function getState() {return clone(game.settings.get(MODULE_ID, "campaignData"));}
function enqueue(fn) {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}
async function setPrivate(points) {
  const store = clone(game.settings.get(MODULE_ID, "privateLocations"));
  store[privateKey()] = points;
  await game.settings.set(MODULE_ID, "privateLocations", store);
}
async function loadAtlas() {
  if (!atlasPromise) atlasPromise = fetch(`${BASE}/data/atlas.json`).then(async response => {
    if (!response.ok) throw new Error(`Не удалось загрузить атлас (${response.status}).`);
    const atlas = await response.json();
    if (atlas.schemaVersion !== 1 || !Array.isArray(atlas.districts) || !Array.isArray(atlas.locations)) throw new Error("Некорректный файл атласа.");
    return atlas;
  }).catch(error => {atlasPromise = undefined; throw error;});
  return atlasPromise;
}
async function currentAtlas() {return visibleAtlas(await loadAtlas(), getState(), getPrivate(), game.user.isGM);}

class LocationEditor extends FormApplication {
  constructor(point, app) {super(); this.point = point; this.atlasApp = app;}
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {id:"nca-location-editor", title:"RED CITY — Метка", template:`${BASE}/templates/location-editor.hbs`, width:560, height:"auto", closeOnSubmit:false, classes:["nca-editor"]});
  }
  async getData() {
    const atlas = await loadAtlas();
    return {point:this.point, isCustom:this.point.custom, districts:atlas.districts.map(d => ({id:d.id, name:d.name, selected:d.id === this.point.districtId})), categories:CATEGORIES.map(id => ({id,name:CATEGORY_NAMES[id],selected:id === this.point.category})), maxX:atlas.width, maxY:atlas.height};
  }
  async _updateObject(event, formData) {
    try {
      requireGM();
      await this.atlasApp.savePoint({...this.point, ...formData, x:Number(formData.x), y:Number(formData.y), hidden:this.point.custom && formData.hidden === true, precision:"approximate"});
      await this.close();
      ui.notifications.info("Метка сохранена.");
    } catch(error) {notice(error);}
  }
}

class NightCityAtlasWindow extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:MODULE_ID, title:"RED CITY // Найт-Сити 2045", template:`${BASE}/templates/atlas.hbs`,
      width:Math.min(1380, Math.max(700, window.innerWidth - 90)), height:Math.min(860, Math.max(440, window.innerHeight - 90)),
      resizable:true, classes:["night-city-atlas-window"], minimizable:true
    });
  }
  async getData() {this.data = await currentAtlas(); return {};}
  activateListeners(html) {
    super.activateListeners(html);
    this.atlasUI?.destroy();
    const root = html[0].querySelector(".nca-app") ?? html[0];
    this.atlasUI = new AtlasUI(root, this.data, {
      isGM:game.user.isGM, basePath:BASE,
      onAdd:guard(position => this.editPoint({...position, id:`custom-${foundry.utils.randomID(16)}`,name:"",nameEn:"",summary:"",category:"landmark",custom:true,source:"Метка кампании",precision:"approximate"})),
      onEdit:guard(point => this.editPoint(point)),
      onDelete:guard(point => this.deletePoint(point)),
      onImport:guard(() => this.importDialog()), onExport:guard(() => this.exportDialog()),
      onOpenJournal:guard(point => this.openJournal(point)),
      onShare:game.user.isGM ? guard(ref => this.shareReference(ref)) : undefined
    });
    if (this.pendingReference) this.selectReference(this.pendingReference);
  }
  async close(options) {this.atlasUI?.destroy(); this.atlasUI = undefined; return super.close(options);}
  async refresh() {
    this.data = await currentAtlas();
    if (this.rendered && this.atlasUI) this.atlasUI.updateData(this.data);
  }
  selectReference(ref) {
    this.pendingReference = ref;
    if (typeof this.atlasUI?.selectReference === "function") this.atlasUI.selectReference(ref);
    else if (ref.type === "location" && typeof this.atlasUI?.selectLocation === "function") this.atlasUI.selectLocation(ref.id);
    else if (ref.type === "district" && typeof this.atlasUI?.selectDistrict === "function") this.atlasUI.selectDistrict(ref.id);
  }
  async editPoint(point) {
    requireGM();
    const atlas = await loadAtlas();
    const defaultId = atlas.districts[0].id;
    new LocationEditor({...point,districtId:point.districtId || defaultId}, this).render(true);
  }
  async savePoint(raw) {
    requireGM();
    const atlas = await loadAtlas();
    const canonical = atlas.locations.some(p => p.id === raw.id);
    const point = validateLocation(raw, atlas, {custom:!canonical});
    if (canonical && point.hidden) throw new Error("Канонические точки общедоступны. Для личной заметки создайте отдельную метку.");
    await enqueue(async () => {
      const state = getState();
      const privatePoints = getPrivate().filter(p => p.id !== point.id);
      state.locations = state.locations.filter(p => p.id !== point.id);
      state.overrides = state.overrides.filter(p => p.id !== point.id);
      state.disabled = state.disabled.filter(id => id !== point.id);
      if (canonical) state.overrides.push(point);
      else if (point.hidden) privatePoints.push(point);
      else state.locations.push(point);
      if (state.locations.length + privatePoints.length > 2000) throw new Error("Лимит: 2000 пользовательских меток.");
      // Private notes never enter a world setting or socket message.
      await setPrivate(privatePoints);
      await game.settings.set(MODULE_ID, "campaignData", state);
    });
    await this.refresh();
  }
  async deletePoint(point) {
    requireGM();
    const yes = await Dialog.confirm({title:"Удалить метку?", content:`<p>Убрать «${escapeHTML(point.name)}» с карты? Каноническую точку можно вернуть через импорт резервной копии с соответствующим изменением.</p>`,defaultYes:false});
    if (!yes) return;
    const atlas = await loadAtlas();
    await enqueue(async () => {
      const state = getState();
      state.locations = state.locations.filter(p => p.id !== point.id);
      state.overrides = state.overrides.filter(p => p.id !== point.id);
      if (atlas.locations.some(p => p.id === point.id)) state.disabled = [...new Set([...state.disabled,point.id])];
      await setPrivate(getPrivate().filter(p => p.id !== point.id));
      await game.settings.set(MODULE_ID,"campaignData",state);
    });
    await this.refresh();
  }
  async importData(payload) {
    requireGM();
    const checked = validateImport(payload, await loadAtlas());
    const {publicState,privateLocations} = splitImport(checked);
    await enqueue(async () => {
      const state = getState();
      const importedIds = new Set(checked.locations.map(p => p.id));
      state.locations = state.locations.filter(p => !importedIds.has(p.id));
      const merged = mergeState(state, publicState);
      // An override explicitly restores that default pin, even after deletion.
      const restore = new Set(checked.overrides.map(p => p.id));
      merged.disabled = merged.disabled.filter(id => !restore.has(id));
      const local = [...getPrivate().filter(p => !importedIds.has(p.id)), ...privateLocations];
      if (merged.locations.length + local.length > 2000) throw new Error("Лимит: 2000 пользовательских меток.");
      await setPrivate(local);
      await game.settings.set(MODULE_ID,"campaignData",merged);
    });
    await this.refresh();
    return checked.locations.length + checked.overrides.length;
  }
  importDialog() {
    requireGM();
    new Dialog({title:"Импорт меток RED CITY", content:`<form><p>JSON со schemaVersion: 1. Импорт добавляет и обновляет метки по ID; остальные остаются. Максимум 2 МБ.</p><input type="file" name="atlasFile" accept=".json,application/json" required></form>`,buttons:{import:{icon:"fas fa-file-import",label:"Импортировать",callback:html => guard(async () => {
      const file = html[0].querySelector('input[type="file"]').files[0];
      if (!file) throw new Error("Выберите JSON-файл.");
      if (file.size > 2 * 1024 * 1024) throw new Error("Файл больше 2 МБ.");
      const count = await this.importData(JSON.parse(await file.text()));
      ui.notifications.info(`Импортировано записей: ${count}.`);
    })()},cancel:{label:"Отмена"}},default:"import"}).render(true);
  }
  exportDialog() {
    requireGM();
    new Dialog({title:"Экспорт меток RED CITY",content:"<p>Сохраняются метки кампании, изменения и отключённые точки. Для переноса личных меток на другое устройство выберите полную копию.</p>",buttons:{public:{label:"Общедоступные метки",callback:()=>this.exportData(false)},all:{label:"Полная копия с личными метками",callback:()=>this.exportData(true)},cancel:{label:"Отмена"}},default:"public"}).render(true);
  }
  exportData(includePrivate = false) {
    requireGM();
    const state = getState();
    if (includePrivate) state.locations.push(...getPrivate());
    const payload = {schemaVersion:1, atlasVersion:"1.0.0", exportedAt:new Date().toISOString(), ...state};
    saveDataToFile(JSON.stringify(payload,null,2),"application/json",`red-city-${includePrivate ? "gm-backup" : "locations"}.json`);
  }
  async openJournal(point) {
    if (!point.journalUUID) return;
    const document = await fromUuid(point.journalUUID);
    if (!document || !document.testUserPermission(game.user, "OBSERVER")) throw new Error("Журнал недоступен вашему пользователю.");
    if (document.documentName === "JournalEntryPage") document.parent.sheet.render(true, {pageId:document.id});
    else if (document.documentName === "JournalEntry") document.sheet.render(true);
    else throw new Error("UUID должен вести на JournalEntry или JournalEntryPage.");
  }
  async shareReference(ref) {
    requireGM();
    const atlas = await currentAtlas();
    if (!ref || !["district","location"].includes(ref.type)) return;
    const item = (ref.type === "district" ? atlas.districts : atlas.locations).find(p => p.id === ref.id);
    if (!item || item.hidden) throw new Error("Личную метку нельзя показать в общем чате.");
    await ChatMessage.create({speaker:ChatMessage.getSpeaker(), content:`<div class="nca-chat-card"><strong>RED CITY // 2045</strong><p>${escapeHTML(item.name)}</p><p>${escapeHTML(item.summary)}</p><button type="button" data-nca-type="${ref.type}" data-nca-id="${escapeHTML(ref.id)}">Открыть в атласе</button></div>`});
  }
}

/** v12 settings menus require a FormApplication constructor. */
class AtlasLauncher extends FormApplication {
  render() {guard(()=>openAtlas())(); return this;}
  async _updateObject() {}
}

async function openAtlas(ref) {
  await loadAtlas();
  windowInstance ??= new NightCityAtlasWindow();
  windowInstance.pendingReference = ref;
  if (windowInstance.rendered) {
    await windowInstance.refresh();
    windowInstance.bringToTop();
    if (ref) windowInstance.selectReference(ref);
  } else windowInstance.render(true);
  return windowInstance;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID,"campaignData",{name:"Campaign atlas data",scope:"world",config:false,type:Object,default:EMPTY_STATE(),onChange:()=>{if(windowInstance?.rendered) guard(()=>windowInstance.refresh())();}});
  game.settings.register(MODULE_ID,"privateLocations",{name:"Private local GM locations",scope:"client",config:false,type:Object,default:{}});
  game.settings.registerMenu(MODULE_ID,"openAtlas",{name:"RED CITY — Найт-Сити 2045",label:"Открыть карту",hint:"Районы, места и метки кампании.",icon:"fas fa-map-marked-alt",type:AtlasLauncher,restricted:false});
  game.keybindings.register(MODULE_ID,"open",{name:"Открыть атлас Найт-Сити",editable:[{key:"KeyN",modifiers:["Alt","Shift"]}],onDown:()=>{guard(()=>openAtlas())();return true;},precedence:CONST.KEYBINDING_PRECEDENCE.NORMAL});
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = Object.freeze({open:openAtlas,getData:currentAtlas,addLocation:async point=>{requireGM(); const app=await openAtlas(); return app.savePoint({...point,id:point.id||`custom-${foundry.utils.randomID(16)}`,custom:true});},importLocations:async payload=>{requireGM(); const app=await openAtlas();return app.importData(payload);}});
});

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.find(control => control.name === "token");
  if (!tokens || tokens.tools.some(tool=>tool.name===MODULE_ID)) return;
  tokens.tools.push({name:MODULE_ID,title:"RED CITY — Найт-Сити 2045",icon:"fas fa-map-marked-alt",button:true,onClick:guard(()=>openAtlas())});
});

Hooks.on("renderJournalDirectory", (app,html) => {
  const root = html[0];
  const header = root.querySelector(".header-actions") ?? root.querySelector(".directory-header");
  if (!header || header.querySelector("[data-nca-open]")) return;
  const button = document.createElement("button");
  button.type="button"; button.dataset.ncaOpen="true"; button.title="RED CITY — Найт-Сити 2045";
  button.innerHTML='<i class="fas fa-map-marked-alt"></i> Найт-Сити';
  button.addEventListener("click",guard(()=>openAtlas())); header.append(button);
});

Hooks.on("renderChatMessage", (message,html) => {
  for (const button of html[0].querySelectorAll("button[data-nca-type][data-nca-id]")) {
    button.addEventListener("click",guard(()=>openAtlas({type:button.dataset.ncaType,id:button.dataset.ncaId})));
  }
});
