import { z } from "zod";
import { BulkPointsInput, MAX_BULK_POINTS } from "@/lib/metrics";
import { ApiError, type Operation } from "@/lib/openapi";
import { PointJson } from "../metrics/openapi";

// The contract for ./route.ts, listed in app/api/operations.ts.
export const operations: Operation[] = [
  {
    method: "post",
    path: "/api/points",
    operationId: "recordPoints",
    summary: `Record up to ${MAX_BULK_POINTS} values across metrics in one request. Nothing is saved if any point is invalid.`,
    request: BulkPointsInput,
    responses: {
      201: { description: "The recorded points.", schema: z.object({ points: z.array(PointJson) }) },
      400: { description: "The body is not JSON or a point is invalid; the message names it, like points.3.value.", schema: ApiError },
      404: { description: "A point names a metric key that does not exist.", schema: ApiError },
    },
  },
];
