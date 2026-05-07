# DESIGN.md - Don Joaquín

Este documento define el sistema de diseño completo basado en la identidad visual de "Don Joaquín", optimizado para aplicaciones de uso intensivo y prolongado con una paleta extendida.

## 1. Paleta de Colores
Basado en el logo, la paleta se centra en tonos azules vibrantes y un acento solar cálido, complementada con escalas tonales completas y colores funcionales.

### Colores de Marca
| Categoría | Color | Hex | Uso sugerido |
| :--- | :--- | :--- | :--- |
| **Primario (Base)** | Azul Brillante | `#0088D1` | Marca, CTAs principales, encabezados. |
| **Primario (Light)** | Azul Claro | `#4FC3F7` | Hover states, fondos de elementos activos. |
| **Secundario (Base)** | Azul Profundo | `#004A99` | Texto de marca, botones secundarios. |
| **Acento (Base)** | Amarillo Sol | `#FFB300` | Iconos, resaltados, estados de alerta. |
| **Acento (Light)** | Amarillo Claro | `#FFE082` | Fondos de alerta, hover en iconos de acento. |

### Grises (Neutros)
| Escala | Hex | Uso sugerido |
| :--- | :--- | :--- |
| **50** | `#F8FAFC` | Fondo general de la aplicación. |
| **100** | `#F1F5F9` | Fondos secundarios, áreas de descanso. |
| **200** | `#E2E8F0` | Bordes sutiles, divisores. |
| **400** | `#94A3B8` | Texto deshabilitado, iconos secundarios. |
| **600** | `#475569` | Texto secundario, metadatos. |
| **800** | `#1E293B` | Cuerpo de texto principal. |
| **900** | `#0F172A` | Títulos y encabezados. |
| **White** | `#FFFFFF` | Tarjetas, contenedores, modales. |

### Colores Funcionales
| Estado | Base (500) | Fondo (50) | Texto Oscuro (900) |
| :--- | :--- | :--- | :--- |
| **Éxito** | `#10B981` | `#ECFDF5` | `#064E3B` |
| **Error** | `#EF4444` | `#FEF2F2` | `#7F1D1D` |
| **Advertencia** | `#F59E0B` | `#FFFBEB` | `#78350F` |
| **Info** | `#3B82F6` | `#EFF6FF` | `#1E3A8A` |

## 2. Tipografía (Optimización de Legibilidad)
Para evitar la fatiga visual en trabajadores que usarán la web por tiempos prolongados, se utiliza **Inter**, una familia tipográfica sans-serif altamente legible.

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
- **Efecto:** Transiciones suaves al hover con ligeros cambios de saturación.

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
          50: '#E1F5FE',
          100: '#B3E5FC',
          200: '#81D4FA',
          300: '#4FC3F7',
          400: '#29B6F6',
          500: '#0088D1', // Azul Brillante
          600: '#039BE5',
          700: '#0288D1',
          800: '#0277BD',
          900: '#004A99', // Azul Profundo
        },
        accent: {
          50: '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFB300', // Amarillo Sol
        },
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
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