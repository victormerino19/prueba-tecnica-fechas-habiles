export function construirHtmlInterfaz(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prueba: Fechas hábiles</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      h1 { margin-top: 0; }
      label { display: block; margin: 0.5rem 0 0.25rem; }
      input, select { padding: 0.4rem; }
      .fila { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
      .col { min-width: 14rem; }
      .ancho { width: 22rem; max-width: 100%; }
      button { padding: 0.5rem 0.8rem; cursor: pointer; }
      .acciones { margin-top: 1rem; display: flex; gap: 0.75rem; }
      pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow: auto; }
      .nota { color: #555; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <h1>Prueba técnica: Fechas hábiles</h1>
    <p class="nota">Esta interfaz prueba el endpoint <code>/api/fecha-habil</code> respetando zona "America/Bogota", horario laboral (08:00–12:00, 13:00–17:00), fines de semana y festivos. El parámetro <code>date</code> se enviará en UTC con sufijo <code>Z</code>.</p>

    <div class="fila">
      <div class="col">
        <label for="fechaLocal">Calendario (fecha local):</label>
        <input id="fechaLocal" type="date" class="ancho" />
      </div>
      <div class="col">
        <label for="horaLocal">Hora (laboral):</label>
        <select id="horaLocal" class="ancho">
          <option value="" selected>-- elige hora --</option>
          <option value="08:00">08:00</option>
          <option value="09:00">09:00</option>
          <option value="10:00">10:00</option>
          <option value="11:00">11:00</option>
          <option value="12:00">12:00</option>
          <option value="13:00">13:00</option>
          <option value="14:00">14:00</option>
          <option value="15:00">15:00</option>
          <option value="16:00">16:00</option>
          <option value="17:00">17:00</option>
        </select>
      </div>
      <div class="col">
        <label for="date">Fecha base (UTC ISO con Z):</label>
        <input id="date" type="text" class="ancho" placeholder="YYYY-MM-DDTHH:mm:ssZ" />
      </div>
    </div>

    <div class="fila">
      <div class="col">
        <label for="days">Días hábiles a sumar:</label>
        <input id="days" type="number" min="1" step="1" class="ancho" />
      </div>
      <div class="col">
        <label for="hours">Horas hábiles a sumar:</label>
        <input id="hours" type="number" min="1" step="1" class="ancho" />
      </div>
    </div>

    <div class="acciones">
      <button id="btn-calcular">Calcular</button>
      <button id="btn-ejemplo">Usar ejemplo</button>
      <button id="btn-limpiar">Limpiar</button>
    </div>

    <h2>Resultado</h2>
    <pre id="resultado">(sin ejecutar)</pre>

    <script type="module">
      const $ = (id) => document.getElementById(id);
      const mostrar = (obj) => {
        document.getElementById('resultado').textContent = JSON.stringify(obj, null, 2);
      };

      function isoUtcDesdeLocalPickers() {
        const f = document.getElementById('fechaLocal').value; // YYYY-MM-DD
        const h = document.getElementById('horaLocal').value;  // HH:mm seleccionado
        if (!f || !h) return null;
        const d = new Date(f + 'T' + h + ':00'); // local time
        return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); // sin milisegundos
      }

      function construirQuery() {
        const p = new URLSearchParams();
        const datePickerIso = isoUtcDesdeLocalPickers();
        const dateText = document.getElementById('date').value.trim();
        const days = document.getElementById('days').value.trim();
        const hours = document.getElementById('hours').value.trim();
        const dateFinal = datePickerIso || dateText;
        if (dateFinal) p.set('date', dateFinal);
        if (days) p.set('days', String(Number(days)));
        if (hours) p.set('hours', String(Number(hours)));
        return p.toString();
      }

      async function calcular() {
        try {
          const qs = construirQuery();
          if (!qs.includes('days') && !qs.includes('hours')) {
            mostrar({ error: 'InvalidParameters', message: "Debe enviarse al menos 'days' o 'hours'." });
            return;
          }
          const url = '/api/fecha-habil?' + qs;
          const res = await fetch(url);

          // Si la respuesta no es JSON, mostrarla como texto
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            mostrar({ status: res.status, error: 'InvalidResponse', message: text });
            return;
          }

          const cuerpo = await res.json();
          mostrar(res.ok ? cuerpo : { status: res.status, ...cuerpo });
        } catch (e) {
          mostrar({ error: 'UpstreamUnavailable', message: String(e) });
        }
      }

      function formatoHoraLaboral(d) {
        const h = d.getHours();
        if (h < 8) return '08:00';
        if (h > 17) return '17:00';
        if (h === 12) return '12:00';
        if ((h >= 8 && h <= 12) || (h >= 13 && h <= 17)) return String(h).padStart(2,'0') + ':00';
        return '13:00';
      }

      function formatoFechaInput(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const dia = String(d.getDate()).padStart(2,'0');
        return y + '-' + m + '-' + dia;
      }

      function usarEjemplo() {
        const d = new Date('2025-04-10T15:00:00Z');
        document.getElementById('fechaLocal').value = formatoFechaInput(d);
        document.getElementById('horaLocal').value = formatoHoraLaboral(d); // 15:00
        document.getElementById('date').value = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        document.getElementById('days').value = '5';
        document.getElementById('hours').value = '4';
      }

      function limpiar() {
        document.getElementById('fechaLocal').value = '';
        document.getElementById('horaLocal').value = '';
        document.getElementById('date').value = '';
        document.getElementById('days').value = '';
        document.getElementById('hours').value = '';
        document.getElementById('resultado').textContent = '(sin ejecutar)';
      }

      function sincronizarIsoTexto() {
        const iso = isoUtcDesdeLocalPickers();
        if (iso) document.getElementById('date').value = iso;
      }

      document.getElementById('btn-calcular').addEventListener('click', calcular);
      document.getElementById('btn-ejemplo').addEventListener('click', usarEjemplo);
      document.getElementById('btn-limpiar').addEventListener('click', limpiar);
      document.getElementById('fechaLocal').addEventListener('change', sincronizarIsoTexto);
      document.getElementById('horaLocal').addEventListener('change', sincronizarIsoTexto);
    </script>
  </body>
</html>`;
}