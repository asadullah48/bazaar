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
  badge: string;
  heading: string;
  sub: string;
  cta: string;
  href: string;
  image: string;
  accentCls: {
    pill: string;
    cta: string;
    bar: string;
  };
}

const SLIDES: Slide[] = [
  {
    id: "textiles",
    badge: "Summer Collection 2026",
    heading: "Premium Pakistani\nTextiles",
    sub: "Lawn, Linen & Embroidered Suits — up to 40% off from verified sellers",
    cta: "Shop Textiles",
    href: "/en/products",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&w=1400&q=80",
    accentCls: {
      pill: "bg-orange-500 text-white",
      cta: "bg-orange-500 hover:bg-orange-600 text-white",
      bar: "from-orange-500 to-orange-600",
    },
  },
  {
    id: "electronics",
    badge: "Best in Tech",
    heading: "Latest Electronics\n& Gadgets",
    sub: "Smartphones, laptops & home appliances — trusted sellers, nationwide delivery",
    cta: "Explore Tech",
    href: "/en/products",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&w=1400&q=80",
    accentCls: {
      pill: "bg-cyan-500 text-white",
      cta: "bg-cyan-600 hover:bg-cyan-700 text-white",
      bar: "from-cyan-500 to-cyan-600",
    },
  },
  {
    id: "b2b",
    badge: "B2B Marketplace",
    heading: "Bulk Sourcing\nMade Simple",
    sub: "Post an RFQ and get competitive quotes from verified Pakistani suppliers in hours",
    cta: "Post an RFQ",
    href: "/en/rfq/new",
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&w=1400&q=80",
    accentCls: {
      pill: "bg-teal-500 text-white",
      cta: "bg-teal-600 hover:bg-teal-700 text-white",
      bar: "from-teal-500 to-teal-600",
    },
  },
];

export function HeroCarousel() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5500, stopOnInteraction: true }),
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
    <section className="relative overflow-hidden mx-4 sm:mx-6 lg:mx-8 mt-6 rounded-2xl shadow-xl">
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {SLIDES.map((slide) => (
            <div key={slide.id} className="relative flex-[0_0_100%] min-w-0 aspect-[5/2]">
              {/* Background photo */}
              <Image
                src={slide.image}
                alt={slide.heading.replace("\n", " ")}
                fill
                className="object-cover"
                priority={slide.id === "textiles"}
                sizes="(max-width: 768px) 100vw, 1400px"
              />
              {/* Dark gradient — left heavy, fades right */}
              <div className="absolute inset-0 bg-gradient-to-r from-gray-950/92 via-gray-950/68 to-gray-950/10" />
              {/* Vertical accent bar */}
              <div
                className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${slide.accentCls.bar} opacity-90`}
              />

              {/* Text content */}
              <div className="relative z-10 flex h-full items-center">
                <div className="px-8 sm:px-14 py-10 max-w-lg">
                  <span
                    className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4 ${slide.accentCls.pill}`}
                  >
                    {slide.badge}
                  </span>
                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight whitespace-pre-line">
                    {slide.heading}
                  </h2>
                  <p className="mt-3 text-gray-300 text-sm sm:text-base leading-relaxed max-w-sm">
                    {slide.sub}
                  </p>
                  <Link
                    href={slide.href}
                    className={`mt-6 inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-xl transition-colors ${slide.accentCls.cta}`}
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

      {/* Prev / Next */}
      <button
        onClick={scrollPrev}
        className="absolute start-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"
        aria-label="Previous slide"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={scrollNext}
        className="absolute end-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all"
        aria-label="Next slide"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 start-1/2 -translate-x-1/2 flex gap-2 z-20">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={clsx(
              "h-1.5 rounded-full transition-all duration-300",
              i === selectedIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
            )}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
