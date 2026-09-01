"use client";

import { SEO_FAQ } from "@/lib/seo";
import { BRAND, LOCAL_BUSINESS } from "@/lib/constants";

interface SeoFaqSectionProps {
  variant?: "dark" | "light";
}

export function SeoFaqSection({ variant = "dark" }: SeoFaqSectionProps) {
  const isDark = variant === "dark";

  return (
    <section
      className={
        isDark
          ? "text-left rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8 space-y-5"
          : "rounded-xl border bg-white p-5 sm:p-8 space-y-5 shadow-sm"
      }
      aria-label="Jindal Creation Muzaffarnagar FAQ"
    >
      <div className="space-y-2 text-center sm:text-left">
        <h2
          className={
            isDark
              ? "text-xl sm:text-2xl font-serif font-bold text-white"
              : "text-xl sm:text-2xl font-serif font-bold text-navy"
          }
        >
          Jindal Creation Near Me — FAQ
        </h2>
        <p className={isDark ? "text-white/65 text-sm" : "text-gray-600 text-sm"}>
          <strong>{BRAND.name}</strong> · <strong>Jindal MZN</strong> ·{" "}
          <strong>Jindal Muzaffarnagar</strong> — PVC panels &amp; home decor
        </p>
      </div>

      <dl className="space-y-4">
        {SEO_FAQ.map((item) => (
          <div key={item.question} className="space-y-1">
            <dt
              className={
                isDark
                  ? "font-semibold text-gold text-sm sm:text-base"
                  : "font-semibold text-navy text-sm sm:text-base"
              }
            >
              {item.question}
            </dt>
            <dd className={isDark ? "text-white/75 text-sm leading-relaxed" : "text-gray-600 text-sm leading-relaxed"}>
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>

      <p className={isDark ? "text-white/50 text-xs" : "text-gray-400 text-xs"}>
        Keywords: Jindal Creation, Jindal MZN, Jindal Creation MZN, Jindal Muzaffarnagar, Jindal
        Creation near me, PVC panels Muzaffarnagar, home decor near me — {LOCAL_BUSINESS.address.city},{" "}
        {LOCAL_BUSINESS.address.state}.
      </p>
    </section>
  );
}
