import { createHash } from "crypto";
import type {
  AmbassadorConsentAction,
  AmbassadorConsentType
} from "@prisma/client";

export type AmbassadorLegalDocument = {
  type: AmbassadorConsentType;
  title: string;
  version: string;
  action: AmbassadorConsentAction;
  body: string;
  hash: string;
};

const VERSION = process.env.AMBASSADOR_DOCUMENT_VERSION || "2026-09-17-draft";

const RAW_DOCUMENTS: Omit<AmbassadorLegalDocument, "hash" | "version">[] = [
  {
    type: "AMBASSADOR_AGREEMENT",
    title: "Petiwell Marka Elçiliği ve Satış Ortaklığı Sözleşmesi",
    action: "ACCEPTED",
    body: `Bu metin Petiwell Marka Elçiliği pilot programının çalışma esaslarını düzenler.

Marka Elçisi bağımsız hareket eder; Petiwell çalışanı, acentesi veya ticari temsilcisi değildir. Petiwell adına sipariş, ödeme, taahhüt veya müşteri kişisel verisi alamaz.

Başlangıç paketi iki Petiwell ürünü, bilgilendirme kartı, kupon kodu ve QR kod içerebilir. Elçi, paketin tesliminden itibaren 14 gün içinde en az bir kalıcı içerik yayımlamayı; ilk içeriği yayımdan önce Petiwell incelemesine sunmayı kabul eder. İlk içerikten sonra aylık zorunlu paylaşım kotası yoktur.

Elçiye aktif olduğu sürece kişiye özel kupon ve referral bağlantısı verilebilir. Geçerli web sitesi satışlarında komisyon oranı sipariş anındaki snapshot oranıdır. İptal, iade, kendi alışverişi, sahte veya şüpheli işlem komisyon doğurmaz. Hak edilmiş gerçek komisyonlar programın sona ermesiyle silinmez.

Vergi ve banka bilgilerinin doğruluğu Elçinin sorumluluğundadır. Ödeme yalnızca doğrulanmış vergi statüsü ve Elçi adına kayıtlı banka hesabına yapılır. Petiwell, mevzuat veya risk incelemesi nedeniyle ödemeyi belge tamamlanana kadar bekletebilir.

Normal fesih bildirimi varsayılan olarak 15 gün sonra hüküm doğurur. Ağır reklam ihlali, dolandırıcılık, müşteri verisi toplama veya Petiwell adına yetkisiz işlemde kupon ve referral derhal durdurulabilir.`,
  },
  {
    type: "KVKK_NOTICE",
    title: "Petiwell Marka Elçisi KVKK Aydınlatma Metni",
    action: "ACKNOWLEDGED",
    body: `Veri sorumlusu Petiwell'dir. Kimlik, iletişim, sosyal medya, teslimat, vergi, banka, sözleşme, içerik, satış ortaklığı ve ödeme kayıtları; davet ve onboarding süreçlerinin yürütülmesi, sözleşmenin kurulması ve ifası, başlangıç paketinin gönderilmesi, kupon/referral ve komisyon işlemleri, vergi ve muhasebe yükümlülükleri, bilgi güvenliği, uyuşmazlıkların yönetimi ve hukuki yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.

Veriler; hizmet alınan barındırma, private dosya saklama, e-posta, kargo, banka, mali müşavirlik ve hukuk hizmeti sağlayıcılarına amaçla sınırlı olarak aktarılabilir. Yurt dışı aktarım bulunması halinde KVKK'nın güncel aktarım hükümlerine uygun mekanizma kullanılır.

Veriler ilgili mevzuat, zamanaşımı, vergi/muhasebe ve sözleşme süreleri boyunca saklanır; süresi sona eren ve hukuken gerekli olmayan onboarding taslakları ile dosyalar silinir veya anonimleştirilir.

KVKK kapsamındaki erişim, düzeltme, silme, işlemeyi kısıtlama ve diğer başvurular Petiwell iletişim kanallarından yapılabilir. Bu metnin okunduğuna ilişkin kayıt açık rıza değildir.`,
  },
  {
    type: "CONTENT_RULES",
    title: "Petiwell Reklam ve İçerik Kuralları",
    action: "ACCEPTED",
    body: `Ücret, komisyon, ücretsiz veya indirimli ürün karşılığı tüm paylaşımlarda reklam ilişkisi ilk bakışta fark edilecek şekilde “Reklam | Petiwell ile iş birliği” veya mevzuata uygun eşdeğer bir ifadeyle belirtilmelidir.

İlk kalıcı içerikte en az bir Petiwell ürünü, Elçiye özel kupon kodu ve Petiwell resmi hesap etiketi görünmelidir. İlk içerik yayımdan önce incelenir. Sonraki içerikler için rutin ön onay aranmaz; mevzuata aykırı içerikler için düzeltme veya kaldırma istenebilir.

Elçi deneyimlemediği ürünü deneyimlemiş gibi tanıtamaz; tüketiciyi yanıltamaz; fiyat, kampanya, stok veya ürün özelliği hakkında doğrulanmamış beyanda bulunamaz. Müşteri adına sipariş veya ödeme alamaz.`,
  },
  {
    type: "CLAIMS_GUIDE",
    title: "Petiwell Serbest / Yasak Ürün İddiaları Rehberi",
    action: "ACCEPTED",
    body: `Serbest anlatımlar ürünün etiket ve Petiwell tarafından sağlanan doğrulanmış ürün metinleriyle sınırlıdır. “Günlük bakım desteği”, “tüy ve deri bakımına odaklanır” ve “tüy yumağı bakımına yönelik” gibi ölçülü ifadeler kullanılabilir.

Hastalık teşhis, tedavi veya önleme; veteriner tedavisinin yerine geçme; kesin sonuç, garanti, bilimsel olarak kanıtlanmış veya doktor/veteriner onayı izlenimi veren beyanlar yasaktır. Öncesi/sonrası görselleri yanıltıcı biçimde kullanılamaz.

Şüpheli bir ifade yayımlanmadan önce Petiwell'e sorulmalıdır. Mevzuata aykırı ciddi içerik için 24 saatlik kaldırma/gizleme talebi verilebilir.`,
  },
  {
    type: "COMMISSION_RULES",
    title: "Petiwell Kupon ve Komisyon Program Kuralları",
    action: "ACCEPTED",
    body: `Aktif Elçi kodu müşteriye varsayılan olarak %10 indirim sağlar. Attribution önceliği manuel geçerli Elçi kodu, son geçerli referral bağlantısı ve attribution yok sırasındadır. Referral süresi varsayılan olarak 30 gündür ve izin gerektiren saklama teknolojileri yalnızca uygun kullanıcı tercihiyle kullanılır.

Komisyon varsayılan olarak tüm ürün indirimlerinden sonra kalan, kargo hariç KDV hariç ürün bedelinin %15'idir. Oranlar sipariş anında snapshot olarak saklanır. Trendyol ve diğer satış kanalları komisyon kapsamı dışındadır.

Komisyon ödeme başarılı olduğunda bekleyen statüde oluşur; teslimat ve varsayılan 14 günlük iade süresi tamamlandıktan sonra onaylanabilir. İptal/iade komisyonu iptal eder veya düzeltir. Elçinin kendi siparişi komisyon doğurmaz.

Ödeme dönemleri ayın 1'i ve 15'idir. Onaylı kullanılabilir bakiye 500 TL'nin altındaysa bakiye sonraki döneme devreder. Vergi belgesi, fatura veya banka doğrulaması eksikse komisyon silinmez; ödeme bekletilir.`,
  }
];

export const AMBASSADOR_LEGAL_DOCUMENTS: AmbassadorLegalDocument[] =
  RAW_DOCUMENTS.map((document) => ({
    ...document,
    version: VERSION,
    hash: createHash("sha256")
      .update(`${document.type}:${VERSION}:${document.body}`)
      .digest("hex")
  }));

export function ambassadorLegalDocument(type: AmbassadorConsentType) {
  return AMBASSADOR_LEGAL_DOCUMENTS.find((document) => document.type === type) || null;
}

export function ambassadorLegalDocsApproved(): boolean {
  return (
    process.env.AMBASSADOR_LEGAL_DOCS_APPROVED === "true" &&
    !VERSION.toLowerCase().includes("draft")
  );
}
