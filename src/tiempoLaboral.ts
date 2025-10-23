import { DateTime } from "luxon";
import type { ConfiguracionHorarioLaboral, ResultadoNormalizacion, ConjuntoFestivos } from "./tipos";
import { esFestivoLocal } from "./festivos";

export const configuracionLaboralPorDefecto: ConfiguracionHorarioLaboral = {
  zona: "America/Bogota",
  horaInicioManana: 8,
  horaInicioAlmuerzo: 12,
  horaFinAlmuerzo: 13,
  horaFinTarde: 17,
};

function esFinDeSemanaLocal(fecha: DateTime): boolean {
  const dia = fecha.weekday; // 1=lunes ... 7=domingo
  return dia === 6 || dia === 7;
}

function esDiaLaboralLocal(fecha: DateTime, festivos: ConjuntoFestivos): boolean {
  return !esFinDeSemanaLocal(fecha) && !esFestivoLocal(fecha, festivos);
}

export function normalizarHaciaAtrasAHorarioLaboral(
  fecha: DateTime,
  festivos: ConjuntoFestivos,
  cfg: ConfiguracionHorarioLaboral = configuracionLaboralPorDefecto
): ResultadoNormalizacion {
  let actual = fecha.setZone(cfg.zona, { keepLocalTime: true });

  // Si no es día laboral, retroceder al último día laboral a las 17:00
  if (!esDiaLaboralLocal(actual, festivos)) {
    do {
      actual = actual.minus({ days: 1 });
    } while (!esDiaLaboralLocal(actual, festivos));
    actual = actual.set({ hour: cfg.horaFinTarde, minute: 0, second: 0, millisecond: 0 });
    return { normalizado: actual, motivo: "fin_de_semana" };
  }

  const h = actual.hour;
  const m = actual.minute;

  // Antes del inicio laboral de la mañana → día laboral anterior 17:00
  if (h < cfg.horaInicioManana) {
    let previo = actual.minus({ days: 1 });
    while (!esDiaLaboralLocal(previo, festivos)) {
      previo = previo.minus({ days: 1 });
    }
    previo = previo.set({ hour: cfg.horaFinTarde, minute: 0, second: 0, millisecond: 0 });
    return { normalizado: previo, motivo: "antes_de_jornada" };
  }

  // Almuerzo 12:00-13:00 → aproximar hacia atrás a 12:00
  if ((h === cfg.horaInicioAlmuerzo && m > 0) || (h > cfg.horaInicioAlmuerzo && h < cfg.horaFinAlmuerzo)) {
    const retro = actual.set({ hour: cfg.horaInicioAlmuerzo, minute: 0, second: 0, millisecond: 0 });
    return { normalizado: retro, motivo: "almuerzo" };
  }

  // Después de 17:00 → bajar a 17:00
  if (h > cfg.horaFinTarde || (h === cfg.horaFinTarde && m > 0)) {
    const retro = actual.set({ hour: cfg.horaFinTarde, minute: 0, second: 0, millisecond: 0 });
    return { normalizado: retro, motivo: "despues_de_jornada" };
  }

  // Dentro de jornada (mañana o tarde) o exactamente en 12:00 / 17:00
  return { normalizado: actual, motivo: "en_jornada" };
}

export function sumarDiasHabiles(
  fecha: DateTime,
  dias: number,
  festivos: ConjuntoFestivos,
  cfg: ConfiguracionHorarioLaboral = configuracionLaboralPorDefecto
): DateTime {
  if (dias <= 0) return fecha.setZone(cfg.zona, { keepLocalTime: true });
  let actual = fecha.setZone(cfg.zona, { keepLocalTime: true });
  let restantes = dias;
  while (restantes > 0) {
    actual = actual.plus({ days: 1 });
    while (!esDiaLaboralLocal(actual, festivos)) {
      actual = actual.plus({ days: 1 });
    }
    restantes -= 1;
  }
  return actual.set({ hour: fecha.hour, minute: fecha.minute, second: fecha.second, millisecond: fecha.millisecond });
}

export function sumarHorasHabiles(
  fecha: DateTime,
  horas: number,
  festivos: ConjuntoFestivos,
  cfg: ConfiguracionHorarioLaboral = configuracionLaboralPorDefecto
): DateTime {
  if (horas <= 0) return fecha.setZone(cfg.zona, { keepLocalTime: true });
  let actual = fecha.setZone(cfg.zona, { keepLocalTime: true });
  let minutosRestantes = horas * 60;

  // Si estamos exactamente en 12:00, mover al inicio de la tarde 13:00
  if (actual.hour === cfg.horaInicioAlmuerzo && actual.minute === 0) {
    actual = actual.set({ hour: cfg.horaFinAlmuerzo, minute: 0, second: 0, millisecond: 0 });
  }

  while (minutosRestantes > 0) {
    // Asegurar día laboral
    if (!esDiaLaboralLocal(actual, festivos)) {
      do {
        actual = actual.plus({ days: 1 });
      } while (!esDiaLaboralLocal(actual, festivos));
      actual = actual.set({ hour: cfg.horaInicioManana, minute: 0, second: 0, millisecond: 0 });
    }

    const h = actual.hour;
    let finSegmento: DateTime;

    if (h < cfg.horaInicioAlmuerzo) {
      finSegmento = actual.set({ hour: cfg.horaInicioAlmuerzo, minute: 0, second: 0, millisecond: 0 });
    } else if (h >= cfg.horaFinAlmuerzo && h < cfg.horaFinTarde) {
      finSegmento = actual.set({ hour: cfg.horaFinTarde, minute: 0, second: 0, millisecond: 0 });
    } else if (h >= cfg.horaInicioAlmuerzo && h < cfg.horaFinAlmuerzo) {
      // En almuerzo, saltar a 13:00
      actual = actual.set({ hour: cfg.horaFinAlmuerzo, minute: 0, second: 0, millisecond: 0 });
      continue;
    } else {
      // Fuera de horario dentro de día laboral: saltar al siguiente segmento válido
      if (h >= cfg.horaFinTarde) {
        do {
          actual = actual.plus({ days: 1 });
        } while (!esDiaLaboralLocal(actual, festivos));
        actual = actual.set({ hour: cfg.horaInicioManana, minute: 0, second: 0, millisecond: 0 });
        continue;
      }
      // antes de 08:00 en día laboral: mover a 08:00
      actual = actual.set({ hour: cfg.horaInicioManana, minute: 0, second: 0, millisecond: 0 });
      continue;
    }

    const disponible = finSegmento.diff(actual, "minutes").minutes;
    if (minutosRestantes <= disponible) {
      actual = actual.plus({ minutes: minutosRestantes });
      minutosRestantes = 0;
    } else {
      actual = finSegmento;
      minutosRestantes -= disponible;
      // saltar al inicio del siguiente segmento
      if (finSegmento.hour === cfg.horaInicioAlmuerzo) {
        // siguiente segmento: 13:00 mismo día
        actual = actual.set({ hour: cfg.horaFinAlmuerzo, minute: 0, second: 0, millisecond: 0 });
      } else {
        // siguiente segmento: 08:00 del siguiente día laboral
        do {
          actual = actual.plus({ days: 1 });
        } while (!esDiaLaboralLocal(actual, festivos));
        actual = actual.set({ hour: cfg.horaInicioManana, minute: 0, second: 0, millisecond: 0 });
      }
    }
  }

  return actual;
}