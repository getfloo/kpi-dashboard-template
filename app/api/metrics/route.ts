import { readJson, respond } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { summarize } from "@/lib/kpi";
import { MetricInput, createMetric, listMetrics, parse } from "@/lib/metrics";

// The gateway serves /api only to callers holding an app API key with the "api"
// scope ([[routes]] in floo.app.toml) and has already verified the key. A key may
// create and edit metrics and record values; roles apply to signed-in people on
// the pages. The contract is in ./openapi.ts.

export function GET(request: Request): Promise<Response> {
  callerFrom(request.headers);
  return respond(async () => {
    const all = await listMetrics(2);
    return Response.json({ metrics: all.map(summarize) });
  });
}

export function POST(request: Request): Promise<Response> {
  callerFrom(request.headers);
  return respond(async () => {
    const input = parse(MetricInput, await readJson(request));
    return Response.json({ metric: await createMetric(input) }, { status: 201 });
  });
}
