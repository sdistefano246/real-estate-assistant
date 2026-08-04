import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session.server";
import { prisma } from "@/lib/db.server";

const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/login"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  // decrypt() only verifies the JWT's signature/expiry, not that the agent
  // it names still exists — a stale cookie (e.g. from a deleted account)
  // decrypts fine. Trusting that alone here caused a real bug: /login would
  // bounce a stale-but-signed session to /dashboard, whose page-level check
  // (see dal.server.ts's verifySession) correctly bounced it right back to
  // /login, an infinite redirect loop. Verify existence here too so both
  // branches agree on what "authenticated" actually means.
  const agentExists = session?.agentId
    ? Boolean(await prisma.agent.findUnique({ where: { id: session.agentId }, select: { id: true } }))
    : false;

  if (isProtectedRoute && !agentExists) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && agentExists) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
