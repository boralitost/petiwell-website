import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/account";
import {
  USER_SESSION_COOKIE,
  readSessionTokenFromRequest
} from "@/lib/account-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await revokeSession(readSessionTokenFromRequest(req));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0
  });
  return res;
}
