/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          // Pareja suave para etiquetas y avisos: bg-destructive-soft +
          // text-destructive-soft-foreground. Correcta en claro y en oscuro
          // sin escribir la variante dark: en cada sitio.
          soft: 'hsl(var(--destructive-soft))',
          'soft-foreground': 'hsl(var(--destructive-soft-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
          'soft-foreground': 'hsl(var(--success-soft-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
          'soft-foreground': 'hsl(var(--warning-soft-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          soft: 'hsl(var(--info-soft))',
          'soft-foreground': 'hsl(var(--info-soft-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // Los tres tamaños que el CRM usa de verdad, con nombre.
      //
      // Hay 1.106 tamaños escritos a pelo repartidos en diez valores: 584
      // `text-[11px]`, 390 `text-[10px]`, 69 `text-[13px]`, y luego 9, 12, 8 y
      // 14. La escala de Tailwind (12/14/16) no encaja en un panel denso, así
      // que se le pone nombre a la que ya se usaba.
      //
      // No se tocan `xs`, `sm` ni `base`: redefinirlos movería las 83 pantallas
      // a la vez, y eso no se puede revisar. Estas se añaden y se van adoptando
      // según se toca cada pantalla.
      fontSize: {
        micro: ['0.625rem', { lineHeight: '0.875rem' }],   // 10px · etiquetas y chips
        meta: ['0.6875rem', { lineHeight: '1rem' }],       // 11px · datos secundarios
        body: ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px · tablas y formularios
      },

      boxShadow: {
        // La sombra de los diálogos estaba copiada tal cual en 7 sitios.
        dialog: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
