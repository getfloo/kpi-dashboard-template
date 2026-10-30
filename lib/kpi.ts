// Pure KPI math shared by the dashboard, the metric page and the API, so a card
// and an agent reading /api/metrics always agree on status and change.

export type Direction = "higher" | "lower";
export type TargetStatus = "on_target" | "off_target" | "no_target" | "no_data";

type Goal = { target: number | null; direction: Direction | string };
type Reading = { value: number };

/** Whether the latest value meets the target, in the metric's direction. */
export function targetStatus(metric: Goal, latest: Reading | undefined): TargetStatus {
  if (!latest) return "no_data";
  if (metric.target === null) return "no_target";
  const met = metric.direction === "lower" ? latest.value <= metric.target : latest.value >= metric.target;
  return met ? "on_target" : "off_target";
}

/** The latest value against the one before it; "better" follows the metric's direction. */
export function change(metric: Goal, latest: Reading | undefined, previous: Reading | undefined) {
  if (!latest || !previous) return null;
  const delta = latest.value - previous.value;
  const improved = metric.direction === "lower" ? delta < 0 : delta > 0;
  return { delta, verdict: delta === 0 ? "same" : improved ? "better" : "worse" } as const;
}

/** The latest and previous points and target status of a metric's chronological history. */
export function summarize<M extends Goal, P extends Reading>({ metric, points }: { metric: M; points: P[] }) {
  const latest = points.at(-1);
  return {
    ...metric,
    latest: latest ?? null,
    previous: points.at(-2) ?? null,
    status: targetStatus(metric, latest),
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
}

/** 1,284 signups, 99.9%, 42. */
export function formatValue(value: number, unit: string): string {
  const number = formatNumber(value);
  if (!unit) return number;
  return unit === "%" ? `${number}%` : `${number} ${unit}`;
}

/** +12 signups, -0.3%. */
export function formatDelta(delta: number, unit: string): string {
  return `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formatValue(Math.abs(delta), unit)}`;
}

export function formatTarget(metric: Goal & { unit: string }): string {
  if (metric.target === null) return "No target";
  return `${metric.direction === "lower" ? "≤" : "≥"} ${formatValue(metric.target, metric.unit)}`;
}

/** Oct 30, 2026, plus the time when it is not midnight UTC. Dates are shown in UTC. */
export function formatWhen(date: Date): string {
  const day = date.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) return day;
  return `${day}, ${date.toLocaleTimeString("en-US", { timeStyle: "short", hour12: false, timeZone: "UTC" })} UTC`;
}

/** Today's date in UTC as YYYY-MM-DD, the default for the record form. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A y range that includes every value, padded so a flat series still draws mid-height. */
export function valueRange(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min !== max) return [min, max];
  const pad = Math.abs(min) * 0.1 || 1;
  return [min - pad, max + pad];
}

/** The SVG y of a value in a box `height` tall, with the range's top at 0. */
export function scaleY(value: number, height: number, [min, max]: [number, number]): number {
  return height - ((value - min) / (max - min)) * height;
}

/** Maps (x, y) data into a width x height box, x spread over its own range. Returns SVG coordinates. */
export function plot(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  yRange: [number, number],
): { x: number; y: number }[] {
  const xs = points.map((point) => point.x);
  const xMin = Math.min(...xs);
  const xSpan = Math.max(...xs) - xMin;
  return points.map((point) => ({
    x: xSpan === 0 ? width / 2 : ((point.x - xMin) / xSpan) * width,
    y: scaleY(point.y, height, yRange),
  }));
}

/** An SVG polyline `points` attribute. */
export function polyline(coordinates: { x: number; y: number }[]): string {
  return coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}
