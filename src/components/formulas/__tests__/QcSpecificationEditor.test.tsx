// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QcSpecificationEditor } from "../QcSpecificationEditor";

const addMutate = vi.fn();
const removeMutate = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    formulas: {
      addSpecification: { useMutation: () => ({ mutate: addMutate, isPending: false }) },
      removeSpecification: { useMutation: () => ({ mutate: removeMutate, isPending: false }) },
    },
  },
}));

const FORMULA_ID = "550e8400-e29b-41d4-a716-446655440000";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QcSpecificationEditor", () => {
  it("lists the specs with their range", () => {
    render(
      <QcSpecificationEditor
        formulaId={FORMULA_ID}
        specs={[{ id: "s1", parameter: "Viscosidad", minValue: 8000, maxValue: 12000, unit: "cP" }]}
      />,
    );
    expect(screen.getByText("Viscosidad")).toBeInTheDocument();
    expect(screen.getByText("8000 – 12000 cP")).toBeInTheDocument();
  });

  it("sends a new spec, accepting a decimal comma", () => {
    render(<QcSpecificationEditor formulaId={FORMULA_ID} specs={[]} />);
    fireEvent.change(screen.getByLabelText("Parámetro"), { target: { value: "pH" } });
    fireEvent.change(screen.getByLabelText("Mínimo"), { target: { value: "5,5" } });
    fireEvent.change(screen.getByLabelText("Máximo"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(addMutate).toHaveBeenCalledWith({ formulaId: FORMULA_ID, parameter: "pH", minValue: 5.5, maxValue: 7, unit: undefined });
  });

  it("shows the validation message and sends nothing for an inverted range", () => {
    render(<QcSpecificationEditor formulaId={FORMULA_ID} specs={[]} />);
    fireEvent.change(screen.getByLabelText("Parámetro"), { target: { value: "pH" } });
    fireEvent.change(screen.getByLabelText("Mínimo"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Máximo"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(screen.getByText(/mínimo no puede ser mayor/)).toBeInTheDocument();
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("removes a spec", () => {
    render(
      <QcSpecificationEditor formulaId={FORMULA_ID} specs={[{ id: "s1", parameter: "pH", minValue: 5.5, maxValue: 7, unit: null }]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quitar especificación pH" }));
    expect(removeMutate).toHaveBeenCalledWith({ id: "s1" });
  });
});
