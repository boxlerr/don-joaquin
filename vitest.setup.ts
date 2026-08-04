import "@testing-library/jest-dom";

// jsdom no implementa ResizeObserver y varios componentes del layout responsive
// lo usan para saber si un contenedor scrollea (HorizontalScrollHint y todo lo
// que lo envuelve: tabs, tiras de chips, tablas anchas). Sin este stub, montar
// cualquiera de esos componentes tira "ResizeObserver is not defined".
//
// Es un stub inerte a propósito: nunca dispara el callback, así que los tests
// ven el estado inicial (sin overflow). Un test que necesite comprobar el aviso
// de scroll tiene que instalar su propio doble y llamar al callback a mano.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
