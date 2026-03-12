/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f8f6",
          100: "#deeee7",
          300: "#98c9b5",
          500: "#4b9a75",
          700: "#2d6e52",
          900: "#184031"
        }
      }
    }
  },
  plugins: []
};
