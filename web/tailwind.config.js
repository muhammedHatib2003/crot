/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          300: "#34d399",
          500: "#10b981",
          700: "#047857",
          900: "#064e3b"
        }
      }
    }
  },
  plugins: []
};
