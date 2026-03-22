import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        kiosk: {
          bg: "rgb(var(--kiosk-bg) / <alpha-value>)",
          surface: "rgb(var(--kiosk-surface) / <alpha-value>)",
          border: "rgb(var(--kiosk-border) / <alpha-value>)",
          accent: "rgb(var(--kiosk-accent) / <alpha-value>)",
          "accent-muted": "rgb(var(--kiosk-accent-muted) / <alpha-value>)",
          danger: "rgb(var(--kiosk-danger) / <alpha-value>)",
          warning: "rgb(var(--kiosk-warning) / <alpha-value>)",
          text: "rgb(var(--kiosk-text) / <alpha-value>)",
          muted: "rgb(var(--kiosk-muted) / <alpha-value>)",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "slide-up": "slideUp 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
