import { DateTime } from "luxon";

export type RespuestaExitosaApi = {
  date: string;
};

export type RespuestaErrorApi = {
  error: "InvalidParameters" | "BadRequest" | "UpstreamUnavailable";
  message: string;
};

export type ParametrosConsulta = {
  days?: number;
  hours?: number;
  date?: string;
};

export type ConjuntoFestivos = Set<string>; // yyyy-MM-dd en zona local

export interface ProveedorFestivos {
  obtenerFestivos(): Promise<ConjuntoFestivos>;
}

export interface ConfiguracionHorarioLaboral {
  zona: string; // "America/Bogota"
  horaInicioManana: number; // 8
  horaInicioAlmuerzo: number; // 12
  horaFinAlmuerzo: number; // 13
  horaFinTarde: number; // 17
}

export type MotivoNoLaboral =
  | "fin_de_semana"
  | "festivo"
  | "antes_de_jornada"
  | "despues_de_jornada"
  | "almuerzo"
  | "en_jornada";

export interface ResultadoNormalizacion {
  normalizado: DateTime; // Fecha/hora ajustada hacia atrás
  motivo: MotivoNoLaboral;
}