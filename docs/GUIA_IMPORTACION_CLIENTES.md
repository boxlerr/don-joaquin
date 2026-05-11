# Guía de Carga Masiva de Clientes

Este documento explica cómo completar la plantilla para importar clientes al sistema.

## Ubicación de la Plantilla
Puedes encontrar la plantilla en: `docs/plantilla_carga_clientes.csv`

## Instrucciones de Uso
1. Abre el archivo `plantilla_carga_clientes.csv` con Excel.
2. Completa los datos de tus clientes siguiendo el formato de las columnas.
3. Guarda el archivo manteniendo el formato `.csv` (o guárdalo como `.xlsx`).
4. En el sistema, ve a **Clientes** y utiliza el botón de **Importar** para subir el archivo.

## Descripción de los Campos

| Columna | Obligatorio | Descripción / Valores permitidos |
| :--- | :---: | :--- |
| **Razon Social** | SI | Nombre legal de la empresa o persona. |
| **Nombre Comercial** | NO | Nombre de fantasía o cómo se conoce al cliente. |
| **CUIT** | NO | Identificación tributaria (ej: 30-12345678-9). |
| **Condicion IVA** | NO | Valores recomendados: `Responsable Inscripto`, `Monotributo`, `Exento`, `Consumidor Final`. |
| **Domicilio** | NO | Dirección fiscal o de entrega. |
| **Localidad** | NO | Ciudad o pueblo. |
| **Provincia** | NO | Provincia o estado. |
| **Email** | NO | Debe tener un formato de correo válido (ej: info@empresa.com). |
| **Telefono** | NO | Número de contacto. |
| **Es Multinacional** | NO | Coloca `SI`, `X` o `1` si es multinacional. De lo contrario, dejar vacío o `No`. |
| **Observaciones** | NO | Comentarios adicionales sobre el cliente. |

> [!TIP]
> El sistema es flexible con los nombres de las cabeceras. Por ejemplo, acepta tanto "Razón Social" como "Razon Social" (sin tilde).

> [!IMPORTANT]
> Los clientes se importarán automáticamente con el estado **Activo**.
