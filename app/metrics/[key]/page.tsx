import Link from "next/link";
import { notFound } from "next/navigation";
import { recordPointAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LineChart } from "@/components/charts";
import { Change, StatusBadge } from "@/components/metric-card";
import { getIdentity } from "@/lib/identity";
import { formatDelta, formatTarget, formatValue, formatWhen, targetStatus, todayUtc } from "@/lib/kpi";
import { getMetric } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/** How many of the most recent values the chart and table show. */
const HISTORY_POINTS = 200;

export default async function MetricPage({ params }: PageProps<"/metrics/[key]">) {
  const { key } = await params;
  const identity = await getIdentity();
  const history = await getMetric(key, HISTORY_POINTS);
  if (!history) notFound();
  const { metric, points } = history;
  const latest = points.at(-1);
  const newestFirst = points.toReversed();
  const appUrl = process.env.FLOO_APP_URL ?? "https://<your-app-url>";

  return (
    <>
      <Link href="/" className="text-sm text-muted hover:text-ink">← Metrics</Link>
      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{metric.name}</h1>
            <StatusBadge status={targetStatus(metric, latest)} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <code>{metric.key}</code>
            <span>{metric.target === null ? "No target" : `Target ${formatTarget(metric)}`}</span>
            <span>{metric.direction === "lower" ? "Lower" : "Higher"} is better</span>
            {metric.owner && <span>Owner: {metric.owner}</span>}
          </p>
        </div>
        {identity.role === "admin" && (
          <Link href={`/metrics/${metric.key}/edit`} className="rounded-sm border bg-panel px-4 py-2 text-sm font-medium hover:border-accent">
            Edit metric
          </Link>
        )}
      </header>

      <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="rounded-md border bg-panel p-5">
          <p className="text-sm text-muted">Latest</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{latest ? formatValue(latest.value, metric.unit) : "–"}</p>
          <p className="mt-1 text-sm tabular-nums"><Change metric={metric} points={points} /></p>
          <div className="mt-6">
            {points.length === 0 ? (
              <p className="rounded-md border border-dashed px-6 py-12 text-center text-sm text-muted">
                No values yet. Record the first one here, or push it from a script with the call below.
              </p>
            ) : (
              <LineChart points={points} target={metric.target} unit={metric.unit} />
            )}
          </div>
        </div>

        <div className="rounded-md border bg-panel p-5">
          <h2 className="font-medium">Record a value</h2>
          <ActionForm action={recordPointAction} submitLabel="Record value" className="mt-4">
            <input type="hidden" name="metric" value={metric.key} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Value{metric.unit && ` (${metric.unit})`}</span>
              <input name="value" type="number" step="any" required className="w-full" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium">Date</span>
              <input name="date" type="date" required defaultValue={todayUtc()} max={todayUtc()} className="w-full" />
              <span className="mt-1 block text-xs text-muted">A date that already has a value is replaced.</span>
            </label>
          </ActionForm>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-lg font-semibold">
          History <span className="ml-1 font-normal text-muted">({points.length === HISTORY_POINTS ? `latest ${HISTORY_POINTS}` : points.length})</span>
        </h2>
        {points.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted">Recorded values appear here, newest first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Date (UTC)</th><th>Value</th><th>Change</th><th>Recorded by</th></tr>
              </thead>
              <tbody>
                {newestFirst.map((point, index) => {
                  const earlier = newestFirst[index + 1];
                  return (
                    <tr key={point.id}>
                      <td className="whitespace-nowrap">{formatWhen(point.recordedAt)}</td>
                      <td className="whitespace-nowrap">{formatValue(point.value, metric.unit)}</td>
                      <td className="whitespace-nowrap text-muted">{earlier ? formatDelta(point.value - earlier.value, metric.unit) : "–"}</td>
                      <td>
                        {point.source.name}
                        {point.source.kind === "api_key" && <span className="ml-2 rounded-sm bg-surface px-1.5 py-0.5 text-xs text-muted">API</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-md border bg-panel p-5" aria-labelledby="api-heading">
        <h2 id="api-heading" className="font-medium">Push values from a script or agent</h2>
        <p className="mt-1 text-sm text-muted">
          Send an app API key holding the <code>api</code> scope. Leave out <code>recordedAt</code> to record now. Every call is in the <Link href="/api-docs" className="text-accent hover:underline">API docs</Link>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-sm bg-surface p-4 text-xs leading-relaxed"><code>{`curl -X POST ${appUrl}/api/metrics/${metric.key}/points \\
  -H "Authorization: Bearer $FLOO_APP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"value": 42, "recordedAt": "${todayUtc()}"}'`}</code></pre>
      </section>
    </>
  );
}
