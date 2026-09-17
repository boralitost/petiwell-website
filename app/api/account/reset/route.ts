import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithCode } from "@/lib/account";
import { withSessionCookie } from "@/lib/account-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await resetPasswordWithCode({
      email: String(body.email || ""),
      code: String(body.code || ""),
      password: String(body.password || "")
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return withSessionCookie(NextResponse.json({ ok: true }), result.sessionToken);
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
