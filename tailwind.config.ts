import type { Config } from 'tailwindcss'

const config: Config = {
  // Class-strategy dark mode: an ancestor with `class="dark"` flips every
  // `dark:` variant. A small pre-paint script in app/layout.tsx writes this
  // class on <html> before hydration so users never see a flash of light.
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          50:  '#ecfdf5',
          500: '#10b981',
          600: '#0f766e',
          700: '#0d6b63',
        },
      },
    },
  },
  plugins: [],
}
export default config
