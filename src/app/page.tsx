import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { faqPageJsonLd, siteMetadata } from "@/lib/seo";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = siteMetadata({
  title: "Jindal Creation | Jindal MZN — PVC Panels Near Me Muzaffarnagar",
  description:
    "Jindal Creation Muzaffarnagar (Jindal MZN) — search Jindal Creation near me for PVC panels, PVC stock, home decor & interior products. Jindal Muzaffarnagar · WhatsApp order · Saharanpur, Meerut delivery.",
  alternates: {
    canonical: "/",
  },
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqPageJsonLd()} />
      <LandingPage />
    </>
  );
}
