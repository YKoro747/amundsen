"use strict";
// «Амундсен» — открытая страница для родственников (GitHub Pages): панель, графики, настройки вида.
// Данные — файлы data/*.json, которые Mac сам выкладывает после каждого замера (amundsen-pages/publish.py).
// Сделана из приложения для iPhone (amundsen-for-apple-devices) без уведомлений и выгрузки таблицы.

const SVGNS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let period = "day";
let nowData = null, histData = null;

// ---------- настройки этого устройства (хранятся только в нём) ----------
const STORE = "amundsen.settings.v1";
const SLOTS = 8;
const BLOCKS = [
  ["hero", "Панель «Улица»"], ["cards", "Карточки приборов"],
  ["chart_temp", "График температуры"], ["chart_humidity", "График влажности"], ["chart_wind", "График ветра"],
  ["chart_rain", "График осадков"], ["chart_strikes", "График молний"]];
const DEFAULTS = {
  theme: "light", scale: 1, order: [], hidden: [], colors: {}, blocks: {},
};

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { s = {}; }
  const d = JSON.parse(JSON.stringify(DEFAULTS));
  return { ...d, ...s };
}
let settings = loadSettings();
function saveSettings() { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* без хранилища — до закрытия */ } }

function applyLook() {
  const r = document.documentElement;
  if (settings.theme === "dark") r.dataset.theme = "dark"; else delete r.dataset.theme;
  r.style.setProperty("--scale", settings.scale);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", css("--page"));
}
const blockOn = (id) => settings.blocks[id] !== false;
const defaultSlot = (d) => ((d.num - 1) % SLOTS) + 1;
const slotOf = (d) => settings.colors[d.key] || defaultSlot(d);
const colorVar = (d) => `--s${slotOf(d)}`;
const shown = (d) => !settings.hidden.includes(d.key);
function arrange(devs) {
  const idx = new Map(settings.order.map((k, i) => [k, i]));
  const pos = (d) => idx.has(d.key) ? idx.get(d.key) : 1000 + d.num;
  return [...devs].sort((a, b) => pos(a) - pos(b));
}
const px = (n) => n * settings.scale;

// ---------- форматирование ----------
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_NOM = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const hm = (ts) => { const d = new Date(ts * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
function when(ts) {
  const d = new Date(ts * 1000), n = new Date();
  if (sameDay(d, n)) return `в ${hm(ts)}`;
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (sameDay(d, y)) return `вчера в ${hm(ts)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} в ${hm(ts)}`;
}
const num = (v, digits = 1) => v == null ? "—" : Number(v).toLocaleString("ru-RU",
  { minimumFractionDigits: digits, maximumFractionDigits: digits });
const DIRS = ["С", "ССВ", "СВ", "ВСВ", "В", "ВЮВ", "ЮВ", "ЮЮВ", "Ю", "ЮЮЗ", "ЮЗ", "ЗЮЗ", "З", "ЗСЗ", "СЗ", "ССЗ"];
const dirName = (deg) => DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v; else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
function svg(tag, attrs = {}) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
let toastTimer;
function toast(text) {
  const t = $("toast"); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

// ---------- значки ----------
function batteryIcon(ok) {
  const s = svg("svg", { width: 18, height: 10, viewBox: "0 0 18 10", "aria-hidden": "true" });
  s.append(svg("rect", { x: .5, y: .5, width: 15, height: 9, rx: 2, fill: "none", stroke: "currentColor" }));
  s.append(svg("rect", { x: 16, y: 3, width: 1.5, height: 4, rx: .5, fill: "currentColor" }));
  s.append(svg("rect", { x: 2, y: 2, width: ok ? 12 : 3, height: 6, rx: 1,
    fill: ok ? css("--good") : css("--critical") }));
  return s;
}
function alertIcon(color) {
  const s = svg("svg", { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": "true" });
  s.append(svg("path", { d: "M8 1.5 15 14H1z", fill: color }));
  s.append(svg("rect", { x: 7.25, y: 5.5, width: 1.5, height: 4.5, fill: "#0b0b0b" }));
  s.append(svg("rect", { x: 7.25, y: 11, width: 1.5, height: 1.5, fill: "#0b0b0b" }));
  return s;
}
function compass(deg, calm) {
  const s = svg("svg", { width: 64, height: 64, viewBox: "-32 -32 64 64", role: "img",
    "aria-label": calm ? "Штиль" : `Ветер ${dirName(deg)}` });
  s.append(svg("circle", { r: 29, fill: "none", stroke: css("--grid"), "stroke-width": 1.5 }));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    s.append(svg("line", { x1: 25 * Math.sin(a), y1: -25 * Math.cos(a), x2: 29 * Math.sin(a), y2: -29 * Math.cos(a),
      stroke: css("--axis"), "stroke-width": 1.5 }));
  }
  const n = svg("text", { x: 0, y: -16, "text-anchor": "middle", "font-size": 9, fill: css("--muted") });
  n.textContent = "С"; s.append(n);
  if (!calm) {
    // стрелка показывает, куда дует ветер: из направления deg к противоположному
    const g = svg("g", { transform: `rotate(${deg + 180})` });
    g.append(svg("line", { x1: 0, y1: 18, x2: 0, y2: -14, stroke: css("--s1"), "stroke-width": 2.5, "stroke-linecap": "round" }));
    g.append(svg("path", { d: "M0 -22 L6 -11 L-6 -11 Z", fill: css("--s1") }));
    s.append(g);
  } else {
    s.append(svg("circle", { r: 4, fill: css("--s1") }));
  }
  return s;
}

// ---------- панель «сейчас» ----------
function metaRow(d) {
  const m = el("div", { class: "meta" });
  if (d.battery_ok != null) {
    m.append(el("span", { class: "pill" + (d.battery_ok ? "" : " bad") }, batteryIcon(d.battery_ok),
      d.battery_ok ? "батарея в норме" : "батарея разряжена"));
  }
  if (d.ts) {
    if (d.missed) m.append(el("span", { class: "pill stale" }, alertIcon(css("--warning")),
      `не слышен в последнем замере · сигнал ${when(d.ts)}`));
    else m.append(el("span", {}, `сигнал ${when(d.ts)}`));
  } else m.append(el("span", { class: "pill stale" }, alertIcon(css("--warning")), "ещё не было сигнала"));
  return m;
}

function head(d, kind) {
  return el("div", { class: "card-head" },
    el("span", { class: "key", style: `background: var(${colorVar(d)})` }),
    el("div", {}, el("div", { class: "name" }, d.name), el("div", { class: "kind" }, kind)));
}
const kindName = (d) => d.kind === "outdoor" ? "улица" : d.kind === "lightning" ? "датчик грозы" : "комната";

function renderNow(data) {
  const devs = arrange(data.devices);
  const out = devs.find((d) => d.kind === "outdoor");
  const hero = $("hero"); hero.replaceChildren();
  if (out && shown(out) && blockOn("hero")) {
    const calm = !out.wind_kmh;
    // температура и влажность воздуха — от прибора в тени (air_from), если он слышен; иначе от уличного блока
    const src = devs.find((d) => d.key === out.air_from && d.temp_c != null && !d.missed);
    const air = src || out;
    const c = el("div", { class: "card hero" },
      el("div", { class: "main" }, head(out, "улица"),
        el("div", { class: "big" }, air.temp_c == null ? "—" : `${num(air.temp_c)}`, el("small", {}, "°C")),
        el("div", { class: "row" }, el("span", {}, "влажность ", el("b", {}, air.humidity == null ? "—" : `${air.humidity} %`))),
        src ? el("div", { class: "row note" }, el("span", {}, `в тени · ${src.name}`),
          el("span", {}, `на солнце · ${out.name} `, el("b", {}, out.temp_c == null ? "—" : `${num(out.temp_c)} °C`))) : null),
      el("div", { class: "block" }, el("h3", {}, "Ветер"),
        el("div", { class: "wind" }, compass(out.wind_dir || 0, calm),
          el("div", {},
            el("div", { class: "val" }, calm ? "штиль" : num(out.wind_kmh), calm ? null : el("small", {}, " км/ч")),
            el("div", { class: "row" }, calm ? "" : `${dirName(out.wind_dir)} · порыв ${num(out.wind_max_kmh)} км/ч`)))),
      el("div", { class: "block" }, el("h3", {}, "Осадки"),
        el("div", { class: "val" }, num(out.rain_today_mm), el("small", {}, " мм сегодня")),
        el("div", { class: "row" }, `${num(out.rain_24h_mm)} мм за 24 часа`)),
      metaRow(out));
    hero.append(c);
  }
  const cards = $("cards"); cards.replaceChildren();
  cards.hidden = !blockOn("cards");
  for (const d of devs.filter((x) => x.kind !== "outdoor" && shown(x))) {
    const c = el("div", { class: "card" }, head(d, kindName(d)));
    c.append(el("div", { class: "big" }, d.temp_c == null ? "—" : num(d.temp_c), el("small", {}, "°C")));
    const row = el("div", { class: "row" });
    if (!d.hide.includes("humidity")) row.append(el("span", {}, "влажность ", el("b", {}, d.humidity == null ? "—" : `${d.humidity} %`)));
    if (d.kind === "lightning") {
      const n = d.strikes_24h || 0;
      row.append(el("span", {}, "разрядов за 24 ч ", el("b", {}, String(n))));
      if (n > 0 && d.last_strike_ts) {
        row.append(el("span", {}, `последний ${when(d.last_strike_ts)}`));
        if (d.storm_dist != null) row.append(el("span", {}, "оценка расстояния ", el("b", {}, String(d.storm_dist))));
      }
    }
    c.append(row, metaRow(d));
    cards.append(c);
  }

  // строка состояния и предупреждения
  const lr = data.last_run;
  let status = lr ? `Последний замер ${when(lr.finished)}` : "Замеров ещё не было";
  status += data.running_since ? " · идёт замер…" : ` · следующий около ${hm(data.next_run + 180)}`;
  $("status").textContent = status;

  const alerts = $("alerts"); alerts.replaceChildren();
  const NOTES = { no_receiver: "Приёмник не найден — проверьте, что он подключён к Mac.",
    busy: "Приёмник был занят другой программой, замер пропущен.",
    empty: "В последнем замере не услышан ни один прибор.", error: "Ошибка при последнем замере." };
  if (lr && lr.status !== "ok") {
    alerts.append(el("div", { class: "alert crit" }, alertIcon(css("--critical")),
      el("div", {}, el("b", {}, "Замер не удался. "), NOTES[lr.status] || lr.note || "")));
  }
  const low = devs.filter((d) => d.battery_ok === 0).map((d) => d.name);
  if (low.length) alerts.append(el("div", { class: "alert" }, alertIcon(css("--warning")),
    el("div", {}, el("b", {}, "Разряжены батарейки: "), low.join(", "), ".")));
  for (const u of data.unknown || []) {
    alerts.append(el("div", { class: "alert" }, alertIcon(css("--warning")),
      el("div", {}, el("b", {}, "Новый прибор в эфире: "),
        `${u.device.replace(":", " №")}, канал ${u.channel}` + (u.temp_c != null ? `, ${num(u.temp_c)} °C` : "") +
        `. Возможно, это прежний датчик после замены батарейки — нужно указать, какой.`)));
  }
}

// ---------- графики ----------
function niceTicks(min, max, count = 4, integer = false) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  if (integer) step = Math.max(1, Math.ceil(step));
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

function timeTicks(from, to) {
  const ticks = [], d = new Date(from * 1000);
  let fmt, next;
  if (period === "day") {
    d.setMinutes(0, 0, 0); d.setHours(Math.ceil(d.getHours() / 3) * 3);
    next = (x) => x.setHours(x.getHours() + 3);
    fmt = (x) => `${pad(x.getHours())}:00`;
  } else if (period === "week") {
    d.setHours(24, 0, 0, 0);
    next = (x) => x.setDate(x.getDate() + 1);
    fmt = (x) => `${WDAYS[x.getDay()]} ${x.getDate()}`;
  } else if (period === "month") {
    d.setHours(24, 0, 0, 0);
    next = (x) => x.setDate(x.getDate() + 5);
    fmt = (x) => `${x.getDate()} ${MONTHS[x.getMonth()]}`;
  } else {
    d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + 1);
    next = (x) => x.setMonth(x.getMonth() + 2);
    fmt = (x) => MONTHS_NOM[x.getMonth()];
  }
  for (let i = 0; i < 400 && d.getTime() / 1000 <= to; i++) {
    ticks.push({ t: d.getTime() / 1000, label: fmt(d) });
    next(d);
  }
  return ticks;
}

function bucketLabel(t, step) {
  const d = new Date(t * 1000);
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (step >= 86400) return day;
  return `${day}, ${hm(t)}–${hm(t + step)}`;
}

const tip = () => $("tip");
function showTip(evt, title, rows) {
  const t = tip();
  t.replaceChildren(el("div", { class: "t" }, title));
  for (const r of rows) {
    t.append(el("div", { class: "r" }, el("i", { style: `background: var(${r.color})` }),
      el("b", {}, r.value), el("span", {}, r.name)));
  }
  t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  let x = evt.clientX + 14, y = evt.clientY - h - 10;
  if (x + w > innerWidth - 8) x = evt.clientX - w - 14;
  if (x < 8) x = 8;
  if (y < 8) y = evt.clientY + 16;
  t.style.left = `${x}px`; t.style.top = `${y}px`;
}
const hideTip = () => { tip().hidden = true; };

/** spec: { series:[{name,color,points:[[t,v,...]], fmt}], type:"line"|"bar", unit, yZero } */
function drawChart(host, spec) {
  const { from, to, step } = histData;
  host.replaceChildren();
  const all = spec.series.flatMap((s) => s.points.map((p) => p[1]));
  if (!all.length) { host.append(el("div", { class: "empty" }, "За этот период данных пока нет")); return; }

  const W = Math.max(300, host.clientWidth || 600), H = px(W < 500 ? 190 : 220);
  const m = { l: px(40), r: 12, t: 10, b: px(24) };
  const fs = px(11);
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (spec.yZero) lo = 0;
  if (spec.type === "bar" && hi <= 0) hi = 1;
  const yt = niceTicks(lo, hi, 4, spec.integer);
  const y0 = yt[0], y1 = yt[yt.length - 1];
  const X = (t) => m.l + (t - from) / (to - from) * iw;
  const Y = (v) => m.t + ih - (v - y0) / (y1 - y0) * ih;

  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": spec.title });
  const fg = css("--muted");
  for (const v of yt) {
    s.append(svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: v === 0 && spec.yZero ? css("--axis") : css("--grid"), "stroke-width": 1 }));
    const tx = svg("text", { x: m.l - 6, y: Y(v) + fs * .36, "text-anchor": "end", "font-size": fs, fill: fg, "font-variant-numeric": "tabular-nums" });
    tx.textContent = v.toLocaleString("ru-RU"); s.append(tx);
  }
  const tt = timeTicks(from, to);
  const every = Math.ceil(tt.length / Math.max(2, Math.floor(iw / px(70))));
  tt.forEach((k, i) => {
    if (i % every) return;
    const tx = svg("text", { x: X(k.t), y: H - 6, "text-anchor": "middle", "font-size": fs, fill: fg });
    tx.textContent = k.label; s.append(tx);
  });

  if (spec.type === "line") {
    for (const ser of spec.series) {
      if (!ser.points.length) continue;
      let d = "", prev = null;
      for (const p of ser.points) {
        const cx = X(p[0] + step / 2), cy = Y(p[1]);
        // один пропущенный замер соединяем, долгий перерыв оставляем разрывом
        d += (prev == null || p[0] - prev > step * 2.5 ? "M" : "L") + cx.toFixed(1) + " " + cy.toFixed(1);
        prev = p[0];
      }
      s.append(svg("path", { d, fill: "none", stroke: css(ser.color), "stroke-width": 2,
        "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const last = ser.points[ser.points.length - 1];
      s.append(svg("circle", { cx: X(last[0] + step / 2), cy: Y(last[1]), r: 4, fill: css(ser.color),
        stroke: css("--surface"), "stroke-width": 2 }));
    }
  } else {
    if (!all.some((v) => v > 0)) {
      const tx = svg("text", { x: m.l + iw / 2, y: m.t + ih / 2, "text-anchor": "middle", "font-size": px(14), fill: css("--ink-2") });
      tx.textContent = spec.none; s.append(tx);
    }
    const n = spec.series.length, slot = iw * step / (to - from);
    const bw = Math.max(1, Math.min(24, (slot - 2) / n - (n > 1 ? 2 : 0)));
    spec.series.forEach((ser, si) => {
      for (const p of ser.points) {
        if (!p[1]) continue;
        const cx = X(p[0] + step / 2) - (n * bw + (n - 1) * 2) / 2 + si * (bw + 2);
        const top = Y(p[1]), base = Y(0), h = Math.max(1, base - top), r = Math.min(4, bw / 2, h);
        s.append(svg("path", { fill: css(ser.color), d:
          `M${cx} ${base}V${top + r}Q${cx} ${top} ${cx + r} ${top}H${cx + bw - r}Q${cx + bw} ${top} ${cx + bw} ${top + r}V${base}Z` }));
      }
    });
  }

  // слой наведения: вертикальная линия и подсказка по ближайшему интервалу
  const hair = svg("line", { y1: m.t, y2: m.t + ih, stroke: css("--axis"), "stroke-width": 1, visibility: "hidden" });
  s.append(hair);
  const hit = svg("rect", { x: m.l, y: 0, width: iw, height: H, fill: "transparent" });
  s.append(hit);
  const maps = spec.series.map((ser) => new Map(ser.points.map((p) => [p[0], p])));
  const move = (evt) => {
    const r = s.getBoundingClientRect();
    const x = (evt.clientX - r.left) * (W / r.width);
    const t = Math.floor((from + (x - m.l) / iw * (to - from)) / step) * step;
    const rows = spec.series.map((ser, i) => {
      const p = maps[i].get(t);
      return p ? { color: ser.color, name: ser.name, value: ser.fmt(p) } : null;
    }).filter(Boolean);
    if (!rows.length) { hair.setAttribute("visibility", "hidden"); hideTip(); return; }
    const hx = X(t + step / 2);
    hair.setAttribute("x1", hx); hair.setAttribute("x2", hx); hair.setAttribute("visibility", "visible");
    showTip(evt, bucketLabel(t, step), rows);
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { hair.setAttribute("visibility", "hidden"); hideTip(); });
  host.append(s);
}

function tableFor(spec) {
  const times = [...new Set(spec.series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => b - a);
  const maps = spec.series.map((ser) => new Map(ser.points.map((p) => [p[0], p])));
  const tbl = el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Время"),
    ...spec.series.map((s) => el("th", {}, s.name)))));
  const tb = el("tbody");
  for (const t of times) {
    tb.append(el("tr", {}, el("td", {}, bucketLabel(t, histData.step)),
      ...maps.map((mp, i) => el("td", {}, mp.has(t) ? spec.series[i].fmt(mp.get(t)) : "—"))));
  }
  tbl.append(tb);
  return el("details", { class: "tbl" }, el("summary", {}, "Показать таблицей"), el("div", { class: "tbl-scroll" }, tbl));
}

function chartSpecs() {
  const { series, devices, step } = histData;
  const raw = step <= 1800;
  const ordered = arrange(devices);
  const rank = new Map(ordered.map((d, i) => [d.key, i]));
  const byKey = Object.fromEntries(devices.map((d) => [d.key, d]));
  const out = ordered.find((d) => d.kind === "outdoor");
  const outOn = out && shown(out);
  const tempFmt = (p) => raw || p[2] === p[3] ? `${num(p[1])} °C` : `${num(p[1])} °C (${num(p[2])}…${num(p[3])})`;
  const humFmt = (p) => raw || p[2] === p[3] ? `${p[1]} %` : `${Math.round(p[1])} % (${p[2]}…${p[3]})`;
  const mk = (obj, fmt) => Object.entries(obj).filter(([k]) => byKey[k] && shown(byKey[k])).map(([k, pts]) => ({
    name: byKey[k].name, color: colorVar(byKey[k]), points: pts, fmt, rank: rank.get(k),
  })).sort((a, b) => a.rank - b.rank);
  const per = raw ? "за 30 минут" : step === 7200 ? "за 2 часа" : step === 21600 ? "за 6 часов" : "за сутки";
  const avg = raw ? "" : `Средние ${per}; в подсказке — разброс. `;
  const specs = [
    { id: "chart_temp", title: "Температура", desc: `${avg}°C`, type: "line", series: mk(series.temp, tempFmt) },
    { id: "chart_humidity", title: "Влажность", desc: `${avg}%`, type: "line", series: mk(series.humidity, humFmt) },
  ];
  if (outOn) {
    specs.push(
      { id: "chart_wind", title: "Ветер", desc: `«${out.name}», км/ч. Порыв — наибольшая скорость, замеченная за 3 минуты замера.`, type: "line", yZero: true,
        series: [
          { name: "средний", color: "--s1", points: series.wind.map((p) => [p[0], p[1]]), fmt: (p) => `${num(p[1])} км/ч` },
          { name: "порыв", color: "--s2", points: series.wind.map((p) => [p[0], p[2]]), fmt: (p) => `${num(p[1])} км/ч` }] },
      { id: "chart_rain", title: "Осадки", desc: `«${out.name}», мм ${per}`, type: "bar", yZero: true, none: "Осадков за этот период не было",
        series: [{ name: "осадки", color: colorVar(out), points: series.rain, fmt: (p) => `${num(p[1])} мм` }] });
  }
  specs.push({ id: "chart_strikes", title: "Молнии", desc: `Число разрядов ${per}`, type: "bar", yZero: true, integer: true,
    none: "Молний за этот период не было", series: mk(series.strikes, (p) => `${p[1]}`) });
  return specs.filter((s) => blockOn(s.id) && s.series.length);
}

function renderCharts() {
  if (!histData) return;
  const host = $("charts"); host.replaceChildren();
  const specs = chartSpecs();
  $("charts-section").hidden = !specs.length;
  for (const spec of specs) {
    const card = el("div", { class: "card chart" }, el("h3", {}, spec.title), el("p", { class: "desc" }, spec.desc));
    if (spec.series.length > 1) {
      card.append(el("div", { class: "legend" }, ...spec.series.map((s) =>
        el("span", {}, el("i", { class: spec.type === "bar" ? "box" : "", style: `background: var(${s.color})` }), s.name))));
    }
    const plot = el("div", { class: "plot" });
    card.append(plot);
    host.append(card);
    drawChart(plot, spec);
    if (spec.series.some((s) => s.points.length)) card.append(tableFor(spec));
  }
}

// ---------- загрузка ----------
async function getJSON(url) {
  // ?v= — чтобы промежуточный кэш GitHub не отдал файл старше минуты
  const r = await fetch(`${url}?v=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function loadNow() {
  try { nowData = await getJSON("data/now.json"); renderNow(nowData); }
  catch (e) { $("status").textContent = "Нет связи — проверьте интернет"; }
}
async function loadHistory() {
  document.querySelectorAll(".plot").forEach((p) => p.classList.add("loading"));
  try { histData = await getJSON(`data/history-${period}.json`); renderCharts(); }
  catch (e) { $("charts").replaceChildren(el("div", { class: "empty" }, `Графики недоступны: ${e.message}`)); }
}
function rerender() {
  applyLook();
  if (nowData) renderNow(nowData);
  renderCharts();
}

// ---------- окно настроек ----------
const deviceList = () => arrange((nowData || histData || { devices: [] }).devices);

function setSeg(id, value) {
  document.querySelectorAll(`#${id} button`).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === String(value))));
}

function check(label, checked, onChange) {
  const input = el("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", {}, input, label);
}

let paletteFor = null;
function renderDevices() {
  const host = $("set-devices"); host.replaceChildren();
  const devs = deviceList();
  if (!devs.length) { host.append(el("p", { class: "hint" }, "Нет связи с Mac — список приборов появится, когда данные загрузятся.")); return; }
  devs.forEach((d, i) => {
    const on = shown(d);
    const sw = el("button", { class: "swatch", style: `background: var(${colorVar(d)})`, "aria-label": `Цвет: ${d.name}`, "aria-expanded": String(paletteFor === d.key) });
    sw.addEventListener("click", () => { paletteFor = paletteFor === d.key ? null : d.key; renderDevices(); });
    const vis = el("input", { type: "checkbox", "aria-label": `Показывать ${d.name}` });
    vis.checked = on;
    vis.addEventListener("change", () => {
      settings.hidden = settings.hidden.filter((k) => k !== d.key);
      if (!vis.checked) settings.hidden.push(d.key);
      saveSettings(); renderDevices();
    });
    const move = (dir) => {
      const keys = devs.map((x) => x.key), j = i + dir;
      if (j < 0 || j >= keys.length) return;
      [keys[i], keys[j]] = [keys[j], keys[i]];
      settings.order = keys; saveSettings(); renderDevices();
    };
    const up = el("button", { class: "btn move", "aria-label": `Выше: ${d.name}` }, "↑");
    const down = el("button", { class: "btn move", "aria-label": `Ниже: ${d.name}` }, "↓");
    up.disabled = i === 0; down.disabled = i === devs.length - 1;
    up.addEventListener("click", () => move(-1)); down.addEventListener("click", () => move(1));
    host.append(el("div", { class: "dev" + (on ? "" : " off") }, sw,
      el("div", { class: "dname" }, el("b", {}, d.name), el("span", {}, on ? kindName(d) : `${kindName(d)} · скрыт`)),
      vis, up, down));
    if (paletteFor === d.key) {
      const pal = el("div", { class: "palette", role: "group", "aria-label": `Цвет прибора ${d.name}` });
      for (let k = 1; k <= SLOTS; k++) {
        const b = el("button", { class: "swatch", style: `background: var(--s${k})`, "aria-label": `Цвет ${k}`, "aria-pressed": String(slotOf(d) === k) });
        b.addEventListener("click", () => {
          if (k === defaultSlot(d)) delete settings.colors[d.key]; else settings.colors[d.key] = k;
          paletteFor = null; saveSettings(); renderDevices();
        });
        pal.append(b);
      }
      host.append(pal);
    }
  });
}

function renderSettings() {
  renderDevices();
  setSeg("set-theme", settings.theme);
  setSeg("set-scale", settings.scale);

  const blocks = $("set-blocks"); blocks.replaceChildren();
  for (const [id, label] of BLOCKS) {
    blocks.append(check(label, blockOn(id), (v) => {
      if (v) delete settings.blocks[id]; else settings.blocks[id] = false;
      saveSettings();
    }));
  }

}

function openSettings() {
  renderSettings();
  $("settings").hidden = false;
  $("main").inert = true;
  document.body.style.overflow = "hidden";
  $("settings").scrollTop = 0;
  $("close-settings").focus();
}
function closeSettings() {
  $("settings").hidden = true;
  $("main").inert = false;
  document.body.style.overflow = "";
  paletteFor = null;
  rerender();
  $("open-settings").focus();
}

$("open-settings").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", closeSettings);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("settings").hidden) closeSettings(); });
document.querySelectorAll("#set-theme button").forEach((b) => b.addEventListener("click", () => {
  settings.theme = b.dataset.v; saveSettings(); applyLook(); setSeg("set-theme", settings.theme); renderDevices();
}));
document.querySelectorAll("#set-scale button").forEach((b) => b.addEventListener("click", () => {
  settings.scale = Number(b.dataset.v); saveSettings(); applyLook(); setSeg("set-scale", settings.scale);
}));
$("reset-settings").addEventListener("click", () => {
  settings = JSON.parse(JSON.stringify(DEFAULTS));
  saveSettings(); applyLook(); renderSettings(); toast("Оформление сброшено");
});

// ---------- запуск ----------
document.querySelectorAll(".charts-head .seg button").forEach((b) => b.addEventListener("click", () => {
  period = b.dataset.period;
  document.querySelectorAll(".charts-head .seg button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  loadHistory();
}));
let rsz;
addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(renderCharts, 150); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadNow(); loadHistory(); } });

applyLook();
loadNow(); loadHistory();
setInterval(loadNow, 60 * 1000);
setInterval(loadHistory, 5 * 60 * 1000);
