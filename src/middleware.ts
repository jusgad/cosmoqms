import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demoMode";

const isPublicRoute = createRouteMatcher(["/login(.*)", "/api/webhooks/clerk", "/api/health"]);

// signInUrl: unauthenticated visitors go to our /login page, not to Clerk's
// hosted page on another domain.
export default clerkMiddleware(
  async (auth, req) => {
    if (isDemoMode() || isPublicRoute(req)) return NextResponse.next();
    await auth.protect();
  },
  { signInUrl: "/login" },
);

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
