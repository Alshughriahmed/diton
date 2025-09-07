import Script from 'next/script';
import { seoConfig } from '@/lib/seo';

export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": seoConfig.siteName,
    "url": seoConfig.baseUrl,
    "description": "18+ adult video chat platform with random matching and gender filters"
  };

  return (
    <Script
      id="organization-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": seoConfig.siteName,
    "url": seoConfig.baseUrl,
    "description": "Safe, fast 18+ random video chat. Meet adults instantly. No signup."
  };

  return (
    <Script
      id="website-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
