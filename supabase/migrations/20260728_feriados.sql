-- Calendario de feriados y días inhábiles bancarios, para TODO el sistema.
--
-- Es la tabla que responde "¿este día se puede pagar / presentar / trabajar?".
-- La usa préstamos para correr los vencimientos que caen sábado, domingo o
-- feriado, y queda disponible para vacaciones, compliance, caja y cheques.
--
-- Cómo se llena:
--   * Lo que la Ley 27.399 permite calcular (16 de los ~19 días de cualquier
--     año) lo genera src/lib/feriados.ts, sin red. Acá va sembrado 2026-2032.
--   * Los días no laborables con fines turísticos ("puentes") los fija el Poder
--     Ejecutivo año a año por decreto, entre fines de noviembre y fines de
--     diciembre del año anterior. Ésos se cargan a mano — los de 2026 van abajo.
--   * Los asuetos del 24 y 31 de diciembre se confirman recién a mediados de
--     diciembre, también a mano.
--
-- Por qué no se baja de una API en caliente: la API más usada devuelve los años
-- futuros con los feriados trasladables SIN trasladar y con HTTP 200 — no falla,
-- miente. Verificado: para 2027 devuelve 17/6, 17/8 y 12/10 cuando por el art. 6
-- corresponden 21/6, 16/8 y 11/10.

create table if not exists public.feriados (
  fecha date primary key,
  nombre text not null,
  tipo text not null check (
    tipo in ('inamovible', 'trasladable', 'turistico', 'no_laborable', 'bancario', 'extraordinario')
  ),
  -- Feriado pleno (descanso obligatorio, se paga con recargo) vs día no
  -- laborable (lo decide el empleador). La diferencia es plata en la
  -- liquidación, por eso no es un solo booleano.
  es_feriado boolean not null default true,
  -- Los bancos cierran también en los días no laborables: es la excepción
  -- expresa del art. 167 de la LCT ("salvo en bancos, seguros y afines").
  cierra_banco boolean not null default true,
  origen text not null default 'manual' check (origen in ('ley_27399', 'norma', 'manual')),
  -- Norma que lo fija, cuando no sale de la ley (ej. "Resolución 164/2025").
  norma text,
  observaciones text,
  -- Don Joaquín cruza provincias: queda listo para feriados provinciales.
  ambito text not null default 'nacional',
  anio integer generated always as (extract(year from fecha)::integer) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists feriados_anio_idx on public.feriados (anio);

alter table public.feriados enable row level security;

comment on table public.feriados is
  'Calendario de feriados y días inhábiles bancarios. Lo calculable sale de la Ley 27.399; los puentes turísticos y los asuetos de fin de año se cargan a mano.';

insert into public.feriados (fecha, nombre, tipo, es_feriado, cierra_banco, origen, observaciones) values
  ('2026-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2026-02-16', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2026-02-17', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2026-04-02', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2026-04-03', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2026-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2026-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2026-06-15', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', null),
  ('2026-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2026-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2026-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', null),
  ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', null),
  ('2026-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2026-11-23', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', null),
  ('2026-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2026-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2027-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2027-02-08', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2027-02-09', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2027-03-25', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2027-03-26', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2027-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2027-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2027-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2027-06-21', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', null),
  ('2027-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2027-08-16', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', null),
  ('2027-10-11', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', null),
  ('2027-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2027-11-20', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2027-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2027-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2028-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2028-02-28', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2028-02-29', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2028-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2028-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2028-04-13', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2028-04-14', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2028-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2028-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2028-06-17', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2028-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2028-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2028-08-21', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', null),
  ('2028-10-16', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', null),
  ('2028-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2028-11-20', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', null),
  ('2028-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2028-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2029-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2029-02-12', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2029-02-13', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2029-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2029-03-29', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2029-03-30', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2029-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2029-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2029-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2029-06-17', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2029-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2029-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2029-08-20', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', null),
  ('2029-10-15', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', null),
  ('2029-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2029-11-19', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', null),
  ('2029-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2029-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2030-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2030-03-04', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2030-03-05', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2030-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2030-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2030-04-18', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2030-04-19', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2030-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2030-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2030-06-17', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', null),
  ('2030-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2030-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2030-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2030-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2030-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2030-11-18', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', null),
  ('2030-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2030-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2031-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2031-02-24', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2031-02-25', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2031-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2031-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2031-04-10', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2031-04-11', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2031-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2031-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2031-06-16', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', null),
  ('2031-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2031-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2031-08-17', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2031-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2031-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2031-11-24', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', null),
  ('2031-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2031-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null),
  ('2032-01-01', 'Año Nuevo', 'inamovible', true, true, 'ley_27399', null),
  ('2032-02-09', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2032-02-10', 'Carnaval', 'inamovible', true, true, 'ley_27399', null),
  ('2032-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', true, true, 'ley_27399', null),
  ('2032-03-25', 'Jueves Santo', 'no_laborable', false, true, 'ley_27399', null),
  ('2032-03-26', 'Viernes Santo', 'inamovible', true, true, 'ley_27399', null),
  ('2032-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', true, true, 'ley_27399', null),
  ('2032-05-01', 'Día del Trabajador', 'inamovible', true, true, 'ley_27399', null),
  ('2032-05-25', 'Día de la Revolución de Mayo', 'inamovible', true, true, 'ley_27399', null),
  ('2032-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', true, true, 'ley_27399', null),
  ('2032-06-21', 'Paso a la Inmortalidad del General Martín Miguel de Güemes', 'trasladable', true, true, 'ley_27399', null),
  ('2032-07-09', 'Día de la Independencia', 'inamovible', true, true, 'ley_27399', null),
  ('2032-08-16', 'Paso a la Inmortalidad del General José de San Martín', 'trasladable', true, true, 'ley_27399', null),
  ('2032-10-11', 'Día del Respeto a la Diversidad Cultural', 'trasladable', true, true, 'ley_27399', null),
  ('2032-11-06', 'Día del Bancario', 'bancario', false, true, 'ley_27399', null),
  ('2032-11-20', 'Día de la Soberanía Nacional', 'trasladable', true, true, 'ley_27399', 'Traslado a definir por JGM (Decreto 614/2025)'),
  ('2032-12-08', 'Inmaculada Concepción de María', 'inamovible', true, true, 'ley_27399', null),
  ('2032-12-25', 'Navidad', 'inamovible', true, true, 'ley_27399', null)
on conflict (fecha) do nothing;

-- Días no laborables con fines turísticos de 2026 (Resolución 164/2025 de
-- Jefatura de Gabinete, publicada el 26/12/2025). No son feriado: la actividad
-- es optativa para el empleador. Pero los bancos cierran igual.
insert into public.feriados (fecha, nombre, tipo, es_feriado, cierra_banco, origen, norma) values
  ('2026-03-23', 'Día no laborable con fines turísticos', 'turistico', false, true, 'norma', 'Resolución 164/2025'),
  ('2026-07-10', 'Día no laborable con fines turísticos', 'turistico', false, true, 'norma', 'Resolución 164/2025'),
  ('2026-12-07', 'Día no laborable con fines turísticos', 'turistico', false, true, 'norma', 'Resolución 164/2025')
on conflict (fecha) do nothing;
