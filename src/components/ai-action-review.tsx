import { useT } from "@/lib/i18n";

const labels: Record<string, string> = {
  apartment_number: "№", area: "м²", price: "Нарх", rooms: "Ҳуҷраҳо", name: "Ном", fullname: "Ному насаб", phone: "Телефон", address: "Суроға", location: "Ҷойгиршавӣ", description: "Тавсиф", note: "Эзоҳ", notes: "Эзоҳ", amount: "Маблағ", category: "Категория", status: "Ҳолат", date: "Сана", payment_date: "Санаи пардохт", expense_date: "Санаи хароҷот", due_date: "Муҳлати пардохт", payment_deadline: "Муҳлати пардохт", floor_number: "Ошёна", quantity: "Шумора", unit: "Воҳид", unit_price: "Нархи воҳид", planned_amount: "Маблағи нақша", total_amount: "Маблағи умумӣ", daily_rate: "Маоши рӯзона", monthly_salary: "Маоши моҳона", position: "Вазифа", progress: "Иҷро (%)", count: "Шумора", floor_from: "Аз ошёна", floor_to: "То ошёна", start_number: "Рақами аввал", price_per_sqm: "Нархи м²", areas: "Масоҳатҳо", project_id: "Лоиҳа", floor_id: "Ошёна", apartment_id: "Хона", customer_id: "Муштарӣ", sale_id: "Фурӯш", payable_id: "Қарз", currency: "Асъор", counterparty: "Тараф", brigade_name: "Бригада", specialty: "Ихтисос", receipt_inn: "ИНН", receipt_address: "Суроға", receipt_signer: "Имзо", customer_name: "Муштарӣ", customer_phone: "Телефон", supplier_fio: "Таъминкунанда", payment_method: "Тарзи пардохт",
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}
function format(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function AiActionReview({ preview }: { preview: unknown }) {
  const { tr } = useT();
  const data = record(preview);
  const before = record(data["before"]);
  const after = record(data["after"] ?? data["values"]);
  const apartmentRows = Array.isArray(data["changes"]) ? data["changes"] : [];
  return <div className="min-w-0 text-xs">
    <p className="font-medium break-words">{format(data["section"] ?? data["action"])}</p>
    {apartmentRows.length > 0 ? <>
      <p className="mt-1 text-muted-foreground">{apartmentRows.length} · {tr("Квартиры")}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-primary">{tr("Просмотреть изменения")}</summary>
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {apartmentRows.map((value, index) => {
            const row = record(value); const old = record(row["before"]);
            return <div key={index} className="border-l-2 border-border pl-2">
              <span className="font-medium">№ {format(old["apartment_number"])}</span>
              {["apartment_number", "area", "price", "rooms"].filter(key => Object.hasOwn(row, key)).map(key => <div key={key} className="break-words"><span className="text-muted-foreground">{tr(labels[key] ?? key)}: </span>{format(old[key])} → {format(row[key])}</div>)}
            </div>;
          })}
        </div>
      </details>
    </> : <dl className="mt-2 space-y-1">
      {Object.entries(after).filter(([key]) => key !== "before" && key !== "id" && !key.endsWith("_id")).map(([key, value]) => <div key={key} className="break-words"><dt className="inline text-muted-foreground">{tr(labels[key] ?? key)}: </dt><dd className="inline">{Object.hasOwn(before, key) ? `${format(before[key])} → ` : ""}{format(value)}</dd></div>)}
    </dl>}
  </div>;
}