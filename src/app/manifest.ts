import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — Jindal MZN Muzaffarnagar`,
    short_name: "Jindal MZN",
    description:
      "Jindal Creation Muzaffarnagar — PVC panels, home decor & interior products near you.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a2332",
    theme_color: "#1a2332",
    lang: "en-IN",
    categories: ["business", "shopping"],
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
