import Link from "next/link";
import { createMetricAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MetricFields } from "@/components/metric-fields";
import { getIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function NewMetric() {
  const identity = await getIdentity();
  return (
    <div className="max-w-2xl">
      <Link href="/" className="text-sm text-muted hover:text-ink">← Metrics</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold tracking-tight">New metric</h1>
      {identity.role === "admin" ? (
        <ActionForm action={createMetricAction} submitLabel="Create metric" className="rounded-md border bg-panel p-6">
          <MetricFields />
        </ActionForm>
      ) : (
        <p className="rounded-md border bg-panel p-6 text-muted">Only app admins can create metrics. Ask one to add it, then record values on its page.</p>
      )}
    </div>
  );
}
