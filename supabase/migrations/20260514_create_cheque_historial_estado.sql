-- Tabla de historial de transiciones de estado de cheques
CREATE TABLE cheque_historial_estado (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  cheque_id       UUID         NOT NULL REFERENCES cheques(id) ON DELETE CASCADE,
  estado_anterior cheque_estado,
  estado_nuevo    cheque_estado NOT NULL,
  fecha           DATE         NOT NULL,
  motivo          TEXT,
  observaciones   TEXT,
  usuario_id      UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_cheque_historial_cheque_id
  ON cheque_historial_estado(cheque_id, created_at DESC);

ALTER TABLE cheque_historial_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Historial cheques: lectura autenticados"
  ON cheque_historial_estado FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Historial cheques: insertar service_role"
  ON cheque_historial_estado FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
