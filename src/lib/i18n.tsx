import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ru" | "tg" | "zh";

export const LANG_LABEL: Record<Lang, string> = {
  ru: "Русский",
  tg: "Тоҷикӣ",
  zh: "中文",
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
  zh: {
    "app.name": "Binosoz.tj",
    "app.tagline": "建筑管理",
    "nav.menu": "菜单",
    "nav.dashboard": "仪表板",
    "nav.projects": "项目",
    "nav.customers": "客户",
    "nav.payments": "付款",
    "nav.expenses": "支出",
    "nav.staff": "员工",
    "common.logout": "退出",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.add": "添加",
    "common.create": "创建",
    "common.loading": "加载中…",
    "common.back": "返回",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.search": "搜索",
    "common.theme.light": "浅色主题",
    "common.theme.dark": "深色主题",
    "common.language": "语言",
    "common.currency": "货币",
    "project.tabs.apartments": "公寓",
    "project.tabs.sales": "销售",
    "project.tabs.expenses": "支出",
    "project.tabs.payments": "付款",
    "project.tabs.access": "访问",
    "project.stats.total": "公寓总数",
    "project.stats.sold": "已售",
    "project.stats.revenue": "收入",
    "project.stats.expenses": "支出",
    "project.toProjects": "返回项目",
    "project.addFloor": "添加楼层",
    "project.newApartment": "公寓",
    "project.newClient": "新销售",
    "project.giveAccess": "授予访问权限",
    "project.newPayment": "新付款",
    "project.addExpense": "添加支出",
    "project.noFloors": "无楼层",
    "project.noFloorsDesc": "添加楼层和公寓以可视化。",
    "project.noSales": "暂无销售",
    "project.noExpenses": "无支出",
    "project.noPayments": "暂无付款",
    "project.noStaff": "无员工",
    "project.floor": "楼层",
    "apt.number": "编号",
    "apt.area": "面积, 平方米",
    "apt.rooms": "房间数",
    "apt.price": "价格",
    "apt.pricePerSqm": "每平方米价格",
    "apt.total": "合计 (面积 × 价格)",
    "apt.status": "状态",
    "client.fullname": "客户姓名",
    "client.phone": "电话",
    "client.passport": "护照",
    "client.address": "地址",
    "client.notes": "备注",
    "client.floor": "楼层",
    "client.apartment": "公寓",
    "client.area": "面积, 平方米",
    "client.price": "价格",
    "client.downPayment": "首付",
    "client.deadline": "分期付款截止日期",
    "client.create": "创建销售",
    "payment.method": "付款方式",
    "payment.method.cash": "现金",
    "payment.method.card": "银行卡",
    "payment.amount": "金额",
    "payment.date": "日期",
    "payment.note": "备注",
    "payment.receipt": "收据 (照片/PDF)",
    "payment.receiptRequired": "银行卡付款需要收据",
    "payment.submit": "提交付款",
    "payment.sale": "交易",
    "access.title": "员工访问权限",
    "access.desc": "创建登录名和密码 — 员工只能看到此项目。",
    "access.email": "员工邮箱",
    "access.password": "密码 (至少6个字符)",
    "access.fullname": "姓名",
    "access.create": "创建访问",
    "access.existing": "已有访问权限",
    "access.revoke": "撤销",
    "table.client": "客户",
    "table.apartment": "公寓",
    "table.price": "价格",
    "table.paid": "已付",
    "table.remaining": "余额",
    "table.deadline": "截止日期",
    "table.date": "日期",
    "table.category": "类别",
    "table.description": "描述",
    "table.amount": "金额",
    "table.method": "方式",
    "table.receipt": "收据",
    "table.project": "项目",
    "status.empty": "空闲",
    "status.reserved": "预留",
    "status.sold": "已售",
    "status.installment": "分期",
    "status.unavailable": "占用（不出售）",
    "projectStatus.planning": "规划中",
    "projectStatus.in_progress": "建设中",
    "projectStatus.completed": "已完成",
    "projectStatus.paused": "已暂停",
    "floor.status": "楼层状态",
    "floor.description": "描述",
    "floor.status.planning": "规划中",
    "floor.status.in_progress": "建设中",
    "floor.status.completed": "已完成",
    "expense.new": "新支出",
    "expense.cat.cement": "水泥",
    "expense.cat.blocks": "砌块",
    "expense.cat.sand": "砂",
    "expense.cat.gravel": "碎石",
    "expense.cat.cable": "电线/电缆",
    "expense.cat.wire": "电线",
    "expense.cat.wire_6mm": "8平方电线",
    "expense.cat.wire_visual": "明线",
    "expense.cat.nails": "钉子/螺丝",
    "expense.cat.lumber": "木材",
    "expense.cat.formwork": "模板",
    "expense.cat.electrical": "电气",
    "expense.cat.plumbing": "给排水",
    "expense.cat.plaster": "抹灰/腻子",
    "expense.cat.paint": "油漆",
    "expense.cat.tile": "瓷砖",
    "expense.cat.windows": "窗户",
    "expense.cat.doors": "门",
    "expense.cat.roofing": "屋面",
    "expense.cat.waterproof": "防水",
    "expense.cat.insulation": "保温",
    "expense.cat.welding": "焊接",
    "expense.cat.tools": "工具",
    "expense.cat.fuel": "燃料",
    "expense.cat.elevator": "电梯",
    "expense.cat.landscaping": "环境美化",
    "expense.cat.concrete": "混凝土",
    "expense.cat.rebar": "钢筋",
    "expense.cat.salary": "工资",
    "expense.cat.materials": "材料",
    "expense.cat.equipment": "设备",
    "expense.cat.transport": "运输",
    "expense.cat.rent": "租金",
    "expense.cat.taxes": "税费",
    "expense.cat.other": "其他",
    "expense.cat.compensation": "搬迁补偿",
    "expense.cat.brick": "砖",
    "expense.cat.masters": "工匠费用",
    "expense.cat.partner_payout": "合伙人分配",
    "expense.cat.car_loss": "车辆亏损",
    "expense.cat.subcontract": "分包 (施工队)",
    "payments.upcoming": "即将付款",
    "payments.overdue": "已逾期",
    "payments.dueIn": "还有",
    "payments.days": "天",
    "staff.projects": "项目",
    "staff.noProjects": "未分配",
    "staff.revoke": "撤销访问",
  },
} as const;

type Key = keyof typeof DICT["ru"];

// ---------------------------------------------------------------------------
// Phrase-based translation. Phrase files under src/lib/phrases/*.ts export a
// default map for Tajik (ru -> tg). Optional Chinese maps can be added under
// src/lib/phrases-zh/*.ts (ru -> zh). Static DICT entries also feed both maps
// so the DOM translator catches them for either language.
// ---------------------------------------------------------------------------
const tgModules = import.meta.glob("./phrases/*.ts", { eager: true }) as Record<
  string,
  { default?: Record<string, string> }
>;
const zhModules = import.meta.glob("./phrases-zh/*.ts", { eager: true }) as Record<
  string,
  { default?: Record<string, string> }
>;

const PHRASES: Record<Exclude<Lang, "ru">, Record<string, string>> = {
  tg: {},
  zh: {},
};

for (const mod of Object.values(tgModules)) {
  if (mod.default) Object.assign(PHRASES.tg, mod.default);
}
for (const mod of Object.values(zhModules)) {
  if (mod.default) Object.assign(PHRASES.zh, mod.default);
}
for (const key of Object.keys(DICT.ru) as Key[]) {
  const ru = DICT.ru[key];
  const tg = DICT.tg[key];
  const zh = DICT.zh[key];
  if (ru && tg && !(ru in PHRASES.tg)) PHRASES.tg[ru] = tg;
  if (ru && zh && !(ru in PHRASES.zh)) PHRASES.zh[ru] = zh;
}

// ---------------------------------------------------------------------------
// Global DOM translator — walks text nodes / placeholder / title attrs and
// substitutes matched Russian source strings with the active language.
// ---------------------------------------------------------------------------
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const origText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, { placeholder?: string; title?: string }>();

function translateText(node: Text, lang: Lang) {
  const parent = node.parentElement;
  if (parent && SKIP_TAGS.has(parent.tagName)) return;
  const current = node.nodeValue ?? "";
  const trimmed = current.trim();
  if (!trimmed) return;
  if (lang === "ru") {
    const o = origText.get(node);
    if (o != null && node.nodeValue !== o) node.nodeValue = o;
    return;
  }
  const map = PHRASES[lang];
  const original = origText.get(node) ?? current;
  const originalTrimmed = original.trim();
  const hit = map[originalTrimmed] ?? map[trimmed];
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
    if (lang === "ru") {
      if (store[attr] != null) el.setAttribute(attr, store[attr]!);
      continue;
    }
    const map = PHRASES[lang];
    const original = store[attr] ?? current;
    const originalTrimmed = original.trim();
    const hit = map[originalTrimmed] ?? map[trimmed];
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
    if (saved === "ru" || saved === "tg" || saved === "zh") setLangState(saved);
  }, []);

  useEffect(() => {
    runDomTranslate(lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("lang", l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (key: Key) => DICT[lang][key] ?? DICT.ru[key] ?? key;
  const tr = (ru: string) => {
    if (lang === "ru") return ru;
    return PHRASES[lang][ru] ?? ru;
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
