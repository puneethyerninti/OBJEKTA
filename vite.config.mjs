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
      'three', 'postprocessing',
      '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/three/examples/') || id.includes('/three-stdlib')) {
            return 'vendor-three-extras';
          }
          if (id.includes('/@react-three/')) {
            return 'vendor-r3f';
          }
          if (id.includes('/postprocessing') || id.includes('/maath')) {
            return 'vendor-postfx';
          }
          if (id.includes('/three/')) {
            return 'vendor-three-core';
          }
          if (id.includes('/react') || id.includes('/react-dom') || id.includes('/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('/socket.io-client') || id.includes('/yjs') || id.includes('/y-websocket')) {
            return 'vendor-collab';
          }
          if (id.includes('/rapier3d-compat')) {
            return 'vendor-physics';
          }

          return 'vendor-misc';
        },
      },
    },
  }
});
