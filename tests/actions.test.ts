import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));
vi.mock("@/db", () => ({ getDb: () => { throw new Error("tests never open a database"); } }));
vi.mock("@/lib/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/metrics")>()),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  recordPoints: vi.fn(),
}));

import { headers } from "next/headers";
import { createMetricAction, recordPointAction, updateMetricAction } from "../app/actions";
import { RequestError, createMetric, recordPoints, updateMetric } from "../lib/metrics";

function signIn(role: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({
    "X-Floo-User-Id": "user-123",
    "X-Floo-User-Email": "pat@example.com",
    "X-Floo-User-Name": "Pat",
    "X-Floo-User-Role": role,
  }) as Awaited<ReturnType<typeof headers>>);
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const metricForm = form({ key: "open_bugs", name: "Open bugs", unit: "bugs", target: "", direction: "lower", owner: "" });

beforeEach(() => vi.clearAllMocks());

describe("creating and editing metrics", () => {
  it("is refused for a member, whatever the form sends", async () => {
    signIn("member");
    expect(await createMetricAction(null, metricForm)).toEqual({ error: "Only app admins can create or edit metrics." });
    expect(await updateMetricAction(null, metricForm)).toEqual({ error: "Only app admins can create or edit metrics." });
    expect(createMetric).not.toHaveBeenCalled();
    expect(updateMetric).not.toHaveBeenCalled();
  });

  it("creates the metric for an admin and opens its page; an empty target means none", async () => {
    signIn("admin");
    vi.mocked(createMetric).mockResolvedValue({ key: "open_bugs" } as Awaited<ReturnType<typeof createMetric>>);
    await expect(createMetricAction(null, metricForm)).rejects.toThrow("redirect:/metrics/open_bugs");
    expect(createMetric).toHaveBeenCalledWith({
      key: "open_bugs", name: "Open bugs", unit: "bugs", target: null, direction: "lower", owner: "",
    });
  });

  it("shows a taken key as a form error", async () => {
    signIn("admin");
    vi.mocked(createMetric).mockRejectedValue(new RequestError(409, 'A metric with key "open_bugs" already exists.'));
    expect(await createMetricAction(null, metricForm)).toEqual({ error: 'A metric with key "open_bugs" already exists.' });
  });
});

describe("recording a value", () => {
  it("is open to members and credits the signed-in person", async () => {
    signIn("member");
    vi.mocked(recordPoints).mockResolvedValue([]);
    const result = await recordPointAction(null, form({ metric: "open_bugs", value: "31", date: "2026-10-30" }));
    expect(result).toEqual({ savedAt: expect.any(Number) });
    expect(recordPoints).toHaveBeenCalledWith({ kind: "user", id: "user-123", name: "Pat" }, [
      { metric: "open_bugs", value: 31, recordedAt: new Date("2026-10-30T00:00:00Z") },
    ]);
  });

  it("asks for a number when the value is empty", async () => {
    signIn("member");
    expect(await recordPointAction(null, form({ metric: "open_bugs", value: "", date: "2026-10-30" })))
      .toEqual({ error: "The value is a number." });
    expect(recordPoints).not.toHaveBeenCalled();
  });
});
