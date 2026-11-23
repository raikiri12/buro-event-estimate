const venues = [
  {name:"Сёрф", photo:"surf", metro:"Бауманская", area:135, capacity:40, base:30000, address:"Самокатная ул., 4, стр. 18"},
  {name:"Соул", photo:"soul", metro:"Бауманская", area:150, capacity:60, base:67500, address:"Новорязанская ул., 29, стр. 4"},
  {name:"Гавайи", photo:"hawaii", metro:"Бауманская", area:300, capacity:150, base:35000, address:"Самокатная ул., 4, стр. 1"},
  {name:"Виола", photo:"viola", metro:"Сокольники", area:320, capacity:200, base:62500, address:"Песочная аллея, 5"},
  {name:"Виола Западная", photo:"viola-west", metro:"Сокольники", area:80, capacity:40, base:30000, address:"Песочная аллея, 5"},
  {name:"Виола Восточная", photo:"viola-east", metro:"Сокольники", area:80, capacity:40, base:30000, address:"Песочная аллея, 5"}
];
const catering = {
  buffet:{name:"Фуршет", rate:2000},
  banquet:{name:"Банкет", rate:3500},
  station:{name:"Фудстанции", rate:3500},
  none:{name:"Без кейтеринга", rate:0}
};
const services = [
  {name:"Проектор, Smart TV и микрофоны", price:2500},
  {name:"Дым-машина", price:2000},
  {name:"Диджей", price:4000, from:true},
  {name:"Фотограф", price:7000, from:true},
  {name:"Чайно-кофейная станция", price:6000, limit:40}
];
const key = "buro-estimate-ledger-v1";
const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat("ru-RU", {style:"currency", currency:"RUB", maximumFractionDigits:0});
const rub = amount => money.format(amount);
const guestForms = new Intl.PluralRules("ru-RU");
const guestLabel = count => count + " " + ({one:"гость", few:"гостя", many:"гостей"}[guestForms.select(count)] || "гостя");
const dateFormat = new Intl.DateTimeFormat("ru-RU", {dateStyle:"long"});
const dateLabel = date => date ? dateFormat.format(new Date(date + "T12:00:00")) : "Дата уточняется";
const venue = () => venues[Number($("venue").value)];
const number = id => Number($(id).value);
const dialog = $("dialog");
const content = $("dialog-content");
let statusTimeout;
let records = loadRecords();
let editing = null;
let originalForm = "";
let calculatorFocus;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(label, className, action) {
  const element = node("button", label, className);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}
function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function announce(message) {
  const inDialog = dialog.open;
  const target = $(inDialog ? "dialog-status" : "status");
  $(inDialog ? "status" : "dialog-status").textContent = "";
  target.textContent = message;
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => target.textContent = "", 5000);
}
function route() {
  const ledger = location.hash === "#ledger";
  $("ledger").hidden = !ledger;
  $("estimate").hidden = ledger;
  $("mobile-total").hidden = ledger;
  $("nav-estimate").setAttribute("aria-current", ledger ? "false" : "page");
  $("nav-ledger").setAttribute("aria-current", ledger ? "page" : "false");
  if (ledger) renderLedger();
  window.scrollTo(0, 0);
  if (!ledger && calculatorFocus) {
    $(calculatorFocus).focus();
    calculatorFocus = undefined;
  }
}
function readForm() {
  return {
    title:$("event-name").value,
    venue:venue().photo,
    date:$("date").value,
    hours:$("hours").value,
    guests:$("guests").value,
    extra:$("extra").value,
    food:$("food").value,
    foodRate:$("food-price").value,
    services:services.filter((_, i) => $("service-" + i).checked).map(service => service.name)
  };
}
function openCalculator(focus) {
  calculatorFocus = focus;
  if (location.hash !== "#estimate") location.hash = "#estimate";
  else route();
}
function applyForm(form) {
  $("event-name").value = form.title || "";
  $("venue").value = venues.findIndex(place => place.photo === form.venue);
  $("date").value = form.date;
  $("hours").value = form.hours;
  $("guests").value = form.guests;
  $("extra").value = form.extra;
  $("food").value = form.food;
  $("food-price").value = form.foodRate;
  $("food-price").disabled = form.food === "none";
  services.forEach((service, i) => $("service-" + i).checked = form.services.includes(service.name));
  originalForm = JSON.stringify(readForm());
  $("edit-context").hidden = !editing;
  $("cancel-edit").hidden = !editing;
  $("save").textContent = editing ? "Сохранить изменения" : "Сохранить смету";
  refreshPhoto();
  refresh();
}
function canReplaceDraft() {
  return originalForm === JSON.stringify(readForm()) || window.confirm("Открыть другую смету? Несохранённые изменения будут потеряны.");
}
function startEdit(record) {
  if (!canReplaceDraft()) return;
  const place = venues.find(item => item.name === record.name);
  if (!place) {
    announce("Площадка этой сметы отсутствует в калькуляторе");
    return;
  }
  const food = Object.entries(catering).find(([key, type]) => key !== "none" && record.lines.some(line => line.name === type.name));
  const foodLine = record.lines.find(line => line.name === food?.[1].name);
  const extension = record.lines.find(line => line.name === "Продление аренды");
  editing = record;
  applyForm(record.form || {
    title:record.title || "", venue:place.photo, date:record.date, hours:record.hours, guests:record.guests,
    extra:extension && record.hours > 5 ? extension.value / (record.hours - 5) : place.base / 5,
    food:food?.[0] || "none", foodRate:foodLine ? foodLine.value / record.guests : 0,
    services:record.lines.map(line => line.name)
  });
  openCalculator("event-name");
}
function estimate() {
  const place = venue();
  const hours = Math.max(5, number("hours"));
  const guests = Math.max(1, number("guests"));
  const date = $("date").value;
  const food = catering[$("food").value];
  const rate = number("food-price");
  const extra = number("extra");
  const lines = [{name:"Аренда · " + place.name, note:"Пакет на 5 ч, от", value:place.base}];
  if (hours > 5) lines.push({name:"Продление аренды", note:(hours - 5) + " ч × " + rub(extra), value:(hours - 5) * extra});
  if ($("food").value !== "none") lines.push({name:food.name, note:guestLabel(guests) + " × " + rub(rate), value:guests * rate});
  services.forEach((service, index) => {
    if ($("service-" + index).checked) lines.push({name:service.name, note:service.from ? "Цена от" : "", value:service.price});
  });
  return {title:$("event-name").value.trim(), name:place.name, address:place.address, date, hours, guests, lines,
    total:lines.reduce((sum, line) => sum + line.value, 0)};
}
const fieldIds = ["date", "guests", "hours", "extra", "food-price"];
function valid(showErrors = false) {
  for (const id of fieldIds) {
    const input = $(id);
    if (!input.checkValidity()) {
      if (showErrors) input.reportValidity();
      return false;
    }
  }
  if (number("guests") > venue().capacity || $("service-4").checked && number("guests") > 40) {
    if (showErrors) {
      $("capacity").scrollIntoView({block:"center"});
      $("guests").focus({preventScroll:true});
    }
    return false;
  }
  return true;
}
function refresh() {
  const place = venue();
  $("venue-info").textContent = place.address + " · " + place.area + " м² · до " + place.capacity + " гостей";
  const capacity = $("capacity");
  capacity.textContent = number("guests") > place.capacity
    ? "Лофт вмещает до " + place.capacity + " гостей. Уменьшите число гостей или выберите другой лофт."
    : $("service-4").checked && number("guests") > 40
      ? "Чайно-кофейная станция рассчитана на 40 гостей. Измените число гостей или уберите услугу."
      : "";
  capacity.hidden = !capacity.textContent;
  $("guests").setAttribute("aria-invalid", String(!!capacity.textContent || !$("guests").validity.valid));
  $("guests").setAttribute("aria-describedby", "capacity");
  const entry = valid() ? estimate() : null;
  $("summary").textContent = entry ? dateLabel(entry.date) + " · " + entry.hours + " ч · " + guestLabel(entry.guests) : "Проверьте параметры события";
  $("receipt-note").textContent = entry
    ? "Расчёт по стартовым ценам. Тариф на дату и возвратный залог уточняются отдельно."
    : "Итог появится после исправления полей";
  $("items").replaceChildren(...(entry?.lines ?? []).map(line => {
    const row = node("div", undefined, "item");
    const title = node("dt", line.name);
    if (line.note) title.append(node("small", line.note));
    row.append(title, node("dd", rub(line.value)));
    return row;
  }));
  const total = entry ? rub(entry.total) : "—";
  $("total").textContent = total;
  $("mobile-amount").textContent = total;
  const hoursAdded = entry && editing?.name === entry.name ? entry.hours - editing.hours : 0;
  const extraText = hoursAdded > 0 ? rub(hoursAdded * number("extra")) : "";
  $("extension").hidden = !extraText;
  if (extraText) {
    const delta = entry.total - editing.total;
    const rentalDelta = hoursAdded * number("extra");
    $("extension").textContent = "Доплата за продление: " + extraText + " (" + hoursAdded + " ч × " + rub(number("extra")) + "/ч)" +
      (delta !== rentalDelta ? ". Изменение всей сметы: " + (delta >= 0 ? "+" : "−") + rub(Math.abs(delta)) : "");
  } else {
    $("extension").textContent = "";
  }
  $("mobile-label").textContent = extraText ? "За продление " + extraText : "К итогу сметы";
}
function refreshPhoto() {
  const place = venue();
  const photo = $("venue-photo");
  photo.src = "assets/" + place.photo + ".webp";
  photo.alt = "Интерьер лофта «" + place.name + "»";
  $("venue-caption").textContent = place.name + " · " + place.metro;
}
function openDialog(title, ...body) {
  $("dialog-status").textContent = "";
  $("dialog-title").textContent = title;
  content.replaceChildren(...body);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function proposal(entry) {
  const rows = entry.lines.map(line => line.name + (line.note ? " (" + line.note + ")" : "") + " — " + rub(line.value));
  return [
    "БЮРО хороших событий",
    ...(entry.title ? [entry.title] : []),
    "Лофт " + entry.name + " · " + entry.address,
    dateLabel(entry.date) + " · " + entry.hours + " ч · " + guestLabel(entry.guests),
    "", ...rows, "", "Итого — " + rub(entry.total), "",
    "Демонстрационный расчёт. Цены, доступность площадки, продление и возвратный залог согласуются отдельно."
  ].join("\n");
}
function openProposal(entry) {
  const text = proposal(entry);
  const preview = node("textarea", undefined, "dialog-copy");
  preview.value = text;
  preview.readOnly = true;
  preview.setAttribute("aria-label", "Текст предложения");
  const actions = node("div", undefined, "dialog-actions");
  actions.append(button("Скопировать текст", "primary", async () => {
    try {
      await navigator.clipboard.writeText(text);
      announce("Предложение скопировано");
    } catch {
      preview.focus();
      preview.select();
      announce("Текст выделен. Скопируйте его через меню");
    }
  }), button("Печать / PDF", "secondary", () => window.print()));
  const print = node("pre", text, "print-copy");
  print.style.display = "none";
  openDialog("Предложение для клиента", preview, print, actions);
}
function renderLedger() {
  $("count").textContent = records.length;
  $("export").disabled = records.length === 0;
  $("records").replaceChildren(...(records.length ? records.map(entry => {
    const row = node("article", undefined, "record");
    const info = node("div");
    info.append(node("strong", entry.title || "Лофт " + entry.name), node("small",
      (entry.title ? entry.name + " · " : "") + dateLabel(entry.date) + " · " + entry.hours + " ч · " + guestLabel(entry.guests)));
    const actions = node("div", undefined, "record-actions");
    actions.append(
      button("Редактировать", "secondary", () => startEdit(entry)),
      button("Открыть смету", "secondary", () => openProposal(entry)),
      button(accountingLabel(entry), "secondary", () => openAccounting(entry)),
      button("Удалить", "secondary danger", () => confirmDelete(entry))
    );
    row.append(info, node("strong", rub(entry.total)), actions);
    return row;
  }) : [node("p", "Здесь появятся сохранённые сметы")]));
}
function persist(next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
    records = next;
    return true;
  } catch {
    announce("Браузер не сохранил изменения. Проверьте разрешения на хранение данных");
    return false;
  }
}
function saveEstimate() {
  if (!valid(true)) return;
  records = loadRecords();
  if (editing && JSON.stringify(records.find(record => record.id === editing.id)) !== JSON.stringify(editing)) {
    announce("Смету изменили или удалили в другой вкладке. Откройте актуальную версию из списка");
    return;
  }
  const form = readForm();
  const entry = {
    ...estimate(),
    form,
    accountingChanged: Boolean(editing && (editing.accountingChanged || JSON.stringify(form) !== originalForm)),
    id:editing?.id ?? (globalThis.crypto?.randomUUID?.() || String(Date.now()))
  };
  const next = editing ? records.map(record => record.id === entry.id ? entry : record) : [entry, ...records];
  if (!persist(next)) return;
  editing = entry;
  applyForm(entry.form);
  renderLedger();
  location.hash = "#ledger";
  announce("Смета сохранена");
}
function confirmDelete(entry) {
  const actions = node("div", undefined, "dialog-actions");
  actions.append(button("Удалить смету", "primary", () => {
    if (!persist(loadRecords().filter(record => record.id !== entry.id))) return;
    if (editing?.id === entry.id) {
      editing = null;
      applyForm(defaultForm);
    }
    dialog.close();
    renderLedger();
    $("new-estimate").focus();
    announce("Смета удалена");
  }), button("Отмена", "secondary", () => dialog.close()));
  openDialog("Удалить смету?", node("p", (entry.title || "Лофт " + entry.name) + " · " + rub(entry.total)), actions);
  actions.lastElementChild.focus();
}
function accountingLabel(entry) {
  return entry.accountingChanged ? "Передать изменения в учёт" : "Передать в учёт";
}
function openAccounting(entry) {
  const headers = ["Мероприятие","Дата","Площадка","Часы","Гости","Итого, ₽"];
  const cells = [entry.title || "", entry.date, entry.name, entry.hours, entry.guests, entry.total].map(value => {
    const cell = String(value).replace(/[\t\r\n]/g, " ");
    return /^\s*[=+@-]/.test(cell) ? "'" + cell : cell;
  });
  const preview = node("textarea", undefined, "dialog-copy");
  preview.readOnly = true;
  preview.value = cells.join("\t");
  preview.setAttribute("aria-label", "Строка для учёта");
  const actions = node("div", undefined, "dialog-actions");
  for (const [label, value] of [
    ["Скопировать строку", cells.join("\t")],
    ["С заголовками", headers.join("\t") + "\n" + cells.join("\t")]
  ]) {
    actions.append(button(label, "secondary", async () => {
      preview.value = value;
      try {
        await navigator.clipboard.writeText(value);
        announce("Данные скопированы");
      } catch {
        preview.focus();
        preview.select();
        announce("Строка выделена. Скопируйте её через меню");
      }
    }));
  }
  const instruction = entry.accountingChanged
    ? "Скопируйте обновлённую строку и замените ей запись этой сметы в учётной таблице"
    : "Скопируйте строку и вставьте её в учётную таблицу";
  openDialog(accountingLabel(entry), node("p", instruction), preview, actions);
}
function exportLedger() {
  const csvRow = row => row.map(cell => '"' + String(cell).replaceAll('"', '""') + '"').join(";");
  const rows = [["ID сметы","Дата события","Площадка","Часы","Гости","Позиция","Детали","Сумма позиции, ₽","Итого по смете, ₽","Мероприятие"]];
  records.forEach(entry => entry.lines.forEach((line, index) => rows.push([
    entry.id,entry.date,entry.name,entry.hours,entry.guests,line.name,line.note,line.value,index === 0 ? entry.total : "",
    /^\s*[=+@-]/.test(entry.title || "") ? "'" + entry.title : entry.title || ""
  ])));
  const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(csvRow).join("\r\n")], {type:"text/csv;charset=utf-8"}));
  const link = node("a");
  link.href = url;
  link.download = "buro-estimates.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

venues.forEach((place,i) => {
  const option = node("option", place.name + " · от " + rub(place.base) + " / 5 ч");
  option.value = i;
  $("venue").append(option);
});
services.forEach((service,i) => {
  const label = node("label", undefined, "service");
  const input = node("input");
  input.type = "checkbox";
  input.id = "service-" + i;
  input.checked = i === 0;
  label.append(input,node("span",service.name),node("span",(service.from ? "от " : "") + rub(service.price)));
  $("services").append(label);
});
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
$("date").value = [tomorrow.getFullYear(), String(tomorrow.getMonth()+1).padStart(2,"0"), String(tomorrow.getDate()).padStart(2,"0")].join("-");
$("hours").required = true;
$("guests").required = true;
$("extra").required = true;
$("food-price").required = true;
$("extra").value = venue().base / 5;
$("food-price").value = catering.buffet.rate;
$("venue").addEventListener("change", () => {
  $("extra").value = venue().base / 5;
  refreshPhoto();
  refresh();
});
$("food").addEventListener("change", () => {
  $("food-price").value = catering[$("food").value].rate;
  $("food-price").disabled = $("food").value === "none";
  refresh();
});
$("estimate").addEventListener("input", refresh);
document.querySelectorAll("[data-step]").forEach(control => {
  control.addEventListener("click", () => {
    const [id, delta] = control.dataset.step.split(":");
    const input = $(id);
    input.value = Math.max(Number(input.min), Math.min(Number(input.max), number(id) + Number(delta)));
    refresh();
  });
});
$("preview").addEventListener("click", () => { if (valid(true)) openProposal(estimate()); });
$("save").addEventListener("click", saveEstimate);
const defaultForm = readForm();
$("new-estimate").addEventListener("click", () => {
  if (!canReplaceDraft()) return;
  editing = null;
  applyForm(defaultForm);
  openCalculator("event-name");
});
$("cancel-edit").addEventListener("click", () => {
  if (!canReplaceDraft()) return;
  editing = null;
  applyForm(defaultForm);
  location.hash = "#ledger";
});
$("export").addEventListener("click", exportLedger);
$("jump-to-total").addEventListener("click", () => {
  $("receipt-title").tabIndex = -1;
  $("receipt-title").focus({preventScroll:true});
  $("receipt").scrollIntoView({block:"start"});
});
window.addEventListener("hashchange", route);
window.addEventListener("storage", event => {
  if (event.key !== key && event.key !== null) return;
  records = loadRecords();
  renderLedger();
});
applyForm(defaultForm);
renderLedger();
route();
