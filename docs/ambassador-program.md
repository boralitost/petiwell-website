# Petiwell Marka Elçisi Programı — Operasyon Notu

## Yayına açma kapıları

Program varsayılan olarak kapalıdır. İlk davetten önce:

1. Mali müşavir, 20/B ile faturalı işletme ödeme akışlarını ve ödeme dönemini yazılı olarak onaylamalı.
2. Avukat; Elçilik sözleşmesi, KVKK aydınlatması, içerik/iddia rehberi ve komisyon kurallarının son metinlerini onaylamalı.
3. `AMBASSADOR_DOCUMENT_VERSION` son sürüme yükseltilmeli, ardından `AMBASSADOR_LEGAL_DOCS_APPROVED=true` yapılmalı.
4. Private S3 bucket dış erişime kapalı olmalı; erişim anahtarının yalnızca bu bucket için en az yetkisi bulunmalı.
5. Dosya tarama servisi `{"clean":true}` yanıt sözleşmesiyle test edilmeli. Production ortamında tarama servisi yoksa yükleme bilinçli olarak bloklanır.
6. `AMBASSADOR_DATA_ENCRYPTION_KEY`, hash pepper, referral secret ve `CRON_SECRET` secret manager'da oluşturulmalı. Anahtar rotasyonu ayrıca planlanmadan encryption key değiştirilmemeli.
7. Migration staging veritabanında uygulanmalı; davet, onboarding, PayTR ödeme, teslim/iade, komisyon ve payout uçtan uca test edilmeli.

## Finansal kurallar

- Attribution: geçerli manuel Elçi kodu > son geçerli 30 günlük referral > attribution yok.
- Genel kampanya kodu ile Elçi referral'ı birlikte kullanılmaz.
- Site-geneli ikinci ürün 1 TL kampanyası yalnızca `SECOND_PRODUCT_ONE_TRY_ENABLED=true` iken çalışır.
- Sıra: katalog ürün toplamı → ikinci ürün kampanyası → Elçi indirimi → KDV ayrıştırma → komisyon.
- Komisyon: kargo hariç, tüm ürün indirimlerinden sonraki KDV hariç ürün bedeli × sipariş snapshot oranı.
- Komisyon ödeme başarılı olunca `PENDING`, teslimattan sonraki bekleme süresi bitince `APPROVED` olur.
- İptal/iade ödeme öncesinde komisyonu iptal eder; ödeme sonrası iade negatif adjustment oluşturur.
- Payout batch'i ayın 1'i ve 15'inde, minimum bakiye aşıldığında oluşur.
- Faturalı işletme payout'u fatura yüklenip admin tarafından onaylanana kadar `WAITING_DOCUMENT` kalır.

## Güvenlik ve veri minimizasyonu

- TCKN/VKN ve IBAN AES-256-GCM ile şifreli saklanır; panelde yalnızca son dört hane gösterilir.
- Belgeler veritabanında değil Frankfurt bölgesindeki private Vercel Blob
  store'da AES-256 at-rest şifrelemeyle tutulur; admin kısa ömürlü signed URL
  ile görür.
- Elçi panelinde müşteri adı, e-posta, telefon, adres veya ödeme verisi gösterilmez.
- Admin belge görüntüleme ve durum değişiklikleri audit log'a yazılır.
- Referral kalıcılığı yalnızca kullanıcı tam çerez izni verdiyse başlar; izin essential'a dönerse referral çerezleri silinir.
- Production dosyaları private storage'a yazılmadan önce izole Vercel Sandbox
  içindeki ClamAV ile taranır. Virüs imza snapshot'ı günlük cron tarafından
  yenilenir; tarama başarısızsa yükleme fail-closed davranır.

## Bilinen kontrollü sınırlar

- Banka hesabı sahipliği ve vergi statüsü otomatik resmi servisle doğrulanmaz; admin/mali müşavir kontrolü zorunludur.
- Gerçek ödeme API'siyle otomatik EFT yapılmaz; admin banka referansı girerek payout'u ödendi işaretler.
- Kart/fingerprint verisi PayTR iFrame callback'inde paylaşılmadığından tekrarlanan ödeme aracı kontrolü kurulamaz.

## Teknik operasyonlar

- Production admin oturumu TOTP MFA gerektirir. İlk geçişte
  `ADMIN_TOTP_SECRET`, çok kullanıcılı kullanımda
  `ADMIN_DATABASE_AUTH_ENABLED` kullanılır.
- Roller `SUPER_ADMIN`, `OPERATIONS`, `FINANCE` ve `CONTENT_REVIEW` olarak API
  katmanında uygulanır.
- Kısmi iade PayTR'ye gönderilir; ürün bedeli kısmına göre Elçi komisyonunda
  oransal ve audit edilebilir düzeltme oluşur.
- Kargo sağlayıcısı `POST /api/webhooks/shipment` adresine ham JSON gövdesinin
  HMAC-SHA256 imzasını `x-petiwell-signature` başlığında gönderir.
  `eventId`, `eventType=delivered` ve `trackingNumber` zorunludur.
- Cron içerik/inaktivite hatırlatmalarını, payout oluşturmayı ve deadline
  işlemlerini idempotent çalıştırır. Ayrıca stale PayTR iadelerini
  `reference_no` üzerinden uzlaştırır ve operasyon sorunlarını e-postayla
  bildirir.
- Retention silme işi hazırdır; süre onaylanana kadar
  `AMBASSADOR_RETENTION_JOB_ENABLED=false` kalmalıdır.
- Fraud sinyalleri aynı adres, sipariş hızı, kupon sızıntısı ve anormal iade
  oranını kapsar; şüpheli komisyonlar admin incelemesine alınır.
