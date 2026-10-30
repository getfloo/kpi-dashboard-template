// Sample metrics with a few weeks of history, so a new dashboard has something to
// show. Run it on purpose, never on deploy: `npm run seed` with DATABASE_URL set,
// or `floo run --service web -- npm run seed` for the dev database. Safe to rerun:
// metrics upsert by key and points by metric and date.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dataPoints, metrics } from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Missing DATABASE_URL. Run floo run --service web -- npm run seed to seed the dev database.");
}

type Sample = {
  key: string;
  name: string;
  unit: string;
  target: number | null;
  direction: "higher" | "lower";
  owner: string;
  every: "day" | "week";
  count: number;
  start: number;
  trend: number;
  noise: number;
  min?: number;
  max?: number;
  digits: number;
};

const SAMPLES: Sample[] = [
  { key: "weekly_signups", name: "Weekly signups", unit: "signups", target: 400, direction: "higher", owner: "Growth",
    every: "week", count: 16, start: 250, trend: 9, noise: 22, digits: 0 },
  { key: "api_uptime", name: "API uptime", unit: "%", target: 99.9, direction: "higher", owner: "Platform",
    every: "day", count: 60, start: 99.93, trend: 0, noise: 0.07, max: 100, digits: 2 },
  { key: "p95_latency_ms", name: "p95 API latency", unit: "ms", target: 300, direction: "lower", owner: "Platform",
    every: "day", count: 60, start: 410, trend: -1.6, noise: 28, digits: 0 },
  { key: "first_response_hours", name: "Support first response", unit: "hours", target: 4, direction: "lower", owner: "Support",
    every: "day", count: 60, start: 6.8, trend: -0.03, noise: 0.7, min: 0.5, digits: 1 },
  { key: "deploys_per_week", name: "Deploys per week", unit: "deploys", target: 20, direction: "higher", owner: "Engineering",
    every: "week", count: 16, start: 11, trend: 0.6, noise: 3, min: 0, digits: 0 },
  { key: "open_bugs", name: "Open bugs", unit: "bugs", target: 25, direction: "lower", owner: "Engineering",
    every: "day", count: 60, start: 48, trend: -0.2, noise: 3, min: 0, digits: 0 },
  { key: "nps", name: "Net promoter score", unit: "", target: 50, direction: "higher", owner: "Customer success",
    every: "week", count: 16, start: 36, trend: 0.5, noise: 4, digits: 0 },
  { key: "onboarding_completion", name: "Onboarding completion", unit: "%", target: null, direction: "higher", owner: "Product",
    every: "week", count: 16, start: 58, trend: 0.8, noise: 3, max: 100, digits: 1 },
];

// Deterministic noise, so a rerun writes the same values.
function noise(seed: string, index: number): number {
  let hash = 2166136261;
  for (const char of `${seed}:${index}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  // Mix the high bits, which FNV leaves nearly equal for neighboring indexes.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

const today = new Date(new Date().toISOString().slice(0, 10));
const DAY = 24 * 60 * 60 * 1000;
const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
  for (const sample of SAMPLES) {
    const fields = {
      name: sample.name, unit: sample.unit, target: sample.target, direction: sample.direction, owner: sample.owner,
    };
    const [metric] = await db.insert(metrics).values({ key: sample.key, ...fields })
      .onConflictDoUpdate({ target: metrics.key, set: { ...fields, updatedAt: new Date() } })
      .returning({ id: metrics.id });
    const step = sample.every === "week" ? 7 * DAY : DAY;
    const rows = Array.from({ length: sample.count }, (_, index) => {
      const raw = sample.start + sample.trend * index + sample.noise * noise(sample.key, index);
      const bounded = Math.min(sample.max ?? Infinity, Math.max(sample.min ?? -Infinity, raw));
      return {
        metricId: metric.id,
        value: Number(bounded.toFixed(sample.digits)),
        recordedAt: new Date(today.getTime() - (sample.count - 1 - index) * step),
        sourceKind: "api_key",
        sourceId: "sample-data",
        sourceName: "Sample data",
      };
    });
    await db.insert(dataPoints).values(rows).onConflictDoUpdate({
      target: [dataPoints.metricId, dataPoints.recordedAt],
      set: { value: sql`excluded.value` },
    });
    console.log(`Seeded ${sample.key}: ${rows.length} values`);
  }
} finally {
  await client.end();
}
