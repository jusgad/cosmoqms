import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

type FindManyArgs = Prisma.NotificationFindManyArgs;
type UpdateManyArgs = Prisma.NotificationUpdateManyArgs;
type CountArgs = Prisma.NotificationCountArgs;

const findMany = vi.fn(async (args: FindManyArgs) => {
  void args;
  return [];
});
const count = vi.fn(async (args: CountArgs) => {
  void args;
  return 3;
});
let updatedRows = 1;
const updateMany = vi.fn(async (args: UpdateManyArgs) => {
  void args;
  return { count: updatedRows };
});

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({ notification: { findMany, count, updateMany } }),
}));

import { notificationsRouter } from "../notifications";

const caller = (user: { id: string; tenantId: string; role: "jefe_planta" | "calidad" } | null) =>
  notificationsRouter.createCaller({ user, prisma: {} as never });

const me = { id: "u1", tenantId: "t1", role: "jefe_planta" as const };
const NOTIFICATION_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("notifications router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatedRows = 1;
  });

  it("requires a session", async () => {
    await expect(caller(null).list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lists only the caller's own notifications in their tenant, newest first", async () => {
    await caller(me).list();
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", recipientUserId: "u1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("counts unread notifications for the caller", async () => {
    expect(await caller(me).unreadCount()).toBe(3);
    expect(count).toHaveBeenCalledWith({ where: { tenantId: "t1", recipientUserId: "u1", readAt: null } });
  });

  it("can only mark the caller's own unread notification as read", async () => {
    expect(await caller(me).markRead({ id: NOTIFICATION_ID })).toEqual({ updated: 1 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID, tenantId: "t1", recipientUserId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("reports zero updates for someone else's notification instead of touching it", async () => {
    updatedRows = 0;
    expect(await caller(me).markRead({ id: NOTIFICATION_ID })).toEqual({ updated: 0 });
  });

  it("marks all of the caller's unread notifications as read", async () => {
    updatedRows = 4;
    expect(await caller(me).markAllRead()).toEqual({ updated: 4 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", recipientUserId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
