const SVG_NS = "http://www.w3.org/2000/svg";
let instanceSequence = 0;

const CATEGORIES = {
  nightlife: { label: "Ночная жизнь", short: "Клубы", color: "#df90ff", icon: "music" },
  medical: { label: "Медицина", short: "Медицина", color: "#65dec3", icon: "cross" },
  corporate: { label: "Корпорации", short: "Корпорации", color: "#f6bd69", icon: "building" },
  civic: { label: "Городские службы", short: "Службы", color: "#8ec0f5", icon: "shield" },
  transport: { label: "Транспорт", short: "Транспорт", color: "#6bd4e4", icon: "transit" },
  market: { label: "Торговля", short: "Торговля", color: "#f3d47d", icon: "shop" },
  landmark: { label: "Ориентиры", short: "Ориентиры", color: "#d3dae5", icon: "pin" },
  gang: { label: "Уличные группировки", short: "Группировки", color: "#f67f88", icon: "bolt" }
};

const ICONS = {
  search: "M21 21l-5.2-5.2M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z",
  pin: "M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12ZM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  music: "M9 17V5l11-2v12M9 17c0 2-2 3-4 3s-3-1-3-2.5S4 15 6 15s3 .7 3 2ZM20 15c0 2-2 3-4 3s-3-1-3-2.5S15 13 17 13s3 .7 3 2Z",
  cross: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z",
  building: "M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 9h1m6 0h1M8 12h1m6 0h1",
  shield: "m12 3 9 3v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6",
  transit: "M5 16V5c0-2 14-2 14 0v11ZM5 10h14M8 7h1m6 0h1M7 16l-2 5m12-5 2 5M7 19h10",
  shop: "M3 9 5 3h14l2 6M3 9v3h18V9ZM5 12v9h14v-9M9 21v-6h6v6",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7Z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  reset: "M3 9a9 9 0 1 1 0 6M3 3v6h6",
  expand: "M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  edit: "m15 4 5 5M4 20l1-6L17 2l5 5L10 19Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  upload: "M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6",
  download: "M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4",
  book: "M12 5v16M3 3c4 0 7 1 9 2 2-1 5-2 9-2v15c-4 0-7 1-9 3-2-2-5-3-9-3Z",
  share: "M8 12H3v9h18v-9h-5M12 16V2m-5 5 5-5 5 5",
  info: "M12 10v7m0-10h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z",
  layers: "m12 2 10 6-10 6L2 8ZM2 12l10 6 10-6M2 16l10 6 10-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  list: "M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01"
};

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}

function svgNode(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function icon(name, className = "nca-icon") {
  const svg = svgNode("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: className });
  svg.append(svgNode("path", { d: ICONS[name] || ICONS.pin }));
  return svg;
}

function button(text, className, iconName, title = text) {
  const el = node("button", className);
  el.type = "button";
  el.title = title;
  el.setAttribute("aria-label", title);
  if (iconName) el.append(icon(iconName));
  if (text) el.append(node("span", "", text));
  return el;
}

function validUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function safeColor(value, fallback = "#d9a55d") {
  return typeof value === "string" && /^#[a-f0-9]{3,8}$/i.test(value) ? value : fallback;
}

function searchText(value) {
  return String(value || "").toLocaleLowerCase("ru").replace(/ё/g, "е").normalize("NFKC");
}

function sourceAnchor(source, sourceUrl) {
  const embeddedUrl = typeof source === "string" ? source.match(/https?:\/\/[^\s<>]+/)?.[0] : null;
  const raw = typeof source === "string" ? (validUrl(source) || sourceUrl || embeddedUrl) : source?.url || sourceUrl;
  const href = validUrl(raw);
  if (!href) return null;
  const label = typeof source === "object" ? (source.title || source.name || "Источник") : validUrl(source) ? "Источник" : String(source || "").replace(/https?:\/\/[^\s<>]+/g, "").replace(/[\s:;,]+$/, "").trim() || "Источник";
  const anchor = node("a", "nca-source", label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

/** Shared, dependency-free view for Foundry and the standalone preview. */
export class AtlasUI {
  constructor(rootElement, data, options = {}) {
    if (!(rootElement instanceof HTMLElement)) throw new TypeError("AtlasUI requires an HTML root element");
    this.root = rootElement;
    this.options = { isGM: false, basePath: "modules/night-city-atlas", ...options };
    this.uid = `nca-${++instanceSequence}`;
    this.abort = new AbortController();
    this.query = "";
    this.category = "all";
    this.districtFilter = "all";
    this.selected = null;
    this.hovered = null;
    this.addMode = false;
    this.drag = null;
    this.suppressClickUntil = 0;
    this.camera = { x: 800, y: 800, zoom: 1 };
    this.firstLoad = true;
    this.root.classList.add("nca-app");
    this._build();
    this._listen();
    this.updateData(data);
  }

  _on(el, event, listener, options = {}) {
    el.addEventListener(event, listener, { ...options, signal: this.abort.signal });
  }

  _asset(path) {
    if (typeof path !== "string" || !path) return null;
    const embedded = this.options.assetMap?.[path];
    if (typeof embedded === "string" && /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(embedded)) return embedded;
    const external = validUrl(path);
    if (external) return external.startsWith("https:") ? external : null;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path) || path.includes("..") || path.startsWith("/")) return null;
    const relative = path.replace(/^\.\//, "");
    if (relative.startsWith("assets/")) return `${this.options.basePath.replace(/\/$/, "")}/${relative}`;
    return relative;
  }

  _build() {
    this.root.replaceChildren();
    this.shell = node("div", "nca-shell");
    this.shell.innerHTML = `
      <header class="nca-header">
        <div class="nca-brand"><div class="nca-brand-mark" aria-hidden="true">N<span>C</span></div><div><div class="nca-brand-title">RED CITY<span class="nca-brand-slash"> //</span></div><div class="nca-brand-subtitle">ИНТЕРАКТИВНЫЙ АТЛАС НАЙТ-СИТИ</div></div></div>
        <div class="nca-era"><span class="nca-live-dot"></span><span>ВРЕМЯ КРАСНОГО</span><strong>2045</strong></div>
        <div class="nca-header-actions"></div>
      </header>
      <div class="nca-workspace">
        <aside class="nca-rail" aria-label="Поиск и места">
          <div class="nca-rail-top"><div class="nca-section-heading"><span>ГОРОДСКОЙ ИНДЕКС</span><span class="nca-index-total"></span></div>
            <div class="nca-search-wrap"></div>
            <div class="nca-district-filter"><label>Район</label><select></select></div>
            <div class="nca-filter-heading"><span>КАТЕГОРИИ</span><button type="button" class="nca-clear">Сбросить</button></div>
            <div class="nca-categories" aria-label="Категории мест"></div>
          </div>
          <div class="nca-results-heading"><span>МЕСТА НА КАРТЕ</span><span class="nca-results-count" aria-live="polite"></span></div>
          <div class="nca-location-list" aria-label="Места"></div>
          <div class="nca-rail-footer"><span class="nca-live-dot"></span> ОБНОВЛЕНИЕ КРАСНОГО ВРЕМЕНИ</div>
        </aside>
        <section class="nca-map-panel" aria-label="Интерактивная карта Найт-Сити">
          <div class="nca-map-stage">
            <svg class="nca-map" role="group" aria-label="Карта районов и мест. Колесо мыши меняет масштаб, перетаскивание перемещает карту. Стрелки перемещают, плюс и минус меняют масштаб, ноль сбрасывает вид." tabindex="0" viewBox="0 0 1600 1600" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="nca-map-heading"><div class="nca-map-heading-kicker">ПОЛЕВОЙ АТЛАС / 01</div><div class="nca-map-heading-title">NIGHT CITY</div><div class="nca-map-heading-subtitle">СВОБОДНЫЙ ГОРОД · 36° N / 121° W</div></div>
            <div class="nca-map-controls" aria-label="Управление картой"></div>
            <div class="nca-map-compass" aria-hidden="true"><span>N</span><div>↑</div><small>ТИХИЙ ОКЕАН</small></div>
            <div class="nca-map-hint">Наведите на район · нажмите на место</div>
            <div class="nca-tooltip" hidden role="tooltip"></div>
            <div class="nca-add-banner" hidden><span>Выберите точку для новой метки</span><button type="button" aria-label="Отменить добавление">×</button></div>
          </div>
          <div class="nca-map-status"><div class="nca-zone-legend" aria-label="Зоны города"></div><div class="nca-map-meta"><span class="nca-zoom-value">100%</span><span class="nca-coordinate">800 / 800</span></div></div>
          <div class="nca-map-caption"><span>СХЕМАТИЧЕСКИЙ АТЛАС · ПОЛОЖЕНИЯ МЕСТ ОРИЕНТИРОВОЧНЫЕ</span><button type="button" class="nca-about-button">О карте</button></div>
        </section>
        <aside class="nca-inspector" aria-label="Сведения о выбранном районе или месте"></aside>
      </div>
      <div class="nca-mobile-nav" aria-label="Панели атласа"></div>
      <div class="nca-live-region" aria-live="polite" aria-atomic="true"></div>
      <div class="nca-info-dialog" hidden role="dialog" aria-modal="true" aria-label="О карте"><div class="nca-dialog-card"><div class="nca-dialog-header"><h2>О карте</h2><button type="button" class="nca-dialog-close" aria-label="Закрыть">×</button></div><div class="nca-dialog-content"></div><button type="button" class="nca-primary nca-dialog-done">Понятно</button></div></div>`;
    this.root.append(this.shell);
    this.svg = this.root.querySelector(".nca-map");
    this.stage = this.root.querySelector(".nca-map-stage");
    this.inspector = this.root.querySelector(".nca-inspector");
    this.tooltip = this.root.querySelector(".nca-tooltip");
    this.list = this.root.querySelector(".nca-location-list");
    this.districtSelect = this.root.querySelector(".nca-district-filter select");
    this.districtSelect.id = `${this.uid}-district`;
    this.root.querySelector(".nca-district-filter label").htmlFor = this.districtSelect.id;
    const search = this.root.querySelector(".nca-search-wrap");
    search.append(icon("search"));
    this.searchInput = node("input", "nca-search");
    this.searchInput.type = "search";
    this.searchInput.placeholder = "Найти место или район…";
    this.searchInput.setAttribute("aria-label", "Поиск мест на русском и английском");
    search.append(this.searchInput);
    const categories = this.root.querySelector(".nca-categories");
    const all = button("Все места", "nca-category is-active", "layers");
    all.dataset.category = "all";
    all.setAttribute("aria-pressed", "true");
    categories.append(all);
    for (const [id, item] of Object.entries(CATEGORIES)) {
      const btn = button(item.short, "nca-category", item.icon, item.label);
      btn.dataset.category = id;
      btn.style.setProperty("--category-color", item.color);
      btn.setAttribute("aria-pressed", "false");
      categories.append(btn);
    }
    const actions = this.root.querySelector(".nca-header-actions");
    if (this.options.isGM) {
      actions.append(node("span", "nca-gm-badge", "GM"));
      if (this.options.onImport) { const b = button("", "nca-icon-button", "upload", "Импортировать места"); b.dataset.action = "import"; actions.append(b); }
      if (this.options.onExport) { const b = button("", "nca-icon-button", "download", "Экспортировать места"); b.dataset.action = "export"; actions.append(b); }
      if (this.options.onAdd) {
        this.addButton = button("Добавить место", "nca-primary nca-add-button", "plus");
        this.addButton.dataset.action = "add";
        this.addButton.setAttribute("aria-pressed", "false");
        actions.append(this.addButton);
      }
    } else actions.append(node("span", "nca-reader-label", "ГОРОД ЖДЁТ"));
    const controls = this.root.querySelector(".nca-map-controls");
    for (const [action, symbol, label] of [["zoom-in", "plus", "Увеличить масштаб"], ["zoom-out", "minus", "Уменьшить масштаб"], ["reset", "expand", "Показать весь город"]]) {
      const b = button("", "nca-map-control", symbol, label);
      b.dataset.action = action;
      controls.append(b);
    }
    const nav = this.root.querySelector(".nca-mobile-nav");
    for (const [panel, label, symbol] of [["index", "Места", "list"], ["map", "Карта", "layers"], ["detail", "Сведения", "info"]]) {
      const b = button(label, `nca-mobile-tab ${panel === "map" ? "is-active" : ""}`, symbol);
      b.dataset.panel = panel;
      b.setAttribute("aria-pressed", String(panel === "map"));
      nav.append(b);
    }
    this.shell.dataset.mobilePanel = "map";
  }

  _listen() {
    this._on(this.searchInput, "input", () => { this.query = this.searchInput.value; this._renderResults(); });
    this._on(this.districtSelect, "change", () => {
      this.districtFilter = this.districtSelect.value;
      this._renderResults();
      const district = this.districts.get(this.districtFilter);
      if (district) { this.select("district", district.id); this._focusDistrict(district); }
    });
    this._on(this.root, "click", event => {
      const category = event.target.closest("button[data-category]");
      if (category && this.root.contains(category)) { this.category = category.dataset.category; this._renderResults(); return; }
      const location = event.target.closest("button[data-location]");
      if (location && this.root.contains(location)) {
        const point = this.locations.get(location.dataset.location);
        if (point) { this.select("location", point.id); this._focusLocation(point); this._mobilePanel("detail"); }
        return;
      }
      const action = event.target.closest("button[data-action]");
      if (action && this.root.contains(action)) this._action(action.dataset.action);
      const panel = event.target.closest("button[data-panel]");
      if (panel && this.root.contains(panel)) this._mobilePanel(panel.dataset.panel);
      if (event.target.closest(".nca-clear")) {
        this.query = ""; this.category = "all"; this.districtFilter = "all";
        this.searchInput.value = ""; this.districtSelect.value = "all"; this._renderResults();
      }
      if (event.target.closest(".nca-about-button")) this._openAbout();
      if (event.target.closest(".nca-dialog-close, .nca-dialog-done")) this._closeAbout();
      if (event.target.closest(".nca-add-banner button")) this._setAddMode(false);
    });
    this._on(this.svg, "wheel", event => {
      event.preventDefault();
      this._zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.003), this._mapPoint(event));
    }, { passive: false });
    this._on(this.svg, "pointerdown", event => {
      if (event.button !== 0) return;
      this.lastPointerTarget = event.target.closest("[data-map-type]");
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cameraX: this.camera.x, cameraY: this.camera.y, moved: false, scale: this._screenScale() };
      this.svg.setPointerCapture(event.pointerId);
    });
    this._on(this.svg, "pointermove", event => {
      const point = this._mapPoint(event);
      if (point) this.root.querySelector(".nca-coordinate").textContent = `${Math.round(point.x)} / ${Math.round(point.y)}`;
      if (this.drag && event.pointerId === this.drag.id) {
        const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          this.svg.classList.add("is-dragging");
          this.camera.x = this.drag.cameraX - dx / this.drag.scale;
          this.camera.y = this.drag.cameraY - dy / this.drag.scale;
          this._applyCamera();
          this._hideTooltip();
        }
      } else this._positionTooltip(event);
    });
    const stopDrag = event => {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      if (this.drag.moved) this.suppressClickUntil = Date.now() + 180;
      if (this.svg.hasPointerCapture(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
      this.drag = null;
      this.svg.classList.remove("is-dragging");
    };
    this._on(this.svg, "pointerup", stopDrag);
    this._on(this.svg, "pointercancel", stopDrag);
    this._on(this.svg, "click", event => {
      if (Date.now() < this.suppressClickUntil) return;
      const point = this._mapPoint(event);
      if (this.addMode && point) { this._addAt(point); return; }
      const target = event.target.closest("[data-map-type]") || this.lastPointerTarget;
      this.lastPointerTarget = null;
      if (target) { this.select(target.dataset.mapType, target.dataset.mapId); this._mobilePanel("detail"); }
    });
    this._on(this.svg, "dblclick", event => {
      event.preventDefault();
      if (this.options.isGM && this.options.onAdd && !event.target.closest('[data-map-type="location"]')) {
        const point = this._mapPoint(event); if (point) this._addAt(point);
      }
    });
    this._on(this.svg, "pointerover", event => {
      if (this.drag?.moved || this.addMode) return;
      const target = event.target.closest("[data-map-type]");
      if (!target || target.contains(event.relatedTarget)) return;
      this._hover(target.dataset.mapType, target.dataset.mapId, event);
    });
    this._on(this.svg, "pointerout", event => {
      const target = event.target.closest("[data-map-type]");
      if (!target || target.contains(event.relatedTarget)) return;
      this.hovered = null; this._hideTooltip(); this._renderInspector(); this._paintSelection();
    });
    this._on(this.svg, "pointerleave", () => { this.hovered = null; this._hideTooltip(); this._renderInspector(); this._paintSelection(); });
    this._on(this.svg, "focusin", event => {
      const target = event.target.closest("[data-map-type]");
      if (target) this._hover(target.dataset.mapType, target.dataset.mapId);
    });
    this._on(this.svg, "focusout", () => { this.hovered = null; this._hideTooltip(); this._renderInspector(); this._paintSelection(); });
    this._on(this.svg, "keydown", event => {
      const target = event.target.closest("[data-map-type]");
      if (["Enter", " "].includes(event.key) && target) { event.preventDefault(); this.select(target.dataset.mapType, target.dataset.mapId); return; }
      if (["+", "="].includes(event.key)) { event.preventDefault(); this._zoom(1.25); }
      if (event.key === "-") { event.preventDefault(); this._zoom(0.8); }
      if (event.key === "0" || event.key === "Home") { event.preventDefault(); this._resetCamera(); }
      const delta = 130 / this.camera.zoom;
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        if (event.key === "ArrowLeft") this.camera.x -= delta;
        if (event.key === "ArrowRight") this.camera.x += delta;
        if (event.key === "ArrowUp") this.camera.y -= delta;
        if (event.key === "ArrowDown") this.camera.y += delta;
        this._applyCamera();
      }
    });
    this._on(this.root, "keydown", event => {
      if (event.key === "Escape") { this._setAddMode(false); this._hideTooltip(); this._closeAbout(); }
      const dialog = this.root.querySelector(".nca-info-dialog");
      if (event.key === "Tab" && !dialog.hidden) {
        const items = [...dialog.querySelectorAll("button, a[href]")];
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    });
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => { if (this.data) this._applyCamera(); });
      this.resizeObserver.observe(this.stage);
    }
  }

  updateData(data) {
    this.data = data && typeof data === "object" ? data : {};
    this.data.width = Number(this.data.width) || 1600;
    this.data.height = Number(this.data.height) || 1600;
    this.districts = new Map((this.data.districts || []).map(item => [item.id, item]));
    this.locations = new Map((this.data.locations || []).map(item => [item.id, item]));
    this.zones = new Map((this.data.zones || []).map(item => [item.id, item]));
    if (this.selected && !(this.selected.type === "district" ? this.districts : this.locations).has(this.selected.id)) this.selected = null;
    if (!this.districts.has(this.districtFilter)) this.districtFilter = "all";
    this.hovered = null;
    this.districtSelect.replaceChildren(node("option", "", "Все районы"));
    this.districtSelect.firstChild.value = "all";
    for (const district of this.districts.values()) {
      const option = node("option", "", district.name); option.value = district.id; this.districtSelect.append(option);
    }
    this.districtSelect.value = this.districtFilter;
    this.root.querySelector(".nca-index-total").textContent = String(this.locations.size).padStart(2, "0");
    const legend = this.root.querySelector(".nca-zone-legend"); legend.replaceChildren();
    for (const zone of this.zones.values()) {
      const item = node("span", "nca-legend-item");
      const dot = node("i"); dot.style.backgroundColor = safeColor(zone.color); item.append(dot, node("span", "", zone.name)); legend.append(item);
    }
    this._renderMap(); this._renderResults(); this._renderInspector();
    if (this.firstLoad) { this.firstLoad = false; this._resetCamera(); } else this._applyCamera();
  }

  _renderMap() {
    this.svg.replaceChildren();
    const defs = svgNode("defs");
    const pattern = svgNode("pattern", { id: `${this.uid}-grid`, width: 50, height: 50, patternUnits: "userSpaceOnUse" });
    pattern.append(svgNode("path", { d: "M 50 0 L 0 0 0 50", fill: "none", stroke: "#789bac", "stroke-opacity": 0.08, "stroke-width": 1 }));
    defs.append(pattern); this.svg.append(defs);
    this.svg.append(svgNode("rect", { x: -2400, y: -2400, width: 6400, height: 6400, fill: "#0c131b" }));
    this.svg.append(svgNode("rect", { x: -2400, y: -2400, width: 6400, height: 6400, fill: `url(#${this.uid}-grid)` }));
    this.svg.append(svgNode("image", { href: this._asset("assets/map-base.svg"), x: 0, y: 0, width: this.data.width, height: this.data.height, "aria-hidden": "true", "pointer-events": "none" }));
    this.districtLayer = svgNode("g", { class: "nca-district-layer" });
    this.labelLayer = svgNode("g", { class: "nca-district-labels", "aria-hidden": "true", "pointer-events": "none" });
    for (const district of this.districts.values()) {
      if (!Array.isArray(district.polygon) || district.polygon.length < 3) continue;
      const zone = this.zones.get(district.zone);
      const color = safeColor(zone?.color);
      const polygon = svgNode("polygon", { points: district.polygon.map(point => `${Number(point[0]) || 0},${Number(point[1]) || 0}`).join(" "), class: "nca-district-shape", fill: color, stroke: color, "data-map-type": "district", "data-map-id": district.id, role: "button", tabindex: 0, "aria-label": `Район: ${district.name}`, "aria-pressed": "false" });
      this.districtLayer.append(polygon);
      if (Array.isArray(district.label)) {
        const group = svgNode("g", { transform: `translate(${Number(district.label[0]) || 0} ${Number(district.label[1]) || 0})`, class: "nca-district-label", "data-label-id": district.id });
        const text = svgNode("text", { "text-anchor": "middle", y: 0 });
        text.textContent = String(district.name || "").toLocaleUpperCase("ru");
        const sub = svgNode("text", { "text-anchor": "middle", y: 21, class: "nca-district-label-en" }); sub.textContent = String(district.nameEn || "").toUpperCase();
        group.append(text, sub); this.labelLayer.append(group);
      }
    }
    this.svg.append(this.districtLayer, this.labelLayer);
    this.pinLayer = svgNode("g", { class: "nca-pin-layer" }); this.svg.append(this.pinLayer);
    this._renderPins();
  }

  _filteredLocations() {
    const terms = searchText(this.query).split(/\s+/).filter(Boolean);
    return [...this.locations.values()].filter(point => {
      if (this.category !== "all" && point.category !== this.category) return false;
      if (this.districtFilter !== "all" && point.districtId !== this.districtFilter) return false;
      if (!terms.length) return true;
      const district = this.districts.get(point.districtId);
      const haystack = searchText([point.name, point.nameEn, point.summary, CATEGORIES[point.category]?.label, district?.name, district?.nameEn, ...(point.tags || [])].join(" "));
      return terms.every(term => haystack.includes(term));
    });
  }

  _renderResults() {
    this.filtered = this._filteredLocations();
    const count = this.root.querySelector(".nca-results-count"); count.textContent = `${this.filtered.length} / ${this.locations.size}`;
    for (const btn of this.root.querySelectorAll("[data-category]")) {
      const active = btn.dataset.category === this.category; btn.classList.toggle("is-active", active); btn.setAttribute("aria-pressed", String(active));
    }
    this.list.replaceChildren();
    for (const [index, point] of this.filtered.entries()) {
      const category = CATEGORIES[point.category] || CATEGORIES.landmark;
      const district = this.districts.get(point.districtId);
      const item = button("", "nca-location-row", null, `${point.name}. ${district?.name || "Найт-Сити"}`); item.dataset.location = point.id;
      item.classList.toggle("is-selected", this.selected?.type === "location" && this.selected.id === point.id);
      item.setAttribute("aria-pressed", String(item.classList.contains("is-selected")));
      const mark = node("span", "nca-location-icon"); mark.style.color = category.color; mark.append(icon(category.icon));
      const copy = node("span", "nca-location-copy");
      copy.append(node("strong", "", point.name), node("small", "", district?.name || "За пределами районов"));
      const rank = node("span", "nca-location-number", point.code || String(index + 1).padStart(2, "0"));
      if (point.hidden) { rank.replaceChildren(icon("eye")); rank.title = "Личная метка GM"; }
      item.append(mark, copy, rank); this.list.append(item);
    }
    if (!this.filtered.length) {
      const empty = node("div", "nca-empty"); empty.append(icon("search"), node("strong", "", "Ничего не найдено"), node("p", "", "Попробуйте другое название или сбросьте фильтры.")); this.list.append(empty);
    }
    if (this.pinLayer) this._renderPins();
    this._paintSelection();
  }

  _renderPins() {
    this.pinLayer.replaceChildren();
    const points = this.filtered || [...this.locations.values()];
    for (const point of points) {
      if (!Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) continue;
      const category = CATEGORIES[point.category] || CATEGORIES.landmark;
      const g = svgNode("g", { class: "nca-map-pin", transform: `translate(${point.x} ${point.y})`, "data-map-type": "location", "data-map-id": point.id, role: "button", tabindex: 0, "aria-label": `${point.name}, ${category.label}`, "aria-pressed": "false" });
      g.style.setProperty("--pin-color", category.color);
      g.append(svgNode("circle", { class: "nca-pin-hit", r: 22, fill: "transparent" }), svgNode("circle", { class: "nca-pin-halo", r: 23 }), svgNode("circle", { class: "nca-pin-body", r: 14, stroke: category.color }));
      const symbol = icon(category.icon, "nca-pin-icon"); symbol.setAttribute("x", -8); symbol.setAttribute("y", -8); symbol.setAttribute("width", 16); symbol.setAttribute("height", 16); symbol.style.color = category.color;
      g.append(symbol);
      if (point.hidden) g.append(svgNode("circle", { cx: 11, cy: -11, r: 4, fill: "#ffbd67", stroke: "#0c131b", "stroke-width": 2 }));
      const label = svgNode("text", { class: "nca-pin-label", x: 22, y: 5 }); label.textContent = point.name; g.append(label);
      this.pinLayer.append(g);
    }
    this._paintSelection();
  }

  _paintSelection() {
    if (!this.svg) return;
    for (const item of this.svg.querySelectorAll("[data-map-type]")) {
      const selected = item.dataset.mapType === this.selected?.type && item.dataset.mapId === this.selected?.id;
      const hovered = item.dataset.mapType === this.hovered?.type && item.dataset.mapId === this.hovered?.id;
      item.classList.toggle("is-selected", selected); item.classList.toggle("is-hovered", hovered); item.setAttribute("aria-pressed", String(selected));
      if (item.dataset.mapType === "district") item.classList.toggle("is-filtered", this.districtFilter !== "all" && item.dataset.mapId !== this.districtFilter);
    }
    for (const item of this.list.querySelectorAll("[data-location]")) {
      const selected = this.selected?.type === "location" && item.dataset.location === this.selected.id;
      item.classList.toggle("is-selected", selected); item.setAttribute("aria-pressed", String(selected));
    }
  }

  select(type, id) {
    if (!["district", "location"].includes(type) || !(type === "district" ? this.districts : this.locations).has(id)) return;
    this.selected = { type, id }; this.hovered = null; this._hideTooltip(); this._renderInspector(); this._paintSelection();
    const item = (type === "district" ? this.districts : this.locations).get(id);
    this.root.querySelector(".nca-live-region").textContent = `Выбрано: ${item.name}`;
  }

  getSelected() { return this.selected ? { ...this.selected } : null; }

  selectReference(reference) {
    if (!reference || !["district", "location"].includes(reference.type)) return;
    const item = (reference.type === "district" ? this.districts : this.locations).get(reference.id);
    if (!item) return;
    this.select(reference.type, reference.id);
    if (reference.type === "district") this._focusDistrict(item); else this._focusLocation(item);
    this._mobilePanel("detail");
  }

  _hover(type, id, event) {
    const item = (type === "district" ? this.districts : this.locations).get(id);
    if (!item) return;
    this.hovered = { type, id }; this._paintSelection();
    if (!this.selected || this.selected.type === "district") this._renderInspector();
    if (!event || event.pointerType === "touch") return;
    this.tooltip.replaceChildren();
    const district = type === "district" ? item : this.districts.get(item.districtId);
    const imagePath = this._asset(item.image || district?.image);
    if (imagePath) {
      const image = node("img", "nca-tooltip-image"); image.src = imagePath; image.alt = `Иллюстрация: ${district?.name || item.name}`; image.loading = "lazy"; this.tooltip.append(image);
    }
    const body = node("div", "nca-tooltip-copy");
    body.append(node("span", "nca-eyebrow", type === "district" ? "РАЙОН ГОРОДА" : CATEGORIES[item.category]?.label || "МЕСТО"), node("strong", "", item.name), node("p", "", item.summary || ""));
    body.append(node("small", "", "Нажмите, чтобы закрепить сведения")); this.tooltip.append(body); this.tooltip.hidden = false; this._positionTooltip(event);
  }

  _positionTooltip(event) {
    if (this.tooltip.hidden || !event) return;
    const bounds = this.stage.getBoundingClientRect();
    const width = this.tooltip.offsetWidth || 270, height = this.tooltip.offsetHeight || 250;
    let x = event.clientX - bounds.left + 20, y = event.clientY - bounds.top + 20;
    if (x + width > bounds.width - 14) x = event.clientX - bounds.left - width - 20;
    if (y + height > bounds.height - 14) y = event.clientY - bounds.top - height - 20;
    this.tooltip.style.left = `${Math.max(12, Math.min(bounds.width - width - 12, x))}px`;
    this.tooltip.style.top = `${Math.max(12, Math.min(bounds.height - height - 12, y))}px`;
  }

  _hideTooltip() { this.tooltip.hidden = true; }

  _renderInspector() {
    if (!this.districts) return;
    let reference = this.selected;
    if (this.hovered && (!this.selected || this.selected.type === "district")) reference = this.hovered;
    if (!reference) reference = { type: "district", id: this.districts.keys().next().value };
    const item = (reference.type === "district" ? this.districts : this.locations).get(reference.id);
    this.inspected = { ...reference };
    this.inspector.replaceChildren();
    if (!item) {
      this.inspector.append(node("p", "nca-inspector-empty", "Выберите район или место на карте.")); return;
    }
    const isLocation = reference.type === "location";
    const district = isLocation ? this.districts.get(item.districtId) : item;
    const zone = this.zones.get(district?.zone);
    const imagePath = this._asset(item.image || district?.image);
    const hero = node("div", "nca-inspector-hero");
    if (imagePath) { const image = node("img"); image.src = imagePath; image.alt = `Авторская иллюстрация района ${district?.name || item.name}`; image.loading = "lazy"; hero.append(image); }
    const heroTop = node("div", "nca-hero-top");
    const typeBadge = node("span", "nca-hero-badge", isLocation ? "ТОЧКА ИНТЕРЕСА" : "РАЙОН ГОРОДА");
    heroTop.append(typeBadge, node("span", "nca-hero-code", isLocation ? "POI" : "NC / 2045")); hero.append(heroTop);
    const heroBottom = node("div", "nca-hero-bottom");
    heroBottom.append(node("span", "", district?.nameEn || "NIGHT CITY"), node("span", "", "ГОРОДСКАЯ ИЛЛЮСТРАЦИЯ")); hero.append(heroBottom); this.inspector.append(hero);
    const content = node("div", "nca-inspector-content");
    const kicker = node("div", "nca-inspector-kicker");
    const badge = node("span", "nca-zone-badge", isLocation ? (CATEGORIES[item.category]?.label || "Место") : zone?.name || "Найт-Сити");
    badge.style.setProperty("--badge-color", isLocation ? CATEGORIES[item.category]?.color || "#d9a55d" : safeColor(zone?.color)); kicker.append(badge);
    if (this.selected?.id === item.id && this.selected.type === reference.type) kicker.append(node("span", "nca-pinned", "ЗАКРЕПЛЕНО"));
    else kicker.append(node("span", "nca-pinned", "ОБЗОР"));
    content.append(kicker, node("h2", "nca-inspector-title", item.name));
    if (item.nameEn) content.append(node("div", "nca-inspector-en", item.nameEn));
    content.append(node("p", "nca-inspector-summary", item.summary || "Описание ещё не добавлено."));
    if (isLocation && item.placementNote) {
      const note = node("div", "nca-placement-note"); note.append(icon("info"), node("p", "", item.placementNote)); content.append(note);
    }
    if (isLocation) {
      const facts = node("dl", "nca-facts");
      const row = (label, value) => { const wrap = node("div"); wrap.append(node("dt", "", label), node("dd", "", value)); facts.append(wrap); };
      row("РАЙОН", district?.name || "Вне районов");
      if (item.code) row("КОД АТЛАСА", item.code);
      row("ПОЛОЖЕНИЕ", item.precision === "atlas" ? "Отмечено на атласе" : "Ориентировочное");
      if (item.hidden) row("ВИДИМОСТЬ", "Личная метка GM");
      content.append(facts);
      if (district) {
        const districtButton = button(`Район: ${district.name}`, "nca-district-link", "layers");
        districtButton.dataset.action = "parent-district"; content.append(districtButton);
      }
    } else {
      const count = [...this.locations.values()].filter(point => point.districtId === item.id).length;
      const metrics = node("div", "nca-district-metrics");
      const metric = node("div"); metric.append(node("strong", "", String(count).padStart(2, "0")), node("span", "", "МЕСТ В АТЛАСЕ"));
      const zoneMetric = node("div"); zoneMetric.append(icon("layers"), node("span", "", zone?.name || "Найт-Сити")); metrics.append(metric, zoneMetric); content.append(metrics);
      if (item.tags?.length) { const tags = node("div", "nca-tags"); for (const tag of item.tags) tags.append(node("span", "", tag)); content.append(tags); }
      if (item.details?.length) {
        const details = node("div", "nca-details"); details.append(node("h3", "", "ГОРОД ВБЛИЗИ"));
        for (const detail of item.details) { const row = node("div", "nca-detail-line"); row.append(node("i"), node("p", "", detail)); details.append(row); } content.append(details);
      }
      const local = [...this.locations.values()].filter(point => point.districtId === item.id).slice(0, 5);
      if (local.length) {
        const mini = node("div", "nca-nearby"); mini.append(node("h3", "", "МЕСТА В РАЙОНЕ"));
        for (const point of local) { const b = button(point.name, "nca-nearby-location", "pin"); b.dataset.location = point.id; b.append(icon("chevron")); mini.append(b); } content.append(mini);
      }
    }
    const source = sourceAnchor(item.source, item.sourceUrl); if (source) content.append(source);
    else if (typeof item.source === "string" && item.source) content.append(node("div", "nca-source-note", item.source));
    const actions = node("div", "nca-inspector-actions");
    if (isLocation && item.journalUUID && this.options.onOpenJournal) { const b = button("Открыть журнал", "nca-primary", "book"); b.dataset.action = "journal"; actions.append(b); }
    if (!item.hidden && this.options.isGM && this.options.onShare) { const b = button("Показать игрокам", "nca-secondary", "share"); b.dataset.action = "share"; actions.append(b); }
    if (isLocation && this.options.isGM) {
      const editGroup = node("div", "nca-edit-actions");
      if (this.options.onEdit) { const b = button("Изменить", "nca-secondary", "edit"); b.dataset.action = "edit"; editGroup.append(b); }
      if (this.options.onDelete) { const b = button("", "nca-icon-button nca-delete-button", "trash", "Удалить место"); b.dataset.action = "delete"; editGroup.append(b); }
      actions.append(editGroup);
    }
    if (actions.childElementCount) content.append(actions);
    this.inspector.append(content);
    const footer = node("div", "nca-inspector-footer"); footer.append(node("span", "", "RED CITY // DATABASE"), node("span", "", "2045")); this.inspector.append(footer);
  }

  _action(action) {
    const reference = this.inspected || this.selected;
    const point = reference?.type === "location" ? this.locations.get(reference.id) : null;
    if (action === "zoom-in") this._zoom(1.25);
    if (action === "zoom-out") this._zoom(0.8);
    if (action === "reset") this._resetCamera();
    if (action === "add" && this.options.isGM) this._setAddMode(!this.addMode);
    if (action === "import" && this.options.isGM) this.options.onImport?.();
    if (action === "export" && this.options.isGM) this.options.onExport?.();
    if (action === "edit" && point && this.options.isGM) this.options.onEdit?.(point);
    if (action === "delete" && point && this.options.isGM) this.options.onDelete?.(point);
    if (action === "journal" && point) this.options.onOpenJournal?.(point);
    if (action === "share" && reference && this.options.isGM) {
      const item = (reference.type === "district" ? this.districts : this.locations).get(reference.id);
      if (!item?.hidden) this.options.onShare?.({ ...reference });
    }
    if (action === "parent-district" && point && this.districts.has(point.districtId)) { this.select("district", point.districtId); this._focusDistrict(this.districts.get(point.districtId)); }
  }

  _setAddMode(active) {
    this.addMode = Boolean(active && this.options.isGM && this.options.onAdd);
    this.svg.classList.toggle("is-adding", this.addMode); this.root.querySelector(".nca-add-banner").hidden = !this.addMode;
    this.addButton?.classList.toggle("is-active", this.addMode); this.addButton?.setAttribute("aria-pressed", String(this.addMode)); this._hideTooltip();
    if (this.addMode) this._mobilePanel("map");
  }

  _pointInPolygon(point, polygon) {
    if (!Array.isArray(polygon)) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > point.y) !== (yj > point.y) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  _addAt(point) {
    if (!this.options.isGM || !this.options.onAdd) return;
    const x = Math.round(Math.max(0, Math.min(this.data.width, point.x))), y = Math.round(Math.max(0, Math.min(this.data.height, point.y)));
    const district = [...this.districts.values()].find(item => this._pointInPolygon({ x, y }, item.polygon));
    this._setAddMode(false); this.options.onAdd({ x, y, districtId: district?.id || "" });
  }

  _mapPoint(event) {
    const matrix = this.svg.getScreenCTM(); if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y };
  }

  _screenScale() { const matrix = this.svg.getScreenCTM(); return Math.abs(matrix?.a || 1); }

  _zoom(factor, anchor = null) {
    const old = this.camera.zoom, next = Math.max(0.7, Math.min(6, old * factor));
    if (anchor) { const ratio = old / next; this.camera.x = anchor.x + (this.camera.x - anchor.x) * ratio; this.camera.y = anchor.y + (this.camera.y - anchor.y) * ratio; }
    this.camera.zoom = next; this._applyCamera(); this._hideTooltip();
  }

  _applyCamera() {
    this.camera.x = Math.max(-100, Math.min(this.data.width + 100, this.camera.x)); this.camera.y = Math.max(-100, Math.min(this.data.height + 100, this.camera.y));
    const { width: baseWidth, height: baseHeight } = this._baseViewSize();
    const width = baseWidth / this.camera.zoom, height = baseHeight / this.camera.zoom;
    this.svg.setAttribute("viewBox", `${this.camera.x - width / 2} ${this.camera.y - height / 2} ${width} ${height}`);
    this.svg.classList.toggle("is-zoomed", this.camera.zoom >= 2.2);
    this.root.querySelector(".nca-zoom-value").textContent = `${Math.round(this.camera.zoom * 100)}%`;
  }

  _baseViewSize() {
    const bounds = this.stage.getBoundingClientRect();
    const aspect = bounds.width > 0 && bounds.height > 0 ? bounds.width / bounds.height : this.data.width / this.data.height;
    const width = Math.max(this.data.width, this.data.height * aspect);
    return { width, height: width / aspect };
  }

  _resetCamera() {
    const points = [...this.districts.values()].flatMap(item => item.polygon || []);
    if (!points.length) { this.camera = { x: this.data.width / 2, y: this.data.height / 2, zoom: 1 }; this._applyCamera(); return; }
    const xs = points.map(p => Number(p[0])), ys = points.map(p => Number(p[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const base = this._baseViewSize();
    this.camera = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: Math.max(.7, Math.min(6, Math.min(base.width / ((maxX - minX) * 1.13), base.height / ((maxY - minY) * 1.13)))) };
    this._applyCamera();
  }
  _focusLocation(point) { this.camera.x = Number(point.x); this.camera.y = Number(point.y); this.camera.zoom = Math.max(this.camera.zoom, 2.3); this._applyCamera(); }
  _focusDistrict(district) {
    const points = district.polygon || [];
    if (!points.length) return;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    this.camera.x = (Math.min(...xs) + Math.max(...xs)) / 2; this.camera.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const base = this._baseViewSize();
    this.camera.zoom = Math.max(1, Math.min(4.2, Math.min(base.width / ((Math.max(...xs) - Math.min(...xs)) * 1.65), base.height / ((Math.max(...ys) - Math.min(...ys)) * 1.65))));
    this._applyCamera();
  }

  _mobilePanel(panel) {
    this.shell.dataset.mobilePanel = panel;
    for (const button of this.root.querySelectorAll("[data-panel]")) { const active = button.dataset.panel === panel; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); }
  }

  _openAbout() {
    const dialog = this.root.querySelector(".nca-info-dialog"), content = this.root.querySelector(".nca-dialog-content");
    this.dialogPreviousFocus = document.activeElement; content.replaceChildren();
    content.append(node("h3", "", this.data.coverage?.title || "Найт-Сити 2045"), node("p", "", this.data.coverage?.detail || "Это схематический игровой атлас. Положение мест на карте может быть приблизительным."));
    const sources = node("div", "nca-dialog-sources");
    for (const source of this.data.coverage?.sources || []) { const link = sourceAnchor(source); if (link) sources.append(link); }
    if (sources.childElementCount) content.append(node("h4", "", "ИСТОЧНИКИ"), sources);
    const heading = node("h4", "", "УПРАВЛЕНИЕ");
    content.append(heading, node("p", "", "Колесо мыши — масштаб. Перетаскивание — движение по карте. Tab — выбор района или места; Enter — открыть сведения. Стрелки — перемещение, + / − — масштаб, 0 — весь город."));
    if (this.options.isGM && this.options.onAdd) content.append(node("p", "", "Добавляйте собственные места кнопкой «Добавить место» или двойным нажатием на карту."));
    dialog.hidden = false; dialog.querySelector(".nca-dialog-close").focus();
  }

  _closeAbout() { const dialog = this.root.querySelector(".nca-info-dialog"); if (dialog.hidden) return; dialog.hidden = true; if (this.dialogPreviousFocus?.isConnected) this.dialogPreviousFocus.focus(); }

  destroy() { this.abort.abort(); this.resizeObserver?.disconnect(); this.root.replaceChildren(); this.drag = null; }
}

export { CATEGORIES };
