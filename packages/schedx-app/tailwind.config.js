/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/preline/dist/*.js'],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#1da1f2', // Twitter blue
					600: '#1d4ed8',
					700: '#1e40af',
					800: '#1e3a8a',
					900: '#1e293b',
					950: '#0f172a'
				},
				// Twitter Dim Mode Colors
				twitter: {
					dim: {
						bg: '#15202b', // Main background
						secondary: '#192734', // Secondary background
						tertiary: '#253341', // Tertiary background
						border: '#38444d', // Borders
						text: '#ffffff', // Primary text
						textSecondary: '#8899a6', // Secondary text
						accent: '#1da1f2' // Twitter blue
					}
				},
				success: '#17bf63',
				warning: '#ffad1f',
				error: '#e0245e'
			},
			width: {
				65: '16.25rem' // Custom width for sidebar (260px)
			},
			animation: {
				'fade-in': 'fadeIn 0.5s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'slide-down': 'slideDown 0.3s ease-out'
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				slideDown: {
					'0%': { transform: 'translateY(-10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				}
			}
		}
	},
	plugins: [
		function ({ addVariant }) {
			// Use data-theme attribute for more reliable targeting
			addVariant('theme-lightsout', '[data-theme="lightsout"] &');
			addVariant('theme-dark', '[data-theme="dark"] &');
		}
	],
	darkMode: 'class',
	safelist: []
};
