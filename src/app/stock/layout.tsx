import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { siteMetadata, stockPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = siteMetadata({
  title: "PVC Panel Stock — Jindal Creation MZN Muzaffarnagar Near Me",
  description:
    "Jindal Creation Muzaffarnagar (Jindal MZN) live stock — PVC panels, home decor, interior products. Search Jindal Creation near me, product ID se check karein, WhatsApp par order karein.",
  alternates: { canonical: "/stock" },
});

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={stockPageJsonLd()} />
      {children}
    </>
  );
}
