import type { Metadata } from "next";
import { siteMetadata } from "@/lib/seo";

export const metadata: Metadata = siteMetadata({
  title: "Check PVC Panel Stock — Muzaffarnagar | Jindal Creation",
  description:
    "Jindal Creation Muzaffarnagar — live PVC panel & home decor stock check. Product ID se search karein, pieces/box me order karein, WhatsApp par bhejein.",
  alternates: { canonical: "/stock" },
});

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
