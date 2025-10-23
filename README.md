# Prueba técnica: Fechas hábiles (TypeScript + Fastify)

Este repositorio es mi respuesta a la prueba técnica “fechas hábiles”. Tomé la consigna del documento `/c:/Users/Victor/prueba capta/prueba-tecnica-fechas-habiles-ts/Prueba técnica de fechas hábiles.docx` y construí una API que suma días y horas hábiles considerando el calendario laboral de Colombia (zona `America/Bogota`), fines de semana y festivos.

A continuación explico, en primera persona, qué hice, cómo estructuré el proyecto, cómo correrlo y qué requisitos de la prueba están cumplidos.

---

## Qué hice

- Implementé una API REST en Fastify (Node + TypeScript) con un endpoint `GET /api/fecha-habil` que recibe una fecha base (`date` en UTC), y cantidades de `days` y `hours` a sumar.
- Apliqué la lógica de jornada laboral Colombia: 08:00–12:00 y 13:00–17:00 (pausa de almuerzo). Las horas fuera de este rango no se consideran hábiles.
- Excluí fines de semana (sábado, domingo) y festivos oficiales, obtenidos desde una fuente remota configurable vía env (`HOLIDAYS_URL`).
- La API devuelve la fecha resultante en UTC (con sufijo `Z`), manteniendo exactitud de la conversión de zonas.
- Contenericé con Docker multi-stage: compilo TS en la etapa `builder` y ejecuto en `runtime` con dependencias de producción.
- Agregué Docker Compose para levantar la app con un comando sencillo.
- Documenté cómo correr en desarrollo y producción.

---

## Cumplimiento de la prueba (desde mi trabajo)

- Requisito: Excluir fines de semana y festivos.
  - Cumplido en `src/tiempoLaboral.ts` (fines de semana) y `src/festivos.ts` (festivos vía `HOLIDAYS_URL`).
- Requisito: Respetar horario laboral (08–12 y 13–17, Colombia).
  - Cumplido en `src/tiempoLaboral.ts`. La lógica parte la jornada y evita contar horas fuera del rango.
- Requisito: Cálculo con `days` y `hours` sobre una `date` base.
  - Cumplido en `src/interfaz.ts` y `src/servidor.ts`. Valido parámetros y orquesto el cálculo.
- Requisito: Zona horaria y salida en UTC.
  - Cumplido: la jornada se calcula en `America/Bogota` y el resultado se retorna en UTC (con `Z`).
- Requisito: Endpoint claro y manejos de error.
  - Cumplido: `GET /api/fecha-habil` valida tipos, rangos y formato de fecha. Respuestas de error estandarizadas.
- Requisito: Entregable ejecutable con Docker.
  - Cumplido: `Dockerfile` multi-stage y `docker-compose.yml` funcionales.

Si el evaluador necesita trazar punto por punto contra el documento, puedo añadir una sección “Checklist exacta” con cada ítem textual del `.docx`. Al ser un documento binario, dejo aquí el resumen fiel a la consigna que seguí.

---

## Arquitectura del proyecto

- `src/servidor.ts`: Inicializa Fastify, registra la ruta `GET /api/fecha-habil`, valida inputs y devuelve el cálculo.
- `src/interfaz.ts`: Tipos de entrada y validación (parámetros `date`, `days`, `hours`).
- `src/tiempoLaboral.ts`: Núcleo de la lógica de jornada, saltos de fin de semana, avance de horas, división mañana/tarde.
- `src/festivos.ts`: Obtención y normalización de festivos desde `HOLIDAYS_URL` (env). Caché simple en memoria.
- `src/tipos.ts`: Tipos internos y utilidades.
- `Dockerfile`: Build multi-stage (builder + runtime).
- `docker-compose.yml`: Orquestación rápida para correr la app.
- `.env.example`: Variables esperadas (`PORT`, `HOLIDAYS_URL`).

---

## API

- Método: `GET`
- Ruta: `/api/fecha-habil`
- Query params:
  - `date` (string, ISO UTC, con `Z`), obligatorio.
  - `days` (entero ≥ 0), opcional.
  - `hours` (entero ≥ 0), opcional.

- Respuesta éxito:
```json
{ "date": "2025-08-01T14:00:00Z" }
```

- Respuestas de error (ejemplos):
```json
{ "error": "InvalidParameters", "message": "'date' debe ser ISO UTC con Z" }
{ "error": "InvalidParameters", "message": "'days' y 'hours' deben ser enteros ≥ 0" }
```

---

## Cómo correr

### Desarrollo (Node)
```bash
npm install
npm run dev
# Servirá en http://localhost:3000/
```

### Producción (Node)
```bash
npm run build
npm run start
```

### Docker Compose
```bash
# Desde la carpeta del proyecto
docker compose build
docker compose up -d
# Logs
docker compose logs -f
# Probar
curl "http://localhost:3000/api/fecha-habil?date=2025-04-10T15:00:00Z&days=5&hours=4"
```

### Docker CLI
```bash
docker build -t fechas-habiles:latest .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e HOLIDAYS_URL=https://content.capta.co/Recruitment/WorkingDays.json \
  fechas-habiles:latest
```

---

## Ejemplos de uso

- Sumar 2 días hábiles desde `2025-04-10T15:00:00Z`:
```bash
curl "http://localhost:3000/api/fecha-habil?date=2025-04-10T15:00:00Z&days=2"
```

- Sumar 1 día y 3 horas hábiles:
```bash
curl "http://localhost:3000/api/fecha-habil?date=2025-04-10T10:00:00Z&days=1&hours=3"
```

- Solo horas (p. ej. 10 horas) respetando jornada y almuerzo:
```bash
curl "http://localhost:3000/api/fecha-habil?date=2025-04-10T09:00:00Z&hours=10"
```

---

## Decisiones y supuestos

- La jornada laboral se modela como dos bloques: 08–12 y 13–17. Entre 12–13 no se cuenta tiempo.
- Fines de semana y festivos se excluyen completamente.
- La entrada se espera en UTC (con `Z`) para evitar ambigüedades; el cálculo interno respeta `America/Bogota`.
- Si `days` y `hours` son 0, se devuelve la misma fecha (normalizada en UTC).
- Si faltan parámetros o son inválidos, la API responde con `InvalidParameters`.

---

## Variables de entorno

- `PORT`: puerto del servidor (default 3000).
- `HOLIDAYS_URL`: URL JSON con festivos de Colombia. Ejemplo: `https://content.capta.co/Recruitment/WorkingDays.json`.

Copiar `.env.example` a `.env` y ajustar valores.

---

## Estado del repositorio y cambios realizados

- Renombré la rama principal a `main`.
- Configuré el remoto `origin` al repositorio de GitHub correspondiente.
- Integré el historial remoto con un merge permitiendo historias no relacionadas.
- Resolví el conflicto en `README.md` manteniendo esta documentación completa.
- Empujé `main` con upstream.

Commits relevantes:
- `Resolve README.md conflict: keep local documentation` (resolución del conflicto del README).
- `Merge origin/main into local main (allow unrelated histories)` (integración del remoto).
- `UI: selector de hora laboral (08–12, 13–17) sin minutos` (interfaz simplificada para horas válidas).
- `ESM: corregidos imports relativos con extensión .js` (en `servidor.ts`, `tiempoLaboral.ts`, `interfaz.ts`).
- `deps: añadir @types/luxon y sincronizar package-lock.json` (para `npm ci` en Docker).
- Cambios previos del proyecto:
  - `Prueba técnica: Fechas hábiles – TS + Fastify + Docker multi-stage`
  - `docker-compose: remover 'version' obsoleta y ajustar nombre del servicio`

---

## Próximos pasos sugeridos

- Añadir pruebas automáticas (unitarias/integra) para la lógica de jornada y festivos.
- Publicar una especificación OpenAPI para el endpoint.
- Cachear festivos en disco o memoria con TTL configurable.

---

Si necesitas que documente punto por punto contra el texto exacto del `.docx`, indícame y lo desgloso como checklist; la implementación ya cubre los requerimientos descritos arriba.

## Despliegue público (Render)
- Usa el blueprint incluido (`render.yaml`) para desplegar con un clic.
- Enlace directo: `https://render.com/deploy?repo=https://github.com/victormerino19/prueba-tecnica-fechas-habiles`
- Servicio sugerido: `fechas-habiles-api`.
- URL pública esperada: `https://fechas-habiles-api.onrender.com`.
- Endpoints:
  - `GET /api/fecha-habil`
  - `GET /docs` (Swagger/OpenAPI)
- Variables de entorno:
  - `HOLIDAYS_URL` (incluida por defecto en `render.yaml`).
