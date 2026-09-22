/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        primary: "#4169F5",
        navy: "#111A45",
        surface: "#F8F9FD",
        border: "#E4E7F0",
        text: "#151A3A",
        muted: "#68708A",
        quiet: "#A7AEC2",
        purple: "#6C4CE8",
        success: "#32A66A",
        warning: "#F5A623",
        danger: "#E05252"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(17, 26, 69, 0.08)",
      },
    },
  },
  plugins: [],
};
