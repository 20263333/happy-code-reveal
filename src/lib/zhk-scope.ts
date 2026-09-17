// Интихоби глобалии ЖК (Шарора Сохтмон / Қазоқон Сохтмон ва ғ.).
// Тугмаҳои болои саҳифа ва ҳамаи филтрҳои ЖК аз ҳамин як манбаъ кор мекунанд,
// то маълумоти лоиҳаҳо бо ҳам омехта нашавад.
import { useSyncExternalStore } from "react";

const KEY = "platform.zhk.selected";
const listeners = new Set<() => void>();

export function getGlobalZhk(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setGlobalZhk(id: string) {
  if (typeof window === "undefined") return;
  if (getGlobalZhk() === id) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useGlobalZhk(): string {
  return useSyncExternalStore(subscribe, getGlobalZhk, () => "");
}
