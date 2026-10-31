CREATE TABLE "data_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"target" double precision,
	"direction" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_points_metric_id_recorded_at_idx" ON "data_points" USING btree ("metric_id","recorded_at");