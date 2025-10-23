import { DateTime } from "luxon";
import type { ProveedorFestivos, ConjuntoFestivos } from "./tipos";

interface EstructuraFestivosRemota {
  holidays: string[];
}

export class ProveedorFestivosRemoto implements ProveedorFestivos {
  private readonly url: string;
  private cache?: { conjunto: ConjuntoFestivos; obtenidoEn: number };
  private readonly ttlMs: number;

  constructor(url: string, ttlMs: number = 12 * 60 * 60 * 1000) {
    this.url = url;
    this.ttlMs = ttlMs;
  }

  async obtenerFestivos(): Promise<ConjuntoFestivos> {
    const ahora = Date.now();
    if (this.cache && ahora - this.cache.obtenidoEn < this.ttlMs) {
      return this.cache.conjunto;
    }
    const res = await fetch(this.url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Fallo al descargar festivos: ${res.status}`);
    }
    const data = (await res.json()) as EstructuraFestivosRemota | string[];

    const lista: string[] = Array.isArray(data) ? data : data.holidays;
    const conjunto: ConjuntoFestivos = new Set<string>();

    for (const item of lista) {
      const dt = DateTime.fromISO(item, { zone: "America/Bogota" });
      const clave = dt.toFormat("yyyy-LL-dd");
      conjunto.add(clave);
    }

    this.cache = { conjunto, obtenidoEn: ahora };
    return conjunto;
  }
}

export function esFestivoLocal(fecha: DateTime, festivos: ConjuntoFestivos): boolean {
  const clave = fecha.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toFormat("yyyy-LL-dd");
  return festivos.has(clave);
}