import { DateTime } from "luxon";
import { ProveedorFestivosRemoto } from "../src/festivos";
import { sumarDiasHabiles, sumarHorasHabiles, normalizarHaciaAtrasAHorarioLaboral, configuracionLaboralPorDefecto } from "../src/tiempoLaboral";
import type { RespuestaErrorApi, RespuestaExitosaApi } from "../src/tipos";

export const config = { runtime: "nodejs" };

const URL_FESTIVOS = process.env.HOLIDAYS_URL || "https://content.capta.co/Recruitment/WorkingDays.json";
const ZONA = configuracionLaboralPorDefecto.zona;

function crearError(estado: number, mensaje: string, error: RespuestaErrorApi["error"] = "InvalidParameters") {
  return { status: estado, body: { error, message: mensaje } as RespuestaErrorApi };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "InvalidMethod", message: "Solo GET" });
    return;
  }

  try {
    console.log("fecha-habil handler invoked");
    // Self-test to catch any runtime load issues and return JSON instead of HTML error
    try {
      const ahoraLocal = DateTime.now().setZone(ZONA);
      const _probe = normalizarHaciaAtrasAHorarioLaboral(ahoraLocal, new Set<string>());
    } catch (probeErr) {
      console.error("Self-test failed:", probeErr);
      const err = crearError(503, `Self-test failed: ${(probeErr as Error).message}`, "UpstreamUnavailable");
      res.status(err.status).json(err.body);
      return;
    }

    const consulta: Record<string, unknown> = (req.query || {}) as Record<string, unknown>;

    const diasCrudo = consulta["days"];
    const horasCrudo = consulta["hours"];
    const fechaCrudo = consulta["date"];

    const hayDias = diasCrudo !== undefined && diasCrudo !== null;
    const hayHoras = horasCrudo !== undefined && horasCrudo !== null;

    if (!hayDias && !hayHoras) {
      const err = crearError(400, "Debe enviarse al menos 'days' o 'hours'.");
      res.status(err.status).json(err.body);
      return;
    }

    const dias = hayDias ? Number(diasCrudo) : undefined;
    const horas = hayHoras ? Number(horasCrudo) : undefined;

    if (hayDias && (!Number.isInteger(dias) || (dias as number) <= 0)) {
      const err = crearError(400, "'days' debe ser un entero positivo.");
      res.status(err.status).json(err.body);
      return;
    }
    if (hayHoras && (!Number.isInteger(horas) || (horas as number) <= 0)) {
      const err = crearError(400, "'hours' debe ser un entero positivo.");
      res.status(err.status).json(err.body);
      return;
    }

    let baseLocal: DateTime;
    if (typeof fechaCrudo === "string") {
      const parseadaUtc = DateTime.fromISO(fechaCrudo, { zone: "utc" });
      if (!parseadaUtc.isValid || !/Z$/.test(fechaCrudo)) {
        const err = crearError(400, "'date' debe ser ISO UTC con sufijo Z.");
        res.status(err.status).json(err.body);
        return;
      }
      baseLocal = parseadaUtc.setZone(ZONA);
    } else {
      baseLocal = DateTime.now().setZone(ZONA);
    }

    const proveedorFestivos = new ProveedorFestivosRemoto(URL_FESTIVOS);
    const festivos = await proveedorFestivos.obtenerFestivos();

    const normalizado = normalizarHaciaAtrasAHorarioLaboral(baseLocal, festivos).normalizado;

    let resultadoLocal = normalizado;
    if (typeof dias === "number") {
      resultadoLocal = sumarDiasHabiles(resultadoLocal, dias, festivos);
    }
    if (typeof horas === "number") {
      resultadoLocal = sumarHorasHabiles(resultadoLocal, horas, festivos);
    }

    const resultadoUtc = resultadoLocal.toUTC();
    const isoSinMs = resultadoUtc.toISO({ suppressMilliseconds: true });
    const cuerpo: RespuestaExitosaApi = { date: isoSinMs as string };

    res.status(200).json(cuerpo);
  } catch (e) {
    console.error("fecha-habil internal error", e);
    const err = crearError(503, `Error interno o de dependencia: ${(e as Error).message}`, "UpstreamUnavailable");
    res.status(err.status).json(err.body);
  }
}