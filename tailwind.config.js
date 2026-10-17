    /** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#f1f5f9',
            100: '#e2e8f0',
            200: '#f8fafc',
            300: '#e2e8f0',
            400: '#cbd5e1',
            500: '#6366f1',
            600: '#4f46e5',
            700: '#4338ca',
            800: '#3730a3',
            900: '#1e1b4b',
          },
          accent: {
            500: '#818cf8',
            600: '#6366f1',
            700: '#4f46e5',
          },
          surface: {
            50: '#ffffff',
            100: '#f8fafc',
            200: '#e2e8f0',
          },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}