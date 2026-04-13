import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07111f",
        mist: "#e8eef5",
        line: "#20334d",
        accent: "#8bb6e8",
        shell: "#f4f7fb",
      },
      boxShadow: {
        panel: "0 28px 80px rgba(7, 17, 31, 0.14)",
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', "Georgia", "serif"],
        sans: ['"Avenir Next"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      maxWidth: {
        reading: "44rem",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top, rgba(139, 182, 232, 0.18), transparent 48%)",
      },
    },
  },
  plugins: [],
};

export default config;
