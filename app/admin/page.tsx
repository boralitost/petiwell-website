import { isAdminAuthenticated, adminConfigured } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminInventory } from "@/components/admin/AdminInventory";
import { prisma } from "@/lib/db";
import { ensureInventorySeeded } from "@/lib/inventory";
import { getCatalogProduct } from "@/lib/product";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-neutral-600">
          ADMIN_PASSWORD ve ADMIN_SESSION_SECRET env değişkenlerini ayarlayın.
        </p>
      </main>
    );
  }

  if (!isAdminAuthenticated()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold">Petiwell Admin</h1>
        <AdminLoginForm />
      </main>
    );
  }

  let orders: Awaited<
    ReturnType<
      typeof prisma.order.findMany<{
        include: { items: true; payments: true };
      }>
    >
  > = [];
  let inventory: {
    productId: string;
    sku: string;
    stock: number;
    name: string;
    priceTry: number;
  }[] = [];
  let dbOk = true;

  try {
    await ensureInventorySeeded();
    orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: true, payments: true }
    });
    const rows = await prisma.productInventory.findMany({
      orderBy: { productId: "asc" }
    });
    inventory = rows.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      stock: r.stock,
      name: getCatalogProduct(r.productId)?.name.tr ?? r.productId,
      priceTry: getCatalogProduct(r.productId)?.priceTry ?? 0
    }));
  } catch {
    dbOk = false;
  }

  if (!dbOk) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Veritabanına bağlanılamadı. DATABASE_URL ve prisma migrate kontrol edin.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AdminOrders
        orders={orders as unknown as Parameters<typeof AdminOrders>[0]["orders"]}
      />
      <AdminInventory inventory={inventory} />
    </main>
  );
}
