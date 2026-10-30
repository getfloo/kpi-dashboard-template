import { doublePrecision, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** People who have signed in, synced from the gateway on every page load. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A number the team tracks. `key` is its stable handle in URLs and the API. */
export const metrics = pgTable("metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default(""),
  target: doublePrecision("target"),
  // "higher" or "lower": which way is better. Validated in lib/metrics.ts.
  direction: text("direction").notNull(),
  owner: text("owner").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One value per metric per instant: recording the same recorded_at again replaces
// the value, so a retried scheduled push never double counts. source_id is whatever
// id the gateway asserted: a user's id from a page, or an API consumer's id from /api.
export const dataPoints = pgTable("data_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  metricId: uuid("metric_id").notNull().references(() => metrics.id, { onDelete: "cascade" }),
  value: doublePrecision("value").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  // "user" or "api_key".
  sourceKind: text("source_kind").notNull(),
  sourceId: text("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("data_points_metric_id_recorded_at_idx").on(table.metricId, table.recordedAt)]);
