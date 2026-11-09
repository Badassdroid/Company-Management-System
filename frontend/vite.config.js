import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const workspaceRoot = fileURLToPath(new URL('../', import.meta.url))
  const env = loadEnv(mode, workspaceRoot, '')

  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      __SUPABASE_PUBLIC_KEY__: JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        env.VITE_SUPABASE_ANON_KEY ||
        env.SUPABASE_PUBLISHABLE_KEY ||
        env.SUPABASE_ANON_KEY ||
        '',
      ),
    },
    server: {
      proxy: {
        '/api': {
          target: env.FLASK_URL || 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
