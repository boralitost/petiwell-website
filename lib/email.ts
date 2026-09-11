import { getCompanyInfo } from "@/lib/company";
import { formatTry } from "@/lib/commerce";

type OrderEmailItem = {
  productName: string;
  quantity: number;
  unitPriceTry: number;
  lineTotalTry: number;
};

type OrderEmailPayload = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  subtotalTry: number;
  shippingTry: number;
  totalTry: number;
  trackingNumber?: string | null;
  items: OrderEmailItem[];
};

async function sendResend(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Petiwell <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing — skip send:", params.subject);
    return { ok: false, error: "email_not_configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[email] resend failed", text);
    return { ok: false, error: text };
  }
  return { ok: true };
}

function itemsTable(items: OrderEmailItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${formatTry(i.unitPriceTry)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${formatTry(i.lineTotalTry)}</td>
        </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr>
      <th align="left" style="padding:8px">Ürün</th>
      <th align="left" style="padding:8px">Adet</th>
      <th align="left" style="padding:8px">Birim</th>
      <th align="left" style="padding:8px">Toplam</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function layout(title: string, body: string): string {
  const company = getCompanyInfo();
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#262126;line-height:1.5">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;color:#563169">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #e9e1e7;margin:24px 0" />
      <p style="font-size:12px;color:#6f676f">
        ${company.legalName}<br/>
        ${company.address}, ${company.city}<br/>
        ${company.phone} · ${company.email}<br/>
        ${company.taxOffice} · VKN ${company.taxNumber}
      </p>
    </div>
  </body></html>`;
}

export async function sendOrderPaidEmail(order: OrderEmailPayload) {
  const html = layout(
    "Siparişiniz alındı",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> numaralı siparişinizin ödemesi alındı.</p>
     ${itemsTable(order.items)}
     <p style="margin-top:16px">
       Ara toplam: ${formatTry(order.subtotalTry)}<br/>
       Kargo: ${formatTry(order.shippingTry)}<br/>
       <strong>Toplam: ${formatTry(order.totalTry)}</strong>
     </p>
     <p>Teslimat: ${order.shippingAddress}, ${order.city}</p>
     <p style="font-size:12px;color:#6f676f">
       Mesafeli satış ve cayma hakları için petiwell.com/tr/shipping adresine bakabilirsiniz.
     </p>`
  );

  const notify = process.env.ORDER_NOTIFY_TO;
  const to = notify
    ? [order.customerEmail, notify]
    : [order.customerEmail];

  return sendResend({
    to,
    subject: `Petiwell sipariş onayı — ${order.orderNumber}`,
    html
  });
}

export async function sendPaymentFailedEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}) {
  const html = layout(
    "Ödeme tamamlanamadı",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> için ödeme alınamadı. Sepetten tekrar deneyebilirsiniz.</p>`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell ödeme başarısız — ${order.orderNumber}`,
    html
  });
}

export async function sendOrderShippedEmail(order: OrderEmailPayload) {
  const html = layout(
    "Siparişiniz kargoya verildi",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> kargoya verildi.</p>
     ${
       order.trackingNumber
         ? `<p>Takip no: <strong>${order.trackingNumber}</strong></p>`
         : ""
     }
     ${itemsTable(order.items)}`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell kargo — ${order.orderNumber}`,
    html
  });
}
