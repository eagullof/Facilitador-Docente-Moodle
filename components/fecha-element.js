class FechaElement extends HTMLElement {
  connectedCallback() {
    const prefix = this.getAttribute("name-prefix") || "";

    // Años y minutos por defecto se pueden parametrizar
    const fecha = new Date();
    const thisYear = String(fecha.getFullYear());
    const yearsAttr = this.getAttribute("years") || "2025,2026,2027,2028";
    const years = yearsAttr.split(",");
    const defaultYear = this.getAttribute("default-year") || thisYear;

    const defaultMonth = fecha.getMonth() + 1 || 1;
    const defaultDay = fecha.getDate() || 1;
    const defaultHour = Number(this.getAttribute("default-hour")) || 9;

    const minutesAttr = this.getAttribute("minutes") || "0,15,30,45,59";
    const minutes = minutesAttr.split(",");
    const defaultMinute = Number(this.getAttribute("default-minute")) || 0;

    const meses = [
      "01 - Enero", 
      "02 - Febrero", 
      "03 - Marzo", 
      "04 - Abril", 
      "05 - Mayo", 
      "06 - Junio",
      "07 - Julio", 
      "08 - Agosto", 
      "09 - Septiembre", 
      "10 - Octubre", 
      "11 - Noviembre", 
      "12 - Diciembre"
    ];

    const dayOptions = Array.from({ length: 31 }, (_, i) => {
      const d = i + 1;
      return `<option value="${d}" ${d == defaultDay ? "selected" : ""}>${d}</option>`;
    }).join("");

    const monthOptions = meses.map((mes, i) => {
      const val = i + 1;
      return `<option value="${val}" ${val == defaultMonth ? "selected" : ""}>${mes}</option>`;
    }).join("");

    const yearOptions = years.map(y => `
      <option value="${y}" ${y == defaultYear ? "selected" : ""}>${y}</option>
    `).join("");

    const hourOptions = Array.from({ length: 24 }, (_, i) => {
      const txt = String(i).padStart(2, defaultHour);
      return `<option value="${i}" ${i == defaultHour ? "selected" : ""}>${i}</option>`;
    }).join("");

    const minuteOptions = minutes.map(m => `
      <option value="${m}" ${m == defaultMinute ? "selected" : ""}>
        ${String(m).padStart(2, "0")}
      </option>
    `).join("");

    this.innerHTML = `
      <div class="d-flex flex-wrap gap-1 mb-3">
        <select class="form-select w-auto"
                id="${prefix}-dia"
                name="${prefix}-dia"
                data-part="dia">
          <option disabled selected>Día</option>
          ${dayOptions}
        </select>

        <select class="form-select w-auto"
                id="${prefix}-mes"
                name="${prefix}-mes"
                data-part="mes">
          <option disabled selected>Mes</option>
          ${monthOptions}
        </select>

        <select class="form-select w-auto"
                id="${prefix}-anio"
                name="${prefix}-anio"
                data-part="anio">
          <option disabled>Año</option>
          ${yearOptions}
        </select>

        <select class="form-select w-auto"
                id="${prefix}-hora"
                name="${prefix}-hora"
                data-part="hora">
          <option disabled selected>Hora</option>
          ${hourOptions}
        </select>

        <select class="form-select w-auto"
                id="${prefix}-minuto"
                name="${prefix}-minuto"
                data-part="minuto">
          <option disabled>Minuto</option>
          ${minuteOptions}
        </select>
      </div>
    `;
  }

  // Propiedad para obtener la fecha/hora en formato ISO sencillo
  get value() {
    const get = part => this.querySelector(`[data-part="${part}"]`)?.value || null;

    const dia = get("dia");
    const mes = get("mes");
    const anio = get("anio");
    const hora = get("hora");
    const minuto = get("minuto");

    if (!dia || !mes || !anio || !hora || !minuto) {
      return null;
    }

    const d = String(dia).padStart(2, "0");
    const m = String(mes).padStart(2, "0");
    const h = String(hora).padStart(2, "0");
    const min = String(minuto).padStart(2, "0");

    // Ejemplo: "2025-03-15T08:30:00"
    return `${anio}-${m}-${d}T${h}:${min}:00`;
  }
}

customElements.define("fecha-element", FechaElement);
