-- Tipos de plantilla y estado
CREATE TYPE plantilla_tipo AS ENUM ('remito', 'factura', 'gasoil', 'liquidacion');
CREATE TYPE plantilla_estado AS ENUM ('activo', 'desarrollo', 'eliminada');

-- Tabla de plantillas PDF
CREATE TABLE plantillas_pdf (
  id            UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT           NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
  descripcion   TEXT           NOT NULL DEFAULT '',
  tipo          plantilla_tipo NOT NULL,
  estado        plantilla_estado NOT NULL DEFAULT 'desarrollo',
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  created_by    UUID           REFERENCES usuarios(id)
);

CREATE INDEX idx_plantillas_pdf_estado ON plantillas_pdf(estado) WHERE estado != 'eliminada';

ALTER TABLE plantillas_pdf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plantillas: lectura autenticados"
  ON plantillas_pdf FOR SELECT
  USING (auth.role() = 'authenticated' AND estado != 'eliminada');

CREATE POLICY "Plantillas: insertar service_role"
  ON plantillas_pdf FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Plantillas: actualizar service_role"
  ON plantillas_pdf FOR UPDATE
  USING (auth.role() = 'service_role');

-- Seed
INSERT INTO plantillas_pdf (nombre, descripcion, tipo, estado) VALUES
  ('Remito de Viaje',      'Documento de entrega de mercadería',                 'remito',      'activo'),
  ('Factura de Viaje',     'Factura estándar para servicios de transporte',      'factura',     'activo'),
  ('Comprobante de Gasoil','Detalle de carga de combustible',                    'gasoil',      'activo'),
  ('Liquidación Chofer',   'Resumen de pagos y descuentos (en desarrollo)',      'liquidacion', 'desarrollo');
