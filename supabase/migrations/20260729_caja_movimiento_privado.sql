-- Caja: marcar un movimiento como privado (pedido 29/07).
-- ---------------------------------------------------------------------------
-- Hasta ahora la vista del operador ocultaba TODO lo cargado por dirección
-- (quien tiene la subsección caja_saldo). Bárbara necesita decidirlo movimiento
-- por movimiento: un retiro suyo no se muestra, pero un cobro que el operador
-- tiene que ver sí.
--
-- Tres estados, por eso la columna es nullable:
--   · null  → sin decidir: vale la regla por autor (si lo cargó dirección, se
--             oculta). Cubre lo ya cargado y lo que entra por importaciones,
--             viáticos o transferencias, que no pasan por el diálogo.
--   · true  → privado explícito: nunca se le muestra al operativo.
--   · false → público explícito: se muestra aunque lo haya cargado dirección.
--
-- Quien tiene caja_saldo ve siempre todo: el filtro es solo para el operador.

alter table public.caja_movimientos
  add column if not exists privado boolean;

comment on column public.caja_movimientos.privado is
  'Visibilidad para el personal operativo: true = oculto, false = visible, null = sin decidir (se oculta si lo cargó dirección).';

-- El operador filtra por esta columna en cada consulta de la caja diaria.
create index if not exists caja_movimientos_privado_idx
  on public.caja_movimientos (caja, privado);
