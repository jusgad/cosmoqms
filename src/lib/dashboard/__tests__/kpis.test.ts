import { describe, it, expect } from "vitest";
import { averageStageDurations, formatDuration, monthlyOutcomes, qcPassRate, windowStart } from "../kpis";

const at = (iso: string) => new Date(iso);

describe("monthlyOutcomes", () => {
  const now = new Date(2026, 10, 19); // 19 nov 2026, local time

  it("builds the last six months, oldest first, ending in the current month", () => {
    const months = monthlyOutcomes(now, [], []);
    expect(months.map((m) => m.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(months.map((m) => m.label)).toEqual(["jun", "jul", "ago", "sep", "oct", "nov"]);
  });

  it("counts releases and rejections into their month and ignores anything outside the window", () => {
    const months = monthlyOutcomes(
      now,
      [new Date(2026, 10, 2), new Date(2026, 10, 18), new Date(2026, 6, 1), new Date(2026, 4, 30)],
      [new Date(2026, 10, 5), new Date(2025, 10, 5)],
    );
    expect(months.find((m) => m.key === "2026-11")).toMatchObject({ liberados: 2, rechazados: 1 });
    expect(months.find((m) => m.key === "2026-07")).toMatchObject({ liberados: 1, rechazados: 0 });
    expect(months.reduce((sum, m) => sum + m.liberados + m.rechazados, 0)).toBe(4);
  });

  it("spans a year boundary", () => {
    expect(windowStart(new Date(2026, 1, 10), 6)).toEqual(new Date(2025, 8, 1));
  });
});

describe("averageStageDurations", () => {
  const order = {
    firstWeighingAt: at("2026-11-01T08:00:00Z"),
    signatures: [
      { stage: "pesado", signedAt: at("2026-11-01T10:00:00Z") },
      { stage: "mezclado", signedAt: at("2026-11-01T14:00:00Z") },
      { stage: "envasado", signedAt: at("2026-11-02T14:00:00Z") },
      { stage: "calidad", signedAt: at("2026-11-03T09:00:00Z") },
      { stage: "liberado", signedAt: at("2026-11-04T14:00:00Z") },
    ],
  };

  it("measures each stage from the previous sign-off to its own", () => {
    const durations = averageStageDurations([order]);
    expect(durations).toEqual([
      { stage: "pesado", averageHours: 2, samples: 1 },
      { stage: "mezclado", averageHours: 4, samples: 1 },
      { stage: "envasado", averageHours: 24, samples: 1 },
      { stage: "calidad", averageHours: 48, samples: 1 },
    ]);
  });

  it("averages across orders and ends the quality stage at a rejection too", () => {
    const rejectedOrder = {
      firstWeighingAt: at("2026-11-10T08:00:00Z"),
      signatures: [
        { stage: "pesado", signedAt: at("2026-11-10T12:00:00Z") },
        { stage: "mezclado", signedAt: at("2026-11-10T14:00:00Z") },
        { stage: "envasado", signedAt: at("2026-11-11T14:00:00Z") },
        { stage: "rechazado", signedAt: at("2026-11-11T20:00:00Z") },
      ],
    };
    const durations = averageStageDurations([order, rejectedOrder]);
    expect(durations[0]).toEqual({ stage: "pesado", averageHours: 3, samples: 2 });
    expect(durations[3]).toEqual({ stage: "calidad", averageHours: 27, samples: 2 });
  });

  it("skips stages that have not finished yet", () => {
    const inProgress = { firstWeighingAt: at("2026-11-10T08:00:00Z"), signatures: [] };
    expect(averageStageDurations([inProgress]).every((d) => d.averageHours === null && d.samples === 0)).toBe(true);
  });
});

describe("qcPassRate", () => {
  it("has no rate without results", () => {
    expect(qcPassRate([])).toEqual({ total: 0, passed: 0, rate: null });
  });

  it("is the share of conforming results", () => {
    expect(qcPassRate([{ result: "pass" }, { result: "pass" }, { result: "pass" }, { result: "fail" }])).toEqual({
      total: 4,
      passed: 3,
      rate: 0.75,
    });
  });
});

describe("formatDuration", () => {
  it.each([
    [0.25, "15 min"],
    [6.5, "6,5 h"],
    [55, "2,3 días"],
  ])("formats %s hours as %s", (hours, expected) => {
    expect(formatDuration(hours)).toBe(expected);
  });
});
