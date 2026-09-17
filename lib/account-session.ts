import { NextResponse } from "next/server";
import {
  SESSION_TTL_MS,
  USER_SESSION_COOKIE,
  sessionCookieOptions
} from "@/lib/account-auth";

export function withSessionCookie(res: NextResponse, sessionToken: string) {
  res.cookies.set(
    USER_SESSION_COOKIE,
    sessionToken,
    sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000))
  );
  return res;
}
