import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwind(),
        autoprefixer()
      ]
    }
  },
  resolve: {
    dedupe: [
      'react', 'react-dom',
      'three',
    ],
    alias: {
      three: 'three'
    }
  },
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'three-mesh-bvh',
      'postprocessing',
    ],
    exclude: [
      'three/examples/jsm',
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2300,
  },
});
