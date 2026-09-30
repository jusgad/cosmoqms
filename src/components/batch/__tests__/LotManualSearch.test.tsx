// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LotManualSearch, type LotOption } from "../LotManualSearch";

// `@testing-library/react`'s auto-cleanup only self-registers when it finds
// a *global* `afterEach` (e.g. `test.globals: true`); this project's vitest
// config intentionally keeps globals off (explicit imports throughout the
// existing suite), so each render is unmounted by hand between tests.
afterEach(cleanup);

const lots = [
  { id: "l1", rawMaterialName: "Glicerina", supplierLotCode: "SUP-1", supplierName: "Acme" },
  { id: "l2", rawMaterialName: "Agua desionizada", supplierLotCode: "SUP-2", supplierName: "Hydro" },
];

describe("LotManualSearch", () => {
  it("filters the list as the user types a raw material name", () => {
    render(<LotManualSearch lots={lots} onSelect={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "glic" } });
    expect(screen.getByText(/Glicerina/)).toBeInTheDocument();
    expect(screen.queryByText(/Agua desionizada/)).not.toBeInTheDocument();
  });

  it("calls onSelect with the matching lot when a result is clicked", () => {
    let selected: LotOption | null = null;
    render(<LotManualSearch lots={lots} onSelect={(lot) => (selected = lot)} />);
    fireEvent.click(screen.getByRole("button", { name: /Agua desionizada/ }));
    expect(selected).toEqual(lots[1]);
  });

  it("renders every lot with an empty query, with no camera permission involved", () => {
    render(<LotManualSearch lots={lots} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Glicerina/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agua desionizada/ })).toBeInTheDocument();
  });
});
