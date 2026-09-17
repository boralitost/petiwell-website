# Petiwell — Canlı satış kapısı (go-live)

Satış bayrağı (`NEXT_PUBLIC_DIRECT_SALES_ENABLED`) **yalnızca** aşağıdaki kapılar yeşilken `true` yapılır. Trendyol CTA’lar bayrak kapalıyken bozulmaz.

Otomatik kapı: `npm test` (PayTR hash, sipariş no, satış bayrağı kapalı, kargo 0).

## A. Ortam kapıları

| Kapı | Kanıt |
|------|--------|
| Fiyatlar (497 / 497, KDV+kargo dahil) | Vercel + `.env.local` `PRODUCT_PRICE_*` |
| Stok env (463 / 456) | `PRODUCT_STOCK_*` |
| Kargo ekstra yok | `SHIPPING_FLAT_TRY=0` |
| Postgres + migration | `prisma migrate status` → up to date |
| DB stok satırları | Admin → “Env stoklarını senkronla” |
| Şirket bilgisi | `COMPANY_*` dolu |
| Admin | `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` |
| PayTR merchant | `PAYTR_MERCHANT_ID/KEY/SALT` (sahte değer yok) |
| PayTR test mode | `PAYTR_TEST_MODE=1` ilk açılışta |
| PayTR panel callback | `https://petiwell.com/api/paytr/callback` |
| OK / FAIL URL | success + fail (`oid` create API ekler) |
| Resend | `EMAIL_FROM=Petiwell <noreply@petiwell.com>` (kutu değil) + Reply-To Gmail |
| ETBİS | idari kayıt (kod dışı) |

## B. E2E test matrisi (PayTR test kartı)

Staging / Preview’da bayrak geçici `true`:

1. Sepete ekle → quote = ürün×adet (+ kargo 0)
2. Guest checkout + yasal onay kutuları
3. PayTR iframe; kart yalnızca PayTR’de
4. Başarılı ödeme → callback `OK` **veya** success sayfası PayTR durum-sorgu → `paid` (frontend tek başına paid yapmaz)
5. Çift callback → idempotent
6. Yanlış hash / tutar → paid olmaz
7. Başarısız kart → fail + mail
8. Yetersiz stok → red
9. Admin shipped + takip → kargo maili
10. Mobil iframe

## C. Canlı kesim

1. Test yeşil → `PAYTR_TEST_MODE=0`
2. Düşük tutarlı gerçek sipariş + iade denemesi
3. `NEXT_PUBLIC_DIRECT_SALES_ENABLED=true` + Production redeploy
4. Trendyol CTA kararı (bırak / ikincil)

## D. v1 dışı

Üyelik, kart saklama, taksit UI, kargo API, otomatik e-fatura.
