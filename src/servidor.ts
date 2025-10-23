import Fastify from "fastify";
import { DateTime } from "luxon";
import { ProveedorFestivosRemoto } from "./festivos";
import { sumarDiasHabiles, sumarHorasHabiles, normalizarHaciaAtrasAHorarioLaboral, configuracionLaboralPorDefecto } from "./tiempoLaboral";
import type { RespuestaErrorApi, RespuestaExitosaApi } from "./tipos";
import { construirHtmlInterfaz } from "./interfaz";

const PUERTO = Number(process.env.PORT || 3000);
const URL_FESTIVOS = process.env.HOLIDAYS_URL || "https://content.capta.co/Recruitment/WorkingDays.json";
const ZONA = configuracionLaboralPorDefecto.zona;

const servidor = Fastify({ logger: true });
const proveedorFestivos = new ProveedorFestivosRemoto(URL_FESTIVOS);

function crearError(estado: number, mensaje: string, error: RespuestaErrorApi["error"] = "InvalidParameters") {
  return { status: estado, body: { error, message: mensaje } satisfies RespuestaErrorApi };
}

// Se permite cualquier ruta; aquí uso una en español
servidor.get("/api/fecha-habil", async (req, reply) => {
  try {
    const consulta: Record<string, unknown> = req.query as Record<string, unknown>;

    const diasCrudo = consulta["days"];
    const horasCrudo = consulta["hours"];
    const fechaCrudo = consulta["date"];

    const hayDias = diasCrudo !== undefined && diasCrudo !== null;
    const hayHoras = horasCrudo !== undefined && horasCrudo !== null;

    if (!hayDias && !hayHoras) {
      const err = crearError(400, "Debe enviarse al menos 'days' o 'hours'.");
      return reply.status(err.status).send(err.body);
    }

    const dias = hayDias ? Number(diasCrudo) : undefined;
    const horas = hayHoras ? Number(horasCrudo) : undefined;

    if (hayDias && (!Number.isInteger(dias) || dias! <= 0)) {
      const err = crearError(400, "'days' debe ser un entero positivo.");
      return reply.status(err.status).send(err.body);
    }
    if (hayHoras && (!Number.isInteger(horas) || horas! <= 0)) {
      const err = crearError(400, "'hours' debe ser un entero positivo.");
      return reply.status(err.status).send(err.body);
    }

    let baseLocal: DateTime;
    if (typeof fechaCrudo === "string") {
      const parseadaUtc = DateTime.fromISO(fechaCrudo, { zone: "utc" });
      if (!parseadaUtc.isValid || !/Z$/.test(fechaCrudo)) {
        const err = crearError(400, "'date' debe ser ISO UTC con sufijo Z.");
        return reply.status(err.status).send(err.body);
      }
      baseLocal = parseadaUtc.setZone(ZONA);
    } else {
      baseLocal = DateTime.now().setZone(ZONA);
    }

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

    return reply.status(200).send(cuerpo);
  } catch (e) {
    const err = crearError(503, `Error interno o de dependencia: ${(e as Error).message}`, "UpstreamUnavailable");
    return reply.status(err.status).send(err.body);
  }
});

servidor.get("/", async (_req, reply) => {
  reply.header("Content-Type", "text/html; charset=utf-8");
  reply.send(construirHtmlInterfaz());
});

servidor.listen({ port: PUERTO, host: "0.0.0.0" })
  .then(() => {
    servidor.log.info(`Servidor escuchando en http://localhost:${PUERTO}`);
  })
  .catch((err) => {
    servidor.log.error(err);
    process.exit(1);
  });