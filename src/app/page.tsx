import type { Metadata } from "next";
import { siteMetadata } from "@/lib/seo";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = siteMetadata({
  title: "Jindal Creation — PVC Panels & Home Decor in Muzaffarnagar",
  description:
    "Muzaffarnagar ka trusted PVC panels & home decor supplier — Jindal Creation. PVC stock, wall panels, interior products. Online stock check & WhatsApp order. Saharanpur, Meerut area delivery.",
  alternates: {
    canonical: "/",
  },
});

export default function HomePage() {
  return <LandingPage />;
}
