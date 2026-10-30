import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { syncUser } from "@/db/users";
import { getIdentity } from "@/lib/identity";
import { targetStatus } from "@/lib/kpi";
import { listMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/** How many recent values each card's sparkline draws. */
const SPARKLINE_POINTS = 30;

export default async function Dashboard() {
  const identity = await getIdentity();
  await syncUser(identity);
  const all = await listMetrics(SPARKLINE_POINTS);
  const isAdmin = identity.role === "admin";
  const offTarget = all.filter(({ metric, points }) => targetStatus(metric, points.at(-1)) === "off_target").length;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="mt-1 text-muted">
            {all.length === 0
              ? "Every number your team tracks, in one place."
              : `${all.length} ${all.length === 1 ? "metric" : "metrics"}, ${offTarget} off target. Change is against the value recorded before the latest.`}
          </p>
        </div>
        {isAdmin && (
          <Link href="/metrics/new" className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            New metric
          </Link>
        )}
      </header>

      {all.length === 0 ? (
        <div className="rounded-md border border-dashed bg-panel px-6 py-12 text-center">
          <h2 className="font-medium">No metrics yet</h2>
          {isAdmin ? (
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              <Link href="/metrics/new" className="text-accent hover:underline">Create your first metric</Link>, then
              record values here or have a script push them through the API. See <Link href="/api-docs" className="text-accent hover:underline">API docs</Link>.
            </p>
          ) : (
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">An app admin adds metrics. Once they exist, you can record values for them here.</p>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((history) => (
            <li key={history.metric.id}><MetricCard history={history} /></li>
          ))}
        </ul>
      )}
    </>
  );
}
