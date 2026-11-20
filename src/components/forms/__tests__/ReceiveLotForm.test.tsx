// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ReceiveLotForm } from "../ReceiveLotForm";

const mutate = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/trpc/client", () => ({
  trpc: { materials: { receiveLot: { useMutation: () => ({ mutate, isPending: false }) } } },
}));
// The camera is not available in tests; the handheld-scanner text field is.
vi.mock("@/components/batch/QRScanner", () => ({ QRScanner: () => null }));

const materials = [
  { id: "11111111-1111-4111-8111-111111111111", code: "MP-001", name: "Agua Desionizada" },
  { id: "22222222-2222-4222-8222-222222222222", code: "MP-002", name: "Glicerina Vegetal" },
];

function scan(text: string) {
  fireEvent.click(screen.getByRole("button", { name: /leer qr del proveedor/i }));
  const field = screen.getByLabelText(/lector de mano/i);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key: "Enter" });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReceiveLotForm — supplier QR", () => {
  it("fills material, lot, quantity, expiry and COA from a JSON QR", async () => {
    render(<ReceiveLotForm materials={materials} />);
    scan('{"codigo":"MP-002","lote":"GV-55","cantidad":25.5,"vence":"30/06/2027","coa":"https://prov.co/coa.pdf"}');

    expect(await screen.findByText(/QR leído \(JSON\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Materia prima")).toHaveValue(materials[1].id);
    expect(screen.getByLabelText(/código de lote del proveedor/i)).toHaveValue("GV-55");
    expect(screen.getByLabelText(/cantidad recibida/i)).toHaveValue(25.5);
    expect(screen.getByLabelText(/fecha de vencimiento/i)).toHaveValue("2027-06-30");
    expect(screen.getByLabelText(/certificado de análisis/i)).toHaveValue("https://prov.co/coa.pdf");
  });

  it("fills GS1 data and keeps the GTIN as the supplier code", async () => {
    render(<ReceiveLotForm materials={materials} />);
    scan("(01)07701234567893(10)L-77(17)270600(30)40");

    expect(await screen.findByText(/QR leído \(GS1\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código de lote del proveedor/i)).toHaveValue("L-77");
    expect(screen.getByLabelText(/fecha de vencimiento/i)).toHaveValue("2027-06-30");
    expect(screen.getByLabelText(/código del proveedor \(opcional\)/i)).toHaveValue("07701234567893");
  });

  it("warns when the QR names a material that is not in the catalog", async () => {
    render(<ReceiveLotForm materials={materials} />);
    scan("MATERIAL: Carbómero 940\nLOTE: C-1");

    expect(await screen.findByText(/no está en el catálogo/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Materia prima")).toHaveValue("");
    expect(screen.getByLabelText(/código de lote del proveedor/i)).toHaveValue("C-1");
  });

  it("never submits on its own after a scan", async () => {
    render(<ReceiveLotForm materials={materials} />);
    scan('{"codigo":"MP-001","lote":"A","cantidad":1,"vence":"2027-01-01"}');
    await screen.findByText(/QR leído/);
    expect(mutate).not.toHaveBeenCalled();
  });
});
