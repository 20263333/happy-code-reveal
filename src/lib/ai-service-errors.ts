export const AI_SERVICE_MESSAGES = {
  quota: "Средства или лимит оплаты сервиса AI закончились. Пополните баланс или проверьте лимит расходов у провайдера AI. Подписка ChatGPT не оплачивает OpenAI API; кредиты Binosoz.tj учитываются отдельно.",
  rate_limit: "Сервис AI временно ограничил частоту запросов. Подождите и отправьте сообщение позже.",
  limit_unknown: "Сервис AI вернул 429: ограничение запросов или оплаты. Повторите позже; если ошибка остаётся, проверьте баланс и лимиты провайдера AI.",
  authentication: "Сервис AI не принял ключ доступа. Проверьте настройки AI на сервере.",
  permission: "Сервис AI запретил этот запрос. Проверьте доступ к выбранной модели и ограничения аккаунта AI.",
  unavailable: "Сервис AI не завершил запрос. Автоматический повтор не выполнен; проверьте состояние сервиса перед новой отправкой.",
} as const;

export type AiFailureKind = keyof typeof AI_SERVICE_MESSAGES;

export function isAiServiceFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  return Object.values(AI_SERVICE_MESSAGES).some(message => message === error.message);
}