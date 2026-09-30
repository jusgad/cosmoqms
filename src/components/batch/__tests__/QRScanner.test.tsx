// @vitest-environment jsdom
//
// Review round 1 (Critical) regression test: `Html5Qrcode.isScanning` only
// flips to `true` deep inside `start()`'s async chain, so a real camera
// stream can already be live by the time `start()` resolves even though the
// component unmounted (and ran its cleanup) *before* that resolution. This
// test mocks `html5-qrcode` with a `start()` that resolves only after the
// component has already unmounted, and asserts `stop()` still gets called —
// proving the fix's `.then()` branch (not just the synchronous
// `isScanning`-gated cleanup) is what tears the camera down in that case.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QRScanner } from "../QRScanner";

const stopMock = vi.fn(function (this: { isScanning: boolean }) {
  this.isScanning = false;
  return Promise.resolve();
});
const clearMock = vi.fn();
let startMock: ReturnType<typeof vi.fn>;

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn().mockImplementation(function (this: {
    isScanning: boolean;
    start: typeof startMock;
    stop: typeof stopMock;
    clear: typeof clearMock;
  }) {
    this.isScanning = false;
    this.start = startMock;
    this.stop = stopMock;
    this.clear = clearMock;
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QRScanner", () => {
  it("stops the camera when start() resolves after the component already unmounted", async () => {
    let resolveStart!: () => void;
    startMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveStart = () => resolve(null);
        }),
    );

    const { unmount } = render(<QRScanner onDecode={() => {}} onClose={() => {}} />);

    // Unmount while `start()` is still pending — `isScanning` is still
    // `false` at this instant (nothing in this mock ever flips it before
    // resolution, mirroring the real library's timing), so the synchronous
    // cleanup takes the `clear()`-only branch and must NOT be the only
    // thing relied on to stop the camera.
    unmount();
    expect(stopMock).not.toHaveBeenCalled();

    // Now let `start()` resolve, simulating the camera stream becoming live
    // only after the component is already gone.
    resolveStart();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});
