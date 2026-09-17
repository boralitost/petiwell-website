import Script from "next/script";
import { consentDefaultScript } from "@/lib/consent";
import { publicTrackingIds } from "@/lib/tracking-ids";

function gtagConfigScript(ga4: string, ads: string): string {
  const configs: string[] = [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}window.gtag=gtag;",
    "gtag('js', new Date());"
  ];
  if (ga4) {
    configs.push(`gtag('config','${ga4}',{anonymize_ip:true});`);
  }
  if (ads) {
    configs.push(`gtag('config','${ads}',{allow_enhanced_conversions:true});`);
  }
  return configs.join("");
}

export function GoogleTag() {
  const { gtm, ga4, ads } = publicTrackingIds();
  if (!gtm && !ga4 && !ads) return null;
  const gtagId = ga4 || ads;

  return (
    <>
      <script
        id="pw-consent-default"
        dangerouslySetInnerHTML={{ __html: consentDefaultScript() }}
      />
      {gtm ? (
        <Script id="pw-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':Date.now(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      ) : null}
      {gtagId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="pw-gtag-config" strategy="afterInteractive">
            {gtagConfigScript(ga4, ads)}
          </Script>
        </>
      ) : null}
    </>
  );
}

export function GoogleTagNoscript() {
  const { gtm } = publicTrackingIds();
  if (!gtm) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
