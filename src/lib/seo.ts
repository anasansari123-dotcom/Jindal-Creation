import type { Metadata } from "next";
import { BRAND, LOCAL_BUSINESS } from "@/lib/constants";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://jindalcreation.com";

export const SEO_KEYWORDS = [
  "Jindal Creation",
  "PVC panels Muzaffarnagar",
  "PVC stock Muzaffarnagar",
  "home decor Muzaffarnagar",
  "interior products Muzaffarnagar",
  "wall panels Muzaffarnagar",
  "PVC panels Uttar Pradesh",
  "wholesale PVC panels Muzaffarnagar",
  "decor items Muzaffarnagar",
  "Jindal Creation Muzaffarnagar",
  "PVC panel dealer Muzaffarnagar",
  "home decoration shop Muzaffarnagar",
] as const;

export function siteMetadata(overrides?: Partial<Metadata>): Metadata {
  const title = `${BRAND.name} — PVC Panels & Home Decor in Muzaffarnagar`;
  const description = `${BRAND.name} Muzaffarnagar me PVC panels, PVC stock, home decor aur interior products. Stock check karein, WhatsApp par order karein. ${BRAND.tagline}. Call ${LOCAL_BUSINESS.phoneDisplay}.`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${BRAND.name} Muzaffarnagar`,
    },
    description,
    keywords: [...SEO_KEYWORDS],
    authors: [{ name: BRAND.name, url: SITE_URL }],
    creator: BRAND.name,
    publisher: BRAND.name,
    category: "business",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: SITE_URL,
      siteName: BRAND.name,
      title,
      description,
      images: [
        {
          url: "/logo.png",
          width: 512,
          height: 512,
          alt: `${BRAND.name} — PVC Panels Muzaffarnagar`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/logo.png"],
    },
    other: {
      "geo.region": "IN-UP",
      "geo.placename": "Muzaffarnagar",
      "geo.position": `${LOCAL_BUSINESS.geo.lat};${LOCAL_BUSINESS.geo.lng}`,
      ICBM: `${LOCAL_BUSINESS.geo.lat}, ${LOCAL_BUSINESS.geo.lng}`,
    },
    ...overrides,
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${SITE_URL}/#localbusiness`,
    name: BRAND.name,
    description: `${BRAND.name} — ${BRAND.tagline} in Muzaffarnagar, Uttar Pradesh. PVC panels, home decor & interior products.`,
    url: SITE_URL,
    telephone: LOCAL_BUSINESS.phoneDisplay,
    email: LOCAL_BUSINESS.email,
    image: `${SITE_URL}/logo.png`,
    logo: `${SITE_URL}/logo.png`,
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: LOCAL_BUSINESS.address.street,
      addressLocality: LOCAL_BUSINESS.address.city,
      addressRegion: LOCAL_BUSINESS.address.state,
      postalCode: LOCAL_BUSINESS.address.pincode,
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: LOCAL_BUSINESS.geo.lat,
      longitude: LOCAL_BUSINESS.geo.lng,
    },
    areaServed: LOCAL_BUSINESS.serviceAreas.map((area) => ({
      "@type": "City",
      name: area,
    })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "19:00",
      },
    ],
    sameAs: LOCAL_BUSINESS.sameAs,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "PVC Panels & Home Decor",
      itemListElement: LOCAL_BUSINESS.services.map((service, index) => ({
        "@type": "Offer",
        position: index + 1,
        itemOffered: {
          "@type": "Service",
          name: service,
          areaServed: "Muzaffarnagar, Uttar Pradesh",
        },
      })),
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: BRAND.name,
    description: siteMetadata().description as string,
    publisher: { "@id": `${SITE_URL}/#localbusiness` },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/stock?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
