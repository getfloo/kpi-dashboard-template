import { formatValue, formatWhen, plot, polyline, scaleY, valueRange } from "@/lib/kpi";

type Point = { value: number; recordedAt: Date };

/** A small trend line for a dashboard card: the shape only, no axes. */
export function Sparkline({ points }: { points: Point[] }) {
  const width = 240;
  const height = 48;
  if (points.length < 2) {
    return <div className="flex h-12 items-center text-xs text-muted">Not enough values for a trend yet.</div>;
  }
  const values = points.map((point) => point.value);
  // Evenly spaced by index: a sparkline shows direction, not timing.
  const coordinates = plot(values.map((y, x) => ({ x, y })), width, height - 4, valueRange(values))
    .map(({ x, y }) => ({ x, y: y + 2 }));
  const last = coordinates.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-12 w-full text-accent" aria-hidden="true">
      <polyline points={polyline(coordinates)} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="2.5" fill="currentColor" />
    </svg>
  );
}

/** The metric page chart: values over time with the target as a dashed line. */
export function LineChart({ points, target, unit }: { points: Point[]; target: number | null; unit: string }) {
  const width = 720;
  const height = 260;
  const left = 64;
  const right = 16;
  const top = 16;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const values = points.map((point) => point.value);
  // Include the target so its line is always on the chart.
  const range = valueRange(target === null ? values : [...values, target]);
  const yOf = (value: number) => top + scaleY(value, plotHeight, range);
  // Spaced by time, so a gap between values shows as a gap.
  const coordinates = plot(points.map((point) => ({ x: point.recordedAt.getTime(), y: point.value })), plotWidth, plotHeight, range)
    .map(({ x, y }) => ({ x: x + left, y: y + top }));
  const ticks = [range[1], (range[0] + range[1]) / 2, range[0]];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img"
      aria-label={`Chart of ${points.length} values from ${formatWhen(points[0].recordedAt)} to ${formatWhen(points.at(-1)!.recordedAt)}`}>
      <g className="text-line">
        {ticks.map((tick) => (
          <line key={tick} x1={left} x2={width - right} y1={yOf(tick)} y2={yOf(tick)} stroke="currentColor" />
        ))}
      </g>
      <g className="fill-muted text-[11px]">
        {ticks.map((tick) => (
          <text key={tick} x={left - 8} y={yOf(tick) + 4} textAnchor="end">{formatValue(tick, unit)}</text>
        ))}
        <text x={left} y={height - 8}>{formatWhen(points[0].recordedAt)}</text>
        {points.length > 1 && <text x={width - right} y={height - 8} textAnchor="end">{formatWhen(points.at(-1)!.recordedAt)}</text>}
      </g>
      {target !== null && (
        <g className="text-success">
          <line x1={left} x2={width - right} y1={yOf(target)} y2={yOf(target)} stroke="currentColor" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={width - right} y={yOf(target) - 6} textAnchor="end" className="fill-success text-[11px]">Target {formatValue(target, unit)}</text>
        </g>
      )}
      <g className="text-accent">
        {points.length > 1 && (
          <polyline points={polyline(coordinates)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.length <= 60 && coordinates.map(({ x, y }, index) => (
          <circle key={index} cx={x} cy={y} r="3" fill="currentColor">
            <title>{`${formatWhen(points[index].recordedAt)}: ${formatValue(points[index].value, unit)}`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}
