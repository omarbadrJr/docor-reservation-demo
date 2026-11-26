import type { NextRequest, NextResponse } from "next/server";

import { createSupabaseProxyDeps, handleAuthProxy } from "@/lib/auth/proxy";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  return handleAuthProxy(request, createSupabaseProxyDeps(request));
}

export const config = {
  matcher: [
    "/login",
    "/owner/:path*",
    "/receptionist/:path*",
    "/api/owner/:path*",
    "/api/receptionist/:path*",
  ],
};
