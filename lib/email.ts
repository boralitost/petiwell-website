import { getCompanyInfo } from "@/lib/company";
import { formatTry } from "@/lib/commerce";
import { resolveEmailFrom, resolveShopNotify } from "@/lib/email-from";
import { Locale } from "@/lib/i18n";

function escapeHtml(raw: string): string {
  return raw.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char
  );
}

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
  discountTry?: number;
  totalTry: number;
  promoCode?: string | null;
  trackingNumber?: string | null;
  items: OrderEmailItem[];
};

async function sendResend(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveEmailFrom(process.env.EMAIL_FROM);
  const replyTo = (
    process.env.EMAIL_REPLY_TO ||
    process.env.COMPANY_EMAIL ||
    ""
  ).trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY missing — skip send:", params.subject);
    return { ok: false, error: "email_not_configured" };
  }
  if (!from) {
    console.warn("[email] EMAIL_FROM cannot be Gmail; use @petiwell.com");
    return { ok: false, error: "email_from_not_set" };
  }

  const recipients = [...new Set(
    (Array.isArray(params.to) ? params.to : [params.to])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )];
  if (!recipients.length) {
    return { ok: false, error: "no_recipient" };
  }

  const errors: string[] = [];
  let sent = 0;
  for (const to of recipients) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(replyTo ? { reply_to: [replyTo] } : {}),
        subject: params.subject,
        html: params.html
      })
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[email] resend failed");
      errors.push(summarizeResendError(text));
      continue;
    }
    sent += 1;
  }

  if (sent === 0) {
    return { ok: false, error: errors[0] || "email_failed" };
  }
  return { ok: true, error: errors[0] };
}

function summarizeResendError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string };
    const message = parsed.message || text;
    if (/only send testing emails/i.test(message)) {
      return "resend_test_mode_recipient";
    }
    if (/domain is not verified/i.test(message)) {
      return "resend_domain_unverified";
    }
    if (/from/i.test(message) && /verified/i.test(message)) {
      return "resend_from_not_allowed";
    }
    return "resend_rejected";
  } catch {
    return "resend_rejected";
  }
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
        Yanıtlar ${company.email} adresine gelir.<br/>
        ${company.taxOffice} · VKN ${company.taxNumber}
      </p>
    </div>
  </body></html>`;
}

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  purpose:
    | "verify_email"
    | "reset_password"
    | "change_password"
    | "ambassador_verify_email";
  locale: Locale;
}) {
  const tr = input.locale !== "en";
  const titles = {
    verify_email: tr ? "Petiwell e-posta doğrulama" : "Petiwell email verification",
    reset_password: tr ? "Petiwell şifre sıfırlama" : "Petiwell password reset",
    change_password: tr ? "Petiwell şifre değişikliği" : "Petiwell password change",
    ambassador_verify_email: tr
      ? "Petiwell Marka Elçisi e-posta doğrulama"
      : "Petiwell Ambassador email verification"
  };
  const leads = {
    verify_email: tr
      ? "Üyeliğini tamamlamak için doğrulama kodun:"
      : "Use this code to verify your email:",
    reset_password: tr
      ? "Şifreni sıfırlamak için kodun:"
      : "Use this code to reset your password:",
    change_password: tr
      ? "Şifre değişikliğini onaylamak için kodun:"
      : "Use this code to confirm the password change:",
    ambassador_verify_email: tr
      ? "Marka Elçisi başvurundaki e-postayı doğrulamak için kodun:"
      : "Use this code to verify the email in your Ambassador application:"
  };
  const title = titles[input.purpose];
  const html = layout(
    title,
    `<p>${leads[input.purpose]}</p>
     <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#563169">${input.code}</p>
     <p style="font-size:12px;color:#6f676f">${tr ? "Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan maili yok say." : "This code expires in 10 minutes. If you did not request it, ignore this email."}</p>`
  );
  return sendResend({
    to: input.to,
    subject: `${title}: ${input.code}`,
    html
  });
}

export async function sendAmbassadorApprovedEmail(input: {
  to: string;
  firstName: string;
  couponCode: string;
  referralUrl: string;
}) {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com"
  ).replace(/\/+$/, "");
  return sendResend({
    to: input.to,
    subject: "Petiwell Marka Elçiliği başvurun onaylandı",
    html: layout(
      "Petiwell Marka Elçiliğin aktif",
      `<p>Merhaba ${escapeHtml(input.firstName)},</p>
       <p>Başvurun onaylandı. Sana özel müşteri indirim kodun: <strong>${escapeHtml(input.couponCode)}</strong></p>
       <p>Referral bağlantın: <a href="${escapeHtml(input.referralUrl)}">${escapeHtml(input.referralUrl)}</a></p>
       <p>Panelini kullanmak için hesabına bir şifre belirle:</p>
       <p><a href="${origin}/tr/account/forgot" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#563169;color:white;text-decoration:none">Şifremi belirle</a></p>`
    )
  });
}

export async function sendAmbassadorInviteEmail(input: {
  to: string;
  firstName: string;
  onboardingUrl: string;
  expiresAt: Date;
}) {
  return sendResend({
    to: input.to,
    subject: "Petiwell Marka Elçiliği davetin",
    html: layout(
      "Petiwell Marka Elçiliğine davetlisin",
      `<p>Merhaba ${escapeHtml(input.firstName || "")},</p>
       <p>Petiwell Marka Elçiliği Programına özel olarak davetlisin.</p>
       <p><a href="${escapeHtml(input.onboardingUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#563169;color:white;text-decoration:none">Onboarding'i Başlat</a></p>
       <p style="font-size:12px;color:#6f676f">Bu kişisel bağlantı ${escapeHtml(input.expiresAt.toLocaleDateString("tr-TR"))} tarihine kadar geçerlidir ve paylaşılmamalıdır.</p>`
    )
  });
}

export async function sendAmbassadorReviewEmail(input: {
  to: string;
  firstName: string;
  kind: "missing_documents" | "rejected";
  reason: string;
}) {
  const missing = input.kind === "missing_documents";
  const title = missing
    ? "Petiwell Marka Elçisi başvurunda eksik bilgi var"
    : "Petiwell Marka Elçisi başvurun hakkında";
  return sendResend({
    to: input.to,
    subject: title,
    html: layout(
      title,
      `<p>Merhaba ${escapeHtml(input.firstName)},</p>
       <p>${missing ? "Başvurunu tamamlayabilmemiz için aşağıdaki bilgi veya belgeye ihtiyacımız var:" : "Başvurun bu aşamada onaylanamadı."}</p>
       <p><strong>${escapeHtml(input.reason || "Petiwell ekibi ayrıntılar için seninle iletişime geçecek.")}</strong></p>`
    )
  });
}

export async function sendAmbassadorShipmentEmail(input: {
  to: string;
  firstName: string;
  carrier: string;
  trackingNumber: string;
}) {
  return sendResend({
    to: input.to,
    subject: "Petiwell Marka Elçisi başlangıç paketin yola çıktı",
    html: layout(
      "Başlangıç paketin yola çıktı",
      `<p>Merhaba ${escapeHtml(input.firstName)},</p>
       <p>Kargo: <strong>${escapeHtml(input.carrier)}</strong></p>
       <p>Takip numarası: <strong>${escapeHtml(input.trackingNumber)}</strong></p>
       <p>Paket teslim edildiğinde ilk içerik için 14 günlük süren başlayacak.</p>`
    )
  });
}

export async function sendAmbassadorOperationalEmail(input: {
  to: string;
  firstName: string;
  kind:
    | "package_delivered"
    | "content_reminder"
    | "content_final_warning"
    | "content_paused"
    | "inactivity_warning"
    | "content_review"
    | "payout_waiting_invoice"
    | "payout_ready"
    | "payout_paid";
  detail?: string;
  dueAt?: Date | null;
  amountTry?: number;
}) {
  const titles: Record<typeof input.kind, string> = {
    package_delivered: "Başlangıç paketin teslim edildi",
    content_reminder: "İlk Petiwell içeriğin için hatırlatma",
    content_final_warning: "İlk içerik için son hatırlatma",
    content_paused: "Marka Elçisi hesabın geçici olarak duraklatıldı",
    inactivity_warning: "Petiwell Marka Elçisi aktivite hatırlatması",
    content_review: "Petiwell içerik inceleme sonucu",
    payout_waiting_invoice: "Komisyon ödemen için belge bekleniyor",
    payout_ready: "Komisyon ödemen hazır",
    payout_paid: "Komisyon ödemen gönderildi"
  };
  const details = [
    input.detail ? `<p>${escapeHtml(input.detail)}</p>` : "",
    input.dueAt
      ? `<p>Son tarih: <strong>${escapeHtml(input.dueAt.toLocaleString("tr-TR"))}</strong></p>`
      : "",
    typeof input.amountTry === "number"
      ? `<p>Tutar: <strong>${escapeHtml(formatTry(input.amountTry, "tr-TR"))}</strong></p>`
      : ""
  ].join("");
  return sendResend({
    to: input.to,
    subject: titles[input.kind],
    html: layout(
      titles[input.kind],
      `<p>Merhaba ${escapeHtml(input.firstName)},</p>${details}`
    )
  });
}

export async function sendOrderPartialRefundEmail(input: {
  to: string;
  customerName: string;
  orderNumber: string;
  amountTry: number;
  reason: string;
}) {
  return sendResend({
    to: input.to,
    subject: `Petiwell ${input.orderNumber} kısmi iade`,
    html: layout(
      "Kısmi iaden alındı",
      `<p>Merhaba ${escapeHtml(input.customerName)},</p>
       <p><strong>${escapeHtml(input.orderNumber)}</strong> siparişin için ${escapeHtml(formatTry(input.amountTry))} tutarında iade PayTR'ye iletildi.</p>
       <p>Neden: ${escapeHtml(input.reason)}</p>
       <p>Tutarın kartına yansıma süresi bankana göre değişebilir.</p>`
    )
  });
}

export async function sendOperationsAlertEmail(input: {
  subject: string;
  lines: string[];
}) {
  const to =
    process.env.OPERATIONS_ALERT_TO ||
    process.env.ORDER_NOTIFY_TO ||
    process.env.EMAIL_REPLY_TO ||
    "";
  if (!to) return { ok: false as const, error: "operations_alert_to_missing" };
  return sendResend({
    to,
    subject: `Petiwell operasyon uyarısı: ${input.subject}`,
    html: layout(
      input.subject,
      `<ul>${input.lines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul>`
    )
  });
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
       ${
         order.discountTry
           ? `İndirim${order.promoCode ? ` (${order.promoCode})` : ""}: −${formatTry(order.discountTry)}<br/>`
           : ""
       }
       <strong>Toplam: ${formatTry(order.totalTry)}</strong>
     </p>
     <p>Teslimat: ${order.shippingAddress}, ${order.city}</p>
     <p style="font-size:12px;color:#6f676f">
       Mesafeli satış, 14 günlük cayma hakkı ve hijyen istisnaları: petiwell.com/tr/shipping — Cayma formu: petiwell.com/tr/withdrawal — KVKK: petiwell.com/tr/privacy
     </p>`
  );

  const subject = `Petiwell sipariş onayı — ${order.orderNumber}`;
  const customer = await sendResend({
    to: order.customerEmail,
    subject,
    html
  });

  const notify = resolveShopNotify(
    process.env.ORDER_NOTIFY_TO,
    process.env.COMPANY_EMAIL
  );
  const customerAddr = order.customerEmail.trim().toLowerCase();
  if (notify && notify !== customerAddr) {
    const shop = await sendResend({ to: notify, subject, html });
    if (!shop.ok) {
      return {
        ok: customer.ok,
        error: customer.error || shop.error
      };
    }
  }

  return customer;
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
         ? `<p>Takip no: <strong>${order.trackingNumber}</strong></p>
            <p style="font-size:13px;color:#6f676f">Kargo firmanızın sitesinden bu numarayla sorgulayabilirsiniz.</p>`
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

export async function sendOrderCancelledEmail(order: OrderEmailPayload) {
  const html = layout(
    "Siparişiniz iptal edildi",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> numaralı sipariş iptal edildi. Ödeme alındıysa tutar kartınıza / ödeme yönteminize iade edilir.</p>
     ${itemsTable(order.items)}
     <p style="font-size:12px;color:#6f676f">
       Sorularınız için ${getCompanyInfo().email} adresine yazabilirsiniz.
     </p>`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell sipariş iptali — ${order.orderNumber}`,
    html
  });
}

export async function sendOrderPreparingEmail(order: OrderEmailPayload) {
  const html = layout(
    "Siparişiniz hazırlanıyor",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> numaralı siparişiniz hazırlanıyor.</p>
     ${itemsTable(order.items)}`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell sipariş hazırlanıyor — ${order.orderNumber}`,
    html
  });
}

export async function sendOrderRefundedEmail(order: OrderEmailPayload) {
  const html = layout(
    "İadeniz alındı",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> için iade alındı. Tutar orijinal ödeme yöntemine döner.</p>
     ${itemsTable(order.items)}
     <p style="font-size:12px;color:#6f676f">
       Sorularınız için ${getCompanyInfo().email} adresine yazabilirsiniz.
     </p>`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell iade — ${order.orderNumber}`,
    html
  });
}

export async function sendOrderDeliveredEmail(order: OrderEmailPayload) {
  const html = layout(
    "Siparişiniz teslim edildi",
    `<p>Merhaba ${order.customerName},</p>
     <p><strong>${order.orderNumber}</strong> numaralı siparişiniz teslim edildi.</p>
     ${itemsTable(order.items)}
     <p style="font-size:12px;color:#6f676f">
       Sorularınız için ${getCompanyInfo().email} adresine yazabilirsiniz.
     </p>`
  );
  return sendResend({
    to: order.customerEmail,
    subject: `Petiwell teslim — ${order.orderNumber}`,
    html
  });
}
