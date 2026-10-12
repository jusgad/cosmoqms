import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/login(.*)", "/api/webhooks/clerk"]);

// TEMPORARY (2026-10-11, requested + approved by Sebas): see the matching
// block in `src/lib/auth.ts` — removed together once the manual's
// screenshots are done.
const DEMO_MODE = process.env.DEMO_MODE === "true";

export default clerkMiddleware(async (auth, req) => {
  if (DEMO_MODE || isPublicRoute(req)) return NextResponse.next();
  await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
