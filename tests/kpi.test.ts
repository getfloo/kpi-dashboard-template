import { describe, expect, it } from "vitest";
import {
  change, formatDelta, formatTarget, formatValue, formatWhen, plot, polyline, scaleY, summarize, targetStatus, valueRange,
} from "../lib/kpi";

const higher = { target: 100, direction: "higher" };
const lower = { target: 100, direction: "lower" };

describe("targetStatus", () => {
  it.each([
    [higher, 100, "on_target"],
    [higher, 99, "off_target"],
    [lower, 100, "on_target"],
    [lower, 101, "off_target"],
    [{ target: null, direction: "higher" }, 5, "no_target"],
  ])("%j with %d is %s", (metric, value, status) => {
    expect(targetStatus(metric, { value })).toBe(status);
  });

  it("is no_data without a value", () => {
    expect(targetStatus(higher, undefined)).toBe("no_data");
  });
});

describe("change", () => {
  it("calls a rise better when higher is better, and worse when lower is", () => {
    expect(change(higher, { value: 12 }, { value: 10 })).toEqual({ delta: 2, verdict: "better" });
    expect(change(lower, { value: 12 }, { value: 10 })).toEqual({ delta: 2, verdict: "worse" });
    expect(change(lower, { value: 8 }, { value: 10 })).toEqual({ delta: -2, verdict: "better" });
    expect(change(higher, { value: 10 }, { value: 10 })).toEqual({ delta: 0, verdict: "same" });
  });

  it("is null without two values", () => {
    expect(change(higher, { value: 1 }, undefined)).toBeNull();
  });
});

describe("summarize", () => {
  it("takes the last two points of a chronological history", () => {
    const summary = summarize({ metric: higher, points: [{ value: 90 }, { value: 95 }, { value: 120 }] });
    expect(summary).toEqual({ ...higher, latest: { value: 120 }, previous: { value: 95 }, status: "on_target" });
  });

  it("is empty for a metric without points", () => {
    expect(summarize({ metric: higher, points: [] })).toMatchObject({ latest: null, previous: null, status: "no_data" });
  });
});

describe("formatting", () => {
  it.each([
    [1284, "signups", "1,284 signups"],
    [99.954, "%", "99.95%"],
    [0.4321, "", "0.43"],
    [1234.5, "ms", "1,235 ms"],
  ])("formats %d %s as %s", (value, unit, text) => {
    expect(formatValue(value, unit)).toBe(text);
  });

  it("signs a delta", () => {
    expect(formatDelta(12, "bugs")).toBe("+12 bugs");
    expect(formatDelta(-0.3, "%")).toBe("-0.3%");
    expect(formatDelta(0, "")).toBe("0");
  });

  it("states the target in the metric's direction", () => {
    expect(formatTarget({ ...lower, unit: "ms" })).toBe("≤ 100 ms");
    expect(formatTarget({ ...higher, unit: "" })).toBe("≥ 100");
    expect(formatTarget({ target: null, direction: "higher", unit: "" })).toBe("No target");
  });

  it("shows a time only when the value was not recorded at midnight UTC", () => {
    expect(formatWhen(new Date("2026-10-30T00:00:00Z"))).toBe("Oct 30, 2026");
    expect(formatWhen(new Date("2026-10-30T09:05:00Z"))).toBe("Oct 30, 2026, 09:05 UTC");
  });
});

describe("chart geometry", () => {
  it("pads a flat series so it draws mid-height", () => {
    expect(valueRange([5, 5])).toEqual([4.5, 5.5]);
    expect(valueRange([0, 0])).toEqual([-1, 1]);
    expect(scaleY(5, 100, valueRange([5, 5]))).toBe(50);
  });

  it("maps the lowest value to the bottom and the highest to the top", () => {
    const coordinates = plot([{ x: 0, y: 10 }, { x: 5, y: 20 }, { x: 10, y: 15 }], 200, 50, [10, 20]);
    expect(coordinates).toEqual([{ x: 0, y: 50 }, { x: 100, y: 0 }, { x: 200, y: 25 }]);
    expect(polyline(coordinates)).toBe("0.0,50.0 100.0,0.0 200.0,25.0");
  });

  it("centers a single point", () => {
    expect(plot([{ x: 3, y: 1 }], 200, 50, [0, 2])).toEqual([{ x: 100, y: 25 }]);
  });
});
