-- Las dos canteras que le faltaban al cuadro de rindes.
--
-- Salió de leer los dos Excel que mandó Nico el 02/09/2026. En su planilla del
-- 01/09, **9 de las 15 vueltas salen de canteras que no estaban en el cuadro**:
-- `MANGRULLO` (8 vueltas) y `SANTA ROSA` (1). Sin ellas, esas vueltas no se
-- pueden anotar ni desde la oficina ni desde el enlace del chofer.
--
-- Decisión de Julián (02/09): *"no importa que rinda igual clavado, vos ponerlo
-- y listo"*. O sea: MANGRULLO entra aunque sus rindes sean idénticos a los de
-- IBICUY, sin esperar a que Nico confirme si es el mismo lugar con otro nombre.
--
-- **Los coeficientes no se inventan, se copian de dos fuentes que coinciden:**
--
--   * MANGRULLO — Nico le aplicó los rindes de IBICUY clavados en su planilla, y
--     el tablero de autoconsumo de YPF lo llama "El Mangrullo YPF" con esos
--     mismos números: 19.961 L ÷ 742,6 tn = 26,88 para LAJE9; 7.561 ÷ 281,3 =
--     26,88 para LAJE41; 1.749 ÷ 70,1 = 24,95 para Sand Point; 806 ÷ 35,4 =
--     22,77 para Añelo. Van los cuatro.
--   * SANTA ROSA — **sólo AÑELO**. Nico usó 21,67 y el tablero de YPF le da
--     785 ÷ 36,2 = 21,68. Para LAJE9, LAJE41 y SAND POINT **no hay ni un dato**,
--     ni de él ni de YPF, así que no se cargan: un rinde inventado se convierte
--     en litros de gasoil entregados de más. La pantalla ya muestra esos tramos
--     apagados con "Sin valor cargado — avisale a la oficina", que es lo que
--     corresponde hasta que Nico los pase.
--
-- El nombre va **MANGRULLO tal cual lo escribe Nico**, no "El Mangrullo YPF":
-- el que carga es él y tiene que reconocer lo que ve.
--
-- ⚠️ Si Nico confirma que MANGRULLO e IBICUY son el mismo lugar, hay que unificar
-- los dos puntos — si no, el reporte del mes parte las toneladas de una misma
-- cantera en dos filas. Queda anotado en el Tablero.
--
-- Idempotente: se puede correr las veces que haga falta.

-- ── 1) El punto de ruta que falta ────────────────────────────────────────────
-- SANTA ROSA ya existe (verificado el 02/09). MANGRULLO no.
-- `puntos_ruta.nombre` es UNIQUE, así que el `on conflict` no es adorno: sin él
-- una segunda corrida rompe la migración entera.

insert into puntos_ruta (nombre, tipo)
values ('MANGRULLO', 'otro')
on conflict (nombre) do nothing;

-- ── 2) Los tramos ────────────────────────────────────────────────────────────
-- El join interno hace que un nombre que no exista simplemente no inserte esa
-- fila, en vez de romper. `do nothing` para no pisar un valor ya corregido a mano.

insert into gasoil_tarifas (origen_id, destino_id, litros_por_tonelada, observaciones)
select o.id, d.id, v.ltn, v.nota
from (values
  ('MANGRULLO',  'Añelo',      22.76, 'Mismos rindes que IBICUY. Nico los aplicó así en su planilla del 01/09 y coinciden con el tablero de YPF (El Mangrullo YPF)'),
  ('MANGRULLO',  'SAND POINT', 24.93, 'Mismos rindes que IBICUY. Nico los aplicó así en su planilla del 01/09 y coinciden con el tablero de YPF (El Mangrullo YPF)'),
  ('MANGRULLO',  'LAJE9',      26.88, 'Mismos rindes que IBICUY. Nico los aplicó así en su planilla del 01/09 y coinciden con el tablero de YPF (El Mangrullo YPF)'),
  ('MANGRULLO',  'LAJE41',     26.88, 'Mismos rindes que IBICUY. Nico los aplicó así en su planilla del 01/09 y coinciden con el tablero de YPF (El Mangrullo YPF)'),
  ('SANTA ROSA', 'Añelo',      21.67, 'Nico usó 21,67 en su planilla del 01/09; el tablero de YPF da 785 L ÷ 36,2 tn = 21,68. Los otros destinos de SANTA ROSA no tienen dato y quedan sin cargar a propósito')
) as v(origen, destino, ltn, nota)
join puntos_ruta o on o.nombre = v.origen
join puntos_ruta d on d.nombre = v.destino
on conflict (origen_id, destino_id) do nothing;

-- ── 3) Verificación. Esperado: 17 tramos (12 de antes + 5). ──────────────────

select o.nombre as cantera, d.nombre as destino, t.litros_por_tonelada as ltn
from gasoil_tarifas t
join puntos_ruta o on o.id = t.origen_id
join puntos_ruta d on d.id = t.destino_id
order by o.nombre, d.nombre;
