import type { Config } from "tailwindcss";

/**
 * Theme tokens are ported from the :root block of tideline-ui.html.
 * The raw CSS variables live in app/globals.css; here we surface the ones
 * worth having as Tailwind utilities so components can mix utility classes
 * with the ported design-system classes.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        "muted-2": "var(--muted-2)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        card: "var(--card)",
        blue: {
          DEFAULT: "var(--blue)",
          strong: "var(--blue-strong)",
          ink: "var(--blue-ink)",
          50: "var(--blue-50)",
          100: "var(--blue-100)",
          200: "var(--blue-200)",
        },
        dark: {
          DEFAULT: "var(--dark)",
          2: "var(--dark-2)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
      },
      maxWidth: {
        wrap: "var(--maxw)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
