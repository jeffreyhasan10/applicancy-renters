
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: '#1F2937', // Charcoal Black
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: '#D4AF37', // Champagne Gold
					foreground: '#1F2937' // Charcoal Black text on gold
				},
				destructive: {
					DEFAULT: '#EF4444', // Soft Red
					foreground: '#FFFFFF'
				},
				muted: {
					DEFAULT: '#F3F4F6', // Pearl Gray
					foreground: '#6B7280' // Slate Gray
				},
				accent: {
					DEFAULT: '#D4AF37', // Champagne Gold
					foreground: '#1F2937'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: '#F3F4F6', // Pearl Gray
					foreground: '#1F2937' // Charcoal Black
				},
				sidebar: {
					DEFAULT: '#1F2937', // Charcoal Black
					foreground: '#FAFAFA', // Soft White
					primary: '#D4AF37', // Champagne Gold
					'primary-foreground': '#1F2937',
					accent: '#2D3748', // Slightly lighter than sidebar
					'accent-foreground': '#FAFAFA',
					border: '#374151', // Slightly lighter border
					ring: '#D4AF37' // Gold highlight
				},
				propease: {
					50: "#EEF2FF", 
					100: "#E0E7FF", 
					200: "#C7D2FE", 
					300: "#A5B4FC", 
					400: "#818CF8", 
					500: "#6366F1", 
					600: "#4F46E5", 
					700: "#4338CA", 
					800: "#3730A3",
					900: "#1E3A8A"
				},
				success: '#16A34A', // Forest Green
				warning: '#FBBF24', // Amber
				danger: '#EF4444', // Soft Red
				info: '#0ea5e9',
				luxury: {
					gold: '#D4AF37', // Champagne Gold
					charcoal: '#1F2937', // Charcoal Black
					pearl: '#F3F4F6', // Pearl Gray
					slate: '#6B7280', // Slate Gray
					softwhite: '#FAFAFA' // Soft White
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				fadeIn: {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				shimmer: {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				pulse: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '.5' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fadeIn': 'fadeIn 0.5s ease-out forwards',
				'shimmer': 'shimmer 2s infinite linear',
				'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
			},
			boxShadow: {
				'luxury': '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
				'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
				'gold': '0 4px 14px 0 rgba(212, 175, 55, 0.39)',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
