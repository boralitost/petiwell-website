/**
 * Seed ProductInventory from catalog env stock.
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed.ts
 * Or after migrate: call ensureInventorySeeded from a one-off API / script.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const PRODUCTS = [
  {
    productId: "plus-b",
    sku: "PW-PLUS-B-50ML",
    stock: envNumber("PRODUCT_STOCK_PLUS_B", 0)
  },
  {
    productId: "sterile-paste",
    sku: "PW-STERILE-PASTE-100G",
    stock: envNumber("PRODUCT_STOCK_STERILE_PASTE", 0)
  }
] as const;

async function main() {
  for (const p of PRODUCTS) {
    await prisma.productInventory.upsert({
      where: { productId: p.productId },
      create: { productId: p.productId, sku: p.sku, stock: p.stock },
      update: { sku: p.sku, stock: p.stock }
    });
    console.log(`inventory ${p.productId} = ${p.stock}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
