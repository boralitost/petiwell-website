import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const ambassador = await prisma.ambassador.findFirst({
    where: {
      referralToken: params.token,
      referralActive: true,
      status: {
        in: [
          "ACTIVE_PENDING_SHIPMENT",
          "ACTIVE_PENDING_FIRST_CONTENT",
          "ACTIVE"
        ]
      }
    },
    select: { referralToken: true }
  });
  const destination = new URL("/tr", req.nextUrl.origin);
  if (ambassador?.referralToken) {
    destination.searchParams.set("ref", ambassador.referralToken);
  }
  return NextResponse.redirect(destination);
}
