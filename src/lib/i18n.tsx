import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ru" | "tg" | "en";

export const LANG_LABEL: Record<Lang, string> = {
  ru: "Русский",
  tg: "Тоҷикӣ",
  en: "English",
};

const DICT = {
  ru: {
    "app.name": "Binosoz.tj",
    "app.tagline": "Управление застройкой",
    "nav.menu": "Меню",
    "nav.dashboard": "Дашборд",
    "nav.projects": "Проекты",
    "nav.customers": "Клиенты",
    "nav.payments": "Платежи",
    "nav.expenses": "Расходы",
    "nav.staff": "Сотрудники",
    "common.logout": "Выйти",
    "common.save": "Сохранить",
    "common.cancel": "Отмена",
    "common.add": "Добавить",
    "common.create": "Создать",
    "common.loading": "Загрузка…",
    "common.back": "Назад",
    "common.delete": "Удалить",
    "common.edit": "Изменить",
    "common.search": "Поиск",
    "common.theme.light": "Светлая тема",
    "common.theme.dark": "Тёмная тема",
    "common.language": "Язык",
    "common.currency": "Валюта",
    "project.tabs.apartments": "Квартиры",
    "project.tabs.sales": "Продажи",
    "project.tabs.expenses": "Расходы",
    "project.tabs.payments": "Платежи",
    "project.tabs.access": "Доступ",
    "project.stats.total": "Квартир всего",
    "project.stats.sold": "Продано",
    "project.stats.revenue": "Выручка",
    "project.stats.expenses": "Расходы",
    "project.toProjects": "К проектам",
    "project.addFloor": "Добавить этаж",
    "project.newApartment": "Квартира",
    "project.newClient": "Новая продажа",
    "project.giveAccess": "Дать доступ",
    "project.newPayment": "Новый платёж",
    "project.addExpense": "Добавить расход",
    "project.noFloors": "Нет этажей",
    "project.noFloorsDesc": "Добавьте этаж и квартиры для визуализации.",
    "project.noSales": "Продаж пока нет",
    "project.noExpenses": "Расходов нет",
    "project.noPayments": "Платежей пока нет",
    "project.noStaff": "Сотрудников нет",
    "project.floor": "Этаж",
    "apt.number": "Номер",
    "apt.area": "Площадь, м²",
    "apt.rooms": "Комнат",
    "apt.price": "Цена",
    "apt.pricePerSqm": "Цена за 1 м²",
    "apt.total": "Итого (площадь × цена)",
    "apt.status": "Статус",
    "client.fullname": "ФИО клиента",
    "client.phone": "Телефон",
    "client.passport": "Паспорт",
    "client.address": "Адрес",
    "client.notes": "Примечания",
    "client.floor": "Этаж",
    "client.apartment": "Квартира",
    "client.area": "Площадь, м²",
    "client.price": "Цена",
    "client.downPayment": "Первый взнос",
    "client.deadline": "Дедлайн рассрочки",
    "client.create": "Оформить продажу",
    "payment.method": "Способ оплаты",
    "payment.method.cash": "Наличные",
    "payment.method.card": "Карта",
    "payment.amount": "Сумма",
    "payment.date": "Дата",
    "payment.note": "Примечание",
    "payment.receipt": "Чек (фото/PDF)",
    "payment.receiptRequired": "При оплате картой чек обязателен",
    "payment.submit": "Внести платёж",
    "payment.sale": "Сделка",
    "access.title": "Доступ сотрудников",
    "access.desc": "Создайте логин и пароль — сотрудник увидит только этот проект.",
    "access.email": "Email сотрудника",
    "access.password": "Пароль (мин. 6 символов)",
    "access.fullname": "ФИО",
    "access.create": "Создать доступ",
    "access.existing": "Уже имеют доступ",
    "access.revoke": "Отозвать",
    "table.client": "Клиент",
    "table.apartment": "Квартира",
    "table.price": "Цена",
    "table.paid": "Оплачено",
    "table.remaining": "Остаток",
    "table.deadline": "Дедлайн",
    "table.date": "Дата",
    "table.category": "Категория",
    "table.description": "Описание",
    "table.amount": "Сумма",
    "table.method": "Способ",
    "table.receipt": "Чек",
    "table.project": "Проект",
    "status.empty": "Свободна",
    "status.reserved": "Бронь",
    "status.sold": "Продана",
    "status.installment": "Рассрочка",
    "status.unavailable": "Занята (не продаётся)",
    "projectStatus.planning": "Планирование",
    "projectStatus.in_progress": "Строится",
    "projectStatus.completed": "Завершён",
    "projectStatus.paused": "Приостановлен",
    "floor.status": "Статус этажа",
    "floor.description": "Описание",
    "floor.status.planning": "Планирование",
    "floor.status.in_progress": "Строится",
    "floor.status.completed": "Готов",
    "expense.new": "Новый расход",
    "expense.cat.cement": "Цемент",
    "expense.cat.blocks": "Блоки (пеноблок)",
    "expense.cat.sand": "Песок",
    "expense.cat.gravel": "Щебень",
    "expense.cat.cable": "Провод / кабель",
    "expense.cat.wire": "Сим",
    "expense.cat.wire_6mm": "Сим 8 мм²",
    "expense.cat.wire_visual": "Сим визуальный",
    "expense.cat.nails": "Гвозди / саморезы",
    "expense.cat.lumber": "Доски / брус",
    "expense.cat.formwork": "Опалубка",
    "expense.cat.electrical": "Электрика",
    "expense.cat.plumbing": "Сантехника",
    "expense.cat.plaster": "Штукатурка / шпаклёвка",
    "expense.cat.paint": "Краска",
    "expense.cat.tile": "Плитка / кафель",
    "expense.cat.windows": "Окна",
    "expense.cat.doors": "Двери",
    "expense.cat.roofing": "Кровля",
    "expense.cat.waterproof": "Гидроизоляция",
    "expense.cat.insulation": "Утеплитель",
    "expense.cat.welding": "Сварочные работы",
    "expense.cat.tools": "Инструменты",
    "expense.cat.fuel": "Топливо",
    "expense.cat.elevator": "Лифт",
    "expense.cat.landscaping": "Благоустройство",
    "expense.cat.concrete": "Бетон",
    "expense.cat.rebar": "Арматур",
    "expense.cat.salary": "Зарплата",
    "expense.cat.materials": "Материалы",
    "expense.cat.equipment": "Техника",
    "expense.cat.transport": "Транспорт",
    "expense.cat.rent": "Аренда",
    "expense.cat.taxes": "Налоги",
    "expense.cat.other": "Прочее",
    "expense.cat.compensation": "Компенсация переселенцу",
    "expense.cat.car_loss": "Зарари мошин",
    "expense.cat.subcontract": "Субподряд (Бригады)",
    "expense.cat.brick": "Кирпич",
    "expense.cat.masters": "Оплата мастерам",
    "expense.cat.partner_payout": "Выплата партнёру",
    "payments.upcoming": "Предстоящие платежи",
    "payments.overdue": "Просрочено",
    "payments.dueIn": "Через",
    "payments.days": "дн.",
    "staff.projects": "Проекты",
    "staff.noProjects": "Не назначен",
    "staff.revoke": "Отозвать доступ",
  },
  tg: {
    "app.name": "Binosoz.tj",
    "app.tagline": "Идоракунии сохтмон",
    "nav.menu": "Меню",
    "nav.dashboard": "Дашборд",
    "nav.projects": "Лоиҳаҳо",
    "nav.customers": "Муштариён",
    "nav.payments": "Пардохтҳо",
    "nav.expenses": "Хароҷот",
    "nav.staff": "Кормандон",
    "common.logout": "Баромадан",
    "common.save": "Сабт",
    "common.cancel": "Бекор",
    "common.add": "Илова",
    "common.create": "Сохтан",
    "common.loading": "Боргирӣ…",
    "common.back": "Бозгашт",
    "common.delete": "Нест кардан",
    "common.edit": "Тағйир",
    "common.search": "Ҷустуҷӯ",
    "common.theme.light": "Мавзӯи равшан",
    "common.theme.dark": "Мавзӯи торик",
    "common.language": "Забон",
    "common.currency": "Асъор",
    "project.tabs.apartments": "Хонаҳо",
    "project.tabs.sales": "Фурӯш",
    "project.tabs.expenses": "Хароҷот",
    "project.tabs.payments": "Пардохтҳо",
    "project.tabs.access": "Дастрасӣ",
    "project.stats.total": "Ҳамаи хонаҳо",
    "project.stats.sold": "Фурӯхташуда",
    "project.stats.revenue": "Даромад",
    "project.stats.expenses": "Хароҷот",
    "project.toProjects": "Ба лоиҳаҳо",
    "project.addFloor": "Илова кардани ошёна",
    "project.newApartment": "Хона",
    "project.newClient": "Фурӯши нав",
    "project.giveAccess": "Додани дастрасӣ",
    "project.newPayment": "Пардохти нав",
    "project.addExpense": "Илова кардани хароҷот",
    "project.noFloors": "Ошёна нест",
    "project.noFloorsDesc": "Ошёна ва хонаҳо илова кунед.",
    "project.noSales": "Ҳоло фурӯше нест",
    "project.noExpenses": "Хароҷот нест",
    "project.noPayments": "Ҳоло пардохте нест",
    "project.noStaff": "Корманд нест",
    "project.floor": "Ошёна",
    "apt.number": "Рақам",
    "apt.area": "Масоҳат, м²",
    "apt.rooms": "Ҳуҷра",
    "apt.price": "Нарх",
    "apt.pricePerSqm": "Нарх барои 1 м²",
    "apt.total": "Ҳамагӣ (масоҳат × нарх)",
    "apt.status": "Ҳолат",
    "client.fullname": "Ному насаби муштарӣ",
    "client.phone": "Телефон",
    "client.passport": "Шиноснома",
    "client.address": "Суроға",
    "client.notes": "Эзоҳ",
    "client.floor": "Ошёна",
    "client.apartment": "Хона",
    "client.area": "Масоҳат, м²",
    "client.price": "Нархи пурра",
    "client.downPayment": "Бунаки аввал",
    "client.deadline": "Мӯҳлати қарз",
    "client.create": "Ба расмият даровардан",
    "payment.method": "Тарзи пардохт",
    "payment.method.cash": "Нақд",
    "payment.method.card": "Корт",
    "payment.amount": "Маблағ",
    "payment.date": "Сана",
    "payment.note": "Эзоҳ",
    "payment.receipt": "Чек (акс/PDF)",
    "payment.receiptRequired": "Ҳангоми пардохт бо корт чек ҳатмист",
    "payment.submit": "Сабт кардани пардохт",
    "payment.sale": "Аҳд",
    "access.title": "Дастрасии кормандон",
    "access.desc": "Эмайл ва пароль созед — корманд танҳо ҳамин лоиҳаро мебинад.",
    "access.email": "Эмайли корманд",
    "access.password": "Пароль (камаш 6 рамз)",
    "access.fullname": "Ному насаб",
    "access.create": "Сохтани дастрасӣ",
    "access.existing": "Дастрасӣ доранд",
    "access.revoke": "Гирифтан",
    "table.client": "Муштарӣ",
    "table.apartment": "Хона",
    "table.price": "Нарх",
    "table.paid": "Пардохтшуда",
    "table.remaining": "Бақия",
    "table.deadline": "Мӯҳлат",
    "table.date": "Сана",
    "table.category": "Категория",
    "table.description": "Тавсиф",
    "table.amount": "Маблағ",
    "table.method": "Тарз",
    "table.receipt": "Чек",
    "table.project": "Лоиҳа",
    "status.empty": "Холӣ",
    "status.reserved": "Банд",
    "status.sold": "Фурӯхташуда",
    "status.installment": "Қарз",
    "status.unavailable": "Банд (фурӯхта намешавад)",
    "projectStatus.planning": "Нақшакашӣ",
    "projectStatus.in_progress": "Сохтмон",
    "projectStatus.completed": "Тайёр",
    "projectStatus.paused": "Боздошта",
    "floor.status": "Ҳолати ошёна",
    "floor.description": "Тавсиф",
    "floor.status.planning": "Нақшакашӣ",
    "floor.status.in_progress": "Дар ҳоли сохт",
    "floor.status.completed": "Тайёр",
    "expense.new": "Хароҷоти нав",
    "expense.cat.cement": "Семент",
    "expense.cat.blocks": "Блок (пеноблок)",
    "expense.cat.sand": "Рег",
    "expense.cat.gravel": "Шағал",
    "expense.cat.cable": "Сим / кабел",
    "expense.cat.wire": "Сим",
    "expense.cat.wire_6mm": "Сими 8 мм²",
    "expense.cat.wire_visual": "Сими визуалӣ",
    "expense.cat.nails": "Мехча / шуруп",
    "expense.cat.lumber": "Тахта / чӯб",
    "expense.cat.formwork": "Опалубка",
    "expense.cat.electrical": "Барқ (электрика)",
    "expense.cat.plumbing": "Сантехника",
    "expense.cat.plaster": "Гаҷ / шпаклёвка",
    "expense.cat.paint": "Ранг",
    "expense.cat.tile": "Кафел",
    "expense.cat.windows": "Тирезаҳо",
    "expense.cat.doors": "Дарҳо",
    "expense.cat.roofing": "Бом",
    "expense.cat.waterproof": "Гидроизолятсия",
    "expense.cat.insulation": "Гармнигоҳдоранда",
    "expense.cat.welding": "Кори кафшергарӣ",
    "expense.cat.tools": "Асбобҳо",
    "expense.cat.fuel": "Сӯзишворӣ",
    "expense.cat.elevator": "Лифт",
    "expense.cat.landscaping": "Ободонӣ",
    "expense.cat.concrete": "Бетон",
    "expense.cat.rebar": "Арматур",
    "expense.cat.salary": "Маош",
    "expense.cat.materials": "Масолеҳ",
    "expense.cat.equipment": "Техника",
    "expense.cat.transport": "Нақлиёт",
    "expense.cat.rent": "Иҷора",
    "expense.cat.taxes": "Андоз",
    "expense.cat.other": "Дигар",
    "expense.cat.compensation": "Компенсатсия ба соҳиб",
    "expense.cat.car_loss": "Зарари мошин",
    "expense.cat.subcontract": "Пудратчиён (Бригадаҳо)",
    "expense.cat.brick": "Хишт",
    "expense.cat.masters": "Пули устоҳо",
    "expense.cat.partner_payout": "Пардохт ба шарикон",
    "payments.upcoming": "Пардохтҳои наздик",
    "payments.overdue": "Гузашта",
    "payments.dueIn": "Баъди",
    "payments.days": "рӯз",
    "staff.projects": "Лоиҳаҳо",
    "staff.noProjects": "Таъин нашуда",
    "staff.revoke": "Гирифтани дастрасӣ",
  },
  en: {
    "app.name": "Binosoz.tj",
    "app.tagline": "Construction management",
    "nav.menu": "Menu",
    "nav.dashboard": "Dashboard",
    "nav.projects": "Projects",
    "nav.customers": "Customers",
    "nav.payments": "Payments",
    "nav.expenses": "Expenses",
    "nav.staff": "Staff",
    "common.logout": "Log out",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.add": "Add",
    "common.create": "Create",
    "common.loading": "Loading…",
    "common.back": "Back",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.search": "Search",
    "common.theme.light": "Light theme",
    "common.theme.dark": "Dark theme",
    "common.language": "Language",
    "common.currency": "Currency",
    "project.tabs.apartments": "Apartments",
    "project.tabs.sales": "Sales",
    "project.tabs.expenses": "Expenses",
    "project.tabs.payments": "Payments",
    "project.tabs.access": "Access",
    "project.stats.total": "Total apartments",
    "project.stats.sold": "Sold",
    "project.stats.revenue": "Revenue",
    "project.stats.expenses": "Expenses",
    "project.toProjects": "To projects",
    "project.addFloor": "Add floor",
    "project.newApartment": "Apartment",
    "project.newClient": "New sale",
    "project.giveAccess": "Grant access",
    "project.newPayment": "New payment",
    "project.addExpense": "Add expense",
    "project.noFloors": "No floors",
    "project.noFloorsDesc": "Add floors and apartments for visualization.",
    "project.noSales": "No sales yet",
    "project.noExpenses": "No expenses",
    "project.noPayments": "No payments yet",
    "project.noStaff": "No staff",
    "project.floor": "Floor",
    "apt.number": "Number",
    "apt.area": "Area, m²",
    "apt.rooms": "Rooms",
    "apt.price": "Price",
    "apt.pricePerSqm": "Price per 1 m²",
    "apt.total": "Total (area × price)",
    "apt.status": "Status",
    "client.fullname": "Client full name",
    "client.phone": "Phone",
    "client.passport": "Passport",
    "client.address": "Address",
    "client.notes": "Notes",
    "client.floor": "Floor",
    "client.apartment": "Apartment",
    "client.area": "Area, m²",
    "client.price": "Price",
    "client.downPayment": "First payment",
    "client.deadline": "Installment deadline",
    "client.create": "Create sale",
    "payment.method": "Payment method",
    "payment.method.cash": "Cash",
    "payment.method.card": "Card",
    "payment.amount": "Amount",
    "payment.date": "Date",
    "payment.note": "Note",
    "payment.receipt": "Receipt (photo/PDF)",
    "payment.receiptRequired": "Receipt is required for card payments",
    "payment.submit": "Add payment",
    "payment.sale": "Deal",
    "access.title": "Staff access",
    "access.desc": "Create a login and password — the employee will see only this project.",
    "access.email": "Employee email",
    "access.password": "Password (min. 6 characters)",
    "access.fullname": "Full name",
    "access.create": "Create access",
    "access.existing": "Already have access",
    "access.revoke": "Revoke",
    "table.client": "Client",
    "table.apartment": "Apartment",
    "table.price": "Price",
    "table.paid": "Paid",
    "table.remaining": "Remaining",
    "table.deadline": "Deadline",
    "table.date": "Date",
    "table.category": "Category",
    "table.description": "Description",
    "table.amount": "Amount",
    "table.method": "Method",
    "table.receipt": "Receipt",
    "table.project": "Project",
    "status.empty": "Available",
    "status.reserved": "Reserved",
    "status.sold": "Sold",
    "status.installment": "Installment",
    "status.unavailable": "Unavailable",
    "projectStatus.planning": "Planning",
    "projectStatus.in_progress": "In progress",
    "projectStatus.completed": "Completed",
    "projectStatus.paused": "Paused",
    "floor.status": "Floor status",
    "floor.description": "Description",
    "floor.status.planning": "Planning",
    "floor.status.in_progress": "In progress",
    "floor.status.completed": "Completed",
    "expense.new": "New expense",
    "expense.cat.cement": "Cement",
    "expense.cat.blocks": "Blocks",
    "expense.cat.sand": "Sand",
    "expense.cat.gravel": "Gravel",
    "expense.cat.cable": "Wire / cable",
    "expense.cat.wire": "Wire",
    "expense.cat.wire_6mm": "8 mm² wire",
    "expense.cat.wire_visual": "Visible wire",
    "expense.cat.nails": "Nails / screws",
    "expense.cat.lumber": "Boards / timber",
    "expense.cat.formwork": "Formwork",
    "expense.cat.electrical": "Electrical",
    "expense.cat.plumbing": "Plumbing",
    "expense.cat.plaster": "Plaster / putty",
    "expense.cat.paint": "Paint",
    "expense.cat.tile": "Tile",
    "expense.cat.windows": "Windows",
    "expense.cat.doors": "Doors",
    "expense.cat.roofing": "Roofing",
    "expense.cat.waterproof": "Waterproofing",
    "expense.cat.insulation": "Insulation",
    "expense.cat.welding": "Welding works",
    "expense.cat.tools": "Tools",
    "expense.cat.fuel": "Fuel",
    "expense.cat.elevator": "Elevator",
    "expense.cat.landscaping": "Landscaping",
    "expense.cat.concrete": "Concrete",
    "expense.cat.rebar": "Rebar",
    "expense.cat.salary": "Salary",
    "expense.cat.materials": "Materials",
    "expense.cat.equipment": "Equipment",
    "expense.cat.transport": "Transport",
    "expense.cat.rent": "Rent",
    "expense.cat.taxes": "Taxes",
    "expense.cat.other": "Other",
    "expense.cat.compensation": "Resettlement compensation",
    "expense.cat.car_loss": "Car loss",
    "expense.cat.subcontract": "Subcontract (crews)",
    "expense.cat.brick": "Brick",
    "expense.cat.masters": "Masters payment",
    "expense.cat.partner_payout": "Partner payout",
    "payments.upcoming": "Upcoming payments",
    "payments.overdue": "Overdue",
    "payments.dueIn": "In",
    "payments.days": "days",
    "staff.projects": "Projects",
    "staff.noProjects": "Not assigned",
    "staff.revoke": "Revoke access",
  },
} as const;

type Key = keyof typeof DICT["ru"];

// ---------------------------------------------------------------------------
// Phrase-based translation. Phrase files under src/lib/phrases/*.ts export a
// default map for Tajik (ru -> tg). Optional English maps can be added under
// src/lib/phrases-en/*.ts (ru -> en). Static DICT entries also feed both maps
// so the DOM translator catches them for either language.
// ---------------------------------------------------------------------------
const tgModules = import.meta.glob("./phrases/*.ts", { eager: true }) as Record<
  string,
  { default?: Record<string, string> }
>;
const enModules = import.meta.glob("./phrases-en/*.ts", { eager: true }) as Record<
  string,
  { default?: Record<string, string> }
>;

const PHRASES: Record<Lang, Record<string, string>> = {
  ru: {},
  tg: {},
  en: {},
};

for (const path of Object.keys(tgModules).sort()) {
  const mod = tgModules[path];
  if (mod?.default) Object.assign(PHRASES.tg, mod.default);
}
for (const path of Object.keys(enModules).sort()) {
  const mod = enModules[path];
  if (mod?.default) Object.assign(PHRASES.en, mod.default);
}
for (const key of Object.keys(DICT.ru) as Key[]) {
  const ru = DICT.ru[key];
  const tg = DICT.tg[key];
  const en = DICT.en[key];
  if (ru && tg && !(ru in PHRASES.tg)) PHRASES.tg[ru] = tg;
  if (ru && en && !(ru in PHRASES.en)) PHRASES.en[ru] = en;
}

// ---------------------------------------------------------------------------
// Global DOM translator — walks text nodes / placeholder / title attrs and
// substitutes matched Russian source strings with the active language.
// ---------------------------------------------------------------------------
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const origText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, { placeholder?: string; title?: string }>();

for (const [ru, tg] of Object.entries(PHRASES.tg)) {
  if (tg && !(tg in PHRASES.ru)) PHRASES.ru[tg] = ru;
}

function resolveTranslation(text: string, lang: Lang) {
  const russianSource = PHRASES.ru[text] ?? text;
  if (lang === "ru") return russianSource;
  return PHRASES[lang][russianSource] ?? PHRASES[lang][text] ?? russianSource;
}

function translateText(node: Text, lang: Lang) {
  const parent = node.parentElement;
  if (parent && SKIP_TAGS.has(parent.tagName)) return;
  const current = node.nodeValue ?? "";
  const trimmed = current.trim();
  if (!trimmed) return;
  const original = origText.get(node) ?? current;
  const originalTrimmed = original.trim();
  const hit = resolveTranslation(originalTrimmed, lang) || resolveTranslation(trimmed, lang);
  if (hit && hit !== originalTrimmed) {
    if (!origText.has(node)) origText.set(node, current);
    node.nodeValue = original.replace(originalTrimmed, hit);
  } else if (origText.has(node)) {
    // active language has no translation — restore original so we don't leave
    // a stale translation from a previous language.
    node.nodeValue = original;
  }
}

function translateAttrs(el: Element, lang: Lang) {
  for (const attr of ["placeholder", "title"] as const) {
    if (!el.hasAttribute(attr)) continue;
    const current = el.getAttribute(attr) ?? "";
    const trimmed = current.trim();
    if (!trimmed) continue;
    const store = origAttr.get(el) ?? {};
    const original = store[attr] ?? current;
    const originalTrimmed = original.trim();
    const hit = resolveTranslation(originalTrimmed, lang) || resolveTranslation(trimmed, lang);
    if (hit && hit !== originalTrimmed) {
      if (store[attr] == null) { store[attr] = current; origAttr.set(el, store); }
      el.setAttribute(attr, original.replace(originalTrimmed, hit));
    } else if (store[attr] != null) {
      el.setAttribute(attr, store[attr]!);
    }
  }
}

function walk(root: Node, lang: Lang) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateText(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (SKIP_TAGS.has((root as Element).tagName)) return;
  translateAttrs(root as Element, lang);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text, lang);
    else translateAttrs(n as Element, lang);
    n = tw.nextNode();
  }
}

let observer: MutationObserver | null = null;
export function runDomTranslate(lang: Lang) {
  if (typeof document === "undefined") return;
  observer?.disconnect();
  walk(document.body, lang);
  observer = new MutationObserver((muts) => {
    observer?.disconnect();
    for (const m of muts) {
      if (m.type === "characterData") translateText(m.target as Text, lang);
      else m.addedNodes.forEach((node) => walk(node, lang));
    }
    observer?.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key) => string;
  /** Translate a raw Russian source string to the active language. */
  tr: (ru: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "ru" || saved === "tg" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    runDomTranslate(lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("lang", l);
    if (typeof document !== "undefined") document.documentElement.lang = l === "tg" ? "tg-Cyrl" : l;
  };

  const t = (key: Key) => DICT[lang][key] ?? DICT.ru[key] ?? key;
  const tr = (ru: string) => {
    const source = PHRASES.ru[ru] ?? ru;
    if (lang === "ru") return source;
    return PHRASES[lang][source] ?? source;
  };

  // Remount the whole subtree whenever the language changes so every component
  // re-renders from its source strings in the new language. This avoids stale
  // translations that React would otherwise leave in reused text nodes.
  return (
    <Ctx.Provider value={{ lang, setLang, t, tr }}>
      <Fragment key={lang}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useT() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useT must be inside I18nProvider");
  return c;
}
