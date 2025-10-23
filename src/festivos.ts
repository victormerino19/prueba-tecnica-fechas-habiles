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

    // Fallback seguro: si falla descarga o parseo, devolver conjunto vacío
    try {
      const res = await fetch(this.url, { method: "GET" });
      if (!res.ok) {
        throw new Error(`Fallo al descargar festivos: ${res.status}`);
      }

      const ct = res.headers.get("content-type") || "";
      let data: EstructuraFestivosRemota | string[];
      if (ct.includes("application/json")) {
        data = (await res.json()) as EstructuraFestivosRemota | string[];
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text) as EstructuraFestivosRemota | string[];
        } catch {
          data = { holidays: [] } as EstructuraFestivosRemota;
        }
      }

      const lista: string[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).holidays)
        ? (data as any).holidays
        : [];

      const conjunto: ConjuntoFestivos = new Set<string>();
      for (const item of lista) {
        const dt = DateTime.fromISO(item, { zone: "America/Bogota" });
        const clave = dt.toFormat("yyyy-LL-dd");
        conjunto.add(clave);
      }

      this.cache = { conjunto, obtenidoEn: ahora };
      return conjunto;
    } catch (_e) {
      const conjuntoVacio: ConjuntoFestivos = new Set<string>();
      this.cache = { conjunto: conjuntoVacio, obtenidoEn: ahora };
      return conjuntoVacio;
    }
  }
}

export function esFestivoLocal(fecha: DateTime, festivos: ConjuntoFestivos): boolean {
  const clave = fecha.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toFormat("yyyy-LL-dd");
  return festivos.has(clave);
}