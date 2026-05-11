import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        cyan: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
      },
      backgroundImage: {
        "brand-gradient":       "linear-gradient(135deg, #f97316 0%, #0891b2 100%)",
        "brand-gradient-soft":  "linear-gradient(135deg, #fed7aa 0%, #cffafe 100%)",
        "hero-orange":          "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        "hero-teal":            "linear-gradient(135deg, #0891b2 0%, #0e7490 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
