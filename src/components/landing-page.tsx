"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BRAND, LOCAL_BUSINESS, DEFAULT_WHATSAPP_NUMBER, DEFAULT_WHATSAPP_DISPLAY } from "@/lib/constants";
import { generateWhatsAppUrl } from "@/lib/utils";
import { Package, LogIn, MapPin, Phone, MessageCircle, CheckCircle } from "lucide-react";

export function LandingPage() {
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP_NUMBER);
  const [whatsappDisplay, setWhatsappDisplay] = useState(DEFAULT_WHATSAPP_DISPLAY);

  useEffect(() => {
    fetch("/api/public/stock?search=")
      .then((r) => r.json())
      .then((d) => {
        if (d.whatsappNumber) {
          setWhatsappNumber(d.whatsappNumber);
          const digits = String(d.whatsappNumber).replace(/\D/g, "");
          if (digits.length >= 10) {
            setWhatsappDisplay(`+${digits.startsWith("91") ? digits : `91${digits}`}`);
          }
        }
      })
      .catch(() => {});
  }, []);

  const whatsappHref = generateWhatsAppUrl(
    whatsappNumber,
    `Hello ${BRAND.name}, I am interested in PVC panels / home decor in Muzaffarnagar.`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy to-navy-light flex flex-col">
      <header className="p-4 sm:p-6">
        <Logo size="md" href="/" theme="light" />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="w-full max-w-3xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <Logo size="lg" showText={false} />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-white leading-tight">
              {BRAND.name} — PVC Panels &amp; Home Decor in{" "}
              <span className="text-gold">Muzaffarnagar</span>
            </h1>
            <p className="text-gold text-base sm:text-lg tracking-wide">{BRAND.tagline}</p>
            <p className="text-white/70 text-sm sm:text-base max-w-xl mx-auto">
              {BRAND.slogan}. Muzaffarnagar aur nearby areas ke liye PVC stock, wall panels aur
              interior products — stock check karein aur WhatsApp par order karein.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/stock" className="w-full sm:w-auto">
              <Button variant="gold" size="lg" className="w-full sm:min-w-[220px]">
                <Package className="h-5 w-5" /> Check Stock &amp; Order
              </Button>
            </Link>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:min-w-[220px] border-green-500 text-green-400 hover:bg-green-500/10"
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp Enquiry
              </Button>
            </a>
          </div>

          {/* Local SEO content — visible to users & search engines */}
          <section
            className="text-left rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8 space-y-5"
            aria-label="About Jindal Creation Muzaffarnagar"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white text-center">
              Muzaffarnagar ka PVC Panels &amp; Home Decor Supplier
            </h2>
            <p className="text-white/75 text-sm sm:text-base leading-relaxed">
              <strong className="text-white">{BRAND.name}</strong> Muzaffarnagar, Uttar Pradesh me
              PVC panels, PVC stock, home decor aur interior products supply karta hai. Dealer aur
              retail customers ke liye quality products, stock availability aur fast WhatsApp support.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {LOCAL_BUSINESS.services.map((service) => (
                <div
                  key={service}
                  className="flex items-center gap-2 text-white/80 rounded-lg bg-white/5 px-3 py-2"
                >
                  <CheckCircle className="h-4 w-4 text-gold shrink-0" />
                  {service} — Muzaffarnagar
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
              <div className="flex items-start gap-3 text-white/80">
                <MapPin className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Location</p>
                  <p>
                    {LOCAL_BUSINESS.address.city}, {LOCAL_BUSINESS.address.state}{" "}
                    {LOCAL_BUSINESS.address.pincode}
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Service: {LOCAL_BUSINESS.serviceAreas.join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-white/80">
                <Phone className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Contact</p>
                  <a href={`tel:+${whatsappNumber.replace(/\D/g, "")}`} className="hover:text-gold transition-colors">
                    {whatsappDisplay}
                  </a>
                  <p className="text-white/60 text-xs mt-1">WhatsApp order &amp; enquiry</p>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-gold transition-colors"
            >
              <LogIn className="h-4 w-4" /> Admin Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="p-4 sm:p-6 text-center text-xs text-white/40 space-y-1">
        <p>
          &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> {BRAND.name},{" "}
          Muzaffarnagar — PVC Panels | Home Decor
        </p>
        <p className="text-white/30">
          PVC panels Muzaffarnagar · Home decor Muzaffarnagar · Interior products UP
        </p>
      </footer>
    </div>
  );
}
