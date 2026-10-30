import Link from "next/link";
import { notFound } from "next/navigation";
import { updateMetricAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MetricFields } from "@/components/metric-fields";
import { getIdentity } from "@/lib/identity";
import { getMetric } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function EditMetric({ params }: PageProps<"/metrics/[key]/edit">) {
  const { key } = await params;
  const identity = await getIdentity();
  const history = await getMetric(key, 1);
  if (!history) notFound();
  const { metric } = history;

  return (
    <div className="max-w-2xl">
      <Link href={`/metrics/${metric.key}`} className="text-sm text-muted hover:text-ink">← {metric.name}</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold tracking-tight">Edit metric</h1>
      {identity.role === "admin" ? (
        <ActionForm action={updateMetricAction} submitLabel="Save changes" className="rounded-md border bg-panel p-6">
          <MetricFields metric={metric} />
        </ActionForm>
      ) : (
        <p className="rounded-md border bg-panel p-6 text-muted">Only app admins can edit metrics.</p>
      )}
    </div>
  );
}
