import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

describe("committed migration", () => {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  const sql = migrations.flatMap((migration) => migration.sql).join("\n");
  const tables = new Map(Array.from(
    sql.matchAll(/CREATE TABLE "(\w+)"\s*\(([\s\S]*?)\n\);/g),
    ([, name, columns]) => [name, columns],
  ));

  it("creates users with the gateway ID and profile fields", () => {
    expect(tables.get("users")).toMatch(/"id" text PRIMARY KEY NOT NULL/);
    for (const column of ["email", "name", "role", "created_at", "updated_at"]) {
      expect(tables.get("users")).toContain(`"${column}"`);
    }
  });

  it("creates metrics addressed by a unique key", () => {
    expect(tables.get("metrics")).toContain('"key" text NOT NULL');
    expect(tables.get("metrics")).toContain('CONSTRAINT "metrics_key_unique" UNIQUE("key")');
    expect(tables.get("metrics")).toContain('"target" double precision,');
  });

  it("keeps one value per metric and instant, deleted with its metric", () => {
    expect(tables.get("data_points")).toContain('"value" double precision NOT NULL');
    expect(sql).toContain('FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE cascade');
    expect(sql).toContain('CREATE UNIQUE INDEX "data_points_metric_id_recorded_at_idx" ON "data_points" USING btree ("metric_id","recorded_at")');
  });

  it("keeps SQL portable across managed tenant schemas", () => {
    expect(sql).not.toMatch(/"public"\.|CREATE SCHEMA|SET search_path/i);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries).toHaveLength(migrations.length);
    expect(migrations.length).toBeGreaterThan(0);
  });
});
