// Ensure Vite/PostCSS loads the Tailwind PostCSS adapter.
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
};
