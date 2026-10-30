import { readJson, respond } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { summarize } from "@/lib/kpi";
import { HistoryQuery, MetricUpdate, getMetric, metricNotFound, parse, updateMetric } from "@/lib/metrics";

// Contract: ../openapi.ts. Key-authenticated like everything under /api.

export function GET(request: Request, context: RouteContext<"/api/metrics/[key]">): Promise<Response> {
  callerFrom(request.headers);
  return respond(async () => {
    const { key } = await context.params;
    const { limit } = parse(HistoryQuery, Object.fromEntries(new URL(request.url).searchParams));
    const history = await getMetric(key, limit);
    if (!history) throw metricNotFound(key);
    return Response.json({ metric: summarize(history), points: history.points });
  });
}

export function PATCH(request: Request, context: RouteContext<"/api/metrics/[key]">): Promise<Response> {
  callerFrom(request.headers);
  return respond(async () => {
    const { key } = await context.params;
    const changes = parse(MetricUpdate, await readJson(request));
    return Response.json({ metric: await updateMetric(key, changes) });
  });
}
