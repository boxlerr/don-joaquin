export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acoplados: {
        Row: {
          ano: number | null
          capacidad_tn: number | null
          created_at: string
          created_by: string | null
          es_tolva: boolean
          estado: Database["public"]["Enums"]["acoplado_estado"]
          id: string
          marca: string | null
          modelo: string | null
          observaciones: string | null
          patente: string
          tipo: Database["public"]["Enums"]["acoplado_tipo"] | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          capacidad_tn?: number | null
          created_at?: string
          created_by?: string | null
          es_tolva?: boolean
          estado?: Database["public"]["Enums"]["acoplado_estado"]
          id?: string
          marca?: string | null
          modelo?: string | null
          observaciones?: string | null
          patente: string
          tipo?: Database["public"]["Enums"]["acoplado_tipo"] | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          capacidad_tn?: number | null
          created_at?: string
          created_by?: string | null
          es_tolva?: boolean
          estado?: Database["public"]["Enums"]["acoplado_estado"]
          id?: string
          marca?: string | null
          modelo?: string | null
          observaciones?: string | null
          patente?: string
          tipo?: Database["public"]["Enums"]["acoplado_tipo"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoplados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          created_at: string
          entidad_id: string | null
          entidad_tipo: string | null
          estado: Database["public"]["Enums"]["alerta_estado"]
          fecha_disparo: string
          fecha_vencimiento: string | null
          id: string
          mensaje: string
          notificacion_procesada: boolean
          severidad: Database["public"]["Enums"]["alerta_severidad"]
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          vista_en: string | null
          vista_por: string | null
        }
        Insert: {
          created_at?: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          estado?: Database["public"]["Enums"]["alerta_estado"]
          fecha_disparo: string
          fecha_vencimiento?: string | null
          id?: string
          mensaje: string
          notificacion_procesada?: boolean
          severidad?: Database["public"]["Enums"]["alerta_severidad"]
          tipo: Database["public"]["Enums"]["alerta_tipo"]
          titulo: string
          vista_en?: string | null
          vista_por?: string | null
        }
        Update: {
          created_at?: string
          entidad_id?: string | null
          entidad_tipo?: string | null
          estado?: Database["public"]["Enums"]["alerta_estado"]
          fecha_disparo?: string
          fecha_vencimiento?: string | null
          id?: string
          mensaje?: string
          notificacion_procesada?: boolean
          severidad?: Database["public"]["Enums"]["alerta_severidad"]
          tipo?: Database["public"]["Enums"]["alerta_tipo"]
          titulo?: string
          vista_en?: string | null
          vista_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_vista_por_fkey"
            columns: ["vista_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      apercibimiento_categorias: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tipo_carga_estado"]
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          nombre: string
          orden: number
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          nombre: string
          orden?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      asignacion_diaria: {
        Row: {
          cambio: boolean
          camion_anterior_id: string | null
          camion_id: string | null
          chofer_id: string
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          observaciones: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cambio?: boolean
          camion_anterior_id?: string | null
          camion_id?: string | null
          chofer_id: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cambio?: boolean
          camion_anterior_id?: string | null
          camion_id?: string | null
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asignacion_diaria_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignacion_diaria_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "asignacion_diaria_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignacion_diaria_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignacion_diaria_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          entidad_id: string | null
          entidad_tipo: string
          id: string
          ip: unknown
          metadata: Json | null
          user_agent: string | null
          usuario_id: string | null
          valores_anteriores: Json | null
          valores_nuevos: Json | null
        }
        Insert: {
          accion: string
          created_at?: string
          entidad_id?: string | null
          entidad_tipo: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_agent?: string | null
          usuario_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Update: {
          accion?: string
          created_at?: string
          entidad_id?: string | null
          entidad_tipo?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          user_agent?: string | null
          usuario_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bancos: {
        Row: {
          codigo: string | null
          created_at: string
          estado: Database["public"]["Enums"]["banco_estado"]
          id: string
          nombre: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["banco_estado"]
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["banco_estado"]
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      caja_movimientos: {
        Row: {
          carga_combustible_id: string | null
          categoria: Database["public"]["Enums"]["caja_categoria"]
          cheque_id: string | null
          chofer_id: string | null
          cliente_id: string | null
          concepto: string
          created_at: string
          created_by: string | null
          factura_id: string | null
          fecha: string
          gasto_id: string | null
          id: string
          mantenimiento_id: string | null
          medio: Database["public"]["Enums"]["caja_medio"]
          moneda: string
          monto: number
          observaciones: string | null
          pago_cliente_id: string | null
          siniestro_id: string | null
          tipo: Database["public"]["Enums"]["caja_movimiento_tipo"]
          liq_loma_id: string | null
          dm_ypf_id: string | null
          viaje_id: string | null
          viatico_id: string | null
        }
        Insert: {
          carga_combustible_id?: string | null
          categoria: Database["public"]["Enums"]["caja_categoria"]
          cheque_id?: string | null
          chofer_id?: string | null
          cliente_id?: string | null
          concepto: string
          created_at?: string
          created_by?: string | null
          factura_id?: string | null
          fecha: string
          gasto_id?: string | null
          id?: string
          mantenimiento_id?: string | null
          medio: Database["public"]["Enums"]["caja_medio"]
          moneda?: string
          monto: number
          observaciones?: string | null
          pago_cliente_id?: string | null
          siniestro_id?: string | null
          tipo: Database["public"]["Enums"]["caja_movimiento_tipo"]
          liq_loma_id?: string | null
          dm_ypf_id?: string | null
          viaje_id?: string | null
          viatico_id?: string | null
        }
        Update: {
          carga_combustible_id?: string | null
          categoria?: Database["public"]["Enums"]["caja_categoria"]
          cheque_id?: string | null
          chofer_id?: string | null
          cliente_id?: string | null
          concepto?: string
          created_at?: string
          created_by?: string | null
          factura_id?: string | null
          fecha?: string
          gasto_id?: string | null
          id?: string
          mantenimiento_id?: string | null
          medio?: Database["public"]["Enums"]["caja_medio"]
          moneda?: string
          monto?: number
          observaciones?: string | null
          pago_cliente_id?: string | null
          siniestro_id?: string | null
          tipo?: Database["public"]["Enums"]["caja_movimiento_tipo"]
          liq_loma_id?: string | null
          dm_ypf_id?: string | null
          viaje_id?: string | null
          viatico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_carga_combustible_id_fkey"
            columns: ["carga_combustible_id"]
            isOneToOne: false
            referencedRelation: "cargas_combustible"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_saldo"
            referencedColumns: ["factura_id"]
          },
          {
            foreignKeyName: "caja_movimientos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "viaje_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_mantenimiento_id_fkey"
            columns: ["mantenimiento_id"]
            isOneToOne: false
            referencedRelation: "mantenimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_pago_cliente_id_fkey"
            columns: ["pago_cliente_id"]
            isOneToOne: false
            referencedRelation: "pagos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_siniestro_id_fkey"
            columns: ["siniestro_id"]
            isOneToOne: false
            referencedRelation: "siniestros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_viatico_id_fkey"
            columns: ["viatico_id"]
            isOneToOne: false
            referencedRelation: "viaticos"
            referencedColumns: ["id"]
          },
        ]
      }
      camion_acoplados: {
        Row: {
          acoplado_id: string
          camion_id: string
          created_at: string
          created_by: string | null
          desde: string
          hasta: string | null
          id: string
          observaciones: string | null
        }
        Insert: {
          acoplado_id: string
          camion_id: string
          created_at?: string
          created_by?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          observaciones?: string | null
        }
        Update: {
          acoplado_id?: string
          camion_id?: string
          created_at?: string
          created_by?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camion_acoplados_acoplado_id_fkey"
            columns: ["acoplado_id"]
            isOneToOne: false
            referencedRelation: "acoplados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_acoplados_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_acoplados_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "camion_acoplados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      camion_documentos: {
        Row: {
          archivo_id: string | null
          camion_id: string
          created_at: string
          created_by: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string
          numero: string | null
          observaciones: string | null
          tipo_documento_id: string
          updated_at: string
        }
        Insert: {
          archivo_id?: string | null
          camion_id: string
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          tipo_documento_id: string
          updated_at?: string
        }
        Update: {
          archivo_id?: string | null
          camion_id?: string
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          tipo_documento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camion_documentos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "camion_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_documentos_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      camion_fotos: {
        Row: {
          archivo_id: string
          camion_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          es_principal: boolean
          id: string
        }
        Insert: {
          archivo_id: string
          camion_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_principal?: boolean
          id?: string
        }
        Update: {
          archivo_id?: string
          camion_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          es_principal?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camion_fotos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_fotos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_fotos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "camion_fotos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      camiones: {
        Row: {
          ano: number | null
          capacidad_tn: number
          chofer_actual_id: string | null
          created_at: string
          created_by: string | null
          es_tolva: boolean
          estado: Database["public"]["Enums"]["camion_estado"]
          id: string
          km_actual: number | null
          marca: string
          modelo: string
          observaciones: string | null
          patente: string
          tercerizacion_estado: Database["public"]["Enums"]["tercerizacion_estado"]
          tipo_camion: Database["public"]["Enums"]["camion_tipo"] | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          capacidad_tn: number
          chofer_actual_id?: string | null
          created_at?: string
          created_by?: string | null
          es_tolva?: boolean
          estado?: Database["public"]["Enums"]["camion_estado"]
          id?: string
          km_actual?: number | null
          marca: string
          modelo: string
          observaciones?: string | null
          patente: string
          tercerizacion_estado?: Database["public"]["Enums"]["tercerizacion_estado"]
          tipo_camion?: Database["public"]["Enums"]["camion_tipo"] | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          capacidad_tn?: number
          chofer_actual_id?: string | null
          created_at?: string
          created_by?: string | null
          es_tolva?: boolean
          estado?: Database["public"]["Enums"]["camion_estado"]
          id?: string
          km_actual?: number | null
          marca?: string
          modelo?: string
          observaciones?: string | null
          patente?: string
          tercerizacion_estado?: Database["public"]["Enums"]["tercerizacion_estado"]
          tipo_camion?: Database["public"]["Enums"]["camion_tipo"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camiones_chofer_actual_id_fkey"
            columns: ["chofer_actual_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camiones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas_combustible: {
        Row: {
          camion_id: string
          chofer_id: string | null
          comprobante_id: string | null
          created_at: string
          created_by: string | null
          estacion: string | null
          fecha: string
          id: string
          importe_total: number
          km_odometro: number
          litros: number
          lugar_carga: string | null
          moneda: string
          observaciones: string | null
          origen: Database["public"]["Enums"]["carga_combustible_origen"]
          precio_litro: number | null
          remito: string | null
        }
        Insert: {
          camion_id: string
          chofer_id?: string | null
          comprobante_id?: string | null
          created_at?: string
          created_by?: string | null
          estacion?: string | null
          fecha: string
          id?: string
          importe_total: number
          km_odometro: number
          litros: number
          lugar_carga?: string | null
          moneda?: string
          observaciones?: string | null
          origen: Database["public"]["Enums"]["carga_combustible_origen"]
          precio_litro?: number | null
          remito?: string | null
        }
        Update: {
          camion_id?: string
          chofer_id?: string | null
          comprobante_id?: string | null
          created_at?: string
          created_by?: string | null
          estacion?: string | null
          fecha?: string
          id?: string
          importe_total?: number
          km_odometro?: number
          litros?: number
          lugar_carga?: string | null
          moneda?: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["carga_combustible_origen"]
          precio_litro?: number | null
          remito?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargas_combustible_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_combustible_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "cargas_combustible_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_combustible_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_combustible_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cheque_historial_estado: {
        Row: {
          cheque_id: string
          created_at: string
          estado_anterior: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          fecha: string
          id: string
          motivo: string | null
          observaciones: string | null
          usuario_id: string | null
        }
        Insert: {
          cheque_id: string
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          fecha: string
          id?: string
          motivo?: string | null
          observaciones?: string | null
          usuario_id?: string | null
        }
        Update: {
          cheque_id?: string
          created_at?: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["cheque_estado"]
          fecha?: string
          id?: string
          motivo?: string | null
          observaciones?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheque_historial_estado_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_historial_estado_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_historial_estado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cheque_movimientos: {
        Row: {
          cheque_id: string
          estado_anterior: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          fecha: string
          id: string
          motivo: string | null
          observaciones: string | null
          referencia: string | null
          usuario_id: string
        }
        Insert: {
          cheque_id: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["cheque_estado"]
          fecha?: string
          id?: string
          motivo?: string | null
          observaciones?: string | null
          referencia?: string | null
          usuario_id: string
        }
        Update: {
          cheque_id?: string
          estado_anterior?: Database["public"]["Enums"]["cheque_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["cheque_estado"]
          fecha?: string
          id?: string
          motivo?: string | null
          observaciones?: string | null
          referencia?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheque_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_movimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          archivo_id: string | null
          banco_deposito: string | null
          banco_id: string
          cheque_reemplazo_id: string | null
          cliente_id: string | null
          concepto: string | null
          created_at: string
          created_by: string | null
          cuenta_corriente: string | null
          entregado_a: string | null
          estado: Database["public"]["Enums"]["cheque_estado"]
          factura_id: string | null
          fecha_deposito: string | null
          fecha_emision: string
          fecha_entrega: string | null
          fecha_estado_actual: string | null
          fecha_recepcion: string
          fecha_rechazo: string | null
          fecha_vencimiento: string
          id: string
          importe: number
          librador_cuit: string | null
          librador_nombre: string
          moneda: string
          motivo_rechazo:
            | Database["public"]["Enums"]["cheque_motivo_rechazo"]
            | null
          motivo_rechazo_detalle: string | null
          numero: string
          observaciones: string | null
          recibido_de: string | null
          sucursal_banco: string | null
          tipo: Database["public"]["Enums"]["cheque_tipo"]
          updated_at: string
        }
        Insert: {
          archivo_id?: string | null
          banco_deposito?: string | null
          banco_id?: string | null
          cheque_reemplazo_id?: string | null
          cliente_id?: string | null
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_corriente?: string | null
          entregado_a?: string | null
          estado?: Database["public"]["Enums"]["cheque_estado"]
          factura_id?: string | null
          fecha_deposito?: string | null
          fecha_emision?: string | null
          fecha_entrega?: string | null
          fecha_estado_actual?: string | null
          fecha_recepcion?: string | null
          fecha_rechazo?: string | null
          fecha_vencimiento: string
          id?: string
          importe: number
          librador_cuit?: string | null
          librador_nombre: string
          moneda?: string
          motivo_rechazo?:
            | Database["public"]["Enums"]["cheque_motivo_rechazo"]
            | null
          motivo_rechazo_detalle?: string | null
          numero?: string | null
          observaciones?: string | null
          recibido_de?: string | null
          sucursal_banco?: string | null
          tipo?: Database["public"]["Enums"]["cheque_tipo"]
          updated_at?: string
        }
        Update: {
          archivo_id?: string | null
          banco_deposito?: string | null
          banco_id?: string | null
          cheque_reemplazo_id?: string | null
          cliente_id?: string | null
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          cuenta_corriente?: string | null
          entregado_a?: string | null
          estado?: Database["public"]["Enums"]["cheque_estado"]
          factura_id?: string | null
          fecha_deposito?: string | null
          fecha_emision?: string
          fecha_entrega?: string | null
          fecha_estado_actual?: string | null
          fecha_recepcion?: string
          fecha_rechazo?: string | null
          fecha_vencimiento?: string
          id?: string
          importe?: number
          librador_cuit?: string | null
          librador_nombre?: string
          moneda?: string
          motivo_rechazo?:
            | Database["public"]["Enums"]["cheque_motivo_rechazo"]
            | null
          motivo_rechazo_detalle?: string | null
          numero?: string | null
          observaciones?: string | null
          recibido_de?: string | null
          sucursal_banco?: string | null
          tipo?: Database["public"]["Enums"]["cheque_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_cheque_reemplazo_id_fkey"
            columns: ["cheque_reemplazo_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_cheque_reemplazo_id_fkey"
            columns: ["cheque_reemplazo_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_saldo"
            referencedColumns: ["factura_id"]
          },
          {
            foreignKeyName: "cheques_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "viaje_facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_apercibimientos: {
        Row: {
          archivo_id: string | null
          categoria_id: string | null
          chofer_id: string
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          motivo: string
          observaciones: string | null
        }
        Insert: {
          archivo_id?: string | null
          categoria_id?: string | null
          chofer_id: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          motivo: string
          observaciones?: string | null
        }
        Update: {
          archivo_id?: string | null
          categoria_id?: string | null
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          motivo?: string
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chofer_apercibimientos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_apercibimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "apercibimiento_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_apercibimientos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_apercibimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_ausencias: {
        Row: {
          autorizado_por: string | null
          chofer_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          es_vacaciones: boolean
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          justificada: boolean
          observaciones: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          autorizado_por?: string | null
          chofer_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          es_vacaciones?: boolean
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          justificada?: boolean
          observaciones?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          autorizado_por?: string | null
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          es_vacaciones?: boolean
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          justificada?: boolean
          observaciones?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chofer_ausencias_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_ausencias_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_ausencias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_camion_historial: {
        Row: {
          camion_id: string
          chofer_id: string
          created_at: string
          created_by: string | null
          desde: string
          hasta: string | null
          id: string
          motivo_cambio: string | null
          observaciones: string | null
        }
        Insert: {
          camion_id: string
          chofer_id: string
          created_at?: string
          created_by?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          motivo_cambio?: string | null
          observaciones?: string | null
        }
        Update: {
          camion_id?: string
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          motivo_cambio?: string | null
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chofer_camion_historial_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_camion_historial_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "chofer_camion_historial_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_camion_historial_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_documentos: {
        Row: {
          archivo_id: string | null
          categoria: string | null
          chofer_id: string
          created_at: string
          created_by: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string
          numero: string | null
          observaciones: string | null
          tipo_documento_id: string
          updated_at: string
        }
        Insert: {
          archivo_id?: string | null
          categoria?: string | null
          chofer_id: string
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          tipo_documento_id: string
          updated_at?: string
        }
        Update: {
          archivo_id?: string | null
          categoria?: string | null
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          numero?: string | null
          observaciones?: string | null
          tipo_documento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chofer_documentos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_documentos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_documentos_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_licencias_medicas: {
        Row: {
          certificado_archivo_id: string | null
          chofer_id: string
          created_at: string
          created_by: string | null
          fecha_desde: string
          fecha_hasta: string | null
          id: string
          motivo: string | null
          observaciones: string | null
          updated_at: string
        }
        Insert: {
          certificado_archivo_id?: string | null
          chofer_id: string
          created_at?: string
          created_by?: string | null
          fecha_desde: string
          fecha_hasta?: string | null
          id?: string
          motivo?: string | null
          observaciones?: string | null
          updated_at?: string
        }
        Update: {
          certificado_archivo_id?: string | null
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          fecha_desde?: string
          fecha_hasta?: string | null
          id?: string
          motivo?: string | null
          observaciones?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chofer_licencias_medicas_certificado_archivo_id_fkey"
            columns: ["certificado_archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_licencias_medicas_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_licencias_medicas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_prestamos: {
        Row: {
          chofer_id: string
          created_at: string
          created_by: string | null
          cuotas: number
          estado: Database["public"]["Enums"]["chofer_prestamo_estado"]
          fecha: string
          id: string
          moneda: string
          monto: number
          motivo: string | null
          observaciones: string | null
          saldo_pendiente: number
          updated_at: string
        }
        Insert: {
          chofer_id: string
          created_at?: string
          created_by?: string | null
          cuotas?: number
          estado?: Database["public"]["Enums"]["chofer_prestamo_estado"]
          fecha?: string
          id?: string
          moneda?: string
          monto: number
          motivo?: string | null
          observaciones?: string | null
          saldo_pendiente: number
          updated_at?: string
        }
        Update: {
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          cuotas?: number
          estado?: Database["public"]["Enums"]["chofer_prestamo_estado"]
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          motivo?: string | null
          observaciones?: string | null
          saldo_pendiente?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chofer_prestamos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_prestamos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chofer_vacaciones: {
        Row: {
          chofer_id: string
          created_at: string
          dias_adeudados: number
          dias_correspondientes: number
          id: string
          observaciones: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chofer_id: string
          created_at?: string
          dias_adeudados?: number
          dias_correspondientes?: number
          id?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chofer_id?: string
          created_at?: string
          dias_adeudados?: number
          dias_correspondientes?: number
          id?: string
          observaciones?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chofer_vacaciones_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: true
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chofer_vacaciones_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      choferes: {
        Row: {
          alias_cbu: string | null
          alta_afip: string | null
          apellido: string
          banco: string | null
          cbu: string | null
          ciudad_nacimiento: string | null
          clave_fiscal: string | null
          created_at: string
          created_by: string | null
          cuil: string | null
          dni: string | null
          domicilio: string | null
          email: string | null
          es_demo: boolean
          estado: Database["public"]["Enums"]["chofer_estado"]
          fecha_egreso: string | null
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          foto_id: string | null
          id: string
          localidad: string | null
          motivo_egreso:
            | Database["public"]["Enums"]["chofer_motivo_egreso"]
            | null
          nombre: string
          nro_tramite_dni: string | null
          observaciones: string | null
          periodo_prueba_fin: string | null
          provincia: string | null
          rol: string | null
          tarifa_km: number | null
          telefono: string | null
          telefono_emergencia: string | null
          updated_at: string
        }
        Insert: {
          alias_cbu?: string | null
          alta_afip?: string | null
          apellido: string
          banco?: string | null
          cbu?: string | null
          ciudad_nacimiento?: string | null
          clave_fiscal?: string | null
          created_at?: string
          created_by?: string | null
          cuil?: string | null
          dni?: string | null
          domicilio?: string | null
          email?: string | null
          es_demo?: boolean
          estado?: Database["public"]["Enums"]["chofer_estado"]
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          foto_id?: string | null
          id?: string
          localidad?: string | null
          motivo_egreso?:
            | Database["public"]["Enums"]["chofer_motivo_egreso"]
            | null
          nombre: string
          nro_tramite_dni?: string | null
          observaciones?: string | null
          periodo_prueba_fin?: string | null
          provincia?: string | null
          rol?: string | null
          tarifa_km?: number | null
          telefono?: string | null
          telefono_emergencia?: string | null
          updated_at?: string
        }
        Update: {
          alias_cbu?: string | null
          alta_afip?: string | null
          apellido?: string
          banco?: string | null
          cbu?: string | null
          ciudad_nacimiento?: string | null
          clave_fiscal?: string | null
          created_at?: string
          created_by?: string | null
          cuil?: string | null
          dni?: string | null
          domicilio?: string | null
          email?: string | null
          es_demo?: boolean
          estado?: Database["public"]["Enums"]["chofer_estado"]
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          foto_id?: string | null
          id?: string
          localidad?: string | null
          motivo_egreso?:
            | Database["public"]["Enums"]["chofer_motivo_egreso"]
            | null
          nombre?: string
          nro_tramite_dni?: string | null
          observaciones?: string | null
          periodo_prueba_fin?: string | null
          provincia?: string | null
          rol?: string | null
          tarifa_km?: number | null
          telefono?: string | null
          telefono_emergencia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "choferes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choferes_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_contactos: {
        Row: {
          cargo: Database["public"]["Enums"]["contacto_cargo"]
          cliente_id: string
          created_at: string
          email: string | null
          es_principal: boolean
          id: string
          nombre: string
          observaciones: string | null
          telefono: string | null
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["contacto_cargo"]
          cliente_id: string
          created_at?: string
          email?: string | null
          es_principal?: boolean
          id?: string
          nombre: string
          observaciones?: string | null
          telefono?: string | null
        }
        Update: {
          cargo?: Database["public"]["Enums"]["contacto_cargo"]
          cliente_id?: string
          created_at?: string
          email?: string | null
          es_principal?: boolean
          id?: string
          nombre?: string
          observaciones?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_contactos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_requisitos: {
        Row: {
          archivo_modelo_id: string | null
          cliente_id: string
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["cliente_requisito_estado"]
          formato_requerido: string | null
          frecuencia:
            | Database["public"]["Enums"]["cliente_requisito_frecuencia"]
            | null
          id: string
          observaciones: string | null
          proxima_fecha: string | null
          responsable_interno: string | null
          tipo: Database["public"]["Enums"]["cliente_requisito_tipo"]
          updated_at: string
        }
        Insert: {
          archivo_modelo_id?: string | null
          cliente_id: string
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["cliente_requisito_estado"]
          formato_requerido?: string | null
          frecuencia?:
            | Database["public"]["Enums"]["cliente_requisito_frecuencia"]
            | null
          id?: string
          observaciones?: string | null
          proxima_fecha?: string | null
          responsable_interno?: string | null
          tipo: Database["public"]["Enums"]["cliente_requisito_tipo"]
          updated_at?: string
        }
        Update: {
          archivo_modelo_id?: string | null
          cliente_id?: string
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["cliente_requisito_estado"]
          formato_requerido?: string | null
          frecuencia?:
            | Database["public"]["Enums"]["cliente_requisito_frecuencia"]
            | null
          id?: string
          observaciones?: string | null
          proxima_fecha?: string | null
          responsable_interno?: string | null
          tipo?: Database["public"]["Enums"]["cliente_requisito_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_requisitos_archivo_modelo_id_fkey"
            columns: ["archivo_modelo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_requisitos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_sucursales: {
        Row: {
          cliente_id: string
          created_at: string
          domicilio: string | null
          es_principal: boolean
          estado: Database["public"]["Enums"]["cliente_estado"]
          id: string
          localidad: string | null
          nombre: string
          observaciones: string | null
          pais: string
          provincia: string | null
          telefono: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          domicilio?: string | null
          es_principal?: boolean
          estado?: Database["public"]["Enums"]["cliente_estado"]
          id?: string
          localidad?: string | null
          nombre: string
          observaciones?: string | null
          pais?: string
          provincia?: string | null
          telefono?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          domicilio?: string | null
          es_principal?: boolean
          estado?: Database["public"]["Enums"]["cliente_estado"]
          id?: string
          localidad?: string | null
          nombre?: string
          observaciones?: string | null
          pais?: string
          provincia?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_sucursales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          codigo_postal: string | null
          condicion_iva: Database["public"]["Enums"]["cliente_condicion_iva"]
          condiciones_pago: string | null
          created_at: string
          created_by: string | null
          cuit: string | null
          dias_pago: number | null
          domicilio_fiscal: string | null
          email: string | null
          es_multinacional: boolean
          estado: Database["public"]["Enums"]["cliente_estado"]
          id: string
          limite_credito: number | null
          localidad: string | null
          nombre_comercial: string | null
          observaciones: string | null
          pais: string
          provincia: string | null
          razon_social: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          codigo_postal?: string | null
          condicion_iva?: Database["public"]["Enums"]["cliente_condicion_iva"]
          condiciones_pago?: string | null
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          dias_pago?: number | null
          domicilio_fiscal?: string | null
          email?: string | null
          es_multinacional?: boolean
          estado?: Database["public"]["Enums"]["cliente_estado"]
          id?: string
          limite_credito?: number | null
          localidad?: string | null
          nombre_comercial?: string | null
          observaciones?: string | null
          pais?: string
          provincia?: string | null
          razon_social: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          codigo_postal?: string | null
          condicion_iva?: Database["public"]["Enums"]["cliente_condicion_iva"]
          condiciones_pago?: string | null
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          dias_pago?: number | null
          domicilio_fiscal?: string | null
          email?: string | null
          es_multinacional?: boolean
          estado?: Database["public"]["Enums"]["cliente_estado"]
          id?: string
          limite_credito?: number | null
          localidad?: string | null
          nombre_comercial?: string | null
          observaciones?: string | null
          pais?: string
          provincia?: string | null
          razon_social?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_destinatarios: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      compliance_dm_ypf: {
        Row: {
          archivo_id: string | null
          contrato_sap: string | null
          created_at: string
          estado: string
          fecha_certificacion: string | null
          id: string
          importado_en: string
          importado_por: string | null
          numero_pedido: string | null
          numero_solpe: string | null
          observaciones: string | null
          periodo_desde: string
          periodo_hasta: string
          solicitante: string | null
          total_certificado_ars: number | null
          updated_at: string
        }
        Insert: {
          archivo_id?: string | null
          contrato_sap?: string | null
          created_at?: string
          estado?: string
          fecha_certificacion?: string | null
          id?: string
          importado_en?: string
          importado_por?: string | null
          numero_pedido?: string | null
          numero_solpe?: string | null
          observaciones?: string | null
          periodo_desde: string
          periodo_hasta: string
          solicitante?: string | null
          total_certificado_ars?: number | null
          updated_at?: string
        }
        Update: {
          archivo_id?: string | null
          contrato_sap?: string | null
          created_at?: string
          estado?: string
          fecha_certificacion?: string | null
          id?: string
          importado_en?: string
          importado_por?: string | null
          numero_pedido?: string | null
          numero_solpe?: string | null
          observaciones?: string | null
          periodo_desde?: string
          periodo_hasta?: string
          solicitante?: string | null
          total_certificado_ars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_dm_ypf_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_documentos: {
        Row: {
          archivo_id: string | null
          camion_id: string | null
          chofer_id: string | null
          created_at: string
          created_by: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          id: string
          observaciones: string | null
          periodo: string | null
          requisito_id: string
          updated_at: string
        }
        Insert: {
          archivo_id?: string | null
          camion_id?: string | null
          chofer_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          observaciones?: string | null
          periodo?: string | null
          requisito_id: string
          updated_at?: string
        }
        Update: {
          archivo_id?: string | null
          camion_id?: string | null
          chofer_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_emision?: string | null
          fecha_vencimiento?: string | null
          id?: string
          observaciones?: string | null
          periodo?: string | null
          requisito_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documentos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "compliance_documentos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documentos_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "compliance_requisitos"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requisitos: {
        Row: {
          activo: boolean
          cliente_aplica: Database["public"]["Enums"]["compliance_cliente_aplica"]
          codigo: string
          created_at: string
          descripcion: string | null
          destinatario_id: string | null
          dias_alerta: number
          id: string
          nivel: Database["public"]["Enums"]["compliance_nivel"]
          nombre: string
          orden: number
          periodicidad: Database["public"]["Enums"]["compliance_periodicidad"]
          tipo_destinatario: string
          tipo_documento_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cliente_aplica: Database["public"]["Enums"]["compliance_cliente_aplica"]
          codigo: string
          created_at?: string
          descripcion?: string | null
          destinatario_id?: string | null
          dias_alerta?: number
          id?: string
          nivel: Database["public"]["Enums"]["compliance_nivel"]
          nombre: string
          orden?: number
          periodicidad: Database["public"]["Enums"]["compliance_periodicidad"]
          tipo_destinatario?: string
          tipo_documento_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cliente_aplica?: Database["public"]["Enums"]["compliance_cliente_aplica"]
          codigo?: string
          created_at?: string
          descripcion?: string | null
          destinatario_id?: string | null
          dias_alerta?: number
          id?: string
          nivel?: Database["public"]["Enums"]["compliance_nivel"]
          nombre?: string
          orden?: number
          periodicidad?: Database["public"]["Enums"]["compliance_periodicidad"]
          tipo_destinatario?: string
          tipo_documento_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requisitos_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "compliance_destinatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requisitos_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_notificaciones: {
        Row: {
          alertas_por_recibir: Json
          created_at: string
          habilitar_email: boolean
          habilitar_whatsapp: boolean
          horario_silencio_fin: string | null
          horario_silencio_inicio: string | null
          id: string
          severidad_minima_whatsapp: string
          telefono_verificado: boolean
          updated_at: string
          usuario_id: string
        }
        Insert: {
          alertas_por_recibir?: Json
          created_at?: string
          habilitar_email?: boolean
          habilitar_whatsapp?: boolean
          horario_silencio_fin?: string | null
          horario_silencio_inicio?: string | null
          id?: string
          severidad_minima_whatsapp?: string
          telefono_verificado?: boolean
          updated_at?: string
          usuario_id: string
        }
        Update: {
          alertas_por_recibir?: Json
          created_at?: string
          habilitar_email?: boolean
          habilitar_whatsapp?: boolean
          horario_silencio_fin?: string | null
          horario_silencio_inicio?: string | null
          id?: string
          severidad_minima_whatsapp?: string
          telefono_verificado?: boolean
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_cte_movimientos: {
        Row: {
          categoria: Database["public"]["Enums"]["cta_cte_categoria"]
          cheque_id: string | null
          cliente_id: string
          concepto: string
          created_at: string
          created_by: string | null
          factura_id: string | null
          fecha: string
          id: string
          moneda: string
          monto: number
          movimiento_relacionado_id: string | null
          observaciones: string | null
          pago_cliente_id: string | null
          tipo: Database["public"]["Enums"]["cta_cte_tipo"]
          viaje_id: string | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["cta_cte_categoria"]
          cheque_id?: string | null
          cliente_id: string
          concepto: string
          created_at?: string
          created_by?: string | null
          factura_id?: string | null
          fecha: string
          id?: string
          moneda?: string
          monto: number
          movimiento_relacionado_id?: string | null
          observaciones?: string | null
          pago_cliente_id?: string | null
          tipo: Database["public"]["Enums"]["cta_cte_tipo"]
          viaje_id?: string | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["cta_cte_categoria"]
          cheque_id?: string | null
          cliente_id?: string
          concepto?: string
          created_at?: string
          created_by?: string | null
          factura_id?: string | null
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          movimiento_relacionado_id?: string | null
          observaciones?: string | null
          pago_cliente_id?: string | null
          tipo?: Database["public"]["Enums"]["cta_cte_tipo"]
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_cte_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_saldo"
            referencedColumns: ["factura_id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "viaje_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_movimiento_relacionado_id_fkey"
            columns: ["movimiento_relacionado_id"]
            isOneToOne: false
            referencedRelation: "cta_cte_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_pago_cliente_id_fkey"
            columns: ["pago_cliente_id"]
            isOneToOne: false
            referencedRelation: "pagos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_cte_movimientos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_archivos: {
        Row: {
          bucket: string
          hash_sha256: string | null
          id: string
          mime_type: string | null
          nombre_original: string
          path: string
          subido_en: string
          subido_por: string | null
          tamano_bytes: number | null
        }
        Insert: {
          bucket: string
          hash_sha256?: string | null
          id?: string
          mime_type?: string | null
          nombre_original: string
          path: string
          subido_en?: string
          subido_por?: string | null
          tamano_bytes?: number | null
        }
        Update: {
          bucket?: string
          hash_sha256?: string | null
          id?: string
          mime_type?: string | null
          nombre_original?: string
          path?: string
          subido_en?: string
          subido_por?: string | null
          tamano_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_archivos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      entrevistas: {
        Row: {
          created_at: string
          edad: number | null
          fecha_entrevista: string | null
          id: string
          localidad: string | null
          nombre: string
          observaciones: string | null
          preocupacional: string
          resultado: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          edad?: number | null
          fecha_entrevista?: string | null
          id?: string
          localidad?: string | null
          nombre: string
          observaciones?: string | null
          preocupacional?: string
          resultado?: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          edad?: number | null
          fecha_entrevista?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
          observaciones?: string | null
          preocupacional?: string
          resultado?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      extintores: {
        Row: {
          capacidad: string | null
          categoria: string
          created_at: string
          dominio: string
          fecha_vencimiento: string | null
          id: string
          n_extintor: string | null
          n_interno: string | null
          observaciones: string | null
        }
        Insert: {
          capacidad?: string | null
          categoria: string
          created_at?: string
          dominio: string
          fecha_vencimiento?: string | null
          id?: string
          n_extintor?: string | null
          n_interno?: string | null
          observaciones?: string | null
        }
        Update: {
          capacidad?: string | null
          categoria?: string
          created_at?: string
          dominio?: string
          fecha_vencimiento?: string | null
          id?: string
          n_extintor?: string | null
          n_interno?: string | null
          observaciones?: string | null
        }
        Relationships: []
      }
      gastos: {
        Row: {
          camion_id: string | null
          chofer_id: string | null
          comprobante_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          fecha: string
          id: string
          medio_pago: Database["public"]["Enums"]["gasto_medio_pago"]
          moneda: string
          monto: number
          numero_comprobante: string | null
          proveedor: string | null
          tipo_cambio: number | null
          tipo_gasto_id: string
          updated_at: string
          viaje_id: string | null
          viatico_id: string | null
        }
        Insert: {
          camion_id?: string | null
          chofer_id?: string | null
          comprobante_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha: string
          id?: string
          medio_pago: Database["public"]["Enums"]["gasto_medio_pago"]
          moneda?: string
          monto: number
          numero_comprobante?: string | null
          proveedor?: string | null
          tipo_cambio?: number | null
          tipo_gasto_id: string
          updated_at?: string
          viaje_id?: string | null
          viatico_id?: string | null
        }
        Update: {
          camion_id?: string | null
          chofer_id?: string | null
          comprobante_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          fecha?: string
          id?: string
          medio_pago?: Database["public"]["Enums"]["gasto_medio_pago"]
          moneda?: string
          monto?: number
          numero_comprobante?: string | null
          proveedor?: string | null
          tipo_cambio?: number | null
          tipo_gasto_id?: string
          updated_at?: string
          viaje_id?: string | null
          viatico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "gastos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_tipo_gasto_id_fkey"
            columns: ["tipo_gasto_id"]
            isOneToOne: false
            referencedRelation: "tipos_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_viatico_id_fkey"
            columns: ["viatico_id"]
            isOneToOne: false
            referencedRelation: "viaticos"
            referencedColumns: ["id"]
          },
        ]
      }
      hoja_ruta_items: {
        Row: {
          created_at: string
          dia: string
          editado_manualmente: boolean
          hoja_ruta_id: string
          id: string
          km_no_computable: number
          km_recorridos: number
          km_vacios: number
          llega_a: string
          material: string | null
          monto_chofer: number | null
          monto_flete: number | null
          observaciones: string | null
          orden: number
          remito_numero: string | null
          sale_de: string
          tn_com_29: number | null
          tn_esc_35: number | null
          tn_esc_37_5: number | null
          viaje_id: string | null
        }
        Insert: {
          created_at?: string
          dia: string
          editado_manualmente?: boolean
          hoja_ruta_id: string
          id?: string
          km_no_computable?: number
          km_recorridos?: number
          km_vacios?: number
          llega_a: string
          material?: string | null
          monto_chofer?: number | null
          monto_flete?: number | null
          observaciones?: string | null
          orden: number
          remito_numero?: string | null
          sale_de: string
          tn_com_29?: number | null
          tn_esc_35?: number | null
          tn_esc_37_5?: number | null
          viaje_id?: string | null
        }
        Update: {
          created_at?: string
          dia?: string
          editado_manualmente?: boolean
          hoja_ruta_id?: string
          id?: string
          km_no_computable?: number
          km_recorridos?: number
          km_vacios?: number
          llega_a?: string
          material?: string | null
          monto_chofer?: number | null
          monto_flete?: number | null
          observaciones?: string | null
          orden?: number
          remito_numero?: string | null
          sale_de?: string
          tn_com_29?: number | null
          tn_esc_35?: number | null
          tn_esc_37_5?: number | null
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoja_ruta_items_hoja_ruta_id_fkey"
            columns: ["hoja_ruta_id"]
            isOneToOne: false
            referencedRelation: "hojas_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_items_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoja_ruta_items_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      hojas_ruta: {
        Row: {
          archivo_excel_id: string | null
          archivo_origen: string | null
          camion_id: string | null
          cantidad_viajes: number
          chofer_id: string
          codigo: string
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["hoja_ruta_estado"]
          fecha_cierre: string | null
          fecha_entrega_contador: string | null
          fecha_exportacion: string | null
          fecha_generacion: string
          id: string
          km_computables: number
          km_con_carga: number
          km_no_computables: number
          km_total: number
          km_vacios: number
          monto_total_fletes: number
          monto_total_liquidacion: number
          observaciones: string | null
          periodo_desde: string
          periodo_hasta: string
          periodo_tipo: Database["public"]["Enums"]["hoja_ruta_periodo_tipo"]
          sheet_origen: string | null
          tarifa_km_aplicada: number | null
          tonelaje_total: number
          updated_at: string
        }
        Insert: {
          archivo_excel_id?: string | null
          archivo_origen?: string | null
          camion_id?: string | null
          cantidad_viajes?: number
          chofer_id: string
          codigo: string
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["hoja_ruta_estado"]
          fecha_cierre?: string | null
          fecha_entrega_contador?: string | null
          fecha_exportacion?: string | null
          fecha_generacion?: string
          id?: string
          km_computables?: number
          km_con_carga?: number
          km_no_computables?: number
          km_total?: number
          km_vacios?: number
          monto_total_fletes?: number
          monto_total_liquidacion?: number
          observaciones?: string | null
          periodo_desde: string
          periodo_hasta: string
          periodo_tipo: Database["public"]["Enums"]["hoja_ruta_periodo_tipo"]
          sheet_origen?: string | null
          tarifa_km_aplicada?: number | null
          tonelaje_total?: number
          updated_at?: string
        }
        Update: {
          archivo_excel_id?: string | null
          archivo_origen?: string | null
          camion_id?: string | null
          cantidad_viajes?: number
          chofer_id?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["hoja_ruta_estado"]
          fecha_cierre?: string | null
          fecha_entrega_contador?: string | null
          fecha_exportacion?: string | null
          fecha_generacion?: string
          id?: string
          km_computables?: number
          km_con_carga?: number
          km_no_computables?: number
          km_total?: number
          km_vacios?: number
          monto_total_fletes?: number
          monto_total_liquidacion?: number
          observaciones?: string | null
          periodo_desde?: string
          periodo_hasta?: string
          periodo_tipo?: Database["public"]["Enums"]["hoja_ruta_periodo_tipo"]
          sheet_origen?: string | null
          tarifa_km_aplicada?: number | null
          tonelaje_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hojas_ruta_archivo_excel_id_fkey"
            columns: ["archivo_excel_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "hojas_ruta_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hojas_ruta_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      libradores: {
        Row: {
          created_at: string
          created_by: string | null
          cuit: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "libradores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: number
          ip_address: string
          reason: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          ip_address: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          ip_address?: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      mantenimiento_archivos: {
        Row: {
          archivo_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          mantenimiento_id: string
        }
        Insert: {
          archivo_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          mantenimiento_id: string
        }
        Update: {
          archivo_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          mantenimiento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mantenimiento_archivos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimiento_archivos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimiento_archivos_mantenimiento_id_fkey"
            columns: ["mantenimiento_id"]
            isOneToOne: false
            referencedRelation: "mantenimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      mantenimientos: {
        Row: {
          acoplado_id: string | null
          camion_id: string | null
          comprobante_id: string | null
          costo: number | null
          created_at: string
          created_by: string | null
          descripcion: string
          fecha: string
          id: string
          km_odometro: number
          moneda: string
          observaciones: string | null
          proximo_service_fecha: string | null
          proximo_service_km: number | null
          taller: string | null
          tipo: Database["public"]["Enums"]["mantenimiento_tipo"]
          tipo_servicio_id: string | null
        }
        Insert: {
          acoplado_id?: string | null
          camion_id?: string | null
          comprobante_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          descripcion: string
          fecha: string
          id?: string
          km_odometro: number
          moneda?: string
          observaciones?: string | null
          proximo_service_fecha?: string | null
          proximo_service_km?: number | null
          taller?: string | null
          tipo: Database["public"]["Enums"]["mantenimiento_tipo"]
          tipo_servicio_id?: string | null
        }
        Update: {
          acoplado_id?: string | null
          camion_id?: string | null
          comprobante_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          km_odometro?: number
          moneda?: string
          observaciones?: string | null
          proximo_service_fecha?: string | null
          proximo_service_km?: number | null
          taller?: string | null
          tipo?: Database["public"]["Enums"]["mantenimiento_tipo"]
          tipo_servicio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mantenimientos_acoplado_id_fkey"
            columns: ["acoplado_id"]
            isOneToOne: false
            referencedRelation: "acoplados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "mantenimientos_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mantenimientos_tipo_servicio_id_fkey"
            columns: ["tipo_servicio_id"]
            isOneToOne: false
            referencedRelation: "tipos_servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          alerta_id: string | null
          asunto: string | null
          canal: Database["public"]["Enums"]["notificacion_canal"]
          contenido: string
          created_at: string
          destinatario: string
          error_mensaje: string | null
          estado: Database["public"]["Enums"]["notificacion_estado"]
          fecha_envio: string | null
          fecha_programada: string | null
          id: string
          intentos: number
          metadata: Json | null
          provider_id: string | null
          provider_status: string | null
          ultimo_intento_en: string | null
          usuario_id: string | null
        }
        Insert: {
          alerta_id?: string | null
          asunto?: string | null
          canal: Database["public"]["Enums"]["notificacion_canal"]
          contenido: string
          created_at?: string
          destinatario: string
          error_mensaje?: string | null
          estado?: Database["public"]["Enums"]["notificacion_estado"]
          fecha_envio?: string | null
          fecha_programada?: string | null
          id?: string
          intentos?: number
          metadata?: Json | null
          provider_id?: string | null
          provider_status?: string | null
          ultimo_intento_en?: string | null
          usuario_id?: string | null
        }
        Update: {
          alerta_id?: string | null
          asunto?: string | null
          canal?: Database["public"]["Enums"]["notificacion_canal"]
          contenido?: string
          created_at?: string
          destinatario?: string
          error_mensaje?: string | null
          estado?: Database["public"]["Enums"]["notificacion_estado"]
          fecha_envio?: string | null
          fecha_programada?: string | null
          id?: string
          intentos?: number
          metadata?: Json | null
          provider_id?: string | null
          provider_status?: string | null
          ultimo_intento_en?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_cliente_detalle: {
        Row: {
          cheque_id: string | null
          id: string
          medio: Database["public"]["Enums"]["pago_medio"]
          monto: number
          observaciones: string | null
          pago_cliente_id: string
          referencia: string | null
        }
        Insert: {
          cheque_id?: string | null
          id?: string
          medio: Database["public"]["Enums"]["pago_medio"]
          monto: number
          observaciones?: string | null
          pago_cliente_id: string
          referencia?: string | null
        }
        Update: {
          cheque_id?: string | null
          id?: string
          medio?: Database["public"]["Enums"]["pago_medio"]
          monto?: number
          observaciones?: string | null
          pago_cliente_id?: string
          referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pago_cliente_detalle_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_cliente_detalle_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "v_cheques_por_vencer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_cliente_detalle_pago_cliente_id_fkey"
            columns: ["pago_cliente_id"]
            isOneToOne: false
            referencedRelation: "pagos_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      pago_cliente_imputaciones: {
        Row: {
          factura_id: string
          id: string
          monto_imputado: number
          pago_cliente_id: string
        }
        Insert: {
          factura_id: string
          id?: string
          monto_imputado: number
          pago_cliente_id: string
        }
        Update: {
          factura_id?: string
          id?: string
          monto_imputado?: number
          pago_cliente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_cliente_imputaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_factura_saldo"
            referencedColumns: ["factura_id"]
          },
          {
            foreignKeyName: "pago_cliente_imputaciones_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "viaje_facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_cliente_imputaciones_pago_cliente_id_fkey"
            columns: ["pago_cliente_id"]
            isOneToOne: false
            referencedRelation: "pagos_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_cliente: {
        Row: {
          archivo_id: string | null
          cliente_id: string
          concepto: string | null
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          moneda: string
          monto_total: number
          numero_recibo: string | null
          observaciones: string | null
        }
        Insert: {
          archivo_id?: string | null
          cliente_id: string
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          moneda?: string
          monto_total: number
          numero_recibo?: string | null
          observaciones?: string | null
        }
        Update: {
          archivo_id?: string | null
          cliente_id?: string
          concepto?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          moneda?: string
          monto_total?: number
          numero_recibo?: string | null
          observaciones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cliente_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_cliente_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_sistema: {
        Row: {
          categoria: string | null
          clave: string
          descripcion: string | null
          editable: boolean
          id: string
          tipo_dato: Database["public"]["Enums"]["parametro_tipo_dato"]
          updated_at: string
          updated_by: string | null
          valor: string
        }
        Insert: {
          categoria?: string | null
          clave: string
          descripcion?: string | null
          editable?: boolean
          id?: string
          tipo_dato?: Database["public"]["Enums"]["parametro_tipo_dato"]
          updated_at?: string
          updated_by?: string | null
          valor: string
        }
        Update: {
          categoria?: string | null
          clave?: string
          descripcion?: string | null
          editable?: boolean
          id?: string
          tipo_dato?: Database["public"]["Enums"]["parametro_tipo_dato"]
          updated_at?: string
          updated_by?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_sistema_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pesos_score_chofer: {
        Row: {
          actualizado_por: string | null
          id: string
          peso_apercibimiento: number
          peso_licencia: number
          peso_rotura: number
          peso_vacios_alto: number
          peso_vacios_bajo: number
          peso_vacios_medio: number
          umbral_vacios_alto: number
          umbral_vacios_bajo: number
          umbral_vacios_medio: number
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          id?: string
          peso_apercibimiento?: number
          peso_licencia?: number
          peso_rotura?: number
          peso_vacios_alto?: number
          peso_vacios_bajo?: number
          peso_vacios_medio?: number
          umbral_vacios_alto?: number
          umbral_vacios_bajo?: number
          umbral_vacios_medio?: number
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          id?: string
          peso_apercibimiento?: number
          peso_licencia?: number
          peso_rotura?: number
          peso_vacios_alto?: number
          peso_vacios_bajo?: number
          peso_vacios_medio?: number
          umbral_vacios_alto?: number
          umbral_vacios_bajo?: number
          umbral_vacios_medio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesos_score_chofer_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_pdf: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["plantilla_estado"]
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["plantilla_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["plantilla_estado"]
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["plantilla_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["plantilla_estado"]
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["plantilla_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_pdf_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_ruta: {
        Row: {
          alias: string | null
          cliente_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["punto_estado"]
          id: string
          latitud: number | null
          localidad: string | null
          longitud: number | null
          nombre: string
          pais: string
          provincia: string | null
          sucursal_id: string | null
          tipo: Database["public"]["Enums"]["punto_tipo"]
        }
        Insert: {
          alias?: string | null
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["punto_estado"]
          id?: string
          latitud?: number | null
          localidad?: string | null
          longitud?: number | null
          nombre: string
          pais?: string
          provincia?: string | null
          sucursal_id?: string | null
          tipo?: Database["public"]["Enums"]["punto_tipo"]
        }
        Update: {
          alias?: string | null
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["punto_estado"]
          id?: string
          latitud?: number | null
          localidad?: string | null
          longitud?: number | null
          nombre?: string
          pais?: string
          provincia?: string | null
          sucursal_id?: string | null
          tipo?: Database["public"]["Enums"]["punto_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "puntos_ruta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_ruta_sucursal_id_fkey"
            columns: ["sucursal_id"]
            isOneToOne: false
            referencedRelation: "cliente_sucursales"
            referencedColumns: ["id"]
          },
        ]
      }
      rol_areas: {
        Row: {
          area_codigo: string
          created_at: string
          nivel: Database["public"]["Enums"]["area_nivel"]
          rol_id: string
          updated_at: string
        }
        Insert: {
          area_codigo: string
          created_at?: string
          nivel?: Database["public"]["Enums"]["area_nivel"]
          rol_id: string
          updated_at?: string
        }
        Update: {
          area_codigo?: string
          created_at?: string
          nivel?: Database["public"]["Enums"]["area_nivel"]
          rol_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rol_areas_area_codigo_fkey"
            columns: ["area_codigo"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "rol_areas_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          permisos: Json
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          permisos?: Json
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          permisos?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rotura_archivos: {
        Row: {
          archivo_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          rotura_id: string
        }
        Insert: {
          archivo_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          rotura_id: string
        }
        Update: {
          archivo_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          rotura_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotura_archivos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotura_archivos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotura_archivos_rotura_id_fkey"
            columns: ["rotura_id"]
            isOneToOne: false
            referencedRelation: "roturas_gomas"
            referencedColumns: ["id"]
          },
        ]
      }
      roturas_gomas: {
        Row: {
          acoplado_id: string | null
          camion_id: string | null
          cantidad: number
          chofer_id: string | null
          costo: number | null
          created_at: string
          created_by: string | null
          fecha: string
          gravedad: string
          id: string
          mantenimiento_id: string | null
          moneda: string
          observaciones: string | null
          posicion: string | null
          tipo: string
        }
        Insert: {
          acoplado_id?: string | null
          camion_id?: string | null
          cantidad?: number
          chofer_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          gravedad?: string
          id?: string
          mantenimiento_id?: string | null
          moneda?: string
          observaciones?: string | null
          posicion?: string | null
          tipo?: string
        }
        Update: {
          acoplado_id?: string | null
          camion_id?: string | null
          cantidad?: number
          chofer_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          gravedad?: string
          id?: string
          mantenimiento_id?: string | null
          moneda?: string
          observaciones?: string | null
          posicion?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "roturas_gomas_acoplado_id_fkey"
            columns: ["acoplado_id"]
            isOneToOne: false
            referencedRelation: "acoplados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roturas_gomas_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roturas_gomas_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "roturas_gomas_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roturas_gomas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roturas_gomas_mantenimiento_id_fkey"
            columns: ["mantenimiento_id"]
            isOneToOne: false
            referencedRelation: "mantenimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas: {
        Row: {
          codigo_interno: string | null
          created_at: string
          descripcion: string | null
          destino_id: string
          estado: Database["public"]["Enums"]["ruta_estado"]
          id: string
          km_oficiales: number
          km_vacios: number
          origen_id: string
        }
        Insert: {
          codigo_interno?: string | null
          created_at?: string
          descripcion?: string | null
          destino_id: string
          estado?: Database["public"]["Enums"]["ruta_estado"]
          id?: string
          km_oficiales: number
          km_vacios?: number
          origen_id: string
        }
        Update: {
          codigo_interno?: string | null
          created_at?: string
          descripcion?: string | null
          destino_id?: string
          estado?: Database["public"]["Enums"]["ruta_estado"]
          id?: string
          km_oficiales?: number
          km_vacios?: number
          origen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rutas_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "puntos_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "puntos_ruta"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas_cliente_km: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          km_cliente: number
          observaciones: string | null
          ruta_id: string
          vigencia_desde: string
          vigencia_hasta: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          km_cliente: number
          observaciones?: string | null
          ruta_id: string
          vigencia_desde: string
          vigencia_hasta?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          km_cliente?: number
          observaciones?: string | null
          ruta_id?: string
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rutas_cliente_km_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_cliente_km_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      siniestro_archivos: {
        Row: {
          archivo_id: string
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          siniestro_id: string
        }
        Insert: {
          archivo_id: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          siniestro_id: string
        }
        Update: {
          archivo_id?: string
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          siniestro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "siniestro_archivos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siniestro_archivos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siniestro_archivos_siniestro_id_fkey"
            columns: ["siniestro_id"]
            isOneToOne: false
            referencedRelation: "siniestros"
            referencedColumns: ["id"]
          },
        ]
      }
      siniestros: {
        Row: {
          camion_id: string
          chofer_id: string | null
          compania_seguro: string | null
          created_at: string
          created_by: string | null
          descripcion: string
          estado: Database["public"]["Enums"]["estado_siniestro_enum"]
          fecha: string
          id: string
          monto_danos: number | null
          numero_siniestro_seguro: string | null
          terceros_involucrados: string | null
          tipo_siniestro: Database["public"]["Enums"]["tipo_siniestro_enum"]
          tipo_siniestro_detalle: string | null
          updated_at: string
        }
        Insert: {
          camion_id: string
          chofer_id?: string | null
          compania_seguro?: string | null
          created_at?: string
          created_by?: string | null
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_siniestro_enum"]
          fecha: string
          id?: string
          monto_danos?: number | null
          numero_siniestro_seguro?: string | null
          terceros_involucrados?: string | null
          tipo_siniestro?: Database["public"]["Enums"]["tipo_siniestro_enum"]
          tipo_siniestro_detalle?: string | null
          updated_at?: string
        }
        Update: {
          camion_id?: string
          chofer_id?: string | null
          compania_seguro?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_siniestro_enum"]
          fecha?: string
          id?: string
          monto_danos?: number | null
          numero_siniestro_seguro?: string | null
          terceros_involucrados?: string | null
          tipo_siniestro?: Database["public"]["Enums"]["tipo_siniestro_enum"]
          tipo_siniestro_detalle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "siniestros_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siniestros_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "siniestros_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "siniestros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas: {
        Row: {
          activa: boolean
          cliente_id: string
          created_at: string
          created_by: string | null
          id: string
          modalidad: Database["public"]["Enums"]["tarifa_modalidad"]
          moneda: string
          observaciones: string | null
          ruta_id: string | null
          valor: number
          vigencia_desde: string
          vigencia_hasta: string | null
        }
        Insert: {
          activa?: boolean
          cliente_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          modalidad: Database["public"]["Enums"]["tarifa_modalidad"]
          moneda?: string
          observaciones?: string | null
          ruta_id?: string | null
          valor: number
          vigencia_desde: string
          vigencia_hasta?: string | null
        }
        Update: {
          activa?: boolean
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          modalidad?: Database["public"]["Enums"]["tarifa_modalidad"]
          moneda?: string
          observaciones?: string | null
          ruta_id?: string | null
          valor?: number
          vigencia_desde?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_carga: {
        Row: {
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tipo_carga_estado"]
          id: string
          nombre: string
          requiere_documentacion_especial: boolean
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre: string
          requiere_documentacion_especial?: boolean
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre?: string
          requiere_documentacion_especial?: boolean
        }
        Relationships: []
      }
      tipos_documento: {
        Row: {
          aplica_a: Database["public"]["Enums"]["documento_aplica_a"]
          codigo: string
          created_at: string
          dias_alerta_vencimiento: number
          estado: Database["public"]["Enums"]["tipo_carga_estado"]
          id: string
          nombre: string
          obligatorio: boolean
        }
        Insert: {
          aplica_a: Database["public"]["Enums"]["documento_aplica_a"]
          codigo: string
          created_at?: string
          dias_alerta_vencimiento?: number
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre: string
          obligatorio?: boolean
        }
        Update: {
          aplica_a?: Database["public"]["Enums"]["documento_aplica_a"]
          codigo?: string
          created_at?: string
          dias_alerta_vencimiento?: number
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre?: string
          obligatorio?: boolean
        }
        Relationships: []
      }
      tipos_gasto: {
        Row: {
          categoria: Database["public"]["Enums"]["tipo_gasto_categoria"]
          created_at: string
          estado: Database["public"]["Enums"]["tipo_gasto_estado"]
          id: string
          nombre: string
          requiere_comprobante: boolean
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["tipo_gasto_categoria"]
          created_at?: string
          estado?: Database["public"]["Enums"]["tipo_gasto_estado"]
          id?: string
          nombre: string
          requiere_comprobante?: boolean
        }
        Update: {
          categoria?: Database["public"]["Enums"]["tipo_gasto_categoria"]
          created_at?: string
          estado?: Database["public"]["Enums"]["tipo_gasto_estado"]
          id?: string
          nombre?: string
          requiere_comprobante?: boolean
        }
        Relationships: []
      }
      tipos_servicio: {
        Row: {
          aplica_a_tercerizado: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tipo_carga_estado"]
          id: string
          intervalo_dias: number | null
          intervalo_km: number | null
          nombre: string
          orden: number
          requiere_fecha: boolean
          requiere_km: boolean
          updated_at: string
        }
        Insert: {
          aplica_a_tercerizado?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          intervalo_dias?: number | null
          intervalo_km?: number | null
          nombre: string
          orden?: number
          requiere_fecha?: boolean
          requiere_km?: boolean
          updated_at?: string
        }
        Update: {
          aplica_a_tercerizado?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          intervalo_dias?: number | null
          intervalo_km?: number | null
          nombre?: string
          orden?: number
          requiere_fecha?: boolean
          requiere_km?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tonelaje_categorias: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["tipo_carga_estado"]
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["tipo_carga_estado"]
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      usuario_areas: {
        Row: {
          area_codigo: string
          created_at: string
          id: string
          motivo: string | null
          nivel: Database["public"]["Enums"]["area_nivel"]
          otorgado_por: string | null
          updated_at: string
          usuario_id: string
          vence_en: string | null
        }
        Insert: {
          area_codigo: string
          created_at?: string
          id?: string
          motivo?: string | null
          nivel: Database["public"]["Enums"]["area_nivel"]
          otorgado_por?: string | null
          updated_at?: string
          usuario_id: string
          vence_en?: string | null
        }
        Update: {
          area_codigo?: string
          created_at?: string
          id?: string
          motivo?: string | null
          nivel?: Database["public"]["Enums"]["area_nivel"]
          otorgado_por?: string | null
          updated_at?: string
          usuario_id?: string
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_areas_area_codigo_fkey"
            columns: ["area_codigo"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "usuario_areas_otorgado_por_fkey"
            columns: ["otorgado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_areas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          apellido: string | null
          created_at: string
          created_by: string | null
          email: string
          estado: Database["public"]["Enums"]["usuario_estado"]
          id: string
          last_login: string | null
          last_login_ip: unknown
          must_change_password: boolean
          nombre: string
          password_changed_at: string | null
          rol_id: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          estado?: Database["public"]["Enums"]["usuario_estado"]
          id: string
          last_login?: string | null
          last_login_ip?: unknown
          must_change_password?: boolean
          nombre: string
          password_changed_at?: string | null
          rol_id: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          estado?: Database["public"]["Enums"]["usuario_estado"]
          id?: string
          last_login?: string | null
          last_login_ip?: unknown
          must_change_password?: boolean
          nombre?: string
          password_changed_at?: string | null
          rol_id?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      viaje_cartas_porte: {
        Row: {
          archivo_id: string | null
          created_at: string
          fecha: string | null
          id: string
          numero_cpe: string
          observaciones: string | null
          tipo: Database["public"]["Enums"]["carta_porte_tipo"]
          viaje_id: string
        }
        Insert: {
          archivo_id?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          numero_cpe: string
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["carta_porte_tipo"]
          viaje_id: string
        }
        Update: {
          archivo_id?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          numero_cpe?: string
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["carta_porte_tipo"]
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_cartas_porte_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_cartas_porte_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_cartas_porte_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viaje_facturas: {
        Row: {
          archivo_id: string | null
          created_at: string
          created_by: string | null
          fecha_emision: string
          fecha_vencimiento: string | null
          id: string
          iva_monto: number | null
          iva_porcentaje: number | null
          moneda: string
          monto_neto: number
          monto_total: number
          numero: string
          observaciones: string | null
          tipo: Database["public"]["Enums"]["factura_tipo"]
          tipo_cambio: number | null
          viaje_id: string
        }
        Insert: {
          archivo_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_emision: string
          fecha_vencimiento?: string | null
          id?: string
          iva_monto?: number | null
          iva_porcentaje?: number | null
          moneda?: string
          monto_neto: number
          monto_total: number
          numero: string
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["factura_tipo"]
          tipo_cambio?: number | null
          viaje_id: string
        }
        Update: {
          archivo_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_emision?: string
          fecha_vencimiento?: string | null
          id?: string
          iva_monto?: number | null
          iva_porcentaje?: number | null
          moneda?: string
          monto_neto?: number
          monto_total?: number
          numero?: string
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["factura_tipo"]
          tipo_cambio?: number | null
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_facturas_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_facturas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_facturas_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_facturas_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viaje_remitos: {
        Row: {
          archivo_id: string | null
          created_at: string
          fecha: string | null
          id: string
          numero: string
          observaciones: string | null
          tonelaje: number | null
          viaje_id: string
        }
        Insert: {
          archivo_id?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          numero: string
          observaciones?: string | null
          tonelaje?: number | null
          viaje_id: string
        }
        Update: {
          archivo_id?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          numero?: string
          observaciones?: string | null
          tonelaje?: number | null
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_remitos_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "documentos_archivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_remitos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_remitos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viaje_tonelaje_detalle: {
        Row: {
          categoria_id: string
          created_at: string
          created_by: string | null
          id: string
          observaciones: string | null
          toneladas: number
          viaje_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          observaciones?: string | null
          toneladas: number
          viaje_id: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observaciones?: string | null
          toneladas?: number
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viaje_tonelaje_detalle_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "tonelaje_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_tonelaje_detalle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_tonelaje_detalle_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_tonelaje_detalle_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      viajes: {
        Row: {
          camion_id: string | null
          chofer_id: string | null
          cliente_id: string
          cobrado: boolean
          codigo: string
          created_at: string
          created_by: string | null
          destino_id: string | null
          dm_ypf_id: string | null
          es_internacional: boolean
          es_vacio: boolean
          estado: Database["public"]["Enums"]["viaje_estado"]
          facturado: boolean
          fecha_cobro: string | null
          fecha_llegada: string | null
          fecha_salida: string | null
          fecha_viaje: string
          id: string
          km_con_carga: number
          km_desvio_no_computable: number
          km_vacios: number
          moneda: string
          monto_flete: number | null
          nro_remito: string | null
          nro_transporte: string | null
          nro_viaje_ypf: string | null
          observaciones: string | null
          origen_id: string | null
          requiere_doble_facturacion: boolean
          ruta_id: string | null
          tarifa_id: string | null
          tipo_cambio: number | null
          tipo_carga_id: string
          tonelaje_real: number | null
          updated_at: string
        }
        Insert: {
          camion_id?: string | null
          chofer_id?: string | null
          cliente_id: string
          cobrado?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          destino_id?: string | null
          dm_ypf_id?: string | null
          es_internacional?: boolean
          es_vacio?: boolean
          estado?: Database["public"]["Enums"]["viaje_estado"]
          facturado?: boolean
          fecha_cobro?: string | null
          fecha_llegada?: string | null
          fecha_salida?: string | null
          fecha_viaje: string
          id?: string
          km_con_carga?: number
          km_desvio_no_computable?: number
          km_vacios?: number
          moneda?: string
          monto_flete?: number | null
          nro_remito?: string | null
          nro_transporte?: string | null
          nro_viaje_ypf?: string | null
          observaciones?: string | null
          origen_id?: string | null
          requiere_doble_facturacion?: boolean
          ruta_id?: string | null
          tarifa_id?: string | null
          tipo_cambio?: number | null
          tipo_carga_id: string
          tonelaje_real?: number | null
          updated_at?: string
        }
        Update: {
          camion_id?: string | null
          chofer_id?: string | null
          cliente_id?: string
          cobrado?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          destino_id?: string | null
          dm_ypf_id?: string | null
          es_internacional?: boolean
          es_vacio?: boolean
          estado?: Database["public"]["Enums"]["viaje_estado"]
          facturado?: boolean
          fecha_cobro?: string | null
          fecha_llegada?: string | null
          fecha_salida?: string | null
          fecha_viaje?: string
          id?: string
          km_con_carga?: number
          km_desvio_no_computable?: number
          km_vacios?: number
          moneda?: string
          monto_flete?: number | null
          nro_remito?: string | null
          nro_transporte?: string | null
          nro_viaje_ypf?: string | null
          observaciones?: string | null
          origen_id?: string | null
          requiere_doble_facturacion?: boolean
          ruta_id?: string | null
          tarifa_id?: string | null
          tipo_cambio?: number | null
          tipo_carga_id?: string
          tonelaje_real?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viajes_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
          {
            foreignKeyName: "viajes_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "puntos_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_dm_ypf_id_fkey"
            columns: ["dm_ypf_id"]
            isOneToOne: false
            referencedRelation: "compliance_dm_ypf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "puntos_ruta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viajes_tipo_carga_id_fkey"
            columns: ["tipo_carga_id"]
            isOneToOne: false
            referencedRelation: "tipos_carga"
            referencedColumns: ["id"]
          },
        ]
      }
      viaticos: {
        Row: {
          chofer_id: string
          created_at: string
          created_by: string | null
          diferencia: number | null
          estado: Database["public"]["Enums"]["viatico_estado"]
          fecha_entrega: string
          fecha_rendicion: string | null
          id: string
          medio_entrega: Database["public"]["Enums"]["viatico_medio_entrega"]
          moneda: string
          monto_adelanto: number
          monto_devuelto: number
          monto_entregado: number
          monto_rendido: number | null
          observaciones: string | null
          responsable_entrega_id: string
          updated_at: string
          viaje_id: string | null
        }
        Insert: {
          chofer_id: string
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["viatico_estado"]
          fecha_entrega: string
          fecha_rendicion?: string | null
          id?: string
          medio_entrega?: Database["public"]["Enums"]["viatico_medio_entrega"]
          moneda?: string
          monto_adelanto?: number
          monto_devuelto?: number
          monto_entregado: number
          monto_rendido?: number | null
          observaciones?: string | null
          responsable_entrega_id: string
          updated_at?: string
          viaje_id?: string | null
        }
        Update: {
          chofer_id?: string
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          estado?: Database["public"]["Enums"]["viatico_estado"]
          fecha_entrega?: string
          fecha_rendicion?: string | null
          id?: string
          medio_entrega?: Database["public"]["Enums"]["viatico_medio_entrega"]
          moneda?: string
          monto_adelanto?: number
          monto_devuelto?: number
          monto_entregado?: number
          monto_rendido?: number | null
          observaciones?: string | null
          responsable_entrega_id?: string
          updated_at?: string
          viaje_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viaticos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaticos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaticos_responsable_entrega_id_fkey"
            columns: ["responsable_entrega_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaticos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaticos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_caja_saldo: {
        Row: {
          moneda: string | null
          saldo: number | null
        }
        Relationships: []
      }
      v_camion_documentos_vigencia: {
        Row: {
          camion_id: string | null
          dias_alerta_vencimiento: number | null
          dias_restantes: number | null
          estado_vigencia: string | null
          fecha_vencimiento: string | null
          id: string | null
          numero: string | null
          patente: string | null
          tipo_documento: string | null
          tipo_documento_codigo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camion_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "camiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camion_documentos_camion_id_fkey"
            columns: ["camion_id"]
            isOneToOne: false
            referencedRelation: "v_camion_km_actual"
            referencedColumns: ["camion_id"]
          },
        ]
      }
      v_camion_km_actual: {
        Row: {
          camion_id: string | null
          fecha_ultimo_registro: string | null
          km_actual: number | null
          patente: string | null
        }
        Relationships: []
      }
      v_cheques_por_vencer: {
        Row: {
          banco: string | null
          dias_restantes: number | null
          estado: Database["public"]["Enums"]["cheque_estado"] | null
          fecha_vencimiento: string | null
          id: string | null
          importe: number | null
          librador_nombre: string | null
          moneda: string | null
          numero: string | null
        }
        Relationships: []
      }
      v_chofer_documentos_vigencia: {
        Row: {
          chofer: string | null
          chofer_id: string | null
          dias_alerta_vencimiento: number | null
          dias_restantes: number | null
          estado_vigencia: string | null
          fecha_vencimiento: string | null
          id: string | null
          numero: string | null
          tipo_documento: string | null
          tipo_documento_codigo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chofer_documentos_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_cliente_saldo: {
        Row: {
          cliente_id: string | null
          moneda: string | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_cte_movimientos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_compliance_estado: {
        Row: {
          archivo_id: string | null
          camion_id: string | null
          camion_patente: string | null
          chofer_id: string | null
          chofer_nombre: string | null
          cliente_aplica:
            | Database["public"]["Enums"]["compliance_cliente_aplica"]
            | null
          dias_alerta: number | null
          dias_restantes: number | null
          documento_fuente: string | null
          documento_id: string | null
          estado: string | null
          fecha_vencimiento: string | null
          nivel: Database["public"]["Enums"]["compliance_nivel"] | null
          periodicidad:
            | Database["public"]["Enums"]["compliance_periodicidad"]
            | null
          requisito_codigo: string | null
          requisito_id: string | null
          requisito_nombre: string | null
        }
        Relationships: []
      }
      v_factura_saldo: {
        Row: {
          estado_cobro: string | null
          factura_id: string | null
          fecha_emision: string | null
          fecha_vencimiento: string | null
          imputado: number | null
          moneda: string | null
          monto_total: number | null
          numero: string | null
          saldo_pendiente: number | null
          viaje_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viaje_facturas_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "v_viaje_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viaje_facturas_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: false
            referencedRelation: "viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_viaje_resumen: {
        Row: {
          camion: string | null
          chofer: string | null
          cliente: string | null
          codigo: string | null
          estado: Database["public"]["Enums"]["viaje_estado"] | null
          facturado: boolean | null
          fecha_viaje: string | null
          id: string | null
          km_computables: number | null
          km_total: number | null
          moneda: string | null
          monto_flete: number | null
          tonelaje_real: number | null
          total_gastos: number | null
          total_viaticos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_role_code: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_authenticated_active: { Args: never; Returns: boolean }
      resumen_choferes_mes: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          apellido: string
          chofer_id: string
          nombre: string
          pendientes_facturar: number
          total_importe: number
          total_km: number
          total_km_vacios: number
          total_tn: number
          viajes: number
        }[]
      }
    }
    Enums: {
      acoplado_estado: "activo" | "inactivo" | "baja" | "en_mantenimiento"
      acoplado_tipo:
        | "semi_tolva"
        | "batea"
        | "sider"
        | "semi_furgon"
        | "cisterna"
        | "jaula"
        | "plancha"
        | "otro"
      alerta_estado: "pendiente" | "vista" | "resuelta" | "descartada"
      alerta_severidad: "info" | "advertencia" | "critica"
      alerta_tipo:
        | "vencimiento_doc_camion"
        | "vencimiento_doc_chofer"
        | "vencimiento_cheque"
        | "viatico_pendiente_rendicion"
        | "viaje_sin_cerrar"
        | "mantenimiento_proximo"
        | "gasto_sin_comprobante"
        | "cheque_rechazado_recordatorio"
        | "auditoria_cliente"
        | "otro"
        | "vencimiento_compliance"
      area_nivel: "none" | "read" | "write" | "admin"
      audit_accion:
        | "crear"
        | "actualizar"
        | "eliminar"
        | "cambio_estado"
        | "login"
        | "logout"
        | "login_fallido"
        | "exportar"
        | "importar"
        | "alerta_login"
        | "foto_agregada"
        | "foto_eliminada"
        | "foto_principal"
        | "nota_foto"
      banco_estado: "activo" | "inactivo"
      caja_categoria:
        | "cobro_cliente"
        | "pago_proveedor"
        | "entrega_viatico"
        | "rendicion_vuelto"
        | "gasto_operativo"
        | "pago_chofer"
        | "transferencia_interna"
        | "ajuste"
        | "otro"
        | "siniestro"
        | "mantenimiento"
        | "combustible"
      caja_medio: "efectivo" | "transferencia" | "cheque" | "otro"
      caja_movimiento_tipo: "ingreso" | "egreso"
      camion_estado: "activo" | "inactivo" | "baja" | "en_mantenimiento"
      camion_tipo: "tractor" | "chasis_rigido" | "batea" | "otro"
      carga_combustible_origen: "estacion_servicio" | "tacho_propio"
      carta_porte_tipo: "cpe_granos" | "cp_general" | "mic_dta" | "otro"
      cheque_estado:
        | "cartera"
        | "depositado"
        | "acreditado"
        | "rechazado"
        | "anulado"
        | "entregado"
      cheque_motivo_rechazo:
        | "sin_fondos"
        | "firma_no_corresponde"
        | "cuenta_cerrada"
        | "formal"
        | "otro"
      cheque_tipo: "comun" | "diferido" | "electronico"
      chofer_estado: "activo" | "inactivo" | "baja"
      chofer_motivo_egreso: "renuncia" | "despido" | "jubilacion" | "otro"
      chofer_prestamo_estado:
        | "pendiente"
        | "parcial"
        | "cancelado"
        | "incobrable"
      cliente_condicion_iva:
        | "responsable_inscripto"
        | "monotributo"
        | "exento"
        | "consumidor_final"
        | "no_categorizado"
      cliente_estado: "activo" | "inactivo"
      cliente_requisito_estado: "pendiente" | "cumplido" | "vencido"
      cliente_requisito_frecuencia:
        | "unica"
        | "mensual"
        | "trimestral"
        | "semestral"
        | "anual"
      cliente_requisito_tipo:
        | "habilitacion_proveedor"
        | "documentacion_chofer"
        | "documentacion_camion"
        | "reporte_periodico"
        | "auditoria"
        | "otro"
      compliance_cliente_aplica: "AMBOS" | "YPF" | "LOMA_NEGRA"
      compliance_nivel: "chofer" | "unidad" | "empresa"
      compliance_periodicidad: "mensual" | "anual" | "renovable" | "unica"
      contacto_cargo: "comercial" | "administrativo" | "logistica" | "otro"
      cta_cte_categoria:
        | "factura"
        | "pago"
        | "cheque_recibido"
        | "cheque_rechazado"
        | "nota_credito"
        | "nota_debito"
        | "ajuste"
        | "intereses"
      cta_cte_tipo: "debe" | "haber"
      documento_aplica_a: "camion" | "chofer"
      documento_vigencia_estado: "vigente" | "vencido" | "por_vencer"
      estado_siniestro_enum: "abierto" | "en_gestion" | "cerrado"
      factura_tipo:
        | "nacional"
        | "internacional_ar"
        | "internacional_uy"
        | "otro"
      gasto_medio_pago:
        | "efectivo_viatico"
        | "efectivo_caja"
        | "transferencia"
        | "tarjeta_empresa"
        | "cuenta_corriente"
      hoja_ruta_estado: "borrador" | "cerrada" | "exportada" | "entregada"
      hoja_ruta_periodo_tipo:
        | "semanal"
        | "quincenal"
        | "mensual"
        | "personalizado"
      mantenimiento_tipo:
        | "service_preventivo"
        | "reparacion"
        | "cambio_aceite"
        | "cubiertas"
        | "otro"
      notificacion_canal: "email" | "whatsapp"
      notificacion_estado: "pendiente" | "enviada" | "error" | "rebotada"
      pago_medio: "efectivo" | "transferencia" | "cheque" | "compensacion"
      parametro_tipo_dato: "string" | "number" | "boolean" | "json"
      plantilla_estado: "activo" | "desarrollo" | "eliminada"
      plantilla_tipo: "remito" | "factura" | "gasoil" | "liquidacion"
      punto_estado: "activo" | "inactivo"
      punto_tipo: "planta_propia" | "cliente" | "proveedor" | "puerto" | "otro"
      ruta_estado: "activa" | "inactiva"
      tarifa_modalidad: "fija" | "por_tonelada" | "por_kilo" | "por_km"
      tercerizacion_estado: "interno" | "en_transicion" | "tercerizado"
      tipo_carga_estado: "activo" | "inactivo"
      tipo_gasto_categoria:
        | "operativo_viaje"
        | "mantenimiento"
        | "administrativo"
        | "otro"
      tipo_gasto_estado: "activo" | "inactivo"
      tipo_siniestro_enum:
        | "choque"
        | "robo"
        | "incendio"
        | "vandalismo"
        | "vuelco"
        | "otro"
      usuario_estado: "activo" | "inactivo" | "suspendido"
      viaje_estado: "pendiente" | "en_curso" | "cerrado" | "cancelado"
      viatico_estado: "pendiente_rendicion" | "rendido" | "parcialmente_rendido"
      viatico_medio_entrega: "efectivo" | "transferencia" | "otro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acoplado_estado: ["activo", "inactivo", "baja", "en_mantenimiento"],
      acoplado_tipo: [
        "semi_tolva",
        "batea",
        "sider",
        "semi_furgon",
        "cisterna",
        "jaula",
        "plancha",
        "otro",
      ],
      alerta_estado: ["pendiente", "vista", "resuelta", "descartada"],
      alerta_severidad: ["info", "advertencia", "critica"],
      alerta_tipo: [
        "vencimiento_doc_camion",
        "vencimiento_doc_chofer",
        "vencimiento_cheque",
        "viatico_pendiente_rendicion",
        "viaje_sin_cerrar",
        "mantenimiento_proximo",
        "gasto_sin_comprobante",
        "cheque_rechazado_recordatorio",
        "auditoria_cliente",
        "otro",
        "vencimiento_compliance",
      ],
      area_nivel: ["none", "read", "write", "admin"],
      audit_accion: [
        "crear",
        "actualizar",
        "eliminar",
        "cambio_estado",
        "login",
        "logout",
        "login_fallido",
        "exportar",
        "importar",
        "alerta_login",
        "foto_agregada",
        "foto_eliminada",
        "foto_principal",
        "nota_foto",
      ],
      banco_estado: ["activo", "inactivo"],
      caja_categoria: [
        "cobro_cliente",
        "pago_proveedor",
        "entrega_viatico",
        "rendicion_vuelto",
        "gasto_operativo",
        "pago_chofer",
        "transferencia_interna",
        "ajuste",
        "otro",
        "siniestro",
        "mantenimiento",
        "combustible",
      ],
      caja_medio: ["efectivo", "transferencia", "cheque", "otro"],
      caja_movimiento_tipo: ["ingreso", "egreso"],
      camion_estado: ["activo", "inactivo", "baja", "en_mantenimiento"],
      camion_tipo: ["tractor", "chasis_rigido", "batea", "otro"],
      carga_combustible_origen: ["estacion_servicio", "tacho_propio"],
      carta_porte_tipo: ["cpe_granos", "cp_general", "mic_dta", "otro"],
      cheque_estado: [
        "cartera",
        "depositado",
        "acreditado",
        "rechazado",
        "anulado",
        "entregado",
      ],
      cheque_motivo_rechazo: [
        "sin_fondos",
        "firma_no_corresponde",
        "cuenta_cerrada",
        "formal",
        "otro",
      ],
      cheque_tipo: ["comun", "diferido", "electronico"],
      chofer_estado: ["activo", "inactivo", "baja"],
      chofer_motivo_egreso: ["renuncia", "despido", "jubilacion", "otro"],
      chofer_prestamo_estado: [
        "pendiente",
        "parcial",
        "cancelado",
        "incobrable",
      ],
      cliente_condicion_iva: [
        "responsable_inscripto",
        "monotributo",
        "exento",
        "consumidor_final",
        "no_categorizado",
      ],
      cliente_estado: ["activo", "inactivo"],
      cliente_requisito_estado: ["pendiente", "cumplido", "vencido"],
      cliente_requisito_frecuencia: [
        "unica",
        "mensual",
        "trimestral",
        "semestral",
        "anual",
      ],
      cliente_requisito_tipo: [
        "habilitacion_proveedor",
        "documentacion_chofer",
        "documentacion_camion",
        "reporte_periodico",
        "auditoria",
        "otro",
      ],
      compliance_cliente_aplica: ["AMBOS", "YPF", "LOMA_NEGRA"],
      compliance_nivel: ["chofer", "unidad", "empresa"],
      compliance_periodicidad: ["mensual", "anual", "renovable", "unica"],
      contacto_cargo: ["comercial", "administrativo", "logistica", "otro"],
      cta_cte_categoria: [
        "factura",
        "pago",
        "cheque_recibido",
        "cheque_rechazado",
        "nota_credito",
        "nota_debito",
        "ajuste",
        "intereses",
      ],
      cta_cte_tipo: ["debe", "haber"],
      documento_aplica_a: ["camion", "chofer"],
      documento_vigencia_estado: ["vigente", "vencido", "por_vencer"],
      estado_siniestro_enum: ["abierto", "en_gestion", "cerrado"],
      factura_tipo: [
        "nacional",
        "internacional_ar",
        "internacional_uy",
        "otro",
      ],
      gasto_medio_pago: [
        "efectivo_viatico",
        "efectivo_caja",
        "transferencia",
        "tarjeta_empresa",
        "cuenta_corriente",
      ],
      hoja_ruta_estado: ["borrador", "cerrada", "exportada", "entregada"],
      hoja_ruta_periodo_tipo: [
        "semanal",
        "quincenal",
        "mensual",
        "personalizado",
      ],
      mantenimiento_tipo: [
        "service_preventivo",
        "reparacion",
        "cambio_aceite",
        "cubiertas",
        "otro",
      ],
      notificacion_canal: ["email", "whatsapp"],
      notificacion_estado: ["pendiente", "enviada", "error", "rebotada"],
      pago_medio: ["efectivo", "transferencia", "cheque", "compensacion"],
      parametro_tipo_dato: ["string", "number", "boolean", "json"],
      plantilla_estado: ["activo", "desarrollo", "eliminada"],
      plantilla_tipo: ["remito", "factura", "gasoil", "liquidacion"],
      punto_estado: ["activo", "inactivo"],
      punto_tipo: ["planta_propia", "cliente", "proveedor", "puerto", "otro"],
      ruta_estado: ["activa", "inactiva"],
      tarifa_modalidad: ["fija", "por_tonelada", "por_kilo", "por_km"],
      tercerizacion_estado: ["interno", "en_transicion", "tercerizado"],
      tipo_carga_estado: ["activo", "inactivo"],
      tipo_gasto_categoria: [
        "operativo_viaje",
        "mantenimiento",
        "administrativo",
        "otro",
      ],
      tipo_gasto_estado: ["activo", "inactivo"],
      tipo_siniestro_enum: [
        "choque",
        "robo",
        "incendio",
        "vandalismo",
        "vuelco",
        "otro",
      ],
      usuario_estado: ["activo", "inactivo", "suspendido"],
      viaje_estado: ["pendiente", "en_curso", "cerrado", "cancelado"],
      viatico_estado: [
        "pendiente_rendicion",
        "rendido",
        "parcialmente_rendido",
      ],
      viatico_medio_entrega: ["efectivo", "transferencia", "otro"],
    },
  },
} as const
