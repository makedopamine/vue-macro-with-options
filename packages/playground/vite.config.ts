import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { compiler } from 'vue-macro-with-options'

export default defineConfig({
    plugins: [
        vue({
            compiler
        }),
    ],
})
