-- Acoplados en Compliance — PASO D: mudar los papeles que ya se cargaron.
--
-- Corre DESPUÉS de B y C.
--
-- Anabela cargó el 26/08/2026 once certificados de válvulas de seguridad sobre
-- el CHASIS, porque era el único lugar donde el sistema los aceptaba (Bárbara:
-- "igual los cargué en los chasis porque van a seguir así enganchados"). Este
-- paso los deja donde corresponden SIN perder nada: es el mismo documento, con
-- su id, sus adjuntos y su historial — sólo cambia de qué patente cuelga.
--
-- No se copian ni se vuelven a cargar. Un UPDATE.

-- ── 1) Red de seguridad. El proyecto está en plan Free: no hay backups
--       automáticos ni PITR, así que ésta es la única forma de volver atrás.
create table if not exists public.compliance_documentos_bkp_20260826 as
  select * from public.compliance_documentos;

-- ── 2) La guarda. La mudanza es automática porque cada uno de esos chasis
--       tiene EXACTAMENTE un acoplado enganchado. Si mañana alguno tiene dos
--       (o ninguno), no hay forma de saber a cuál va el papel: la migración se
--       frena acá en vez de adivinar.
do $$
declare ambiguos int;
begin
  select count(*) into ambiguos from (
    select cd.camion_id
      from public.compliance_documentos cd
      join public.compliance_requisitos cr on cr.id = cd.requisito_id
      left join public.camion_acoplados ca
        on ca.camion_id = cd.camion_id and ca.hasta is null
     where cr.codigo in ('CERT_VALVULAS', 'CERT_DISCO_RUPTURA')
       and cd.camion_id is not null
     group by cd.camion_id
    having count(ca.acoplado_id) <> 1
  ) x;

  if ambiguos > 0 then
    raise exception 'PARÁ: % chasis con certificado cargado no tienen exactamente un acoplado enganchado. Resolvelos a mano antes de mudar.', ambiguos;
  end if;
end $$;

-- ── 3) La mudanza: el documento pasa del chasis a su acoplado, y de paso al
--       requisito nuevo (el viejo quedó inactivo en el paso C).
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

-- ── 4) Verificación. Esperado: 0 documentos de los requisitos viejos con
--       camion_id, y 11 con acoplado_id en los requisitos nuevos.
select r.codigo,
       count(*) filter (where cd.camion_id   is not null) as sobre_el_chasis,
       count(*) filter (where cd.acoplado_id is not null) as sobre_el_acoplado
  from public.compliance_documentos cd
  join public.compliance_requisitos r on r.id = cd.requisito_id
 where r.codigo in ('CERT_VALVULAS', 'CERT_DISCO_RUPTURA', 'ACOP_VALVULAS', 'ACOP_DISCO_RUPTURA')
 group by r.codigo
 order by r.codigo;
