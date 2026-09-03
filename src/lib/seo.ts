import type { Metadata } from "next";
import { BRAND, LOCAL_BUSINESS, SEO_ALTERNATE_NAMES } from "@/lib/constants";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://jindalcreation.com";

/** Target SERP keywords — Jindal Creation, MZN, Muzaffarnagar, near me */
export const SEO_KEYWORDS = [
  "Jindal Creation",
  "Jindal MZN",
  "Jindal Muzaffarnagar",
  "Jindal Creation MZN",
  "Jindal Creation Muzaffarnagar",
  "Jindal Creation near me",
  "Jindal near me",
  "Jindal Creation near me Muzaffarnagar",
  "Jindal MZN near me",
  "Jindal PVC panels Muzaffarnagar",
  "Jindal home decor Muzaffarnagar",
  "PVC panels Muzaffarnagar",
  "PVC panels near me",
  "PVC stock Muzaffarnagar",
  "home decor Muzaffarnagar",
  "home decor near me Muzaffarnagar",
  "interior products Muzaffarnagar",
  "wall panels Muzaffarnagar",
  "PVC panels Uttar Pradesh",
  "wholesale PVC panels Muzaffarnagar",
  "decor items Muzaffarnagar",
  "PVC panel dealer Muzaffarnagar",
  "PVC panel shop near me",
  "home decoration shop Muzaffarnagar",
  "Jindal Creation PVC",
  "Jindal Creation home decor",
  "Jindal Creation UP",
] as const;

const DEFAULT_TITLE =
  "Jindal Creation | Jindal MZN — PVC Panels & Home Decor Muzaffarnagar Near Me";

const DEFAULT_DESCRIPTION = `Jindal Creation Muzaffarnagar (Jindal MZN) — PVC panels, PVC stock, home decor & interior products near you. Search "Jindal Creation near me" — stock check, WhatsApp order. ${BRAND.tagline}. Call ${LOCAL_BUSINESS.phoneDisplay}.`;

export function siteMetadata(overrides?: Partial<Metadata>): Metadata {
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s | Jindal Creation MZN`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: [...SEO_KEYWORDS],
    applicationName: BRAND.name,
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
      siteName: `${BRAND.name} — Jindal MZN Muzaffarnagar`,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [
        {
          url: "/logo.png",
          width: 512,
          height: 512,
          alt: "Jindal Creation Muzaffarnagar — PVC Panels & Home Decor",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: ["/logo.png"],
    },
    other: {
      "geo.region": "IN-UP",
      "geo.placename": "Muzaffarnagar",
      "geo.position": `${LOCAL_BUSINESS.geo.lat};${LOCAL_BUSINESS.geo.lng}`,
      ICBM: `${LOCAL_BUSINESS.geo.lat}, ${LOCAL_BUSINESS.geo.lng}`,
    },
    ...(googleVerification
      ? { verification: { google: googleVerification } }
      : {}),
    ...overrides,
  };
}

export function localBusinessJsonLd() {
  const mapsUrl = LOCAL_BUSINESS.sameAs[0];

  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${SITE_URL}/#localbusiness`,
    name: BRAND.name,
    alternateName: [...SEO_ALTERNATE_NAMES],
    description: `${BRAND.name} (Jindal MZN) — PVC panels, home decor & interior products in Muzaffarnagar, UP. Search Jindal Creation near me.`,
    url: SITE_URL,
    telephone: LOCAL_BUSINESS.phoneDisplay,
    email: LOCAL_BUSINESS.email,
    image: `${SITE_URL}/logo.png`,
    logo: `${SITE_URL}/logo.png`,
    priceRange: "₹₹",
    keywords: SEO_KEYWORDS.slice(0, 12).join(", "),
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
    hasMap: mapsUrl,
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
      name: "PVC Panels & Home Decor — Jindal Creation MZN",
      itemListElement: LOCAL_BUSINESS.services.map((service, index) => ({
        "@type": "Offer",
        position: index + 1,
        itemOffered: {
          "@type": "Service",
          name: `${service} — Jindal Creation Muzaffarnagar`,
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
    name: `${BRAND.name} — Jindal MZN`,
    alternateName: [...SEO_ALTERNATE_NAMES],
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#localbusiness` },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/stock?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function stockPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/stock#webpage`,
    url: `${SITE_URL}/stock`,
    name: "PVC Panel Stock Check — Jindal Creation MZN Muzaffarnagar",
    description:
      "Jindal Creation Muzaffarnagar live PVC panel & home decor stock. Jindal MZN product search, WhatsApp order.",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#localbusiness` },
    inLanguage: "en-IN",
  };
}
