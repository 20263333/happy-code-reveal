---
name: Super Admin
description: Single platform Super Admin who grants all access to company owners
type: feature
---
Танҳо ЯК Super Admin дар система вуҷуд дорад:
- Email: **rahmatulloshohimardonzoda@gmail.com**
- Дар jadvali `platform_admins` сабт шудааст
- Тавассути `private.is_platform_admin(auth.uid())` тафтиш мешавад

Танҳо Super Admin метавонад:
- Ширкатҳо (companies) созад/нест кунад
- Тарифҳо (subscription_tariff_id), санаҳои обуна таъин кунад
- Лимитҳоро идора кунад: `max_staff`, `max_projects`, `max_blocks`
- Модулҳо (`enabled_modules`) фаъол/хомӯш кунад
- Демо-ҳисобҳо (`is_demo`, `demo_expires_at`), ҳолати ширкат (`status`)
- Соҳиби ширкат (`owner_user_id`)-ро иваз кунад
- Аз `companies_guard_privileged_updates` trigger ҳимоя шудааст

Соҳибони ширкат (owner) — танҳо дар доираи лимитҳои таъиншудаи Super Admin кор мекунанд.
