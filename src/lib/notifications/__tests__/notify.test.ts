import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { notifyAudience, NOTIFICATION_AUDIENCE } from "../notify";

type UserFindManyArgs = Prisma.UserFindManyArgs;
type NotificationCreateArgs = Prisma.NotificationCreateManyAndReturnArgs;

let recipients: { id: string; email: string }[] = [];
const userFindMany = vi.fn(async (args: UserFindManyArgs) => {
  void args;
  return recipients;
});
const createManyAndReturn = vi.fn(async (args: NotificationCreateArgs) => {
  const rows = Array.isArray(args.data) ? args.data : [args.data];
  return rows.map((row, index) => ({ id: `n${index}`, recipientUserId: row.recipientUserId }));
});

const tx = {
  user: { findMany: userFindMany },
  notification: { createManyAndReturn },
} as unknown as Prisma.TransactionClient;

const draft = {
  kind: "desviacion_creada" as const,
  title: "Nueva desviación en OP-2026-004",
  body: "Grumos en la fase acuosa",
  link: "/calidad/desviaciones/d1",
};

describe("notifyAudience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recipients = [];
  });

  it("looks up only active users of the kind's audience in the tenant, excluding the actor", async () => {
    await notifyAudience(tx, { tenantId: "t1", actorUserId: "actor", draft });
    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        active: true,
        role: { in: NOTIFICATION_AUDIENCE.desviacion_creada },
        id: { not: "actor" },
      },
      select: { id: true, email: true },
    });
  });

  it("writes nothing when nobody is in the audience", async () => {
    const emails = await notifyAudience(tx, { tenantId: "t1", actorUserId: "actor", draft });
    expect(emails).toEqual([]);
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it("creates one inbox row per recipient and returns their emails", async () => {
    recipients = [
      { id: "u-cal", email: "calidad@lab.co" },
      { id: "u-dir", email: "director@lab.co" },
    ];
    const emails = await notifyAudience(tx, { tenantId: "t1", actorUserId: "actor", draft });

    expect(createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { tenantId: "t1", recipientUserId: "u-cal", ...draft },
        { tenantId: "t1", recipientUserId: "u-dir", ...draft },
      ],
      select: { id: true, recipientUserId: true },
    });
    expect(emails).toEqual([
      { notificationId: "n0", tenantId: "t1", to: "calidad@lab.co", title: draft.title, body: draft.body, link: draft.link },
      { notificationId: "n1", tenantId: "t1", to: "director@lab.co", title: draft.title, body: draft.body, link: draft.link },
    ]);
  });
});
