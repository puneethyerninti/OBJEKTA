const { defineConfig } = require('vite');
module.exports = defineConfig(async () => {
	const react = (await import('@vitejs/plugin-react')).default;
	const tailwind = (await import('@tailwindcss/postcss')).default;
	const autoprefixer = (await import('autoprefixer')).default;

	return {
		plugins: [react()],
	css: {
		postcss: {
			plugins: [
				tailwind(),
				autoprefixer(),
			],
		},
	},
	resolve: {
		dedupe: [
			'react', 'react-dom',
			'three', 'postprocessing',
			'@react-three/fiber', '@react-three/drei', '@react-three/postprocessing',
		],
		alias: {
			three: 'three',
		},
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
		},
	};
});
