/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1A0D07',
        'dark-sec': '#26150D',
        'dark-card': '#24140C',
        'accent-brown': '#4A2917',
        'gold': '#8B5A2B',
        'cream': '#F3E4CB',
        'light-cream': '#FFF4E3',
        'muted-beige': '#CDB99D',
        'available-green': '#59D98A',
        cafe: {
          50: '#fff4e3',
          100: '#f3e4cb',
          200: '#cdb99d',
          500: '#8b5a2b',
          700: '#4a2917',
          900: '#24140c',
          950: '#1a0d07',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
    },
  },
  plugins: [],
};
