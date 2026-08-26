# Ilustraciones de los tipos de documento — material para generarlas con Higgsfield

Las 20 que están en producción hoy son SVG dibujados a mano
(`src/app/(dashboard)/compliance/components/ArteTipoDocumento.tsx`). Este archivo guarda el
set de prompts que quedó listo para generarlas como imagen, el día que la cuenta de Higgsfield
tenga créditos: el 26/08/2026 tenía 0,3 y cada imagen cuesta 2,5 (las 20 ≈ 50 créditos).

**Cómo se generan** (`generate_image_batch`, hasta 12 por lote):

```json
{
  "model": "recraft_v4_1",
  "model_type": "vector",
  "resolution": "1k",
  "aspect_ratio": "1:1",
  "background_color": "#E1F5FE",
  "colors": ["#0088D1", "#E1F5FE", "#475569", "#FFFFFF", "#BAE6FD"]
}
```

`recraft_v4_1` en modo `vector` es el único del catálogo que acepta paleta y fondo fijos, que es
lo que hace que las 20 se vean como un set y no como veinte imágenes sueltas. Después hay que
bajarlas, pasarlas a webp de ~128 px (`sharp`, que ya está en el proyecto) y dejarlas en
`public/tipos-documento/`.

**Ojo con las esquinas**: se generan CUADRADAS y el redondeo lo pone el CSS del componente (la
placa es rx 13 sobre 48 ≈ 27 %). Ningún modelo repite el mismo radio veinte veces seguidas.

---

## Estilo — «Elevación y sello»

Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.

---

## Los 20 prompts

### 1. `VTV` — Oblea circular de borde festoneado con cuña azul

```
One circular windshield inspection sticker seen face-on, centred: a die-cut scalloped outer edge of even wavy bumps, a bold inner ring, one quarter wedge filled solid #0088D1 pierced by a small round punch hole, and a small rectangular peel tab at the lower left. The sticker face is otherwise completely empty — no characters of any kind, no digits, no year, no writing. Drawn flat, outline only, no shading. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle document. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 2. `CARNET_CONDUCIR` — Tarjeta apaisada con ventana de foto

```
A driver licence card: one horizontal card with rounded corners, shown flat in strict front elevation, drawn as a flat outline with no material sheen. Its left third is a flat #BAE6FD portrait window holding a small white circle-head-and-shoulders figure; the right side carries three blank rounded #BAE6FD bars standing in for data lines. Every field is empty — no characters of any kind, no digits, no writing anywhere on the card. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: this document belongs to one driver. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 3. `EMP_CERT_COBERTURA` — Paraguas abierto de frente, disco edificio

```
An open umbrella seen in strict front elevation, centred, the only umbrella in the set: a wide chunky canopy of four scalloped panels alternating white and flat #BAE6FD, a long straight vertical shaft below it and a bold hooked handle at the bottom. Nothing under the canopy, nothing else inside the square. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this document belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 4. `CH_LIBRE_DEUDA_SINDICAL` — Apretón de manos en chapa cuadrada, disco persona

```
Two clasped hands in a firm handshake, centred, strict front elevation, held inside one chunky rounded-square badge with a thick border — the only handshake in the set. The two cuffs are flat #BAE6FD, the hands white, the grip drawn with fat rounded strokes and generous margin so it survives shrinking. No paper, no seal, no ribbon, no writing. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: this clearance belongs to one driver. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 5. `COMP_PAGO_HABERES` — Tira dentada con tilde verde

```
A payment voucher: one narrow upright receipt slip in strict front elevation, clearly taller than it is wide, its bottom edge torn in a chunky zig-zag, its face carrying only two blank #BAE6FD bars — no characters of any kind, no digits, no writing. A solid #22C55E circle with a thick white knocked-out check mark overlaps the slip's lower-left corner. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: this proof of payment belongs to one driver. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 6. `EPAP` — Tablilla médica con línea de electro

```
A medical fitness clipboard: one upright board in strict front elevation with a chunky clip straddling its top edge, its white sheet crossed by a single bold #0088D1 ECG heartbeat zig-zag and two short blank #BAE6FD bars beneath it. No writing at all, no characters. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: this medical evaluation belongs to one driver. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 7. `RECIBO_HABERES` — Hoja con grilla vacía y trazo de firma

```
A payslip: one upright sheet in strict front elevation ruled into a chunky grid of three by three empty #BAE6FD cells, filling most of the sheet. Across the bottom, one single continuous wavy loop stroke resting on a short straight baseline — an abstract mark standing in for a signature, deliberately not letters, not a word, not initials, not any character. Nothing else on the sheet. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: the driver this payslip belongs to. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 8. `SEGURO_VIDA` — Mano abierta sosteniendo un corazón

```
Personal life cover: one open upturned hand seen in strict front elevation — a chunky white palm with four short rounded fingers and a thumb, wrist cuff filled flat #BAE6FD — cradling one bold symmetrical heart filled solid #0088D1 floating just above the palm. Only those two shapes, centred, with generous space around them. No umbrella, no shield, no paper. The lower-right #475569 disc holds a white knocked-out head-and-shoulders bust: this cover is for one driver. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 9. `CERT_DISCO_RUPTURA` — Disco de ruptura con brida abulonada y grieta

```
One circular tank rupture disc seen face-on, centred: a thick clamping ring with a perfectly smooth outer edge and eight evenly spaced round bolt holes, and a raised centre cut by deep cross-shaped score lines into four petals, one petal burst open with a short jagged #EF4444 crack. Drawn flat, outline only — no shading, no metal sheen, no rendered volume. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle document. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 10. `CERT_VALVULAS` — Válvula de alivio de perfil con palanca

```
One spring-loaded pressure relief valve in strict side elevation, tall and centred: a bolted round flange base, a tapering body filled flat #BAE6FD, a single side outlet elbow, a rounded bonnet cap on top and a stubby lift lever above it; two small #F59E0B chevrons sit just outside the outlet to show release. Drawn flat, outline only — no shading, no metal sheen, no rendered volume. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle document. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 11. `LIBRE_DEUDA_UNIDAD` — Patente en blanco con tilde verde

```
One blank vehicle licence plate in strict front elevation: a wide horizontal rounded rectangle with a thick border, a solid #0088D1 band across the top edge, and two small screw holes on the centre line. The plate face is absolutely empty — no characters, no digits, no province name, nothing written on the top band either. A small solid #22C55E circle with a white knocked-out tick overlaps the lower-left corner. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle document. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 12. `SEGURO_UNIDAD` — Escudo relleno con cabina de camión calada

```
One plain protective shield in strict front elevation, symmetrical, flat top and pointed base, no crest and no ornament: thick outline and a face filled entirely flat #BAE6FD, holding one white knocked-out front-elevation truck cab — wide windshield, two square headlights, plain bumper — and nothing else inside. The shield reads as a filled, light-blue mass with a white shape cut out of it. Drawn flat, no shading. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle document. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 13. `VERIF_ADICIONAL` — Lupa vertical con tilde ámbar

```
One upright magnifying glass in strict front elevation: a thick circular lens rim at the top and a short straight handle pointing straight down from its base, the lens interior filled flat #BAE6FD holding a single bold #F59E0B tick mark and nothing else. No sparkle, no reflection line. The lower-right #475569 disc holds a white knocked-out side-view tank truck: tractor unit pulling a cylindrical tank semi-trailer, marking a per-vehicle inspection. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 14. `SINDICALES` — Pila de tres monedas de canto

```
A stack of three coins seen in strict side elevation, centred and squat: three equal slabs with fully rounded left and right ends, stacked one on top of the other with a thin gap between them, the top slab white and the two below filled flat #BAE6FD, all with the same thick outline. Nothing minted on them — no faces, no characters, no digits — and nothing else in the square. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this contribution belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 15. `ART` — Casco de seguridad con cruz

```
A construction safety helmet, hard hat, centred in strict front elevation: a tall rounded white crown with a raised central ridge, a wide flat brim across the bottom filled flat #BAE6FD, and a short chin-strap loop under each side. One bold equal-armed cross filled solid #0088D1 sits centred on the crown. No head, no face, no worker, no shading of any kind — flat outline only. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this cover belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 16. `F931` — Hoja vertical con sello redondo abajo a la izquierda

```
A single upright portrait sheet of paper, centred, strict front elevation: white fill with a #0088D1 outline, one longer flat #BAE6FD title bar and three shorter bars across its upper half, its lower half left empty, and one bold official round ink seal overlapping its lower-left corner — two concentric #0088D1 rings around a flat #BAE6FD centre, empty inside. No characters of any kind, no digits, no writing, no folded corner, no people. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this filing belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 17. `NOMINA_F931` — Hoja vertical con lista de personas

```
A single upright portrait sheet of paper, centred, strict front elevation, the same proportions as a plain form: white fill with a #0088D1 outline, carrying a roster of four identical stacked rows that fill the whole sheet top to bottom, each row a small white circle head outlined in #0088D1 followed by one flat #BAE6FD bar. No seal, no stamp, no folded corner, no pencil, no characters of any kind. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this listing belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 18. `EMP_POLIZA_SEGURO_FLOTA` — Libreta gruesa con lomo y cinta marcadora

```
A thick closed contract booklet standing upright and centred, strict front elevation: a chunky rounded-corner white cover, a bold vertical spine band down the left edge, three stacked page-edge lines along the right edge to show thickness, one wide horizontal band across the middle of the cover filled flat #BAE6FD, and a narrow ribbon bookmark hanging from the bottom edge. Nothing written on the cover, no seal, no characters. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this policy covers the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 19. `EMP_SEGURO_VIDA` — Escudo blanco con corazón azul macizo

```
One plain protective shield in strict front elevation, centred, no crest and no ornament: straight square shoulders, sides tapering to a rounded point at the bottom, thick #0088D1 outline and a plain white face. One bold symmetrical heart filled solid #0088D1 sits centred inside the shield with generous margin, so the shield reads white with a dark heart at its core. No human figure, no hands, no paper, no shading. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this cover belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

### 20. `LIBRE_DEUDA_SINDICAL` — Candado abierto

```
One open padlock in strict front elevation, centred: a chunky rounded-square body filled flat #BAE6FD with a thick outline and a small round keyhole knocked out in white at its centre, and a bold U-shaped shackle swung open and clear of the body, hinged on the left and lifted away on the right. Only the padlock — no paper, no seal, no handshake, no check mark, no characters. The lower-right #475569 disc holds a white knocked-out plain flat-roofed office building: this clearance belongs to the whole company. Flat vector pictogram with a technical-drawing feel: one centred object filling ~75% of a full-bleed, opaque, flat #E1F5FE square — square corners, no frame, vignette, ground line or scene. Strict front or side elevation, never 3/4 or perspective. White fills, uniform #0088D1 outlines about 4% of the canvas wide, rounded caps and joins, flat #BAE6FD for interior masses, and one solid #475569 disc in the lower-right corner holding a white knocked-out level silhouette. Chunky and legible at 34px. No gradients, gloss, bevel, shadow, texture, hairlines, text, letters, numbers or logos.
```

---

## Lo que encontró la revisión (vale también para los SVG)

Cada punto es un par que a 34 px se veía igual. Los tres primeros ya se corrigieron en los SVG
que están en producción — la oblea de la VTV lleva borde troquelado, el escudo del seguro de
unidades quedó macizo para contrastar con el de la flota, y el libre de deuda pasó a candado
abierto:

- **[16, 20]** — Colisión total: 16 (F931) y 20 (Libre deuda sindical empresa) eran literalmente la misma ilustración — hoja vertical blanca con sello redondo superpuesto y el mismo disco de edificio. A 34px son indistinguibles. 20 pasa a candado abierto (libre de deuda) y queda un solo 'hoja + sello' en el set.

- **[3, 8]** — Dos paraguas casi idénticos: 3 (Certificado de Cobertura) y 8 (Seguro de vida del chofer) sólo se diferenciaban por un corazón chiquito debajo del toldo y por el disco de nivel. A 34px la silueta es la misma. El paraguas queda sólo en el 3; el 8 pasa a mano abierta sosteniendo un corazón.

- **[12, 19]** — Dos escudos (12 Seguro de unidades y 19 Seguro de Vida Obligatorio) con el mismo contorno. Se mantiene uno por nivel pero con contraste de VALOR, no de detalle: el 12 es escudo relleno #BAE6FD con cabina blanca calada (lee oscuro/claro invertido), el 19 es escudo blanco con corazón azul macizo. Riesgo residual asumido, pero ya no se confunden en miniatura.

- **[1, 9]** — Dos círculos con marcas radiales y perforaciones: 1 (oblea VTV) y 9 (disco de ruptura), ambos de nivel unidad, o sea con el mismo disco de camión. Se separan por el borde: la oblea pasa a troquelado ondulado (festoneado) con pestaña, y el disco de ruptura queda con borde liso, ocho bulones y la grieta roja.

- **[4, 14, 20]** — El trío sindical no se distinguía: 4 (chofer) y 14 (empresa) eran ambos apretón de manos, y 4 y 20 eran ambos 'hoja con sello'. Queda un único apretón de manos (4, chapa cuadrada, disco de persona), 14 pasa a pila de monedas (aportes) y 20 a candado abierto.

- **[5, 11, 20]** — Tres círculos verdes con tilde (5, 11 y 20) repetían el mismo recurso hasta volverlo el elemento más visible del set en vez del objeto. Quedan dos, en objetos de silueta muy distinta (tira dentada vs patente), y el 20 se queda sin tilde.

- **[1, 2, 5, 7, 11, 16, 17]** — Objetos que por naturaleza llevan texto y el generador va a intentar escribir igual: patente, oblea VTV, carnet, recibo firmado, nómina, comprobante. La prohibición de la coletilla no alcanza; hay que negar los caracteres en la descripción del objeto mismo ('la cara de la patente queda absolutamente vacía', etc.).

- **[7]** — La firma del recibo (7) es el punto donde más fácil se cuela texto: 'signature scribble' es una invitación a escribir. Se reescribe como un único trazo ondulado continuo, explícitamente no letras, apoyado en una línea base.

- **[2, 9, 10, 12, 15, 19]** — Palabras que arrastran el look render 3D de stock que el dueño odia: 'domed', 'plastic card', 'heraldic shield', 'metallic'. Se sacan o se acompañan de 'dibujado plano, sólo contorno, sin sombreado'.

- **[3, 8, 12, 16, 17, 19]** — Criterio general que estaba mal aplicado: el disco de nivel mide unos 8px cuando la ilustración va a 34px, así que NO puede ser el único diferenciador entre dos tipos. Cada par crítico ahora se distingue por silueta exterior; el disco confirma, no decide.

- **[14]** — 14 'Sindicales' con apretón de manos no decía nada de aportes (que es plata mensual de la empresa) y además chocaba con el 4. Pasa a una pila de tres monedas en elevación lateral, única silueta de dinero del set.

- **[2, 3, 11, 15]** — Riesgos residuales que dejo anotados, no resueltos por completo: paraguas (3) y casco (15) comparten una masa redondeada arriba —se separan por el mástil largo y el ala plana—; carnet (2) y patente (11) son ambos rectángulos apaisados —se separan por la ventana de foto oscura y por el nivel—.
