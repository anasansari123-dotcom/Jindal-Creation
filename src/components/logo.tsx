import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/constants";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  /** Use "light" on dark backgrounds (navy header, sidebar) */
  theme?: "dark" | "light";
}

const sizes = {
  sm: { img: 32, text: "text-sm" },
  md: { img: 48, text: "text-base" },
  lg: { img: 80, text: "text-xl" },
};

export function Logo({ size = "md", showText = true, href, theme = "dark" }: LogoProps) {
  const nameColor = theme === "light" ? "text-white" : "text-navy";
  const textVisibility = theme === "light" ? "block" : "hidden sm:block";

  const content = (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt={BRAND.name}
        width={sizes[size].img}
        height={sizes[size].img}
        className="object-contain"
        priority
      />
      {showText && (
        <div className={textVisibility}>
          <p className={`font-serif font-bold ${nameColor} ${sizes[size].text}`}>
            {BRAND.name}
          </p>
          <p className="text-xs text-gold tracking-wide">{BRAND.tagline}</p>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${BRAND.name} home`}>
        {content}
      </Link>
    );
  }
  return content;
}
