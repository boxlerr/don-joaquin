# DESIGN.md - Don Joaquín

Este documento define el sistema de diseño basado en la identidad visual de "Don Joaquín", optimizado para aplicaciones de uso intensivo y prolongado.

## 1. Paleta de Colores
Basado en el logo, la paleta se centra en tonos azules vibrantes y un acento solar cálido, con contrastes ajustados para reducir el cansancio visual.

| Categoría | Color | Hex | Uso sugerido |
| :--- | :--- | :--- | :--- |
| **Primario** | Azul Brillante | `#0088D1` | Marca, CTAs principales, encabezados. |
| **Secundario** | Azul Profundo | `#004A99` | Texto de marca, botones secundarios. |
| **Acento** | Amarillo Sol | `#FFB300` | Iconos, resaltados, estados de alerta. |
| **Fondo** | Blanco / Nieve | `#F8FAFC` | Fondo general de la aplicación. |
| **Superficie** | Blanco Puro | `#FFFFFF` | Tarjetas, contenedores, modales. |
| **Texto (Base)** | Gris Oscuro | `#1E293B` | Cuerpo de texto y títulos. |
| **Éxito** | Esmeralda | `#10B981` | Notificaciones positivas. |
| **Error** | Carmesí | `#EF4444` | Alertas y errores. |

## 2. Tipografía (Optimización de Legibilidad)
Para evitar la fatiga visual en trabajadores que usarán la web por tiempos prolongados, se ha seleccionado **Inter**, una familia tipográfica sans-serif altamente legible y equilibrada.

- **Fuente Principal (Display & Body):** Inter (Sans-serif moderna).
  - **H1 (Display):** 32px / Bold
  - **H2 (Display):** 24px / SemiBold
  - **Body:** 16px / Regular
  - **Small:** 14px / Medium

## 3. Componentes Core
Estilo visual sólido y funcional para mejorar el flujo de trabajo.

### Botones
- **Border-radius:** `8px` (Esquinas suavizadas).
- **Padding:** `12px 24px`.
- **Sombra:** `0 4px 6px -1px rgb(0 0 0 / 0.1)`.
- **Efecto:** Transiciones suaves al hover.

### Inputs
- **Borde:** `1px solid #E2E8F0`.
- **Focus:** `2px solid #0088D1` con un ligero glow.
- **Background:** `#FFFFFF`.

## 4. Configuración de Tailwind CSS
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0088D1',
          secondary: '#004A99',
          accent: '#FFB300',
        },
        ui: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          text: '#1E293B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'brand': '8px',
      }
    },
  },
}
```