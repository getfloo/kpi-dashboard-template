import { readJson, respond } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { summarize } from "@/lib/kpi";
import { MetricInput, createMetric, listMetrics, parse, requireMetricEditor } from "@/lib/metrics";

// The gateway serves /api only to callers holding an app API key with the "api"
// scope ([[routes]] in floo.app.toml), or an app member's own floo key, and has
// already verified the key. An app API key may create and edit metrics and record
// values; a member's floo key carries their role, so only admins create or edit
// metrics, as on the pages. The contract is in ./openapi.ts.

export function GET(request: Request): Promise<Response> {
  callerFrom(request.headers);
  return respond(async () => {
    const all = await listMetrics(2);
    return Response.json({ metrics: all.map(summarize) });
  });
}

export function POST(request: Request): Promise<Response> {
  const caller = callerFrom(request.headers);
  return respond(async () => {
    requireMetricEditor(caller);
    const input = parse(MetricInput, await readJson(request));
    return Response.json({ metric: await createMetric(input) }, { status: 201 });
  });
}
