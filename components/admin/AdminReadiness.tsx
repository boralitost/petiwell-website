import {
  getAmbassadorTechnicalReadiness,
  getCommerceReadiness
} from "@/lib/readiness";
import { getOperationsHealth } from "@/lib/operations-health";

export async function AdminReadiness() {
  const readiness = getCommerceReadiness();
  const ambassador = getAmbassadorTechnicalReadiness();
  const operations = await getOperationsHealth();

  return (
    <div className="mb-10 space-y-4">
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Satış hazırlık durumu</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Doğrudan satış:{" "}
        <strong>{readiness.salesEnabled ? "AÇIK" : "KAPALI"}</strong>
        {" · "}
        Açmaya hazır:{" "}
        <strong>{readiness.readyToEnableSales ? "EVET" : "HAYIR"}</strong>
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {readiness.flags.map((f) => (
          <li key={f.id} className="flex items-start gap-2">
            <span
              className={
                f.ok
                  ? "mt-0.5 text-green-700"
                  : f.blocking
                    ? "mt-0.5 text-red-600"
                    : "mt-0.5 text-amber-600"
              }
            >
              {f.ok ? "✓" : "✗"}
            </span>
            <span>
              <span className="font-medium">{f.id}</span>
              {f.blocking ? " (zorunlu)" : ""} — {f.note}
            </span>
          </li>
        ))}
      </ul>
    </section>
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Elçi teknik hazırlık durumu</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Canlı davetlere hazır: <strong>{ambassador.ready ? "EVET" : "HAYIR"}</strong>
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {ambassador.flags.map((flag) => (
          <li key={flag.id} className="flex items-start gap-2">
            <span
              className={
                flag.ok
                  ? "mt-0.5 text-green-700"
                  : flag.blocking
                    ? "mt-0.5 text-red-600"
                    : "mt-0.5 text-amber-600"
              }
            >
              {flag.ok ? "✓" : "✗"}
            </span>
            <span>
              <span className="font-medium">{flag.id}</span>
              {flag.blocking ? " (zorunlu)" : ""} — {flag.note}
            </span>
          </li>
        ))}
      </ul>
    </section>
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Operasyon sağlığı</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Durum: <strong>{operations.ok ? "SAĞLIKLI" : "MÜDAHALE GEREKİYOR"}</strong>
      </p>
      {operations.issues.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">
          {operations.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-green-700">
          Bekleyen kritik iade, webhook, bildirim veya scanner sorunu yok.
        </p>
      )}
    </section>
    </div>
  );
}
