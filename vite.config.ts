import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(JSON.parse(fs.readFileSync('package.json', 'utf-8')).version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'use-sync-external-store/shim/with-selector.js': path.resolve(__dirname, 'node_modules/use-sync-external-store/shim/with-selector.js'),
        'react-reconciler/constants': path.resolve(__dirname, 'node_modules/react-reconciler/constants.js'),
        'react-reconciler': path.resolve(__dirname, 'node_modules/react-reconciler/index.js'),
        'scheduler': path.resolve(__dirname, 'node_modules/scheduler/index.js'),
        'stats.js': path.resolve(__dirname, 'node_modules/stats.js/build/stats.min.js'),
      }
    },
    build: {
      // Performance optimizations
      target: 'es2015',
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'ui-vendor': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            'd3-vendor': ['d3-selection', 'd3-zoom'],
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
            // App chunks
            'dag-components': [
              './frontend/components/dag/DAGCanvas',
              './frontend/components/dag/DAGNode',
              './frontend/components/dag/DAGLink',
              './frontend/components/dag/DAGMinimap',
            ],
          },
          // Optimize chunk size
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Increase chunk size warning limit (for analytics)
      chunkSizeWarningLimit: 600,
      // Sourcemaps only for dev
      sourcemap: mode === 'development',
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        'd3-selection',
        'd3-zoom',
        'zustand',
      ],
      exclude: [
        '@react-three/fiber',
        '@react-three/drei',
        'three',
      ],
    },
  };
});
