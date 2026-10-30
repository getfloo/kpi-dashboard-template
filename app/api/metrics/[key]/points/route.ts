import { readJson, respond } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { PointInput, parse, recordPoints, sourceOf } from "@/lib/metrics";

// The call a scheduled agent makes: POST {"value": 42} to record today's number.
// Contract: ../../openapi.ts.

export function POST(request: Request, context: RouteContext<"/api/metrics/[key]/points">): Promise<Response> {
  const caller = callerFrom(request.headers);
  return respond(async () => {
    const { key } = await context.params;
    const point = parse(PointInput, await readJson(request));
    const [saved] = await recordPoints(sourceOf(caller), [{ metric: key, ...point }]);
    return Response.json({ point: saved }, { status: 201 });
  });
}
