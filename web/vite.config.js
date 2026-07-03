import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Reach several years back in phone browsers (default targets are much
    // newer); the site must work for everyone, not just fresh devices.
    target: ['es2018', 'safari13'],
  },
})
