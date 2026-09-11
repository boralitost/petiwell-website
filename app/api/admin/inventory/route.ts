import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ensureInventorySeeded } from "@/lib/inventory";
import { getCatalogProduct } from "@/lib/product";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await ensureInventorySeeded();
    const rows = await prisma.productInventory.findMany({
      orderBy: { productId: "asc" }
    });
    return NextResponse.json({
      ok: true,
      inventory: rows.map((r) => ({
        productId: r.productId,
        sku: r.sku,
        stock: r.stock,
        name: getCatalogProduct(r.productId)?.name.tr ?? r.productId,
        priceTry: getCatalogProduct(r.productId)?.priceTry ?? 0
      }))
    });
  } catch {
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = await req.json();
    const productId = String(body.productId || "");
    const stock = Math.floor(Number(body.stock));
    if (!productId || !Number.isFinite(stock) || stock < 0) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }

    const catalog = getCatalogProduct(productId);
    if (!catalog) {
      return NextResponse.json({ ok: false, error: "unknown_product" }, { status: 404 });
    }

    const row = await prisma.productInventory.upsert({
      where: { productId },
      create: { productId, sku: catalog.sku, stock },
      update: { stock, sku: catalog.sku }
    });

    return NextResponse.json({ ok: true, inventory: row });
  } catch {
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
  }
}
