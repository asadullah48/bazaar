import Image from "next/image";
import Link from "next/link";

const CATEGORIES = [
  {
    slug: "textiles",
    label: "Textiles & Fashion",
    urdu: "کپڑے و فیشن",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=400&q=75",
    overlay: "from-orange-900/75",
  },
  {
    slug: "electronics",
    label: "Electronics",
    urdu: "الیکٹرانکس",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&w=400&q=75",
    overlay: "from-cyan-900/75",
  },
  {
    slug: "furniture",
    label: "Furniture",
    urdu: "فرنیچر",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&w=400&q=75",
    overlay: "from-amber-900/75",
  },
  {
    slug: "kitchen",
    label: "Kitchen & Home",
    urdu: "کچن و گھر",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&w=400&q=75",
    overlay: "from-teal-900/75",
  },
  {
    slug: "auto-parts",
    label: "Auto Parts",
    urdu: "گاڑی کے پرزے",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&w=400&q=75",
    overlay: "from-gray-900/80",
  },
  {
    slug: "tools",
    label: "Tools & Hardware",
    urdu: "اوزار",
    image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&w=400&q=75",
    overlay: "from-orange-900/75",
  },
] as const;

export function CategoryShowcase({ locale }: { locale: string }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-orange-500 to-cyan-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Browse Categories</h2>
        <Link
          href={`/${locale}/products`}
          className="ms-auto text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map(({ slug, label, urdu, image, overlay }) => (
          <Link
            key={slug}
            href={`/${locale}/products?category=${slug}`}
            className="group relative rounded-2xl overflow-hidden aspect-[3/4] shadow-brand hover:shadow-brand-hover transition-all duration-300"
          >
            <Image
              src={image}
              alt={label}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
            />
            {/* Bottom-up gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t ${overlay} to-transparent`} />
            {/* Labels */}
            <div className="absolute bottom-0 inset-x-0 p-3">
              <p className="text-white font-semibold text-sm leading-tight drop-shadow">{label}</p>
              <p className="text-white/65 text-[11px] mt-0.5">{urdu}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
