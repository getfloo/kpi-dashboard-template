import { z } from "zod";
import { HistoryQuery, MetricInput, MetricKey, MetricUpdate, PointInput } from "@/lib/metrics";
import { ApiError, type Operation } from "@/lib/openapi";

/** A metric as the API returns it. */
export const MetricJson = z.object({
  id: z.uuid().meta({ description: "Internal id. Address metrics by key." }),
  key: MetricKey,
  name: z.string(),
  unit: z.string(),
  target: z.number().nullable(),
  direction: z.enum(["higher", "lower"]),
  owner: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** A recorded value as the API returns it. */
export const PointJson = z.object({
  id: z.uuid(),
  metric: MetricKey,
  value: z.number(),
  recordedAt: z.iso.datetime(),
  source: z.object({
    kind: z.enum(["user", "api_key"]),
    id: z.string().meta({ description: "The user id, or the API consumer id that holds the key." }),
    name: z.string(),
  }).meta({ description: "Who recorded the value." }),
});

/** What the dashboard card shows: the metric, its last two values and its target status. */
export const MetricSummaryJson = MetricJson.extend({
  latest: PointJson.nullable(),
  previous: PointJson.nullable(),
  status: z.enum(["on_target", "off_target", "no_target", "no_data"])
    .meta({ description: "Whether the latest value meets the target in the metric's direction." }),
});

const KeyParam = z.object({ key: MetricKey });
const notFound = { description: "No metric has this key.", schema: ApiError };

// The contract for ./route.ts, ./[key]/route.ts and ./[key]/points/route.ts. Listed
// in app/api/operations.ts; the tests fail if a handler is missing here or a
// response stops matching.
export const operations: Operation[] = [
  {
    method: "get",
    path: "/api/metrics",
    operationId: "listMetrics",
    summary: "List every metric with its latest value, the value before it, and its target status.",
    responses: { 200: { description: "Every metric, by name.", schema: z.object({ metrics: z.array(MetricSummaryJson) }) } },
  },
  {
    method: "post",
    path: "/api/metrics",
    operationId: "createMetric",
    summary: "Create a metric.",
    request: MetricInput,
    responses: {
      201: { description: "The created metric.", schema: z.object({ metric: MetricJson }) },
      400: { description: "The body is not JSON or a field is invalid.", schema: ApiError },
      409: { description: "A metric with this key already exists.", schema: ApiError },
    },
  },
  {
    method: "get",
    path: "/api/metrics/{key}",
    operationId: "getMetric",
    summary: "Get a metric with its most recent points, oldest first.",
    params: KeyParam,
    query: HistoryQuery,
    responses: {
      200: {
        description: "The metric and its history.",
        schema: z.object({ metric: MetricSummaryJson, points: z.array(PointJson) }),
      },
      400: { description: "limit is not a whole number from 1 to 1000.", schema: ApiError },
      404: notFound,
    },
  },
  {
    method: "patch",
    path: "/api/metrics/{key}",
    operationId: "updateMetric",
    summary: "Change a metric's name, unit, target, direction or owner. Omitted fields keep their value.",
    params: KeyParam,
    request: MetricUpdate,
    responses: {
      200: { description: "The updated metric.", schema: z.object({ metric: MetricJson }) },
      400: { description: "The body is not JSON or a field is invalid.", schema: ApiError },
      404: notFound,
    },
  },
  {
    method: "post",
    path: "/api/metrics/{key}/points",
    operationId: "recordPoint",
    summary: "Record one value for a metric. The same recordedAt again replaces it.",
    params: KeyParam,
    request: PointInput,
    responses: {
      201: { description: "The recorded point.", schema: z.object({ point: PointJson }) },
      400: { description: "The body is not JSON, value is not a number, or recordedAt is not ISO 8601.", schema: ApiError },
      404: notFound,
    },
  },
];
