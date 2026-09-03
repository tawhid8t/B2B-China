import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--color-surface-muted) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        action: {
          primary: "rgb(var(--color-action-primary) / <alpha-value>)",
          hover: "rgb(var(--color-action-hover) / <alpha-value>)",
          active: "rgb(var(--color-action-active) / <alpha-value>)",
          soft: "rgb(var(--color-action-soft) / <alpha-value>)"
        },
        "on-action": "rgb(var(--color-on-action) / <alpha-value>)",
        accent: {
          mint: "rgb(var(--color-accent-mint) / <alpha-value>)",
          aqua: "rgb(var(--color-accent-aqua) / <alpha-value>)",
          violet: "rgb(var(--color-accent-violet) / <alpha-value>)",
          coral: "rgb(var(--color-accent-coral) / <alpha-value>)"
        },
        commerce: {
          50: "#f0f8f4",
          100: "#dcefe5",
          200: "#b6dac5",
          300: "#85be9d",
          400: "#4a9a6f",
          500: "#17774e",
          600: "#0e623f",
          700: "#0a4f33",
          800: "#0b402c",
          900: "#093425",
          950: "#031f15"
        },
        vermilion: {
          50: "#fff4f1",
          100: "#ffe5de",
          200: "#ffcabe",
          300: "#f89f8b",
          400: "#e96f55",
          500: "#cf5137",
          600: "#b53f29",
          700: "#933421",
          800: "#792f23",
          900: "#652b22"
        },
        gold: {
          50: "#fbf8ed",
          100: "#f4edcf",
          200: "#eadb9c",
          300: "#ddc263",
          400: "#c9a33a",
          500: "#ad7c2b",
          600: "#946023",
          700: "#77471f",
          800: "#633b20",
          900: "#54331f"
        },
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "danger-action": "rgb(var(--color-danger-action) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        ink: "rgb(var(--color-foreground) / <alpha-value>)",
        paper: "rgb(var(--color-canvas) / <alpha-value>)",
        line: "rgb(var(--color-border) / <alpha-value>)",
        jade: "#17774e",
        coral: "#b53f29",
        saffron: "#ad7c2b"
      },
      fontFamily: {
        sans: [
          "Geist",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans Bengali",
          "Noto Sans SC",
          "Noto Sans",
          "sans-serif"
        ]
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        sheet: "var(--radius-sheet)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        panel: "var(--shadow-panel)",
        overlay: "var(--shadow-overlay)"
      },
      maxWidth: {
        commerce: "80rem",
        reading: "46rem",
        form: "36rem"
      },
      minHeight: {
        touch: "2.75rem",
        "touch-lg": "3rem"
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)"
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms"
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)"
      },
      zIndex: {
        navigation: "40",
        overlay: "50",
        modal: "60",
        toast: "70"
      }
    }
  },
  plugins: []
};

export default config;
