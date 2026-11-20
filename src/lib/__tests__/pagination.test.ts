import { describe, expect, it } from "vitest";
import { pageArgs, pageFromParam, pageHref, totalPages } from "@/lib/pagination";

describe("pagination", () => {
  it("parses the page param defensively", () => {
    expect(pageFromParam(undefined)).toBe(1);
    expect(pageFromParam("3")).toBe(3);
    expect(pageFromParam(["4", "9"])).toBe(4);
    expect(pageFromParam("0")).toBe(1);
    expect(pageFromParam("-2")).toBe(1);
    expect(pageFromParam("abc")).toBe(1);
    expect(pageFromParam("99999999")).toBe(10_000);
  });

  it("turns a page into skip/take", () => {
    expect(pageArgs(1)).toEqual({ skip: 0, take: 25 });
    expect(pageArgs(3)).toEqual({ skip: 50, take: 25 });
  });

  it("always has at least one page", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(25)).toBe(1);
    expect(totalPages(26)).toBe(2);
  });

  it("keeps the other filters in the links and omits page 1", () => {
    expect(pageHref("/materias-primas", { q: "agua" }, 2)).toBe("/materias-primas?q=agua&pagina=2");
    expect(pageHref("/materias-primas", { q: "agua" }, 1)).toBe("/materias-primas?q=agua");
    expect(pageHref("/formulas", { q: undefined }, 1)).toBe("/formulas");
  });
});
