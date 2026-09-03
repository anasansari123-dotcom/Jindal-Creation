import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { siteMetadata } from "@/lib/seo";

export const metadata: Metadata = siteMetadata({
  title: "Jindal Creation | Jindal MZN — PVC Panels Near Me Muzaffarnagar",
  description:
    "Jindal Creation Muzaffarnagar (Jindal MZN) — search Jindal Creation near me for PVC panels, PVC stock, home decor & interior products. Jindal Muzaffarnagar · WhatsApp order · Saharanpur, Meerut delivery.",
  alternates: {
    canonical: "/",
  },
});

export default function HomePage() {
  return <LandingPage />;
}
