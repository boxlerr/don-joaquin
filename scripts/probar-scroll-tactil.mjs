// Banco de pruebas del scroll del selector del Taller, con un dedo DE VERDAD.
//
// El bug no se reproduce con la rueda del mouse: en la computadora anda. Acá se
// emula un teléfono (touch, viewport de iPhone) y se despacha un gesto táctil
// real: en Chromium por el protocolo de Chrome (`Input.synthesizeScrollGesture`
// con `gestureSourceType: "touch"`, que es literalmente lo que hace un dedo) y
// en WebKit —el motor de Safari— con eventos táctiles encadenados.
//
// Cómo se usa (hace falta `npm i -D playwright-core` y `npx playwright install webkit`):
//
//   node scripts/probar-scroll-tactil.mjs [url]
//
// Necesita una página con el selector abierto y SIN login. La forma rápida:
// crear `src/app/prueba-scroll/page.tsx` que renderice <TallerClient> con datos
// falsos, y agregar `prueba-scroll|` al principio del matcher de src/proxy.ts
// para que no lo mande al login. Las dos cosas son temporales: se borran después.

import { chromium, webkit } from "playwright-core";

const URL_PRUEBA = process.argv[2] ?? "http://localhost:3000/prueba-scroll";

const CHROMIUM =
  "/Users/julianboxler/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/" +
  "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const TELEFONO = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

async function abrirSelector(pagina) {
  await pagina.goto(URL_PRUEBA, { waitUntil: "domcontentloaded" });
  const boton = pagina.getByRole("button", { name: /elegir la unidad/i });
  await boton.first().waitFor({ timeout: 20000 });
  // `tap` sólo existe con touch; en escritorio se abre con un click.
  try {
    await boton.first().tap();
  } catch {
    await boton.first().click();
  }
  await pagina.waitForSelector('[data-slot="sheet-content"] ul', { timeout: 20000 });
  await pagina.waitForTimeout(700);
}

const estado = (pagina) =>
  pagina.evaluate(() => {
    const lista = document.querySelector('[data-slot="sheet-content"] ul');
    if (!lista) return null;
    const c = lista.getBoundingClientRect();
    return {
      scrollTop: lista.scrollTop,
      alto: lista.clientHeight,
      contenido: lista.scrollHeight,
      centro: { x: Math.round(c.x + c.width / 2), y: Math.round(c.y + c.height / 2) },
    };
  });

/** El dedo, tal como lo manda Chrome: un gesto de scroll táctil sintetizado. */
async function dedoChromium(cdp, desde, pixeles) {
  await cdp.send("Input.synthesizeScrollGesture", {
    x: desde.x,
    y: desde.y,
    xDistance: 0,
    yDistance: -pixeles,
    gestureSourceType: "touch",
    speed: 800,
    preventFling: true,
  });
}

/** El dedo en WebKit: touchstart + varios touchmove + touchend. */
async function dedoWebkit(pagina, desde, pixeles) {
  await pagina.evaluate(
    async ({ x, y, total }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      // WebKit declara `Touch` pero no deja construirlo ("Illegal constructor"),
      // así que no alcanza con mirar el typeof: hay que intentarlo.
      const toque = (cy, id = 1) => {
        try {
          return new Touch({ identifier: id, target: el, clientX: x, clientY: cy, pageX: x, pageY: cy });
        } catch {
          return document.createTouch(window, el, id, x, cy, x, cy);
        }
      };
      const lista = (...ts) =>
        typeof document.createTouchList === "function" ? document.createTouchList(...ts) : ts;
      const mandar = (tipo, cy) => {
        const t = toque(cy);
        let ev;
        try {
          ev = new TouchEvent(tipo, {
            bubbles: true,
            cancelable: true,
            touches: tipo === "touchend" ? [] : [t],
            targetTouches: tipo === "touchend" ? [] : [t],
            changedTouches: [t],
          });
        } catch {
          // WebKit: se arma el evento con la API vieja.
          ev = document.createEvent("TouchEvent");
          ev.initTouchEvent(
            tipo === "touchend" ? lista() : lista(t),
            tipo === "touchend" ? lista() : lista(t),
            lista(t),
            tipo,
            window,
            0, 0, x, cy,
            false, false, false, false,
          );
        }
        el.dispatchEvent(ev);
      };
      mandar("touchstart", y);
      const pasos = 20;
      for (let i = 1; i <= pasos; i++) {
        mandar("touchmove", y - (total * i) / pasos);
        await new Promise((r) => setTimeout(r, 16));
      }
      mandar("touchend", y - total);
    },
    { x: desde.x, y: desde.y, total: pixeles },
  );
}

async function probar(nombre, lanzar, opciones, dedo, sinNativo = false, contextoExtra = null) {
  const navegador = await lanzar.launch(opciones);
  const contexto = await navegador.newContext(contextoExtra ?? TELEFONO);
  const pagina = await contexto.newPage();
  let resultado;
  try {
    await abrirSelector(pagina);
    if (sinNativo) {
      // Se le saca al navegador la posibilidad de scrollear: `overflow: hidden`
      // deja la lista quieta para cualquier gesto nativo, pero `scrollTop`
      // sigue siendo escribible. Es la forma de comprobar que el arrastre
      // propio mueve la lista POR SÍ SOLO — el escenario del teléfono donde el
      // scroll nativo no responde.
      await pagina.evaluate(() => {
        const l = document.querySelector('[data-slot="sheet-content"] ul');
        if (l) l.style.overflowY = "hidden";
      });
    }
    const antes = await estado(pagina);
    if (!antes) throw new Error("no apareció la lista");
    await dedo({ pagina, contexto, desde: antes.centro, pixeles: 300 });
    await pagina.waitForTimeout(1200);
    const despues = await estado(pagina);
    const corrio = Math.round(despues.scrollTop - antes.scrollTop);
    resultado = { nombre, alto: antes.alto, contenido: antes.contenido, corrio, anda: corrio > 20 };
  } catch (e) {
    resultado = { nombre, error: e.message, anda: false };
  }
  await navegador.close();
  return resultado;
}

const resultados = [];

resultados.push(
  await probar("Chromium (Android) · dedo", chromium, { executablePath: CHROMIUM }, async (o) => {
    const cdp = await o.contexto.newCDPSession(o.pagina);
    await dedoChromium(cdp, o.desde, o.pixeles);
  }),
);

// WebKit de escritorio no implementa eventos táctiles (sólo existen en iOS), así
// que el dedo no se puede sintetizar ahí. Lo que sí se comprueba: que en un
// navegador SIN touch el arrastre propio no se engancha y la rueda sigue
// mandando — o sea que esto no rompe la computadora.
resultados.push(
  await probar(
    "WebKit · sin touch: la rueda",
    webkit,
    {},
    async (o) => {
      await o.pagina.mouse.move(o.desde.x, o.desde.y);
      await o.pagina.mouse.wheel(0, o.pixeles);
    },
    false,
    { viewport: { width: 390, height: 844 }, hasTouch: false, isMobile: false },
  ),
);

resultados.push(
  await probar(
    "Chromium · SIN scroll nativo",
    chromium,
    { executablePath: CHROMIUM },
    async (o) => {
      const cdp = await o.contexto.newCDPSession(o.pagina);
      await dedoChromium(cdp, o.desde, o.pixeles);
    },
    true,
  ),
);

resultados.push(
  await probar(
    "Chromium · rueda (escritorio)",
    chromium,
    { executablePath: CHROMIUM },
    async (o) => {
      await o.pagina.mouse.move(o.desde.x, o.desde.y);
      await o.pagina.mouse.wheel(0, o.pixeles);
    },
    false,
    { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
  ),
);

console.log("\n════ RESULTADO ════════════════════════════════");
for (const r of resultados) {
  const estadoTxt = r.error ? `✗ ${r.error}` : r.anda ? `✓ corrió ${r.corrio}px` : `✗ NO se movió`;
  console.log(`${r.nombre.padEnd(28)} ${estadoTxt}`);
  if (r.alto) console.log(`${"".padEnd(28)}   (lista ${r.alto} / contenido ${r.contenido})`);
}

process.exit(resultados.every((r) => r.anda) ? 0 : 2);
