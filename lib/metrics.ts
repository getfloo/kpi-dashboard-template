import "server-only";
import { desc, eq, getTableColumns, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { dataPoints, metrics } from "@/db/schema";
import type { Caller } from "@/lib/identity";

export const MAX_BULK_POINTS = 1000;
export const MAX_HISTORY = 1000;

/** Input the caller can fix. The API answers with `status`; forms show the message. */
export class RequestError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

export function metricNotFound(key: string): RequestError {
  return new RequestError(404, `No metric with key "${key}". Create it first with POST /api/metrics.`);
}

// One set of schemas validates the forms and the API, and the OpenAPI document is
// generated from them, so the three cannot drift.

export const MetricKey = z.string({ error: "A metric key is required." })
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, {
    error: "A metric key is 1 to 64 lowercase letters, digits, - or _, starting with a letter or digit.",
  })
  .meta({ description: "The metric's stable handle in URLs and the API. It cannot change.", examples: ["weekly_signups"] });

const Name = z.string({ error: "Give the metric a name." }).trim()
  .min(1, { error: "Give the metric a name." })
  .max(80, { error: "Keep the name under 80 characters." });
const Unit = z.string().trim().max(16, { error: "Keep the unit under 16 characters." })
  .meta({ description: 'Shown after the value, like "signups", "ms" or "%". Empty for a plain number.' });
const Target = z.number({ error: "The target is a number." }).nullable()
  .meta({ description: "The value to reach, or null for no target." });
const Direction = z.enum(["higher", "lower"], { error: 'Direction is "higher" or "lower".' })
  .meta({ description: '"higher" when a bigger number is better (signups), "lower" when a smaller one is (latency).' });
const Owner = z.string().trim().max(80, { error: "Keep the owner under 80 characters." })
  .meta({ description: "Who answers for this metric: a person or a team." });

export const MetricInput = z.object({
  key: MetricKey,
  name: Name,
  unit: Unit.default(""),
  target: Target.default(null),
  direction: Direction,
  owner: Owner.default(""),
});

/** Every field but the key; omitted fields keep their value. */
export const MetricUpdate = z.object({ name: Name, unit: Unit, target: Target, direction: Direction, owner: Owner }).partial();

const RecordedAt = z.union([z.iso.datetime({ offset: true }), z.iso.date()], {
  error: "recordedAt is an ISO 8601 date or date-time, like 2026-10-30 or 2026-10-30T09:00:00Z.",
}).meta({
  description: "When the value was measured; a date means midnight UTC. Defaults to now. "
    + "Sending the same metric and recordedAt again replaces the value, so retries are safe.",
}).transform((value) => new Date(value));

export const PointInput = z.object({
  value: z.number({ error: "The value is a number." }).meta({ description: "The measured value, in the metric's unit." }),
  recordedAt: RecordedAt.optional(),
});

export const BulkPointsInput = z.object({
  points: z.array(PointInput.extend({ metric: MetricKey }), { error: "Send points as an array." })
    .min(1, { error: "Send at least one point." })
    .max(MAX_BULK_POINTS, { error: `Send at most ${MAX_BULK_POINTS} points per request.` }),
});

const LIMIT_ERROR = `limit is a whole number from 1 to ${MAX_HISTORY}.`;
export const HistoryQuery = z.object({
  limit: z.coerce.number({ error: LIMIT_ERROR }).int({ error: LIMIT_ERROR })
    .min(1, { error: LIMIT_ERROR }).max(MAX_HISTORY, { error: LIMIT_ERROR }).default(100)
    .meta({ description: `How many of the most recent points to return, 1 to ${MAX_HISTORY}.` }),
});

export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    // Name the item in a bulk request, like points.3.value; top-level messages name their field.
    const where = issue.path.length > 1 ? `${issue.path.join(".")}: ` : "";
    throw new RequestError(400, where + issue.message);
  }
  return parsed.data;
}

/** Who recorded a value: a signed-in person or the API consumer that holds the key. */
export type Source = { kind: "user" | "api_key"; id: string; name: string };

export function sourceOf(caller: Caller): Source {
  return caller.kind === "user"
    ? { kind: "user", id: caller.id, name: caller.name || caller.email }
    : { kind: "api_key", id: caller.id, name: caller.name || "API key" };
}

export type Metric = typeof metrics.$inferSelect;
export type Point = { id: string; metric: string; value: number; recordedAt: Date; source: Source };
/** A metric and its most recent points, oldest first. */
export type MetricHistory = { metric: Metric; points: Point[] };

function toPoint(row: typeof dataPoints.$inferSelect, metric: string): Point {
  const source = { kind: row.sourceKind as Source["kind"], id: row.sourceId, name: row.sourceName };
  return { id: row.id, metric, value: row.value, recordedAt: row.recordedAt, source };
}

/** Every metric by name, each with its `recent` most recent points, in two queries. */
export async function listMetrics(recent: number): Promise<MetricHistory[]> {
  const db = getDb();
  const all = await db.select().from(metrics).orderBy(metrics.name);
  const ranked = db.select({
    ...getTableColumns(dataPoints),
    rank: sql<number>`row_number() over (partition by ${dataPoints.metricId} order by ${dataPoints.recordedAt} desc)`.as("rank"),
  }).from(dataPoints).as("ranked");
  const rows = await db.select().from(ranked).where(lte(ranked.rank, recent)).orderBy(ranked.recordedAt);
  return all.map((metric) => ({
    metric,
    points: rows.filter((row) => row.metricId === metric.id).map((row) => toPoint(row, metric.key)),
  }));
}

export async function getMetric(key: string, limit: number): Promise<MetricHistory | null> {
  const db = getDb();
  const [metric] = await db.select().from(metrics).where(eq(metrics.key, key));
  if (!metric) return null;
  const rows = await db.select().from(dataPoints).where(eq(dataPoints.metricId, metric.id))
    .orderBy(desc(dataPoints.recordedAt)).limit(limit);
  return { metric, points: rows.reverse().map((row) => toPoint(row, metric.key)) };
}

export async function createMetric(input: z.output<typeof MetricInput>): Promise<Metric> {
  const [metric] = await getDb().insert(metrics).values(input).onConflictDoNothing({ target: metrics.key }).returning();
  if (!metric) throw new RequestError(409, `A metric with key "${input.key}" already exists.`);
  return metric;
}

export async function updateMetric(key: string, changes: z.output<typeof MetricUpdate>): Promise<Metric> {
  const [metric] = await getDb().update(metrics).set({ ...changes, updatedAt: new Date() })
    .where(eq(metrics.key, key)).returning();
  if (!metric) throw metricNotFound(key);
  return metric;
}

/**
 * Records points by metric key in one statement: all or nothing. A point for a metric
 * and instant that already has one replaces it, so a retried push never double counts.
 */
export async function recordPoints(
  source: Source,
  points: { metric: string; value: number; recordedAt?: Date }[],
): Promise<Point[]> {
  const db = getDb();
  const keys = [...new Set(points.map((point) => point.metric))];
  const found = await db.select({ id: metrics.id, key: metrics.key }).from(metrics).where(inArray(metrics.key, keys));
  const idByKey = new Map(found.map((metric) => [metric.key, metric.id]));
  const missing = keys.find((key) => !idByKey.has(key));
  if (missing) throw metricNotFound(missing);

  const now = new Date();
  // Postgres refuses to update one row twice in a statement; the last duplicate wins.
  const rows = new Map(points.map((point) => {
    const row = {
      metricId: idByKey.get(point.metric)!,
      value: point.value,
      recordedAt: point.recordedAt ?? now,
      sourceKind: source.kind,
      sourceId: source.id,
      sourceName: source.name,
    };
    return [`${row.metricId} ${row.recordedAt.toISOString()}`, row];
  }));
  const saved = await db.insert(dataPoints).values([...rows.values()]).onConflictDoUpdate({
    target: [dataPoints.metricId, dataPoints.recordedAt],
    set: {
      value: sql`excluded.value`,
      sourceKind: sql`excluded.source_kind`,
      sourceId: sql`excluded.source_id`,
      sourceName: sql`excluded.source_name`,
      createdAt: sql`now()`,
    },
  }).returning();
  const keyById = new Map(found.map((metric) => [metric.id, metric.key]));
  return saved.map((row) => toPoint(row, keyById.get(row.metricId)!));
}
