import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        evergreen: { DEFAULT: "#0F3D2E", line: "#3F6E5C", deep: "#0A2E22" },
        cranberry: { DEFAULT: "#B3202E", light: "#C8303E", dark: "#951A26" },
        gold: { DEFAULT: "#D4A84B", light: "#E2BC63", pale: "#F3D58C" },
        cream: "#FBF6EC",
        parchment: "#F4EFE3",
        ink: "#1B1A12",
        mist: { DEFAULT: "#D7E6DD", dark: "#B7CFC2" },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: { btn: "16px" },
    },
  },
  plugins: [],
} satisfies Config;
