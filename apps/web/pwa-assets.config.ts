import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const cream = '#FFF7F2'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.2,
      resizeOptions: { background: cream },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.2,
      resizeOptions: { background: cream },
    },
  },
  images: ['public/logo.svg'],
})
