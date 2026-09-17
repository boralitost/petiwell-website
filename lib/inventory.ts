import { Prisma } from "@prisma/client";
import { getCatalogProduct, listCatalogProducts } from "@/lib/product";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

export async function ensureInventorySeeded() {
  const catalog = listCatalogProducts();
  for (const p of catalog) {
    await prisma.productInventory.upsert({
      where: { productId: p.id },
      create: {
        productId: p.id,
        sku: p.sku,
        stock: p.stock
      },
      update: {
        sku: p.sku
        // do not overwrite live stock on every request
      }
    });
  }
}

/** Admin-only: overwrite DB stock from catalog env values. */
export async function syncInventoryFromCatalog() {
  const catalog = listCatalogProducts();
  const results: { productId: string; stock: number }[] = [];
  for (const p of catalog) {
    const row = await prisma.productInventory.upsert({
      where: { productId: p.id },
      create: { productId: p.id, sku: p.sku, stock: p.stock },
      update: { sku: p.sku, stock: p.stock }
    });
    results.push({ productId: row.productId, stock: row.stock });
  }
  return results;
}

export async function getStock(productId: string): Promise<number> {
  try {
    const row = await prisma.productInventory.findUnique({
      where: { productId }
    });
    if (row) return row.stock;
  } catch {
    /* DB unavailable — fall back */
  }
  return getCatalogProduct(productId)?.stock ?? 0;
}

export async function decrementStock(
  productId: string,
  quantity: number,
  db: Db = prisma
) {
  const updated = await db.productInventory.updateMany({
    where: { productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } }
  });
  if (updated.count !== 1) {
    throw new Error(`insufficient_stock:${productId}`);
  }
}

export async function incrementStock(
  productId: string,
  quantity: number,
  db: Db = prisma
) {
  await db.productInventory.update({
    where: { productId },
    data: { stock: { increment: quantity } }
  });
}
