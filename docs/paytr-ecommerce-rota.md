# Petiwell PayTR E-ticaret Uygulama Rotası

Branch: `feature/ecommerce-checkout`
Hedef: PayTR iFrame + guest checkout + basit sipariş/admin. Üyelik, kart saklama, taksit, otomatik kargo API ilk sürümde yok.

## Mevcut durum (özet) — güncelleme

Kod branch: `feature/ecommerce-checkout`

**Tamamlanan (kod):** legal sayfalar, sepet/checkout, Prisma şema + migration, admin, PayTR iframe + idempotent callback, Resend e-posta (`lib/email.ts`), `ProductInventory` stok düşümü, footer ödeme işaretleri.

**Canlı satış öncesi sizin taraf:**

1. Plus + B ve Sterile Paste **KDV dahil fiyat + stok** → `.env.local` / Vercel
2. Postgres `DATABASE_URL` + `npx prisma migrate deploy` + `npx prisma db seed` (veya inventory seed)
3. PayTR merchant id/key/salt + panelde callback `https://…/api/paytr/callback`
4. `RESEND_API_KEY` + doğrulanmış `EMAIL_FROM`
5. `NEXT_PUBLIC_DIRECT_SALES_ENABLED=true` (yalnızca 1–4 hazırken)
6. ETBİS (idari) + düşük tutarlı canlı sipariş testi

Trendyol CTA’lar satış kapalıyken bozulmaz.

---

## Mevcut durum (özet) — başlangıç notu (arşiv)

- Next.js 14 App Router, React 18, Tailwind — **statik pazarlama sitesi**
- Ürünler: `lib/product.ts` — fiyat / stok / SKU **yok**; CTA = Trendyol dış link
- Sepet, sipariş, DB, auth, `app/api` **yok**
- Legal: genel metin var; KVKK, çerez, teslimat/iade, mesafeli satış, şirket unvan/adres/VKN **eksik**
- Env/PayTR secret scaffolding **yok**

---

## Faz 0 — Hazırlık (kod yok / az kod)

1. Branch: `feature/ecommerce-checkout`
2. GitHub’da yedek / tag (mevcut `main` korunur)
3. Staging (Vercel Preview) ayır
4. `.env.example` iskeleti (secret değer yok)
5. PayTR anahtarlarını chat/frontend’e yazmama kuralı
6. Şirket bilgilerini topla: unvan, adres, telefon, e-posta, VKN, MERSİS

**Çıkış kriteri:** Branch + staging + şirket bilgileri elinde.

---

## Faz 1 — Yasal ve şirket yüzeyi (satış öncesi zorunlu)

İçerik (TR + EN):

| Sayfa / blok | Not |
|---|---|
| İletişim | Unvan, adres, telefon, e-posta, vergi/MERSİS |
| Gizlilik + KVKK aydınlatma | Ayrı veya legal altında net bölümler |
| Çerez politikası | + basit onay banner (ilk sürüm) |
| Teslimat ve iade | 14 gün cayma hakkı dahil |
| Mesafeli satış sözleşmesi | Checkout’ta onay kutusu |
| Ön bilgilendirme formu | Checkout’ta onay kutusu |
| Footer | Visa / Mastercard / PayTR logoları (SSL zaten Vercel) |

**Çıkış kriteri:** Hukuki metinler sitede; checkout onay kutularına bağlanmaya hazır.

---

## Faz 2 — Ticari katalog

`lib/product.ts` veya DB tablosu:

- `price` (kuruş veya decimal, KDV dahil net politika yaz)
- `sku`
- `stock`
- Para birimi: TRY

UI: ürün kartlarında fiyat + stok durumu.
Trendyol linki: ilk sürümde “Trendyol’da da satılır” ikincil CTA olarak kalabilir veya kaldırılır (karar: ürün sahibi).

**Çıkış kriteri:** Backend’in yeniden hesaplayacağı tek fiyat kaynağı var.

---

## Faz 3 — Veritabanı

Önerilen: **Postgres (Vercel Postgres / Neon / Supabase) + Prisma**

Tablolar:

- `orders` — müşteri, adresler, ara/kargo/toplam, status, payment_status, paytr ids, timestamps
- `order_items` — snapshot name/sku/price/qty/line_total
- `payment_attempts` — merchant_oid, amount, currency, status, error, callback_at

Sipariş status:

`pending_payment` → `paid` → `preparing` → `shipped` → `delivered`
(+ `cancelled`, `refunded`)

**Çıkış kriteri:** Migration + seed (2 ürün) staging’de çalışıyor.

---

## Faz 4 — Sepet + Guest Checkout

- Client sepet (cookie/localStorage) + server doğrulama
- Üye yok
- Adet +/- , kaldırma
- Teslimat + fatura alanları
- Kargo bedeli (sabit veya kural; API şart değil)
- Mesafeli satış + ön bilgilendirme checkbox
- “Ödemeye geç” → **backend toplamı yeniden hesaplar** (asla sadece frontend total)

**Çıkış kriteri:** Sipariş `pending_payment` olarak DB’de oluşuyor (henüz gerçek kart yok).

---

## Faz 5 — Admin panel (minimal)

Koruma: basit admin şifre / session (env).
Özellikler:

- Sipariş listesi + detay
- Ödeme durumu
- `preparing` / kargo takip no / `shipped`
- İptal / iade flag
- Stok düzenleme

Kargo API yok; takip manuel.

**Çıkış kriteri:** Staging’de sahte sipariş panelden işlenebiliyor.

---

## Faz 6 — PayTR başvurusu (paralel, site hazır görünürken)

Başvuru → belgeler → domain → sözleşme → merchant id / key / salt.
Test anahtarları staging env’e.

---

## Faz 7 — PayTR iFrame

Akış:

1. Ödemeye geç
2. Backend fiyat yeniden hesap
3. `pending_payment` order + unique `merchant_oid`
4. PayTR token
5. Frontend iframe
6. Kart yalnızca PayTR’de
7. Server callback → hash doğrula → tutar eşleş → **idempotent** `paid` + stok −1
8. Success/fail sayfaları (UI; asla tek başına status değiştirmez)

API yüzey (örnek):

- `POST /api/checkout/create`
- `POST /api/paytr/token` (veya create içinde)
- `POST /api/paytr/callback`
- `GET /[locale]/checkout/success|fail`

**Kritik kural:** Frontend redirect ile `paid` yapılmaz.

**Çıkış kriteri:** PayTR test kartlarıyla happy path + fail path staging’de yeşil.

---

## Faz 8 — E-posta

Transactional (Resend / Postmark / Nodemailer+SMTP):

- Sipariş alındı / ödeme başarısız
- Hazırlanıyor / kargoda
- İptal-iade

İçerik: kalemler, toplam, adres, sözleşme özeti.

**Çıkış kriteri:** `paid` callback sonrası onay maili geliyor.

---

## Faz 9 — Fatura + ETBİS (idari)

- Fatura: ilk sürüm **manuel** (mevcut e-arşiv)
- ETBİS kayıt + karekod siteye
- Dekont ≠ fatura

---

## Faz 10 — Test matrisi

- Başarılı / hatalı kart / yetersiz bakiye / 3DS fail
- Ödeme ekranı kapatma
- Çift callback / yanlış hash / yanlış tutar
- Ödeme anında stok tükenmesi
- Mobil iframe
- Kargo ücreti
- İptal / iade
- Mail fail
- Yenile / geri tuşu

---

## Faz 11 — Canlı

- Live PayTR keys yalnızca Vercel env
- Debug’da PII/secret yok
- DB backup
- Düşük tutarlı gerçek sipariş + panel + iade
- Sonra public “Satın Al” aç

---

## Önerilen Cursor oturum sırası (prompt parçaları)

1. **Analiz only** (kod yazma) — mevcut rapora dayalı gap listesi
2. Legal + şirket sayfaları
3. Prisma schema + migrations
4. Cart + checkout UI (ödeme stub)
5. Admin panel
6. PayTR token + iframe + **idempotent callback**
7. E-posta
8. E2E test checklist
9. Production cutover

Her oturumda tek faz; “her şeyi bir promptta kodla” yok.

---

## Bilinçli ertelemeler (v1 dışı)

- Üyelik / hesap
- Kart saklama
- Taksit UI (PayTR tarafı ayrı karar)
- Kargo firması API
- E-fatura API

---

## İlk sonraki adım

1. İki ürün için **KDV dahil TRY fiyat** ve başlangıç stok sayılarını paylaşın (veya `.env.local`’e yazın).
2. Neon/Supabase/Vercel Postgres bağlayıp `prisma migrate deploy` çalıştırın.
3. PayTR test anahtarları + Resend API key Vercel Preview env’e.
4. Staging’de test kartı ile E2E; sonra `DIRECT_SALES` açın.
