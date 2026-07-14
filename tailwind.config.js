/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFAF7",
        surface: "#FFFFFF",
        brand: {
          DEFAULT: "#563169",
          soft: "#F4EEF6",
          deep: "#462756",
          muted: "#C9B4D4"
        },
        accent: {
          DEFAULT: "#FF6500",
          soft: "#FFF1E8",
          action: "#C94C00",
          hover: "#A83F00"
        },
        charcoal: "#262126",
        muted: "#4A444A",
        line: "#E9E1E7",
        cream: "#FFF1E8",
        taupe: "#4A444A",
        sage: "#563169",
        promo: "#563169"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(86, 49, 105, 0.08)",
        lift: "0 10px 28px rgba(38, 33, 38, 0.08)"
      }
    }
  },
  plugins: []
};
