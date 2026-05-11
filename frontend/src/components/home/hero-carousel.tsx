"use client";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface Slide {
  id: string;
  image: string;
  badge?: string;
  heading: string;
  sub: string;
  cta: string;
  href: string;
  bg: string;
  ctaCls?: string;
}

const SLIDES: Slide[] = [
  {
    id: "1",
    image: "https://placehold.co/1200x480/f97316/white?text=Textiles+Sale",
    badge: "Summer Sale",
    heading: "Premium Pakistani Textiles",
    sub: "Lawn, Linen & Embroidered Suits — up to 40% off",
    cta: "Shop Textiles",
    href: "/en/categories/textiles",
    bg: "from-orange-500 to-orange-700",
  },
  {
    id: "2",
    image: "https://placehold.co/1200x480/0891b2/white?text=B2B+Wholesale",
    badge: "Wholesale Deals",
    heading: "Bulk Orders for Your Business",
    sub: "Request quotes from verified suppliers across Pakistan",
    cta: "Post an RFQ",
    href: "/en/rfq/new",
    bg: "from-cyan-600 to-teal-700",
    ctaCls: "bg-white text-cyan-700 hover:bg-cyan-50",
  },
  {
    id: "3",
    image: "https://placehold.co/1200x480/ea580c/white?text=Top+Sellers",
    badge: "New Arrivals",
    heading: "Discover Top Sellers",
    sub: "Electronics, furniture, tools & more — all in one place",
    cta: "Browse All",
    href: "/en/products",
    bg: "from-orange-600 to-cyan-600",
  },
];

export function HeroCarousel() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: true }),
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="relative overflow-hidden rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {SLIDES.map((slide) => (
            <div key={slide.id} className="relative flex-[0_0_100%] min-w-0">
              <div className={`bg-gradient-to-r ${slide.bg} absolute inset-0`} />
              <div className="relative aspect-[5/2] flex items-center">
                <Image
                  src={slide.image}
                  alt={slide.heading}
                  fill
                  priority
                  className="object-cover opacity-20 mix-blend-overlay"
                  sizes="100vw"
                />
                <div className="relative z-10 px-8 sm:px-14 py-10 max-w-xl">
                  {slide.badge && (
                    <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                      {slide.badge}
                    </span>
                  )}
                  <h2 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
                    {slide.heading}
                  </h2>
                  <p className="mt-2 text-white/80 text-sm sm:text-base">{slide.sub}</p>
                  <Link
                    href={slide.href}
                    className={`mt-5 inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors ${slide.ctaCls ?? "bg-white text-orange-600 hover:bg-orange-50"}`}
                  >
                    {slide.cta}
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={scrollPrev}
        className="absolute start-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={scrollNext}
        className="absolute end-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight size={18} />
      </button>

      <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={clsx(
              "h-1.5 rounded-full transition-all duration-300",
              i === selectedIndex ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"
            )}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
