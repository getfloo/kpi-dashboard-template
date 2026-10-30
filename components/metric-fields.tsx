import type { Metric } from "@/lib/metrics";

const label = "mb-1.5 block text-sm font-medium";
const hint = "mt-1 block text-xs text-muted";

/** The fields of the create and edit forms. The key is set once, on create. */
export function MetricFields({ metric }: { metric?: Metric }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className={label}>Name</span>
        <input name="name" required maxLength={80} defaultValue={metric?.name} placeholder="Weekly signups" className="w-full" />
      </label>
      {metric ? (
        <div className="sm:col-span-2">
          <span className={label}>Key</span>
          <input type="hidden" name="key" value={metric.key} />
          <code className="text-sm">{metric.key}</code>
          <span className={hint}>The key is how the API and URLs address this metric, so it cannot change.</span>
        </div>
      ) : (
        <label className="sm:col-span-2">
          <span className={label}>Key</span>
          <input name="key" required maxLength={64} pattern="[a-z0-9][a-z0-9_\-]*" placeholder="weekly_signups"
            className="w-full font-mono text-sm" />
          <span className={hint}>Lowercase letters, digits, - and _. Scripts push values to this key; it cannot change later.</span>
        </label>
      )}
      <label>
        <span className={label}>Unit</span>
        <input name="unit" maxLength={16} defaultValue={metric?.unit} placeholder="signups, ms, %" className="w-full" />
      </label>
      <label>
        <span className={label}>Owner</span>
        <input name="owner" maxLength={80} defaultValue={metric?.owner} placeholder="Growth team" className="w-full" />
      </label>
      <label>
        <span className={label}>Target</span>
        <input name="target" type="number" step="any" defaultValue={metric?.target ?? undefined} placeholder="Optional"
          className="w-full" />
      </label>
      <label>
        <span className={label}>Better when the number is</span>
        <select name="direction" defaultValue={metric?.direction ?? "higher"} className="w-full">
          <option value="higher">Higher (signups, uptime)</option>
          <option value="lower">Lower (latency, open bugs)</option>
        </select>
      </label>
    </div>
  );
}
