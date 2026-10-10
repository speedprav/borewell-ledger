/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette
        'water-blue': '#0B5C8A',
        'water-teal': '#0E8FA3',
        'surface': '#F4F8FB',
        // Status colors
        'status-normal': '#16A34A',
        'status-watch': '#D97706',
        'status-critical': '#DC2626',
        'status-nodata': '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'touch': '44px',
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
}
