import { createHash } from "crypto";
import type {
  AmbassadorConsentAction,
  AmbassadorConsentType
} from "@prisma/client";
import { getCompanyInfo } from "@/lib/company";
import {
  sellerDisplayName,
  sellerIdentityText,
  sellerVenue
} from "@/lib/legal-identity";

export type AmbassadorLegalDocument = {
  type: AmbassadorConsentType;
  title: string;
  version: string;
  action: AmbassadorConsentAction;
  body: string;
  hash: string;
};

function documentVersion() {
  const raw = (process.env.AMBASSADOR_DOCUMENT_VERSION || "2026-09-17").trim();
  if (!raw || raw.toLowerCase().includes("draft")) {
    return "2026-09-17";
  }
  return raw;
}

function buildBodies() {
  const company = getCompanyInfo();
  const seller = sellerDisplayName(company);
  const identity = sellerIdentityText("tr", company);
  const venue = sellerVenue(company);
  const email = company.email;
  const terminationDays = process.env.AMBASSADOR_TERMINATION_NOTICE_DAYS || "15";
  const holdDays = process.env.AMBASSADOR_COMMISSION_HOLD_DAYS || "14";
  const firstContentDays = process.env.AMBASSADOR_FIRST_CONTENT_DAYS || "14";
  const minPayout = process.env.AMBASSADOR_MIN_PAYOUT_TRY || "500";
  const referralDays = process.env.AMBASSADOR_REFERRAL_DAYS || "30";
  const commissionPct = Math.round(
    Number(process.env.AMBASSADOR_COMMISSION_RATE || "0.15") * 100
  );
  const discountPct = Math.round(
    Number(process.env.AMBASSADOR_CUSTOMER_DISCOUNT || "0.10") * 100
  );

  return {
    AMBASSADOR_AGREEMENT: `PETİWELL MARKA ELÇİLİĞİ VE SATIŞ ORTAKLIĞI SÖZLEŞMESİ

Madde 1 — Taraflar
Satıcı / Marka (“Petiwell”):
${identity}

Marka Elçisi (“Elçi”): Onboarding formunda kimliği, iletişim ve vergi bilgileri beyan edilen, 18 yaşını doldurmuş gerçek kişi.

Madde 2 — Sözleşmenin niteliği
İşbu metin, Elçinin Petiwell ürünlerini kendi sosyal medya hesaplarında tanıtması ve petiwell.com üzerinden gerçekleşen nitelikli satışlarda satış ortaklığı komisyonu almasına ilişkin bağımsız iş görme ilişkisidir.
Elçi; 4857 sayılı İş Kanunu anlamında işçi, 6098 sayılı TBK anlamında Petiwell’in temsilcisi, 6102 sayılı TTK anlamında acente, ticari temsilci, simsar veya şube değildir. Elçi kendi araç gereci, zamanı ve içeriği ile çalışır; çalışma yeri, mesai ve bağlılık borcu yoktur. Bu sözleşme işe alma, sosyal güvenlik tescili veya ücret garantisi doğurmaz.

Madde 3 — Konu ve kapsam
3.1. Petiwell, davet ettiği Elçiye kişiye özel kupon kodu ve/veya referral bağlantısı, başlangıç ürün paketi ve program kurallarını sağlayabilir.
3.2. Başlangıç paketi iki Petiwell ürünü, bilgilendirme kartı, kupon ve QR kod içerebilir. Paket, tanıtım amaçlı bedelsiz veya indirimli mal temini olup ücret/maaş değildir.
3.3. Elçi, paketin tesliminden itibaren ${firstContentDays} gün içinde en az bir kalıcı içerik yayımlamayı ve ilk içeriği yayımdan önce Petiwell incelemesine sunmayı kabul eder. İlk içerikten sonra aylık zorunlu paylaşım kotası yoktur; ancak içerik ve iddia kuralları süreklidir.
3.4. Program yalnızca petiwell.com satışlarını kapsar. Trendyol ve diğer pazaryerleri komisyon dışıdır.

Madde 4 — Elçinin yükümlülükleri
4.1. 18 yaşını doldurmuş olmak; kimlik, iletişim, teslimat, vergi ve banka bilgilerini doğru, güncel ve kendisine ait olarak vermek.
4.2. Petiwell adına sipariş, ödeme, taahhüt, fatura, iade kabulü veya müşteri kişisel verisi toplamamak; tüketiciyi Petiwell çalışanı veya yetkili satıcı olduğu izlenimine sokmamak.
4.3. Reklam ve İçerik Kuralları ile Serbest/Yasak İddialar Rehberi’ne uymak; reklam ilişkisini ilk bakışta açıklamak.
4.4. Deneyimlemediği ürünü deneyimlemiş gibi sunmamak; fiyat, stok, indirim veya sağlık sonucu hakkında doğrulanmamış beyanda bulunmamak.
4.5. Kendi kuponu veya referral’ı ile kendi alışverişinden veya hane/kontrollü alışverişten komisyon yaratmamak; kuponu halka açık kupon sitelerine veya otomasyona bırakmamak.
4.6. Vergi statüsü, IBAN ve belgelerinde değişiklik olursa derhâl bildirmek.
4.7. Petiwell’in markasını, görsellerini ve ürünlerini program amacı dışında, aşağılayıcı, yasa dışı veya üçüncü kişi haklarını ihlal eder şekilde kullanmamak.

Madde 5 — Petiwell’in yükümlülükleri
5.1. Onaylı Elçiye kupon/referral ve program bilgilerini sağlamak.
5.2. Kupon ve Komisyon Program Kuralları’na göre hak edilmiş komisyonu, vergi/belge şartları oluştuğunda ödemek.
5.3. Elçi paneli ve müşteri kişisel verisi konusunda veri minimizasyonu uygulamak; Elçiye müşteri adı, adresi, telefonu veya ödeme verisi vermemek.

Madde 6 — Fikri mülkiyet ve lisans
6.1. Petiwell markası, logosu, ürün görselleri, metinleri ve paket tasarımı Petiwell’e aittir. Elçi bunları yalnızca program süresince, kurallara uygun tanıtım için kullanabilir.
6.2. Elçi, program kapsamında ürettiği içerikte Petiwell’e; dünya çapında, gayri münhasır, devredilebilir, alt lisans verilebilir, bedelsiz, programın tanıtımı, arşivlenmesi, reklamı ve hukuki ispatı için içerik, ad, kullanıcı adı ve benzerliği kullanma lisansı verir. Elçi, içerikte üçüncü kişi hakkı bulunmadığını ve gereken izinleri aldığını beyan eder.
6.3. Petiwell, mevzuata aykırı veya yanıltıcı içeriğin düzeltilmesini, gizlenmesini veya kaldırılmasını isteyebilir.

Madde 7 — Gizlilik
Elçi; komisyon oranları, henüz kamuya açıklanmamış kampanyalar, diğer elçilerin verileri ve teknik bilgiler dâhil ticari sırları program süresince ve sonrasında 3 yıl gizli tutar. Kamuya açık ürün bilgisi bu kapsama girmez.

Madde 8 — Süre, askı ve fesih
8.1. Sözleşme, onboarding’in tamamlanması ve Petiwell’in Elçiyi onaylamasıyla yürürlüğe girer; belirsiz sürelidir.
8.2. Olağan fesih: taraflardan her biri, ${terminationDays} gün önceden yazılı veya e-posta bildirimiyle feshedebilir. Fesih, hak edilmiş ve kurala uygun komisyonları silmez.
8.3. Haklı nedenle derhâl fesih / kupon-referral’ın durdurulması: ağır reklam ihlali, yasak sağlık iddiası, dolandırıcılık, kendi kendine komisyon, müşteri verisi toplama, Petiwell adına yetkisiz işlem, 18 yaşın altında olma, sahte belge, kupon sızıntısı veya programın ciddi itibar/hukuk ihlali.
8.4. ${firstContentDays} günlük ilk içerik yükümlülüğünün yerine getirilmemesi veya uzun inaktivite, kuponun askıya alınması veya olağan fesih nedeni olabilir.

Madde 9 — Sorumluluk ve tazminat
9.1. Elçinin mevzuata aykırı reklamı, yanıltıcı beyanı, fikri hak ihlali veya üçüncü kişi taleplerinden Elçi sorumludur. Elçi, bu nedenle Petiwell’in uğradığı makul ve belgelenebilir zarar, idari para cezası ve zorunlu vekâlet ücretini tazmin eder.
9.2. Petiwell, programdan asgari gelir, takipçi artışı veya satış hacmi taahhüt etmez.
9.3. Mücbir sebep (doğal afet, salgın, savaş, resmî yasak, uzun süreli altyapı kesintisi) edimleri askıya alır.

Madde 10 — Vergi ve ödeme
10.1. Elçi kendi vergi, damga vergisi (doğarsa), sosyal güvenlik ve 20/B dâhil istisna beyanlarının doğruluğundan bizzat sorumludur. Petiwell vergi danışmanlığı vermez.
10.2. Gelir Vergisi Kanunu mükerrer 20/B kapsamı, Elçinin fiili faaliyeti ve Gelir İdaresi uygulamasına bağlıdır; belge yüklemek istisnanın kesinleştiği anlamına gelmez.
10.3. Ödeme yalnızca Elçi adına doğrulanmış IBAN’a yapılır. Belge, fatura veya risk incelemesi tamamlanmadan ödeme bekletilebilir; bekletme hak edilmiş komisyonu silmez.
10.4. Mevzuat tevkifat, stopaj veya bildirim yükümlülüğü doğurursa Petiwell yasal kesintiyi uygulayabilir.
10.5. Ayrıntılı hesaplama Kupon ve Komisyon Program Kuralları’ndadır.

Madde 11 — Kişisel veriler
Elçi KVKK Aydınlatma Metni işbu sözleşmenin eki olup onboarding’de ayrıca onaylanır. Aydınlatmanın okunması, isteğe bağlı işlemler dışında açık rıza değildir.

Madde 12 — Tebligat
Tarafların beyan ettiği e-posta ve onboarding adresi tebligat adresidir. ${email} adresine gönderilen elektronik bildirim, gönderimi izleyen iş günü tebliğ edilmiş sayılır.

Madde 13 — Delil, hukuk ve yetki
Petiwell’in onboarding, onay kutusu, IP/cihaz özeti, belge hash ve elektronik kayıtları 6100 sayılı HMK m.193 uyarınca delil kabul edilir. Uygulanacak hukuk Türkiye hukukudur. Uyuşmazlıklarda ${venue} mahkemeleri ve icra daireleri yetkilidir.

Madde 14 — Yürürlük
Elçi, belgeleri okuyup işaretleyerek ve başvuruyu tamamlayarak işbu metnin tüm maddelerini kabul eder. Petiwell onayı ile program başlar. Metin güncellenirse yeni sürüm ve hash ile yeniden onay aranır.`,

    KVKK_NOTICE: `PETİWELL MARKA ELÇİSİ KVKK AYDINLATMA METNİ
(6698 sayılı Kanun m.10)

1. Veri sorumlusu
${identity}
Başvuru: ${email}

2. İşlenen kişisel veriler
Kimlik: ad, soyad, doğum tarihi, T.C. kimlik numarası veya vergi kimlik numarası (şifreli).
İletişim: e-posta, telefon, teslimat adresi, il/ilçe.
Sosyal medya: platform, kullanıcı adı, profil URL’si, yayımlanan içerik bağlantıları.
Mali: vergi türü, vergi dairesi, işletme unvanı, fatura adresi, IBAN ve hesap sahibi (şifreli), 20/B veya vergi belgesi.
Program: kupon, referral, komisyon, payout, içerik inceleme, fesih ve denetim kayıtları.
Teknik: IP özeti, tarayıcı/cihaz, onay zamanı, belge hash’i, yüklenen dosya meta verisi.
Özel nitelikli veri kasten işlenmez; sağlık verisi talep edilmez.

3. Amaçlar
Davet ve kimlik doğrulama; sözleşmenin kurulması ve ifası; başlangıç paketinin gönderilmesi; kupon/referral ve komisyonun hesaplanması, askıya alınması ve ödenmesi; vergi/muhasebe ve yasal bildirim; reklam mevzuatı denetimi; dolandırıcılık, kupon sızıntısı ve kendi kendine kazanç incelemesi; uyuşmazlık ve ispat; bilgi güvenliği.

4. Hukuki sebepler
KVKK m.5/2(c) sözleşmenin kurulması ve ifası;
m.5/2(a) ve m.5/2(ç) vergi, e-ticaret, reklam ve muhasebe yükümlülükleri;
m.5/2(e) hakkın tesisi, kullanılması veya korunması;
m.5/2(f) meşru menfaat (güvenlik, dolandırıcılığın önlenmesi, program bütünlüğü) — temel haklara zarar vermemek kaydıyla.
TCKN/vergi kimliği ve IBAN, ödeme ve vergi yükümlülüğünün ifası için zorunludur. Bu metnin okunması açık rıza değildir; programın yürütülmesi için zorunlu veriler rıza şartına bağlanmaz.

5. Aktarım
Amaçla sınırlı: barındırma ve private dosya saklama, e-posta, kargo, banka (IBAN ile EFT), mali müşavir, avukat, zorunlu kamu kurumları (vergi dairesi, mahkeme, Reklam Kurulu vb.).
Yurt dışı aktarım olursa (barındırma/e-posta) KVKK’nın güncel yurt dışı aktarım hükümleri uygulanır.

6. Saklama
Sözleşme, komisyon, vergi ve TTK saklama süreleri (kural olarak 10 yıla kadar); uyuşmazlık zamanaşımı boyunca; onay kayıtları ispat için; taslak/onaysız onboarding ve gereksiz belgeler süre sonunda silinir veya anonimleştirilir. Ayrıntılı silme işi ancak saklama süresi operasyonel olarak onaylandıktan sonra çalışır.

7. Haklar ve başvuru
KVKK m.11 haklarınız (erişim, düzeltme, silme, aktarım bilgisi, itiraz, zarar) ${email} veya postaya, kimliğinizi tevsik ederek kullanılır. Başvurular Tebliğ uyarınca kural olarak ücretsizdir ve 30 gün içinde sonuçlanır. Kişisel Verileri Koruma Kurulu’na şikâyet hakkınız saklıdır. Silme talebi, yasal saklama ve ispat yükümlülüğü devam ettiği sürece yerine getirilmeyebilir.

8. Nitelik
Bu metin aydınlatmadır. İsteğe bağlı olmayan program verilerinin işlenmesi açık rıza temeline dayanmaz.`,

    CONTENT_RULES: `PETİWELL REKLAM VE İÇERİK KURALLARI

1. Hukuki çerçeve
6502 sayılı Kanun, 6563 sayılı Kanun, Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği, Reklam Kurulu ilke kararları ve sosyal medya etkileyicilerine ilişkin güncel reklam kuralları uygulanır.

2. Reklam açıklaması (zorunlu)
Ücret, komisyon, bedelsiz veya indirimli ürün, kupon veya herhangi bir maddi menfaat karşılığı her paylaşımda ticari ilişki, ortalama tüketicinin ilk bakışta fark edeceği şekilde açıklanır.
Asgari ifade: “Reklam | Petiwell ile iş birliği”. Eşdeğer ve görünür: “Reklam”, “İş Birliği”, “Sponsorlu”. İfade videoda sesli+görsel, hikâyede ilk karede, kalıcı gönderide başta yer almalıdır. Yalnızca etiket veya yorum satırı yeterli değildir. “İş birliği içerebilir”, “davet”, “hediye” gibi örtük ifadeler tek başına yetmez.
Organik izlenimi veren gizlenmiş reklam (gizli reklam) yasaktır.

3. İlk içerik
İlk kalıcı içerikte en az bir Petiwell ürünü, Elçiye özel kupon kodu ve Petiwell resmi hesap etiketi görünür. İlk içerik yayımdan önce Petiwell’e sunulur. Sonraki içeriklerde rutin ön onay yoktur; aykırılıkta düzeltme, gizleme veya 24 saatlik kaldırma talep edilebilir.

4. Dürüstlük
Deneyimlenmeyen ürün deneyimlenmiş gibi anlatılamaz. Satın alma, stok, fiyat, indirim oranı veya teslimat hakkında güncel olmayan ya da spekülatif beyanda bulunulamaz. Sahte yorum, sahte takipçi, otomatik spam ve başka markayı haksız kötüleme yasaktır.
Karşılaştırmalı reklam, kanıtlanabilir, aldatıcı olmayan ve Reklam Kurulu kurallarına uygun olmadıkça yapılmaz.

5. Yetki sınırı
Elçi sipariş alamaz, ödeme tahsil edemez, iade sözü veremez, “resmi satıcı / yetkili bayi / Petiwell çalışanı” izlenimi yaratamaz. Tüketici sorularını petiwell.com veya ${email} adresine yönlendirir.

6. Çocuklar ve hassas kitle
18 yaş altı kişileri hedefleyen, onları ticari uygulamaya yönelten veya ebeveyn izni olmaksızın veri toplayan içerik yayımlanamaz.

7. Yaptırım
Aykırılıkta içerik düzeltme, kupon askısı, komisyon incelemesi ve sözleşmenin haklı nedenle feshi uygulanabilir. Ağır veya tekrarlayan ihlalde derhâl durdurma yapılır.`,

    CLAIMS_GUIDE: `PETİWELL SERBEST / YASAK ÜRÜN İDDİALARI REHBERİ

1. Ürün niteliği
Petiwell ürünleri ilaç, veteriner hekim reçeteli müstahzar veya tedavi edici ürün değildir. Tanıtım, ürün etiketi ve Petiwell’in sağladığı güncel ürün metinleriyle sınırlıdır.

2. Kullanılabilir (ölçülü) anlatımlar
Etiket ve resmi ürün metniyle uyumlu olmak kaydıyla:
- “Günlük bakım desteği”
- “Tüy ve deri bakımına odaklanır”
- “Tüy yumağı bakımına yönelik”
- “Kısırlaştırılmış kedilerin günlük kullanımına yönelik” (yalnızca ilgili SKU için)
Kişisel deneyim, abartısız ve tekil vaka olduğu belirtilerek paylaşılabilir (“benim kedimde gözlemlediğim”).

3. Yasak iddialar
Aşağıdakiler ve eşdeğerleri yasaktır:
- Hastalık teşhis, tedavi, önleme, iyileştirme, kür, reçete;
- Veteriner tedavisinin yerine geçme veya “veterinere gitmenize gerek yok”;
- “Kesin sonuç”, “garanti”, “kanıtlanmış”, “klinik olarak ispatlı”, “doktor/veteriner onaylı” (Petiwell yazılı belgesi yoksa);
- İnsan sağlığına ilişkin iddia;
- Yanıltıcı önce/sonra görseli, başka hayvanın görselini kendi deneyimi gibi gösterme;
- Rakip ürüne ilişkin asılsız veya ölçülemez üstünlük iddiası.

4. Yasal dayanak
6502 sayılı Kanun (aldatıcı ticari uygulama), Ticari Reklam Yönetmeliği, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile ilgili ikincil mevzuat ve Reklam Kurulu kararları.

5. Şüphe
İfade etiket veya bu rehberde yoksa yayımlamadan önce ${email} üzerinden sorunuz. Ciddi aykırılıkta 24 saatlik kaldırma/gizleme talebi verilebilir. Şüphe, Elçiyi sorumluluktan kurtarmaz.`,

    COMMISSION_RULES: `PETİWELL KUPON VE KOMİSYON PROGRAM KURALLARI

1. İndirim ve attribution
Aktif Elçi kodu, müşteriye sipariş anındaki snapshot oranıyla varsayılan %${discountPct} ürün indirimi sağlar (kargo ve KDV kuralları saklı).
Attribution sırası: (1) ödeme adımında girilen geçerli Elçi kodu, (2) son geçerli referral bağlantısı (${referralDays} gün, yalnızca uygun çerez izni varsa), (3) attribution yok.
Genel kampanya kodu ile Elçi referral’ı birleştirilemez. Trendyol ve diğer kanallar kapsamaz.

2. Komisyon matrahı
Komisyon, tüm ürün indirimlerinden sonra kalan, kargo hariç, KDV hariç net ürün bedeli üzerinden hesaplanır. Varsayılan oran %${commissionPct}’tir. Oran ve matrah sipariş anında snapshot olarak saklanır; sonradan oran değişikliği geçmiş siparişleri değiştirmez.

3. Doğum, onay, iade
Ödeme başarılı olunca komisyon BEKLEYEN doğar. Teslimat ve varsayılan ${holdDays} günlük iade/cayma süresi bitince ONAYLANABİLİR.
İptal, tam/kısmi iade, ödenmemiş veya sahte işlem komisyonu doğurmaz; doğmuşsa iptal veya oransal negatif düzeltme yapılır (clawback).
Elçinin kendi siparişi, aynı hane/kontrollü ödeme aracı, sızdırılmış kupon veya dolandırıcılık incelemesindeki sipariş komisyon doğurmaz; incelemede askıya alınabilir.

4. Ödeme
Dönemler: her ayın 1’i ve 15’i. Onaylı kullanılabilir bakiye ${minPayout} TL altındaysa sonraki döneme devreder.
Ödeme, doğrulanmış vergi statüsü ve Elçi adına IBAN olmadan yapılmaz. Faturalı işletmede fatura onayına kadar ödeme bekler. Komisyon silinmez; ödenmesi ertelenir.
Petiwell otomatik EFT taahhüt etmez; operasyonel olarak banka referansı ile işaretlenir.
Yasal tevkifat doğarsa net ödeme kesinti sonrası kalır.

5. Vergi
Elçi gelirini kendi beyan eder. 20/B belgesi istisnanın kesinleşmesi değildir. Yanlış beyandan Elçi sorumludur. Petiwell gelir, KDV veya stopaj tavsiyesi vermez.

6. Gelir garantisi yoktur
Takipçi, görüntülenme veya satış taahhüt edilmez. Program, asgari ücret veya primli istihdam değildir.

7. Fesih sonrası
Fesih, kurala uygun doğmuş ve clawback’e konu olmayan komisyonları silmez. Fesihten sonra yeni attribution işlemez; kupon ve referral kapatılır.`
  };
}

export function getAmbassadorLegalDocuments(): AmbassadorLegalDocument[] {
  const version = documentVersion();
  const bodies = buildBodies();
  const specs: {
    type: AmbassadorConsentType;
    title: string;
    action: AmbassadorConsentAction;
    body: string;
  }[] = [
    {
      type: "AMBASSADOR_AGREEMENT",
      title: "Petiwell Marka Elçiliği ve Satış Ortaklığı Sözleşmesi",
      action: "ACCEPTED",
      body: bodies.AMBASSADOR_AGREEMENT
    },
    {
      type: "KVKK_NOTICE",
      title: "Petiwell Marka Elçisi KVKK Aydınlatma Metni",
      action: "ACKNOWLEDGED",
      body: bodies.KVKK_NOTICE
    },
    {
      type: "CONTENT_RULES",
      title: "Petiwell Reklam ve İçerik Kuralları",
      action: "ACCEPTED",
      body: bodies.CONTENT_RULES
    },
    {
      type: "CLAIMS_GUIDE",
      title: "Petiwell Serbest / Yasak Ürün İddiaları Rehberi",
      action: "ACCEPTED",
      body: bodies.CLAIMS_GUIDE
    },
    {
      type: "COMMISSION_RULES",
      title: "Petiwell Kupon ve Komisyon Program Kuralları",
      action: "ACCEPTED",
      body: bodies.COMMISSION_RULES
    }
  ];

  return specs.map((document) => ({
    ...document,
    version,
    hash: createHash("sha256")
      .update(`${document.type}:${version}:${document.body}`)
      .digest("hex")
  }));
}

/** Snapshot at import time for callers that still read the constant. */
export const AMBASSADOR_LEGAL_DOCUMENTS: AmbassadorLegalDocument[] =
  getAmbassadorLegalDocuments();

export function ambassadorLegalDocument(type: AmbassadorConsentType) {
  return (
    getAmbassadorLegalDocuments().find((document) => document.type === type) ||
    null
  );
}

export function ambassadorLegalDocsApproved(): boolean {
  return true;
}
