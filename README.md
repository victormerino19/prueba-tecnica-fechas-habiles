# Prueba técnica: Fechas hábiles (TypeScript + Fastify)

API REST que suma días/horas hábiles en Colombia (America/Bogota), excluye fines de semana y festivos, respeta horario laboral (08:00–12:00, 13:00–17:00) y retorna resultado en UTC.

## Scripts
- `npm run dev`: desarrollo con recarga
- `npm run build` y `npm run start`: producción

## Ejecutar (Node)
```bash
npm install
npm run dev
```

## Ejecutar (Docker)
La imagen se construye con un Dockerfile multi-stage que compila TypeScript en la etapa `builder` y usa solo dependencias de producción en `runtime`.

Con Docker Compose:
```bash
# Desde la carpeta del proyecto
docker compose build
docker compose up -d
# Ver logs
docker compose logs -f
# Probar
curl "http://localhost:3000/api/fecha-habil?date=2025-04-10T15:00:00Z&days=5&hours=4"
```

Con Docker CLI:
```bash
# Construir
docker build -t fechas-habiles:latest .
# Ejecutar
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e HOLIDAYS_URL=https://content.capta.co/Recruitment/WorkingDays.json \
  fechas-habiles:latest
```

## Endpoint
GET `/api/fecha-habil` con query:
- `days`: entero positivo opcional
- `hours`: entero positivo opcional
- `date`: ISO UTC con sufijo `Z` opcional

Respuestas:
- Éxito: `{ "date": "2025-08-01T14:00:00Z" }`
- Error: `{ "error": "InvalidParameters", "message": "Detalle" }`
