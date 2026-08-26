-- Acoplados en Compliance — PASO G: prender el interruptor.
--
-- ESTE ARCHIVO SE CORRE DESPUÉS DEL DEPLOY, NO ANTES.
--
-- Los pasos A–E dejaron todo puesto pero apagado: el enum, la columna, la rama
-- de la vista y los tres requisitos con `activo = false`. Mientras esté apagado
-- nadie ve nada y nada se puede romper.
--
-- Se prende recién cuando el código que entiende los acoplados está en
-- producción, porque la base es la MISMA para local y para producción. El 26/08
-- se prendió antes del deploy y la pantalla se cayó para todo el mundo: la
-- versión desplegada no conocía el alcance nuevo. Segundo intento: la vista pasó
-- a devolver alcance 'unidad' —así el código viejo no se entera— pero la carga
-- seguía guardando contra el chasis, así que igual había que esperar.

-- ── 1) Los tres papeles del acoplado entran al checklist ──────────────────
update public.compliance_requisitos
   set activo = true
 where nivel = 'acoplado'::public.compliance_nivel;

-- ── 2) Los que ya estaban cargados sobre el chasis se mudan a su acoplado ──
--       Mismo documento, mismos adjuntos, mismo historial: sólo cambia de qué
--       patente cuelga. La guarda del paso D ya verificó que cada chasis con
--       certificado tiene exactamente un acoplado enganchado.
update public.compliance_documentos cd
   set acoplado_id  = ca.acoplado_id,
       camion_id    = null,
       requisito_id = nuevo.id
  from public.compliance_requisitos viejo,
       public.compliance_requisitos nuevo,
       public.camion_acoplados ca
 where cd.requisito_id = viejo.id
   and viejo.codigo in ('CERT_VALVULAS', 'CERT_DISCO_RUPTURA')
   and nuevo.codigo = case viejo.codigo
                        when 'CERT_VALVULAS'      then 'ACOP_VALVULAS'
                        when 'CERT_DISCO_RUPTURA' then 'ACOP_DISCO_RUPTURA'
                      end
   and ca.camion_id = cd.camion_id
   and ca.hasta is null
   and cd.camion_id is not null;

-- ── 3) Los dos requisitos que se le pedían al chasis se apagan ────────────
--       No se borran: los documentos históricos cuelgan de ellos y la vista
--       filtra por `activo`. Mismo tratamiento que UNID_BTB el 21/07.
update public.compliance_requisitos
   set activo = false
 where codigo in ('CERT_VALVULAS', 'CERT_DISCO_RUPTURA')
   and nivel = 'unidad'::public.compliance_nivel;

-- ── 4) Verificación ───────────────────────────────────────────────────────
-- Esperado: 922 filas en total y los 11 certificados sobre el acoplado.
select nivel::text as alcance, count(*) as filas from public.v_compliance_estado group by 1 order by 1;

select r.codigo,
       count(*) filter (where cd.camion_id   is not null) as sobre_el_chasis,
       count(*) filter (where cd.acoplado_id is not null) as sobre_el_acoplado
  from public.compliance_documentos cd
  join public.compliance_requisitos r on r.id = cd.requisito_id
 where r.codigo in ('CERT_VALVULAS', 'ACOP_VALVULAS', 'CERT_DISCO_RUPTURA', 'ACOP_DISCO_RUPTURA')
 group by 1 order by 1;
