import { readFile } from 'node:fs/promises'
import { type AppleDeviceSize, appleSplashScreenSizes } from '@vite-pwa/assets-generator/config'
import sharp from 'sharp'
import type { Plugin } from 'vite'

/**
 * iOS shows a still image while a home-screen app starts. This builds one per device size
 * (light and dark) that looks exactly like the first frame of index.html, so the app seems to
 * open straight into itself. The images are made at build time instead of living in git.
 */

/** Share of the screen's shorter side taken by the logo. Must match `#splash svg` in index.html. */
const LOGO_SHARE = 0.28
const DIR = 'splash'

interface Screen {
  /** Pixels as drawn, in this orientation. */
  width: number
  height: number
  scale: number
  landscape: boolean
}

function screens(): Screen[] {
  const seen = new Set<string>()
  const list: Screen[] = []
  for (const [device, size] of Object.entries(appleSplashScreenSizes) as [
    string,
    AppleDeviceSize,
  ][]) {
    // Phones get portrait only (that's how the app is used); iPads both.
    for (const landscape of device.startsWith('iPad') ? [false, true] : [false]) {
      const width = landscape ? size.height : size.width
      const height = landscape ? size.width : size.height
      const key = `${width}x${height}@${size.scaleFactor}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push({ width, height, scale: size.scaleFactor, landscape })
    }
  }
  return list
}

const fileName = (s: Screen, theme: string) => `${DIR}/${theme}-${s.width}x${s.height}.png`

/** Light and dark each say so explicitly, so only one image ever matches, whatever the order. */
function linkAttrs(s: Screen, theme: 'light' | 'dark'): Record<string, string> {
  const portraitWidth = s.landscape ? s.height : s.width
  const portraitHeight = s.landscape ? s.width : s.height
  const media = [
    `(prefers-color-scheme: ${theme})`,
    `(device-width: ${portraitWidth / s.scale}px)`,
    `(device-height: ${portraitHeight / s.scale}px)`,
    `(-webkit-device-pixel-ratio: ${s.scale})`,
    `(orientation: ${s.landscape ? 'landscape' : 'portrait'})`,
  ].join(' and ')
  return { rel: 'apple-touch-startup-image', media, href: `/${fileName(s, theme)}` }
}

export function appleSplash(options: {
  logo: string
  background: { light: string; dark: string }
}): Plugin {
  const list = screens()
  const themes = ['light', 'dark'] as const

  return {
    name: 'meandu:apple-splash',
    apply: 'build',

    transformIndexHtml: () =>
      list.flatMap((s) =>
        themes.map((theme) => ({
          tag: 'link',
          injectTo: 'head' as const,
          attrs: linkAttrs(s, theme),
        })),
      ),

    async generateBundle() {
      const svg = await readFile(options.logo)
      await Promise.all(
        list.map(async (s) => {
          const box = Math.round(Math.min(s.width, s.height) * LOGO_SHARE)
          // Render the SVG at the final size rather than scaling up a small bitmap.
          const logo = await sharp(svg, { density: Math.ceil((72 * box) / 512) })
            .resize(box, box)
            .png()
            .toBuffer()
          for (const theme of themes) {
            const source = await sharp({
              create: {
                width: s.width,
                height: s.height,
                channels: 3,
                background: options.background[theme],
              },
            })
              .composite([{ input: logo, gravity: 'centre' }])
              .png({ compressionLevel: 9, palette: true })
              .toBuffer()
            this.emitFile({ type: 'asset', fileName: fileName(s, theme), source })
          }
        }),
      )
    },
  }
}
