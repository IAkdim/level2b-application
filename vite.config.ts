import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React and React-DOM into their own chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Split UI libraries into their own chunk
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-avatar',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-progress',
          ],
          // Split Supabase and TanStack Query
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
          // Split icon libraries
          'icons-vendor': ['lucide-react', 'react-icons'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
