import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/db", () => ({ getDb: () => { throw new Error("tests never open a database"); } }));
vi.mock("@/lib/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/metrics")>()),
  listMetrics: vi.fn(),
  getMetric: vi.fn(),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  recordPoints: vi.fn(),
}));

import { operations } from "../app/api/operations";
import * as metricRoute from "../app/api/metrics/[key]/route";
import { POST as recordOne } from "../app/api/metrics/[key]/points/route";
import * as metricsRoute from "../app/api/metrics/route";
import { POST as recordMany } from "../app/api/points/route";
import { RequestError, createMetric, getMetric, listMetrics, recordPoints, updateMetric } from "../lib/metrics";

const keyHeaders = {
  "X-Floo-Auth-Method": "api_key",
  "X-Floo-Api-Consumer-Id": "consumer-9",
  "X-Floo-Api-Consumer-Name": "nightly-agent",
  "X-Floo-Api-Key-Id": "key-42",
  "X-Floo-Api-Key-Scopes": "api",
};
const agent = { kind: "api_key", id: "consumer-9", name: "nightly-agent" };

const metric = {
  id: "0b8f3c2e-6a1d-4f5b-9c7e-2d4a6b8c0e1f",
  key: "weekly_signups",
  name: "Weekly signups",
  unit: "signups",
  target: 400,
  direction: "higher",
  owner: "Growth",
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};
const point = (value: number, day: string) => ({
  id: "6f1c1d1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f",
  metric: "weekly_signups",
  value,
  recordedAt: new Date(`${day}T00:00:00Z`),
  source: { kind: "api_key" as const, id: "consumer-9", name: "nightly-agent" },
});

const request = (path: string, method = "GET", body?: BodyInit) =>
  new Request(`http://app${path}`, { method, headers: keyHeaders, body });
const params = (key: string) => ({ params: Promise.resolve({ key }) });

// Every response a handler gives must match what the OpenAPI document declares.
async function expectDocumented(method: string, path: string, response: Response): Promise<unknown> {
  const operation = operations.find((candidate) => candidate.method === method && candidate.path === path);
  const declared = operation?.responses[response.status];
  expect(declared?.schema, `${method.toUpperCase()} ${path} ${response.status} is not documented`).toBeDefined();
  const body: unknown = await response.json();
  declared?.schema?.parse(body);
  return body;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/metrics", () => {
  it("lists metrics with their latest value, the one before it and target status", async () => {
    vi.mocked(listMetrics).mockResolvedValue([{ metric, points: [point(380, "2026-10-23"), point(412, "2026-10-30")] }]);
    const response = await metricsRoute.GET(request("/api/metrics"));
    expect(response.status).toBe(200);
    const body = await expectDocumented("get", "/api/metrics", response);
    expect(body).toMatchObject({
      metrics: [{ key: "weekly_signups", status: "on_target", latest: { value: 412 }, previous: { value: 380 } }],
    });
    expect(listMetrics).toHaveBeenCalledWith(2);
  });

  it("refuses a request that did not come through the gateway", () => {
    expect(() => metricsRoute.GET(new Request("http://app/api/metrics"))).toThrow("did not come through the floo gateway");
  });
});

describe("POST /api/metrics", () => {
  it("creates a metric, filling the optional fields", async () => {
    vi.mocked(createMetric).mockResolvedValue(metric);
    const response = await metricsRoute.POST(request("/api/metrics", "POST",
      JSON.stringify({ key: "weekly_signups", name: " Weekly signups ", direction: "higher" })));
    expect(response.status).toBe(201);
    await expectDocumented("post", "/api/metrics", response);
    expect(createMetric).toHaveBeenCalledWith({
      key: "weekly_signups", name: "Weekly signups", unit: "", target: null, direction: "higher", owner: "",
    });
  });

  it.each([
    [{ key: "Weekly Signups", name: "x", direction: "higher" }, "A metric key is 1 to 64 lowercase"],
    [{ key: "signups", name: "", direction: "higher" }, "Give the metric a name."],
    [{ key: "signups", name: "Signups", direction: "up" }, 'Direction is "higher" or "lower".'],
  ])("answers invalid input %j with 400", async (input, message) => {
    const response = await metricsRoute.POST(request("/api/metrics", "POST", JSON.stringify(input)));
    expect(response.status).toBe(400);
    expect(await expectDocumented("post", "/api/metrics", response)).toEqual({ error: expect.stringContaining(message) });
    expect(createMetric).not.toHaveBeenCalled();
  });

  it("answers a taken key with 409", async () => {
    vi.mocked(createMetric).mockRejectedValue(new RequestError(409, 'A metric with key "weekly_signups" already exists.'));
    const response = await metricsRoute.POST(request("/api/metrics", "POST",
      JSON.stringify({ key: "weekly_signups", name: "Signups", direction: "higher" })));
    expect(response.status).toBe(409);
    await expectDocumented("post", "/api/metrics", response);
  });
});

describe("GET /api/metrics/{key}", () => {
  it("returns the metric and its history, oldest first", async () => {
    vi.mocked(getMetric).mockResolvedValue({ metric, points: [point(380, "2026-10-23"), point(390, "2026-10-30")] });
    const response = await metricRoute.GET(request("/api/metrics/weekly_signups?limit=30"), params("weekly_signups"));
    expect(response.status).toBe(200);
    const body = await expectDocumented("get", "/api/metrics/{key}", response);
    expect(body).toMatchObject({ metric: { status: "off_target" }, points: [{ value: 380 }, { value: 390 }] });
    expect(getMetric).toHaveBeenCalledWith("weekly_signups", 30);
  });

  it("defaults to the latest 100 points", async () => {
    vi.mocked(getMetric).mockResolvedValue({ metric, points: [] });
    await metricRoute.GET(request("/api/metrics/weekly_signups"), params("weekly_signups"));
    expect(getMetric).toHaveBeenCalledWith("weekly_signups", 100);
  });

  it("answers an unknown key with 404", async () => {
    vi.mocked(getMetric).mockResolvedValue(null);
    const response = await metricRoute.GET(request("/api/metrics/nope"), params("nope"));
    expect(response.status).toBe(404);
    await expectDocumented("get", "/api/metrics/{key}", response);
  });

  it.each(["0", "1001", "ten"])("answers limit=%s with 400", async (limit) => {
    const response = await metricRoute.GET(request(`/api/metrics/weekly_signups?limit=${limit}`), params("weekly_signups"));
    expect(response.status).toBe(400);
    await expectDocumented("get", "/api/metrics/{key}", response);
    expect(getMetric).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/metrics/{key}", () => {
  it("changes only the fields sent", async () => {
    vi.mocked(updateMetric).mockResolvedValue({ ...metric, target: 450 });
    const response = await metricRoute.PATCH(request("/api/metrics/weekly_signups", "PATCH", JSON.stringify({ target: 450 })),
      params("weekly_signups"));
    expect(response.status).toBe(200);
    await expectDocumented("patch", "/api/metrics/{key}", response);
    expect(updateMetric).toHaveBeenCalledWith("weekly_signups", { target: 450 });
  });
});

describe("POST /api/metrics/{key}/points", () => {
  const post = (body: BodyInit) =>
    recordOne(request("/api/metrics/weekly_signups/points", "POST", body), params("weekly_signups"));

  it("records a value for the key consumer", async () => {
    vi.mocked(recordPoints).mockResolvedValue([point(412, "2026-10-30")]);
    const response = await post(JSON.stringify({ value: 412, recordedAt: "2026-10-30" }));
    expect(response.status).toBe(201);
    await expectDocumented("post", "/api/metrics/{key}/points", response);
    expect(recordPoints).toHaveBeenCalledWith(agent, [
      { metric: "weekly_signups", value: 412, recordedAt: new Date("2026-10-30T00:00:00Z") },
    ]);
  });

  it("records now when recordedAt is left out", async () => {
    vi.mocked(recordPoints).mockResolvedValue([point(412, "2026-10-30")]);
    await post(JSON.stringify({ value: 412 }));
    expect(recordPoints).toHaveBeenCalledWith(agent, [{ metric: "weekly_signups", value: 412 }]);
  });

  it("accepts a date-time with an offset", async () => {
    vi.mocked(recordPoints).mockResolvedValue([point(412, "2026-10-30")]);
    await post(JSON.stringify({ value: 1, recordedAt: "2026-10-30T09:30:00+02:00" }));
    expect(vi.mocked(recordPoints).mock.calls[0][1][0].recordedAt).toEqual(new Date("2026-10-30T07:30:00Z"));
  });

  it.each([
    ["not JSON", "not json", "Send a JSON body"],
    ["a string value", JSON.stringify({ value: "412" }), "The value is a number."],
    ["a missing value", JSON.stringify({}), "The value is a number."],
    ["a local time without an offset", JSON.stringify({ value: 1, recordedAt: "2026-10-30T09:00:00" }), "recordedAt is an ISO 8601"],
  ])("answers %s with 400", async (_label, body, message) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await expectDocumented("post", "/api/metrics/{key}/points", response)).toEqual({ error: expect.stringContaining(message) });
    expect(recordPoints).not.toHaveBeenCalled();
  });

  it("answers an unknown metric with 404", async () => {
    vi.mocked(recordPoints).mockRejectedValue(new RequestError(404, 'No metric with key "weekly_signups".'));
    const response = await post(JSON.stringify({ value: 1 }));
    expect(response.status).toBe(404);
    await expectDocumented("post", "/api/metrics/{key}/points", response);
  });
});

describe("POST /api/points", () => {
  const post = (body: unknown) => recordMany(request("/api/points", "POST", JSON.stringify(body)));

  it("records many values across metrics in one call", async () => {
    vi.mocked(recordPoints).mockResolvedValue([point(1, "2026-10-29"), point(2, "2026-10-30")]);
    const response = await post({ points: [
      { metric: "weekly_signups", value: 1, recordedAt: "2026-10-29" },
      { metric: "open_bugs", value: 2 },
    ] });
    expect(response.status).toBe(201);
    await expectDocumented("post", "/api/points", response);
    expect(recordPoints).toHaveBeenCalledWith(agent, [
      { metric: "weekly_signups", value: 1, recordedAt: new Date("2026-10-29T00:00:00Z") },
      { metric: "open_bugs", value: 2 },
    ]);
  });

  it("names the invalid point and saves nothing", async () => {
    const response = await post({ points: [{ metric: "a", value: 1 }, { metric: "b", value: "x" }] });
    expect(response.status).toBe(400);
    expect(await expectDocumented("post", "/api/points", response)).toEqual({ error: "points.1.value: The value is a number." });
    expect(recordPoints).not.toHaveBeenCalled();
  });

  it.each([[{ points: [] }, "Send at least one point."], [{}, "Send points as an array."]])(
    "answers %j with 400",
    async (body, message) => {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await expectDocumented("post", "/api/points", response)).toEqual({ error: message });
    },
  );

  it("refuses more than 1000 points", async () => {
    const response = await post({ points: Array.from({ length: 1001 }, () => ({ metric: "a", value: 1 })) });
    expect(response.status).toBe(400);
    expect(recordPoints).not.toHaveBeenCalled();
  });
});
