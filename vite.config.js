import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Identificador de esta compilación: la app lo compara con /version.json para saber
// si hay una versión nueva publicada y recargarse sola (importante en celulares).
export default defineConfig(({ command }) => {
  const idCompilacion = command === 'build' ? String(Date.now()) : 'dev'
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'version-json',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: idCompilacion }) })
        },
      },
    ],
    define: { __BUILD_ID__: JSON.stringify(idCompilacion) },
  }
})
