import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { type TargetStatus, change, formatDelta, formatTarget, formatValue, formatWhen, targetStatus } from "@/lib/kpi";
import type { MetricHistory } from "@/lib/metrics";

const STATUS: Record<TargetStatus, { label: string; className: string }> = {
  on_target: { label: "On target", className: "bg-success-soft text-success" },
  off_target: { label: "Off target", className: "bg-danger-soft text-danger" },
  no_target: { label: "No target", className: "bg-surface text-muted" },
  no_data: { label: "No data", className: "bg-surface text-muted" },
};

export function StatusBadge({ status }: { status: TargetStatus }) {
  const { label, className } = STATUS[status];
  return <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

/** The latest value against the one before it, colored by whether that is better. */
export function Change({ metric, points }: MetricHistory) {
  const difference = change(metric, points.at(-1), points.at(-2));
  if (!difference) return <span className="text-muted">No earlier value</span>;
  const color = { better: "text-success", worse: "text-danger", same: "text-muted" }[difference.verdict];
  const arrow = difference.delta > 0 ? "▲" : difference.delta < 0 ? "▼" : "";
  return (
    <span className={color}>
      {arrow} {difference.delta === 0 ? "No change" : formatDelta(difference.delta, metric.unit)}
      <span className="text-muted"> vs previous</span>
    </span>
  );
}

export function MetricCard({ history }: { history: MetricHistory }) {
  const { metric, points } = history;
  const latest = points.at(-1);
  return (
    <Link href={`/metrics/${metric.key}`}
      className="flex h-full flex-col rounded-md border bg-panel p-5 transition-colors hover:border-accent">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-medium leading-snug">{metric.name}</h2>
        <StatusBadge status={targetStatus(metric, latest)} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {latest ? formatValue(latest.value, metric.unit) : "–"}
      </p>
      <p className="mt-1 text-sm tabular-nums">
        <Change metric={metric} points={points} />
      </p>
      <div className="mt-4 flex-1">
        <Sparkline points={points} />
      </div>
      <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>{metric.target === null ? "No target" : `Target ${formatTarget(metric)}`}</span>
        {metric.owner && <span>Owner: {metric.owner}</span>}
        {latest && <span>Updated {formatWhen(latest.recordedAt)}</span>}
      </p>
    </Link>
  );
}
