import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Fretboard Trainer',
				short_name: 'Fretboard',
				description: 'Practice fretboard, ear training, and theory offline.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#0f172a',
				theme_color: '#0f172a',
				icons: [
					{
						src: 'favicon.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'favicon.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					}
				]
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.destination === 'audio',
						handler: 'CacheFirst',
						options: {
							cacheName: 'audio',
							expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 365 }
						}
					}
				]
			},
			// Required for installability on localhost (manifest + SW during `vite dev`).
			devOptions: {
				enabled: true,
				suppressWarnings: true,
				type: 'module',
				navigateFallback: '/'
			}
		}),
		devtoolsJson(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	],
	ssr: {
		noExternal: ['@magenta/music']
	  }
});
