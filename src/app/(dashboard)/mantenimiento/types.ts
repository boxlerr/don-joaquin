import type { Database } from "@/types/database";

export type CamionOption = {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  tercerizacion_estado: Database["public"]["Enums"]["tercerizacion_estado"];
};

export type ChoferOption = {
  id: string;
  nombre: string;
  apellido: string;
};

export type AcopladoOption = {
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
};

export type TipoServicioOption = {
  id: string;
  codigo: string;
  nombre: string;
  aplica_a_tercerizado: boolean;
};
