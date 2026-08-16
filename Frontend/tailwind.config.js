/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#ff6b81",
        secondary: "#ffeaa7",
        background: "#fff0f3"
      }
    },
  },
  plugins: [],
}
