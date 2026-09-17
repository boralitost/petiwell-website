import { createHash } from "crypto";
import type { Locale } from "@/lib/i18n";
import { getCompanyInfo } from "@/lib/company";
import {
  sellerDisplayName,
  sellerIdentityText,
  sellerVenue
} from "@/lib/legal-identity";

export const CONSUMER_LEGAL_VERSION = "2026-09-17";

export type PolicySection = {
  id: string;
  title: string;
  body: string;
};

export type PolicyDoc = {
  title: string;
  intro: string;
  lastUpdated?: string;
  sections: PolicySection[];
};

export type ConsumerPolicyKey =
  | "privacy"
  | "cookies"
  | "shipping"
  | "distanceSales"
  | "preInfo"
  | "withdrawal"
  | "legal";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com").replace(
    /\/$/,
    ""
  );
}

export function getConsumerPolicy(
  locale: Locale,
  key: ConsumerPolicyKey
): PolicyDoc {
  const catalog = locale === "en" ? englishPolicies() : turkishPolicies();
  return catalog[key];
}

export function getConsumerLegalSnapshot(locale: Locale = "tr"): {
  version: string;
  hash: string;
} {
  const keys: ConsumerPolicyKey[] = [
    "privacy",
    "preInfo",
    "distanceSales",
    "shipping",
    "withdrawal"
  ];
  const body = keys
    .map((key) => {
      const doc = getConsumerPolicy(locale, key);
      return [
        doc.title,
        doc.intro,
        ...doc.sections.map((section) => `${section.title}\n${section.body}`)
      ].join("\n");
    })
    .join("\n---\n");
  return {
    version: CONSUMER_LEGAL_VERSION,
    hash: createHash("sha256")
      .update(`${locale}:${CONSUMER_LEGAL_VERSION}:${body}`)
      .digest("hex")
  };
}

function turkishPolicies(): Record<ConsumerPolicyKey, PolicyDoc> {
  const company = getCompanyInfo();
  const seller = sellerDisplayName(company);
  const identity = sellerIdentityText("tr", company);
  const venue = sellerVenue(company);
  const email = company.email;
  const updated = CONSUMER_LEGAL_VERSION;
  const origin = siteUrl();

  return {
    legal: {
      title: "Yasal Bilgilendirme",
      intro: `${seller} tarafından işletilen petiwell.com; marka tanıtımı ve 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği kapsamında mesafeli satış amacıyla sunulur.`,
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "Satıcı / veri sorumlusu",
          body: identity
        },
        {
          id: "product",
          title: "Ürün niteliği",
          body: "Petiwell ürünleri ilaç, veteriner hekim reçeteli müstahzar veya tedavi edici ürün değildir. Sitedeki açıklamalar ürün etiketinin yerine geçmez. Kullanımda etiket esas alınır; kedinizin özel durumunda veteriner hekime danışılmalıdır."
        },
        {
          id: "channel",
          title: "Satış kanalları",
          body: "Ürünler petiwell.com üzerinden (aktif olduğunda PayTR ile) ve Trendyol mağazası üzerinden satılabilir. Trendyol siparişlerinde aracı platformun sözleşme, teslimat, cayma ve iade kuralları uygulanır. Fiyat, stok ve kargo koşulları ilgili kanalın güncel bilgisine tabidir."
        },
        {
          id: "price",
          title: "Fiyat, vergi ve kampanya",
          body: "Sitede aksi belirtilmedikçe fiyatlar Türk Lirası ve KDV dâhildir. Kampanya, kupon ve Elçi indirimleri sipariş özetinde gösterilir. Gösterilen kampanya, stok ve süre ile sınırlıdır; yanıltıcı veya tükenmiş bir avantaj taahhüt edilmez."
        },
        {
          id: "comms",
          title: "Elektronik iletiler",
          body: "Sipariş, ödeme, kargo ve cayma bildirimleri 6563 sayılı Kanun uyarınca sözleşmenin kurulması ve ifası için gönderilir. Pazarlama içerikli ticari elektronik ileti, ayrı açık rıza olmadan gönderilmez."
        },
        {
          id: "ip",
          title: "Fikri mülkiyet",
          body: "Site tasarımı, metinler, logolar, ürün görselleri ve marka unsurları Petiwell ve/veya ilgili hak sahiplerine aittir. İzinsiz kopyalama, çerçeveleme, veri madenciliği veya ticari kullanım yasaktır."
        },
        {
          id: "law",
          title: "Uygulanacak hukuk",
          body: `Site kullanımı ve mesafeli satışlara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici uyuşmazlıklarında Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri; diğer uyuşmazlıklarda ${venue} mahkemeleri ve icra daireleri yetkilidir.`
        }
      ]
    },
    privacy: {
      title: "Gizlilik ve KVKK Aydınlatma Metni",
      intro: `6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) m.10 uyarınca veri sorumlusu ${seller}’dir. Bu metin sipariş, üyelik, çerez, müşteri destek ve (ayrı program kapsamında) marka elçiliği süreçlerinde işlenen kişisel verilere ilişkindir. Marka elçilerine ayrıca program KVKK metni sunulur.`,
      lastUpdated: updated,
      sections: [
        {
          id: "controller",
          title: "1. Veri sorumlusu",
          body: `${identity}\n\nBaşvurular ${email} adresine veya yukarıdaki postaya iletilir.`
        },
        {
          id: "data",
          title: "2. İşlenen kişisel veriler",
          body: "Kimlik ve iletişim: ad-soyad, e-posta, telefon.\nTeslimat ve fatura: adres, il, ilçe, posta kodu.\nİşlem: sipariş kalemleri, tutar, kupon/referral, sipariş ve ödeme durumu, iade/cayma kayıtları.\nHesap: e-posta ile üyelik, şifre özeti, oturum.\nTeknik: IP, tarayıcı/cihaz bilgisi, çerez kimlikleri, güvenlik logları.\nÖdeme: kart numarası, CVV ve son kullanma tarihi sitemizde saklanmaz; PayTR tarafından işlenir. Satıcı yalnızca ödeme sonucu, sipariş numarası ve zorunlu mutabakat verisini görür.\nPazarlama: yalnızca açık rıza verdiyseniz analitik/reklam çerezleri ve ölçüm kimlikleri."
        },
        {
          id: "purpose",
          title: "3. İşleme amaçları",
          body: "Mesafeli satış sözleşmesinin kurulması ve ifası; teslimat, faturalama, iade/cayma ve müşteri destek; üyelik hesabının yönetimi; ödeme güvenliği, dolandırıcılık ve kötüye kullanımın önlenmesi; yasal saklama, vergi, e-ticaret ve tüketici mevzuatı yükümlülükleri; açık rızaya bağlı analitik ve reklam ölçümü; uyuşmazlıkların takibi."
        },
        {
          id: "legal-basis",
          title: "4. Hukuki sebepler",
          body: "KVKK m.5/2(c) sözleşmenin kurulması ve ifası; m.5/2(a) kanunlarda açıkça öngörülmesi (vergi, e-ticaret, tüketici, muhasebe); m.5/2(ç) veri sorumlusunun hukuki yükümlülüğü; m.5/2(e) hakkın tesisi, kullanılması veya korunması; m.5/2(f) meşru menfaat (bilgi güvenliği, dolandırıcılığın önlenmesi, zorunlu çerezler) — temel hak ve özgürlüklerinize zarar vermemek kaydıyla.\nAnalitik ve reklam çerezleri ile pazarlama ölçümü yalnızca KVKK m.5/1 ve elektronik ticaret mevzuatı kapsamında açık rızaya dayanır. Rıza, çerez bandından geri alınabilir."
        },
        {
          id: "transfer",
          title: "5. Aktarım",
          body: "Amaçla sınırlı olarak şu alıcılara aktarılabilir: PayTR (ödeme kuruluşu), kargo / lojistik sağlayıcıları, e-posta ve barındırma hizmetleri, muhasebe ve hukuk danışmanları, zorunlu kılınan kamu kurumları.\nYurt dışı aktarım (ör. barındırma veya e-posta altyapısı yurt dışında ise) KVKK’nın güncel yurt dışı aktarım hükümleri, yeterli koruma, standart sözleşme veya açık rıza mekanizmalarına uygun yürütülür."
        },
        {
          id: "retention",
          title: "6. Saklama",
          body: "Sipariş, fatura ve muhasebe kayıtları vergi ve Türk Ticaret Kanunu süreleri boyunca (kural olarak 10 yıl); tüketici işlemleri ve elektronik ticaret kayıtları ilgili zamanaşımı ve ispat süreleri boyunca; üyelik verileri hesap açıkken ve kapanıştan sonra yasal zorunluluk bitene kadar; çerezler türüne göre oturum veya en fazla 13 ay; güvenlik logları makul süre saklanır. Süre bitince veri silinir, yok edilir veya anonimleştirilir."
        },
        {
          id: "rights",
          title: "7. KVKK m.11 hakları ve başvuru",
          body: `Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme, aktarılan üçüncü kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonucun çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarınız vardır.\n\nBaşvuru: ${email} veya ${company.address} adresine, kimliğinizi tevsik eden bilgiyle. Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca başvurular kural olarak ücretsizdir; işlemin ayrıca bir maliyet gerektirmesi hâlinde Tebliğ tarifesi uygulanabilir. Başvurular en geç 30 gün içinde sonuçlandırılır. Sonuca itiraz için Kişisel Verileri Koruma Kurulu’na şikâyet yolunuz saklıdır.`
        },
        {
          id: "not-consent",
          title: "8. Bu metnin niteliği",
          body: "Bu aydınlatma, KVKK m.10 bilgilendirme yükümlülüğünü yerine getirir. Sözleşmenin ifası için zorunlu verilerin işlenmesi açık rıza şartına bağlanmaz. Açık rıza yalnızca isteğe bağlı işlemler (analitik/reklam çerezleri) için ayrıca alınır."
        }
      ]
    },
    cookies: {
      title: "Çerez Politikası",
      intro: `${seller}, petiwell.com’da 6698 sayılı KVKK, 6563 sayılı Kanun ve Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile uyumlu şekilde çerez ve benzeri izleme teknolojileri kullanır.`,
      lastUpdated: updated,
      sections: [
        {
          id: "what",
          title: "Çerez nedir?",
          body: "Çerez, tarayıcınıza bırakılan küçük metin dosyasıdır. Oturum çerezleri tarayıcı kapanınca silinir; kalıcı çerezler belirlenen süre saklanır. Piksel ve yerel depolama da benzer amaçla kullanılabilir."
        },
        {
          id: "types",
          title: "Kullandığımız türler",
          body: "Zorunlu: sepet, ödeme güvenliği, oturum, dil, dolandırıcılık önleme. Bunlar sitesiz çalışmaz; açık rıza aranmaz.\nTercih: örneğin çerez tercihinin hatırlanması.\nAnalitik (Google Analytics / Google etiketleri): yalnızca “Tümünü kabul et” derseniz. Trafik ve dönüşüm ölçümü.\nReklam (Google Ads): yalnızca aynı açık rıza ile. Kampanya ölçümü ve Consent Mode v2 sinyalleri.\nElçi referral çerezi: yalnızca tam çerez izni varsa yazılır; izin “Sadece zorunlu”ya dönerse silinir."
        },
        {
          id: "consent",
          title: "Rıza ve geri alma",
          body: "İlk ziyarette çerez bandı gösterilir. “Sadece zorunlu” analitik/reklam çerezini yazmaz. Tercihinizi tarayıcı çerezlerini temizleyerek veya bandı yeniden görüntüleyerek değiştirebilirsiniz. Zorunlu çerezlerin engellenmesi sepet ve ödemeyi bozabilir."
        },
        {
          id: "third",
          title: "Üçüncü taraflar",
          body: "Google Ireland/Google LLC analitik ve reklam çerezlerinde veri işleyen veya müşterek sorumluluk çerçevesinde yer alabilir. PayTR ödeme iframe’i kendi güvenlik çerezlerini kullanabilir. Üçüncü taraf politikaları ilgili sağlayıcıya aittir."
        },
        {
          id: "rights",
          title: "Haklarınız",
          body: `Kişisel veri haklarınız Gizlilik / KVKK metnindedir. Çerez soruları: ${email}.`
        }
      ]
    },
    shipping: {
      title: "Teslimat, Cayma ve İade Koşulları",
      intro: `Bu koşullar ${origin} üzerinden kurulan mesafeli satışlara uygulanır. Trendyol siparişlerinde Trendyol ve satıcı mağaza kuralları geçerlidir.`,
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "Satıcı",
          body: identity
        },
        {
          id: "delivery",
          title: "Teslimat süresi ve şekli",
          body: "Sipariş, stokta varsa ve ödeme onaylandıktan sonra kargoya verilir. Taahhüt edilen süre sipariş onayında veya kargo bildiriminde yer alır. 6502 sayılı Kanun uyarınca, taraflarca daha uzun süre kararlaştırılmadıkça sipariş edimin ifası siparişin satıcıya ulaşmasından itibaren 30 günü geçemez. Mücbir sebep, stok tükenmesi veya hatalı adres teslimatı geciktirebilir; bu hâlde derhâl bilgilendirilirsiniz. Teslimat, siparişte bildirilen adrese kargo ile yapılır. Adres hatası veya teslim alınmamasından doğan ikinci sevk masrafı alıcıya ait olabilir."
        },
        {
          id: "cost",
          title: "Teslimat masrafı",
          body: "Sitede listelenen ürün bedeli aksi belirtilmedikçe KDV ve standart yurt içi kargoyu kapsar; ödeme adımında kargo satırı 0 TL görünebilir. İade kargo masrafının kime ait olacağı, ayıplı maldan kaynaklanan iadelerde satıcıya, sebepsiz caymada kural olarak tüketiciye aittir (kanuni istisnalar saklıdır)."
        },
        {
          id: "withdrawal",
          title: "Cayma hakkı",
          body: `Tüketici, herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin, malın tüketiciye veya belirlediği üçüncü kişiye tesliminden itibaren 14 gün içinde sözleşmeden cayabilir. Cayma süresi malın tesliminde malın size veya gösterdiğiniz kişiye teslimi ile başlar. Cayma bildirimi ${email} adresine sipariş numarasıyla veya ${origin}/tr/withdrawal adresindeki formu kullanarak yapılır. Sözlü bildirim ispat açısından yeterli sayılmaz; yazılı veya kalıcı veri saklayıcısı ile bildirim esastır.\n\nCayma hakkının kullanıldığına ilişkin bildirimin 14 gün içinde yöneltilmesi yeterlidir. Mal, bildirimin satıcıya ulaşmasından itibaren 10 gün içinde, ilk teslimattaki duruma uygun şekilde iade edilmelidir.`
        },
        {
          id: "exceptions",
          title: "Cayma hakkının istisnaları",
          body: "Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca özellikle şu hâllerde cayma hakkı kullanılamaz (ilgili bentler saklıdır):\n- Teslimden sonra ambalajı açılmış olması hâlinde sağlık veya hijyen açısından iadesi uygun olmayan mallar (açılmış/mühürü bozulmuş pet takviyesi, macun, damlalıklı ürünler bu kapsama girebilir).\n- Tüketici talebiyle kişiselleştirilen veya çabuk bozulabilen mallar.\n- Teslimden sonra başka ürünlerle karışan ve niteliği gereği ayrıştırılamayan mallar.\n\nMühürü açılmamış, kullanılmamış ve yeniden satılabilir durumdaki ürünlerde 14 günlük cayma hakkı saklıdır. Hijyen istisnasının uygulanabilmesi için bu koşul ödeme öncesinde size bildirilmiş sayılır."
        },
        {
          id: "refund",
          title: "Bedel iadesi",
          body: "Cayma veya haklı iadede, iade edilen mala ilişkin bedel, mal satıcıya ulaştıktan sonra 14 gün içinde, ödemede kullandığınız yönteme uygun şekilde iade edilir. İade, PayTR/kart kuruluşunun takvimine bağlı olarak hesap ekstrenize yansıyabilir. Satıcı, malı iade almadan önce bedeli iade etmek zorunda değildir. Ayıplı maldan kaynaklanan zorunlu iadelerde kargo satıcıya aittir."
        },
        {
          id: "defect",
          title: "Ayıplı mal",
          body: `6502 sayılı Kanun kapsamındaki ayıp hâlinde ücretsiz onarım, yenisi ile değiştirme, bedel iadesi veya ayıp oranında indirim seçimlik haklarınız vardır. Başvuru ${email} üzerinden sipariş numarası ve ayıp açıklamasıyla yapılır.`
        },
        {
          id: "dispute",
          title: "Uyuşmazlık",
          body: `Başvurularınızı ${email} adresine iletebilirsiniz. Çözülemeyen tüketici uyuşmazlıklarında, yerleşim yeriniz veya satıcının bulunduğu yer Tüketici Hakem Heyeti (ilgili yıl parasal sınırları dâhilinde) ve Tüketici Mahkemeleri yetkilidir. Gerekirse il müdürlükleri ve Ticaret Bakanlığı tüketici başvuruları da kullanılabilir.`
        }
      ]
    },
    distanceSales: {
      title: "Mesafeli Satış Sözleşmesi",
      intro: `İşbu sözleşme, aşağıda kimliği yazılı satıcı ile petiwell.com üzerinden sipariş veren alıcı arasında, 6502 sayılı Kanun, Mesafeli Sözleşmeler Yönetmeliği ve 6563 sayılı Kanun hükümlerine göre elektronik ortamda kurulur.`,
      lastUpdated: updated,
      sections: [
        {
          id: "parties",
          title: "Madde 1 — Taraflar",
          body: `Satıcı:\n${identity}\n\nAlıcı: Ödeme adımında beyan edilen ad-soyad, iletişim ve teslimat bilgileri. Alıcı, bu bilgilerin doğru ve kendisine ait olduğunu kabul eder.`
        },
        {
          id: "subject",
          title: "Madde 2 — Konu",
          body: "Sözleşmenin konusu, alıcının seçtiği Petiwell ürünlerinin satışı, bedelinin tahsili ve teslimidir. Ürünün temel nitelikleri, adedi, vergiler dâhil satış bedeli, varsa indirim ve kargo, ödeme yöntemi sipariş özeti ve Ön Bilgilendirme Formu’nda yer alır; form bu sözleşmenin eki ve ayrılmaz parçasıdır."
        },
        {
          id: "formation",
          title: "Madde 3 — Kuruluş",
          body: "Sözleşme, alıcının ön bilgilendirme ve işbu metni onaylayıp ödemeyi başlatması ve satıcının siparişi sistemde kaydetmesi ile kurulur. Ödeme alınamazsa satıcı edimini ifa etmekle yükümlü olmaz. Satıcı, stok, açık hata (bariz fiyat hatası) veya mevzuata aykırılık hâlinde siparişi iptal edebilir; tahsil edilmişse bedeli iade eder."
        },
        {
          id: "price",
          title: "Madde 4 — Bedel ve ödeme",
          body: "Bedel, sipariş anında gösterilen KDV dâhil tutardır. Ödeme PayTR altyapısı ile alınır. Kart verisi satıcıya iletilmez. Taksit, vade farkı veya üç boyutlu güvenlik PayTR ve kart kuruluşu kurallarına tabidir. Kampanya ve Elçi kuponları yalnızca belirtilen koşullarla geçerlidir; kendi kendine komisyon veya kötüye kullanım satıcının siparişi iptal etme hakkını doğurur."
        },
        {
          id: "delivery",
          title: "Madde 5 — Teslimat",
          body: "Teslimat, Teslimat ve İade Koşulları’ndaki süre ve esaslara göredir. Risk, malın taşıyıcıya tesliminden sonra taşıma kurallarına; tüketiciye teslimde ise teslim anına göre belirlenir. Hasarlı koli teslim alınmamalı, kargo tutanağı tutulmalıdır."
        },
        {
          id: "withdrawal",
          title: "Madde 6 — Cayma ve iade",
          body: `Alıcı, yasal 14 günlük cayma hakkına ve Yönetmelik m.15 istisnalarına tabidir. Ayrıntı ve form: ${origin}/tr/shipping ve ${origin}/tr/withdrawal. Cayma, sözleşmeyi geçmişe etkili sona erdirir; satıcı yasal süre içinde bedeli iade eder.`
        },
        {
          id: "privacy",
          title: "Madde 7 — Kişisel veriler",
          body: `Alıcı verileri Gizlilik / KVKK Aydınlatma Metni’ne göre işlenir: ${origin}/tr/privacy. Ödeme kuruluşu kendi aydınlatmasına tabidir.`
        },
        {
          id: "liability",
          title: "Madde 8 — Sorumluluk",
          body: "Ürünler etiket bilgisine uygun evcil hayvan bakım ürünleridir; hastalık teşhis veya tedavi taahhüdü içermez. Satıcı, mücbir sebep, alıcının hatalı adresi, üçüncü kişi kargo gecikmesi veya alıcının teslimatı kabul etmemesinden doğan sonuçlardan, kanunun yüklediği haller dışında sorumlu değildir. Ayıplı maldan doğan kanuni sorumluluk saklıdır."
        },
        {
          id: "law",
          title: "Madde 9 — Delil, hukuk ve yetki",
          body: `Satıcının resmi defter, elektronik kayıt, sipariş, onay ve log kayıtları 6100 sayılı HMK m.193 uyarınca delil niteliğindedir. Uygulanacak hukuk Türkiye hukukudur. Tüketici işlemlerinde Tüketici Hakem Heyeti ve Tüketici Mahkemeleri; diğerlerinde ${venue} mahkemeleri ve icra daireleri yetkilidir.`
        }
      ]
    },
    preInfo: {
      title: "Ön Bilgilendirme Formu",
      intro: "6502 sayılı Kanun m.48 ve Mesafeli Sözleşmeler Yönetmeliği m.5-6 uyarınca ödeme yükümlülüğü altına girmeden önce aşağıdaki bilgiler sunulur. Ödeme adımındaki onay kutuları, bu formun okunduğu ve kabul edildiği anlamına gelir.",
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "1. Satıcı kimliği",
          body: identity
        },
        {
          id: "product",
          title: "2. Malın temel nitelikleri",
          body: "Satışa konu mallar Petiwell kedi bakım ürünleridir (ör. Plus+B damlalıklı vitamin formatı; Sterile Paste malt macunu). Nihai nitelik, adet, SKU ve birim fiyat sipariş sepeti / ödeme özetinde gösterilir. Ürünler ilaç değildir; etiket talimatı esas alınır."
        },
        {
          id: "price",
          title: "3. Bedel, vergi, kargo",
          body: "Vergiler dâhil toplam bedel, varsa indirim, kupon ve kargo tutarı ödeme özetinde ayrı satırlarla gösterilir. Aksi belirtilmedikçe listedeki ürün fiyatı KDV ve standart yurt içi kargoyu içerir. Ek vergi veya gümrük (yurt dışı teslimatta) alıcıya aittir; site satışı yurt içi teslimata yöneliktir."
        },
        {
          id: "payment",
          title: "4. Ödeme",
          body: "Ödeme kredi/banka kartı ile PayTR güvenli ödeme sayfası üzerinden alınır. Kart bilgisi satıcı sisteminde tutulmaz. Ödeme alınmadan sipariş kesinleşmez."
        },
        {
          id: "delivery",
          title: "5. Teslimat",
          body: "Teslimat alıcının bildirdiği yurt içi adrese kargo iledir. Azami yasal süre 30 gündür; operasyonel hedef sipariş onayında belirtilir. Teslimat masrafı özet satırında görünür."
        },
        {
          id: "withdrawal",
          title: "6. Cayma hakkı ve istisnalar",
          body: `Teslimden itibaren 14 gün içinde gerekçesiz cayma hakkı vardır. Bildirim ${email} veya ${origin}/tr/withdrawal formu iledir. Teslimden sonra ambalajı açılmış hijyen/sağlık nedeniyle iadesi uygun olmayan ürünlerde (açılmış pet takviyesi/macun/damlalık) cayma kullanılamayabilir. Kullanılmamış, mühürü bozulmamış ürünlerde hak saklıdır. Ayrıntı: Teslimat ve İade sayfası.`
        },
        {
          id: "complaint",
          title: "7. Şikâyet ve tüketici başvuruları",
          body: `Şikâyet: ${email}. Çözülmezse Tüketici Hakem Heyeti ve Tüketici Mahkemesi. Satıcı kayıtları elektronik ortamda saklanır.`
        },
        {
          id: "privacy",
          title: "8. Kişisel veriler",
          body: `Aydınlatma metni: ${origin}/tr/privacy. Çerez politikası: ${origin}/tr/cookies.`
        },
        {
          id: "accept",
          title: "9. Onayın anlamı",
          body: "Ödeme sayfasındaki kutuları işaretlemeniz; ön bilgileri aldığınızı, mesafeli satış sözleşmesini kurduğunuzu, KVKK aydınlatmasını okuduğunuzu ve siparişin ödeme yükümlülüğü doğurduğunu kabul ettiğiniz anlamına gelir."
        }
      ]
    },
    withdrawal: {
      title: "Cayma Hakkı Bildirim Formu",
      intro: "Mesafeli Sözleşmeler Yönetmeliği ekindeki örneğe uygun olarak aşağıdaki formu doldurup satıcıya gönderebilirsiniz. Form kullanmak zorunlu değildir; aynı bilgileri e-posta ile iletmeniz de yeterlidir.",
      lastUpdated: updated,
      sections: [
        {
          id: "to",
          title: "Kime",
          body: `${identity}\nE-posta: ${email}`
        },
        {
          id: "text",
          title: "Bildirim metni",
          body: "Aşağıda bilgileri yer alan mal/hizmete ilişkin mesafeli satış sözleşmesinden cayma hakkımı kullandığımı bildiririm."
        },
        {
          id: "fields",
          title: "İletmeniz gereken bilgiler",
          body: `Sipariş numarası:\nSipariş / teslim tarihi:\nCayılan ürün ve adet:\nTüketici adı-soyadı:\nTeslimat adresi:\nİade IBAN’ı (bedelin aynı karta dönememesi hâlinde):\nTarih / imza (kâğıt gönderimde)\n\nFormu veya eşdeğer metni 14 günlük süre dolmadan ${email} adresine gönderin. Ürünü, bildirimin ulaşmasından itibaren 10 gün içinde, faturası ve eksiksiz ambalajıyla iade edin. Hijyen istisnası kapsamındaki açılmış ürünlerde cayma kabul edilmeyebilir.`
        }
      ]
    }
  };
}

function englishPolicies(): Record<ConsumerPolicyKey, PolicyDoc> {
  const company = getCompanyInfo();
  const seller = sellerDisplayName(company);
  const identity = sellerIdentityText("en", company);
  const venue = sellerVenue(company);
  const email = company.email;
  const updated = CONSUMER_LEGAL_VERSION;
  const origin = siteUrl();

  return {
    legal: {
      title: "Legal Notice",
      intro: `${seller} operates petiwell.com for brand information and, when enabled, distance sales under Turkish consumer law (Law No. 6502 and the Distance Contracts Regulation).`,
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "Seller / data controller",
          body: identity
        },
        {
          id: "product",
          title: "Product nature",
          body: "Petiwell products are not medicines or veterinary prescription products. Website copy does not replace the label. Follow the label and consult a veterinarian for your cat’s specific needs."
        },
        {
          id: "channel",
          title: "Sales channels",
          body: "Products may be sold on petiwell.com (PayTR, when enabled) and on Trendyol. Trendyol orders follow that marketplace’s contract, delivery and return rules."
        },
        {
          id: "price",
          title: "Price and campaigns",
          body: "Unless stated otherwise, site prices are in Turkish Lira and include VAT. Campaigns, coupons and ambassador discounts appear in the order summary and are limited by stock and term."
        },
        {
          id: "comms",
          title: "Electronic messages",
          body: "Order, payment, shipment and withdrawal notices are sent to perform the contract. Marketing messages are not sent without separate consent."
        },
        {
          id: "ip",
          title: "Intellectual property",
          body: "Site design, text, logos and images belong to Petiwell and/or rights holders. Unauthorised copying or commercial use is prohibited."
        },
        {
          id: "law",
          title: "Governing law",
          body: `Turkish law applies. Consumer disputes go to Consumer Arbitration Committees and Consumer Courts; other disputes to the courts of ${venue}.`
        }
      ]
    },
    privacy: {
      title: "Privacy & KVKK Notice",
      intro: `Under Article 10 of Law No. 6698 (KVKK), the data controller is ${seller}. This notice covers checkout, accounts, cookies, support and (under a separate notice) the brand-ambassador programme.`,
      lastUpdated: updated,
      sections: [
        {
          id: "controller",
          title: "1. Controller",
          body: `${identity}\n\nRequests: ${email} or the postal address above.`
        },
        {
          id: "data",
          title: "2. Data processed",
          body: "Identity and contact: name, e-mail, phone.\nDelivery/billing: address, city, district, postcode.\nTransaction: items, amounts, coupon/referral, payment and return status.\nAccount: e-mail login, password hash, session.\nTechnical: IP, device/browser, cookie IDs, security logs.\nPayment: card PAN/CVV/expiry are not stored by us; PayTR processes them.\nMarketing identifiers: only with cookie consent."
        },
        {
          id: "purpose",
          title: "3. Purposes",
          body: "Forming and performing the distance contract; delivery, invoicing, withdrawals; account management; payment security and fraud prevention; tax, e-commerce and consumer-law duties; consented analytics/ads; dispute handling."
        },
        {
          id: "legal-basis",
          title: "4. Legal bases",
          body: "KVKK Art. 5/2(c) contract; 5/2(a) and 5/2(ç) legal duties; 5/2(e) establishment of a right; 5/2(f) legitimate interest (security, fraud, essential cookies) without overriding your rights.\nAnalytics and ads cookies rely on Art. 5/1 consent, withdrawable via the cookie banner."
        },
        {
          id: "transfer",
          title: "5. Recipients",
          body: "PayTR, carriers, hosting/e-mail providers, accountants/lawyers, and competent authorities, purpose-limited. Cross-border transfers follow current KVKK transfer rules (adequacy, standard clauses or consent)."
        },
        {
          id: "retention",
          title: "6. Retention",
          body: "Orders and accounting: typically 10 years under tax/TCC rules; consumer/e-commerce records for limitation and evidence periods; account data while the account exists plus legal hold; cookies per type, analytics/ads up to 13 months; security logs for a reasonable period. Then erasure or anonymisation."
        },
        {
          id: "rights",
          title: "7. Article 11 rights",
          body: `You may request access, correction, erasure, restriction, information on recipients, objection to automated outcomes and compensation for unlawful processing.\nApply to ${email} or ${company.address} with identity details. Applications are free of charge as a rule and answered within 30 days. You may complain to the Personal Data Protection Board.`
        },
        {
          id: "not-consent",
          title: "8. Nature of this notice",
          body: "This is an Art. 10 information notice. Processing that is necessary to perform the contract is not conditioned on extra consent. Optional analytics/ads require separate consent."
        }
      ]
    },
    cookies: {
      title: "Cookie Policy",
      intro: `${seller} uses cookies on petiwell.com in line with KVKK and Law No. 6563.`,
      lastUpdated: updated,
      sections: [
        {
          id: "what",
          title: "What cookies are",
          body: "Small text files stored in your browser. Session cookies expire when you close the browser; persistent cookies last for a set period."
        },
        {
          id: "types",
          title: "Types we use",
          body: "Essential: cart, checkout security, session, language, fraud prevention — required, no consent.\nPreferences: e.g. remembering your cookie choice.\nAnalytics (Google): only if you Accept all.\nAds (Google Ads) and Consent Mode v2: only with the same consent.\nAmbassador referral cookie: only with full consent; deleted if you switch to essential-only."
        },
        {
          id: "consent",
          title: "Consent",
          body: "The banner appears on first visit. Essential only blocks analytics/ads cookies. Blocking essential cookies may break checkout."
        },
        {
          id: "third",
          title: "Third parties",
          body: "Google may process analytics/ads cookies. PayTR may set its own security cookies in the payment iframe."
        },
        {
          id: "rights",
          title: "Rights",
          body: `See the Privacy / KVKK notice. Cookie questions: ${email}.`
        }
      ]
    },
    shipping: {
      title: "Delivery, Withdrawal & Returns",
      intro: `These terms apply to distance contracts on ${origin}. Trendyol orders follow Trendyol rules.`,
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "Seller",
          body: identity
        },
        {
          id: "delivery",
          title: "Delivery",
          body: "In-stock paid orders are handed to the carrier. Unless a longer period is agreed, performance must occur within 30 days of the order reaching the seller (Law No. 6502). Force majeure, stock failure or a wrong address may delay delivery. Delivery is to the address you give. A re-shipment caused by your error may be charged to you."
        },
        {
          id: "cost",
          title: "Delivery cost",
          body: "Listed prices usually include VAT and standard domestic shipping; checkout may show shipping as 0 TRY. Return shipping is borne by the seller for defective goods and, as a rule, by the consumer for no-fault withdrawal."
        },
        {
          id: "withdrawal",
          title: "Withdrawal",
          body: `Consumers may withdraw within 14 days of delivery without cause. Notify ${email} with the order number or use ${origin}/en/withdrawal. Notice within 14 days is sufficient. Return the goods within 10 days after the seller receives the notice, in a condition suitable for resale.`
        },
        {
          id: "exceptions",
          title: "Exceptions",
          body: "Under Art. 15 of the Distance Contracts Regulation, withdrawal is unavailable in particular for goods that cannot be returned for health/hygiene reasons once the seal is broken after delivery (opened pet supplements, pastes or droppers may fall here). Unused, sealed goods remain withdrawable. This hygiene exception is disclosed before payment."
        },
        {
          id: "refund",
          title: "Refunds",
          body: "After the returned goods reach the seller, the price is refunded within 14 days via the original payment method. The seller is not required to refund before receiving the goods. Card-scheme timing may delay the statement credit."
        },
        {
          id: "defect",
          title: "Defects",
          body: `Statutory remedies for defective goods apply (repair, replacement, refund or price reduction). Contact ${email} with the order number.`
        },
        {
          id: "dispute",
          title: "Disputes",
          body: `Contact ${email}. Unresolved consumer disputes go to the Consumer Arbitration Committee (within the yearly monetary limits) or Consumer Courts at your or the seller’s place.`
        }
      ]
    },
    distanceSales: {
      title: "Distance Sales Agreement",
      intro: "This agreement is concluded electronically between the seller below and the buyer who orders on petiwell.com, under Law No. 6502, the Distance Contracts Regulation and Law No. 6563.",
      lastUpdated: updated,
      sections: [
        {
          id: "parties",
          title: "1. Parties",
          body: `Seller:\n${identity}\n\nBuyer: the name and contact/delivery details entered at checkout, warranted as accurate and belonging to the buyer.`
        },
        {
          id: "subject",
          title: "2. Subject",
          body: "Sale, payment and delivery of the selected Petiwell products. Essentials, quantity, VAT-inclusive price, discounts, shipping and payment method appear in the order summary and Pre-contract Information Form, which is an annex to this agreement."
        },
        {
          id: "formation",
          title: "3. Formation",
          body: "The contract is formed when the buyer accepts the pre-information and this text, starts payment, and the seller records the order. If payment fails, the seller need not perform. The seller may cancel for stock failure, an obvious pricing error or illegality, and will refund any collected amount."
        },
        {
          id: "price",
          title: "4. Price and payment",
          body: "The price is the VAT-inclusive amount shown at order time. PayTR collects payment; card data is not sent to the seller. Coupons apply only on their terms. Self-dealing or abuse may lead to cancellation."
        },
        {
          id: "delivery",
          title: "5. Delivery",
          body: "Delivery follows the Delivery & Returns page. Do not accept a damaged parcel; keep a carrier report."
        },
        {
          id: "withdrawal",
          title: "6. Withdrawal",
          body: `The 14-day right and Art. 15 exceptions apply. Details: ${origin}/en/shipping and ${origin}/en/withdrawal.`
        },
        {
          id: "privacy",
          title: "7. Personal data",
          body: `Processed under ${origin}/en/privacy. PayTR has its own notice.`
        },
        {
          id: "liability",
          title: "8. Liability",
          body: "Products are pet-care goods per the label; no diagnosis or treatment is promised. Statutory liability for defective goods remains. The seller is not liable beyond the law for force majeure, a wrong address or refusal to take delivery."
        },
        {
          id: "law",
          title: "9. Evidence, law and venue",
          body: `The seller’s electronic records are evidence under CCP Art. 193. Turkish law applies. Consumer forums as above; otherwise the courts of ${venue}.`
        }
      ]
    },
    preInfo: {
      title: "Pre-contract Information Form",
      intro: "Provided before you incur a payment obligation (Law No. 6502 Art. 48; Distance Contracts Regulation Arts. 5–6). Checkout boxes mean you have read and accepted this form.",
      lastUpdated: updated,
      sections: [
        {
          id: "seller",
          title: "1. Seller",
          body: identity
        },
        {
          id: "product",
          title: "2. Main characteristics",
          body: "Petiwell cat-care products (e.g. Plus+B dropper vitamin format; Sterile Paste malt paste). Final name, quantity, SKU and unit price appear in the cart/checkout summary. Not medicines; the label governs use."
        },
        {
          id: "price",
          title: "3. Price, tax, shipping",
          body: "The VAT-inclusive total, discounts and shipping appear as separate lines. Listed prices usually include VAT and standard domestic shipping. The site is intended for domestic delivery."
        },
        {
          id: "payment",
          title: "4. Payment",
          body: "Cards are processed on PayTR’s page. The seller does not store card data. The order is not confirmed until payment succeeds."
        },
        {
          id: "delivery",
          title: "5. Delivery",
          body: "Carrier delivery to your domestic address. Statutory maximum 30 days unless a longer period is agreed."
        },
        {
          id: "withdrawal",
          title: "6. Withdrawal",
          body: `14 days from delivery, via ${email} or ${origin}/en/withdrawal. Opened hygiene-sensitive pet supplements may be excluded. Sealed unused goods remain withdrawable.`
        },
        {
          id: "complaint",
          title: "7. Complaints",
          body: `E-mail ${email}. Then Consumer Arbitration Committee / Consumer Court.`
        },
        {
          id: "privacy",
          title: "8. Personal data",
          body: `${origin}/en/privacy and ${origin}/en/cookies.`
        },
        {
          id: "accept",
          title: "9. Meaning of acceptance",
          body: "Ticking the checkout boxes means you received this information, conclude the distance contract, acknowledge the KVKK notice, and accept a payment obligation."
        }
      ]
    },
    withdrawal: {
      title: "Withdrawal Notice Form",
      intro: "You may complete this form (aligned with the Regulation annex) or send the same information by e-mail. Using the form is not mandatory.",
      lastUpdated: updated,
      sections: [
        {
          id: "to",
          title: "To",
          body: `${identity}\nE-mail: ${email}`
        },
        {
          id: "text",
          title: "Notice",
          body: "I hereby withdraw from the distance contract for the goods identified below."
        },
        {
          id: "fields",
          title: "Please include",
          body: `Order number:\nOrder / delivery date:\nProduct and quantity:\nConsumer name:\nDelivery address:\nRefund IBAN if the original card cannot be credited:\nDate / signature (if sent on paper)\n\nSend within 14 days to ${email}. Return the goods within 10 days after we receive the notice. Opened hygiene-sensitive products may be refused.`
        }
      ]
    }
  };
}
