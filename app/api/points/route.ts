import { readJson, respond } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { BulkPointsInput, parse, recordPoints, sourceOf } from "@/lib/metrics";

// Many values for many metrics in one request, all or nothing. Contract: ./openapi.ts.

export function POST(request: Request): Promise<Response> {
  const caller = callerFrom(request.headers);
  return respond(async () => {
    const { points } = parse(BulkPointsInput, await readJson(request));
    return Response.json({ points: await recordPoints(sourceOf(caller), points) }, { status: 201 });
  });
}
