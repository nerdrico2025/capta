import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F4C81',
          light: '#1A6DB5',
          dark: '#0A3560',
          50: '#EBF4FF',
          100: '#D4E8FA',
          200: '#A9D1F5',
          300: '#7EBBF0',
          400: '#53A4EB',
          500: '#288DE6',
          600: '#1A76C9',
          700: '#1260A8',
          800: '#0F4C81',
          900: '#0A3560',
        },
        accent: {
          DEFAULT: '#2ECC71',
          light: '#52D987',
          dark: '#25A65A',
          50: '#EAFAF1',
          100: '#D1F5E0',
        },
        background: '#F5F5F0',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
