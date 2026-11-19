import { describe, it, expect, vi, beforeEach } from "vitest";

const reportError = vi.hoisted(() => vi.fn((error: unknown, context: Record<string, string>) => void [error, context]));
vi.mock("@/lib/observability", () => ({ reportError }));

import { emailConfigFromEnv, renderNotificationEmail, sendEmails } from "../email";
import type { PendingEmail } from "../notify";

const email: PendingEmail = {
  notificationId: "n1",
  tenantId: "t1",
  to: "calidad@lab.co",
  title: "QC fuera de especificación en OP-2026-001",
  body: "pH: 8.9 <script>alert(1)</script>",
  link: "/produccion/po1",
};

const config = { apiKey: "re_test", from: "CosmoQMS <alertas@lab.co>", appUrl: "https://cosmoqms.test" };

describe("emailConfigFromEnv", () => {
  it("is disabled until both the API key and the sender are configured", () => {
    expect(emailConfigFromEnv({ NODE_ENV: "test" })).toBeNull();
    expect(emailConfigFromEnv({ NODE_ENV: "test", RESEND_API_KEY: "re_x" })).toBeNull();
  });

  it("strips a trailing slash from the app URL", () => {
    expect(
      emailConfigFromEnv({
        NODE_ENV: "test",
        RESEND_API_KEY: "re_x",
        NOTIFICATIONS_FROM_EMAIL: "a@b.co",
        NEXT_PUBLIC_APP_URL: "https://cosmoqms.test/",
      }),
    ).toEqual({ apiKey: "re_x", from: "a@b.co", appUrl: "https://cosmoqms.test" });
  });
});

describe("renderNotificationEmail", () => {
  it("escapes user-controlled text and links back to the app", () => {
    const html = renderNotificationEmail(email, config.appUrl);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://cosmoqms.test/produccion/po1"');
  });
});

describe("sendEmails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts each email to Resend and returns the ids that were accepted", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void [url, init];
      return new Response("{}", { status: 200 });
    });
    const sent = await sendEmails([email], config, fetchImpl as typeof fetch);

    expect(sent).toEqual(["n1"]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: config.from,
      to: ["calidad@lab.co"],
      subject: email.title,
    });
  });

  it("reports a rejected email instead of throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 422 }));
    const sent = await sendEmails([email], config, fetchImpl as typeof fetch);

    expect(sent).toEqual([]);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      area: "notifications.email",
      notificationId: "n1",
    });
  });
});
