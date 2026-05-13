/**
 * CNEL EP – Portal Arriendo de Infraestructura
 * Lógica compartida de UI + Seguridad
 */
'use strict';

/* ─── Seguridad: CSP dinámico + encabezados de seguridad vía meta ─── */
(function applySecurityHeaders() {
  // Prevenir clickjacking básico (para páginas standalone)
  if (window.self !== window.top) {
    // Permitir solo si es el mismo origen
    try {
      if (window.top.location.hostname !== window.location.hostname) {
        document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Acceso no autorizado.</p>';
        return;
      }
    } catch(e) {
      document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Acceso no autorizado.</p>';
      return;
    }
  }
})();

/* ─── Sanitización de entradas ─── */
const Sanitize = {
  /**
   * Escapa caracteres HTML peligrosos
   */
  html(str) {
    if (typeof str !== 'string') return '';
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#x27;', '/':'&#x2F;' };
    return str.replace(/[&<>"'/]/g, m => map[m]);
  },
  /**
   * Limpia texto: elimina scripts, solo permite caracteres seguros
   */
  text(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '')
              .trim();
  },
  /**
   * Valida RUC ecuatoriano (13 dígitos)
   */
  ruc(val) {
    return /^\d{13}$/.test(val.trim());
  },
  /**
   * Valida cédula ecuatoriana (10 dígitos)
   */
  cedula(val) {
    val = val.trim();
    if (!/^\d{10}$/.test(val)) return false;
    const provincia = parseInt(val.substring(0, 2));
    if (provincia < 1 || provincia > 24) return false;
    const d = val.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let n = d[i];
      if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return (10 - (sum % 10)) % 10 === d[9];
  },
  /**
   * Valida email básico
   */
  email(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
  },
  /**
   * Valida teléfono ecuatoriano (9-10 dígitos)
   */
  telefono(val) {
    return /^(\+593|0)?[0-9]{9,10}$/.test(val.replace(/\s/g,''));
  }
};

/* ─── Navbar: toggle responsive ─── */
function initNavbar() {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.querySelector('.navbar-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    nav.setAttribute('aria-hidden', !open);
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Marcar enlace activo
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || href === `./${currentPage}`) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

/* ─── Toast / Notificaciones ─── */
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('role', 'status');
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  },
  show(msg, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || icons.info}</span><span>${Sanitize.html(msg)}</span>`;
    this.container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastIn .3s ease reverse';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }
};

/* ─── Modal ─── */
const Modal = {
  open(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
  },
  init() {
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
      });
    });
  }
};

/* ─── Validación de formularios ─── */
const FormValidator = {
  rules: {},

  /**
   * Registra reglas de validación para un campo
   * @param {string} name - name del campo
   * @param {Object} rule - { required, minLength, pattern, custom, message }
   */
  addRule(name, rule) {
    this.rules[name] = rule;
  },

  /**
   * Valida un campo individual
   */
  validateField(input) {
    const name  = input.name || input.id;
    const value = input.value;
    const rule  = this.rules[name];
    const errorEl = document.getElementById(`err-${name}`);

    let valid = true;
    let msg   = '';

    if (rule) {
      if (rule.required && !value.trim()) {
        valid = false; msg = rule.message || 'Este campo es requerido.';
      } else if (value.trim() && rule.minLength && value.trim().length < rule.minLength) {
        valid = false; msg = `Mínimo ${rule.minLength} caracteres.`;
      } else if (value.trim() && rule.pattern && !rule.pattern.test(value.trim())) {
        valid = false; msg = rule.message || 'Formato inválido.';
      } else if (value.trim() && rule.custom && !rule.custom(value.trim())) {
        valid = false; msg = rule.message || 'Valor inválido.';
      }
    }

    input.classList.toggle('error', !valid);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.toggle('show', !valid);
    }
    return valid;
  },

  /**
   * Valida todo el formulario
   */
  validateForm(form) {
    let allValid = true;
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(inp => {
      if (!this.validateField(inp)) allValid = false;
    });
    return allValid;
  },

  /**
   * Adjunta listeners de validación en tiempo real
   */
  attachListeners(form) {
    form.querySelectorAll('input, select, textarea').forEach(inp => {
      inp.addEventListener('blur',  () => this.validateField(inp));
      inp.addEventListener('input', () => {
        if (inp.classList.contains('error')) this.validateField(inp);
      });
    });
  }
};

/* ─── Rate limiting básico en localStorage ─── */
const RateLimit = {
  check(key, max = 5, windowMs = 60000) {
    const now  = Date.now();
    const data = JSON.parse(localStorage.getItem(`rl_${key}`) || '{"count":0,"start":0}');
    if (now - data.start > windowMs) {
      data.count = 0; data.start = now;
    }
    data.count++;
    localStorage.setItem(`rl_${key}`, JSON.stringify(data));
    return data.count <= max;
  }
};

/* ─── Generador de documentos Word (HTML → .doc) ─── */
const DocGenerator = {
  /**
   * Genera y descarga un archivo .doc compatible con Word
   * @param {string} htmlContent - HTML con el contenido del documento
   * @param {string} filename    - Nombre del archivo sin extensión
   */
  downloadWord(htmlContent, filename = 'documento') {
    const safeHtml = htmlContent; // el HTML ya es generado internamente
    const blob = new Blob([`
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${Sanitize.html(filename)}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; margin: 2cm; color: #000; }
          h1 { font-size: 14pt; text-align: center; }
          h2 { font-size: 12pt; margin-top: 16pt; }
          table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
          th { background: #002855; color: white; padding: 6pt; font-size: 10pt; text-align: left; }
          td { border: 1px solid #ccc; padding: 5pt; font-size: 10pt; }
          p { margin: 4pt 0; line-height: 1.5; }
          ul { margin: 4pt 0 4pt 16pt; }
          li { margin: 2pt 0; }
          .firma { margin-top: 48pt; }
          .linea { border-top: 1px solid #000; width: 220pt; margin-top: 36pt; }
        </style>
      </head>
      <body>${safeHtml}</body>
      </html>
    `], { type: 'application/msword' });
    this._download(blob, `${filename}.doc`);
  },

  /**
   * Descarga disparador genérico
   */
  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
};

/* ─── Generador de PDF vía jsPDF ─── */
const PdfGenerator = {
  /**
   * Descarga PDF usando jsPDF (debe estar cargado en la página)
   */
  async downloadPDF(contenido, filename = 'documento') {
    if (typeof window.jspdf === 'undefined') {
      Toast.show('Cargando generador de PDF...', 'info');
      await this._loadJsPDF();
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW  = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxW   = pageW - margin * 2;
    let y        = 20;
    const lineH  = 6;

    // Encabezado institucional
    doc.setFillColor(0, 40, 85);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('CNEL EP', margin, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Corporación Nacional de Electricidad', margin, 18);
    doc.text('Portal de Arrendamiento de Infraestructura', margin, 23);
    y = 40;

    doc.setTextColor(0, 0, 0);

    // Renderizar líneas
    contenido.forEach(block => {
      if (y > 265) { doc.addPage(); y = 20; }

      if (block.type === 'title') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(0, 40, 85);
        const lines = doc.splitTextToSize(block.text, maxW);
        doc.text(lines, margin, y);
        y += lines.length * 7 + 4;
        doc.setDrawColor(232, 160, 0);
        doc.setLineWidth(.5);
        doc.line(margin, y, margin + 60, y);
        y += 6;
      } else if (block.type === 'heading') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 40, 85);
        y += 4;
        const lines = doc.splitTextToSize(block.text, maxW);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 3;
      } else if (block.type === 'subheading') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 74, 153);
        const lines = doc.splitTextToSize(block.text, maxW);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 2;
      } else if (block.type === 'text') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(block.text, maxW);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 2;
      } else if (block.type === 'bullet') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const bullet = `  •  ${block.text}`;
        const lines  = doc.splitTextToSize(bullet, maxW - 4);
        doc.text(lines, margin, y);
        y += lines.length * lineH + 1;
      } else if (block.type === 'spacer') {
        y += block.size || 4;
      } else if (block.type === 'table') {
        y = this._drawTable(doc, block, margin, y, maxW);
        y += 6;
      } else if (block.type === 'signature') {
        y += 20;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(.3);
        doc.line(margin, y, margin + 80, y);
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(block.name || '', margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.text(block.role || '', margin, y);
        y += 4;
        doc.text(block.company || '', margin, y);
        y += 8;
      }
    });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pageCount}`, pageW - margin, 290, { align: 'right' });
      doc.text('CNEL EP – Portal de Arrendamiento de Infraestructura', margin, 290);
    }

    doc.save(`${filename}.pdf`);
  },

  _drawTable(doc, block, x, y, maxW) {
    const cols   = block.headers.length;
    const colW   = maxW / cols;
    const rowH   = 8;

    // Encabezado
    doc.setFillColor(0, 40, 85);
    doc.rect(x, y, maxW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    block.headers.forEach((h, i) => {
      doc.text(h, x + colW * i + 3, y + 5.5);
    });
    y += rowH;

    // Filas
    block.rows.forEach((row, ri) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFillColor(ri % 2 === 0 ? 247 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 255 : 255);
      doc.rect(x, y, maxW, rowH, 'F');
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(.2);
      doc.rect(x, y, maxW, rowH, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      row.forEach((cell, i) => {
        const cellText = doc.splitTextToSize(String(cell || ''), colW - 4);
        doc.text(cellText, x + colW * i + 3, y + 5.5);
      });
      y += rowH;
    });
    return y;
  },

  async _loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
};

/* ─── Accordion ─── */
function initAccordions() {
  document.querySelectorAll('.req-cat-header').forEach(header => {
    header.addEventListener('click', () => {
      const cat = header.closest('.req-category');
      const isOpen = cat.classList.contains('open');
      // Cerrar todos
      document.querySelectorAll('.req-category.open').forEach(c => c.classList.remove('open'));
      // Abrir este si estaba cerrado
      if (!isOpen) cat.classList.add('open');
    });
  });
}

/* ─── Animaciones al hacer scroll ─── */
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .1 });

  document.querySelectorAll('.animate-in').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}

/* ─── Tabla dinámica de rutas en formularios ─── */
function createRouteTable(containerId, addBtnId, maxRows = 20) {
  const tbody  = document.querySelector(`#${containerId} tbody`);
  const addBtn = document.getElementById(addBtnId);
  if (!tbody || !addBtn) return;

  let rowCount = 0;

  function addRow(data = {}) {
    if (rowCount >= maxRows) {
      Toast.show(`Máximo ${maxRows} rutas permitidas.`, 'warning');
      return;
    }
    rowCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" name="ruta_provincia_${rowCount}" placeholder="Ej: Guayas" maxlength="80"></td>
      <td><input type="text" name="ruta_enlace_${rowCount}"   placeholder="Enlace A-B" maxlength="120"></td>
      <td><input type="number" name="ruta_pos_exist_${rowCount}" placeholder="0" min="0" max="99999"></td>
      <td><input type="number" name="ruta_pos_new_${rowCount}"   placeholder="0" min="0" max="99999"></td>
      <td><input type="number" name="ruta_pos_tot_${rowCount}"   placeholder="0" min="0" max="99999" readonly style="background:#EEF4FF"></td>
      <td><button type="button" class="btn-icon" title="Eliminar fila" aria-label="Eliminar fila">✕</button></td>
    `;
    // Auto-calcular total
    const exist = tr.querySelector(`[name="ruta_pos_exist_${rowCount}"]`);
    const nuevo = tr.querySelector(`[name="ruta_pos_new_${rowCount}"]`);
    const total = tr.querySelector(`[name="ruta_pos_tot_${rowCount}"]`);
    function calcTotal() {
      total.value = (parseInt(exist.value)||0) + (parseInt(nuevo.value)||0);
    }
    exist.addEventListener('input', calcTotal);
    nuevo.addEventListener('input', calcTotal);

    tr.querySelector('.btn-icon').addEventListener('click', () => {
      tr.remove(); rowCount--;
    });

    // Precarga
    if (data.provincia) tr.querySelector(`[name="ruta_provincia_${rowCount}"]`).value = data.provincia;

    tbody.appendChild(tr);
  }

  addBtn.addEventListener('click', () => addRow());
  addRow(); // fila inicial
}

/* ─── Tabla dinámica de personal técnico ─── */
function createPersonnelTable(containerId, addBtnId, maxRows = 15) {
  const tbody  = document.querySelector(`#${containerId} tbody`);
  const addBtn = document.getElementById(addBtnId);
  if (!tbody || !addBtn) return;

  let rowCount = 0;
  function addRow() {
    if (rowCount >= maxRows) return;
    rowCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select name="pers_funcion_${rowCount}" style="min-width:130px">
          <option value="">Seleccione...</option>
          <option>Representante Legal</option>
          <option>Responsable Técnico</option>
          <option>Coordinador de Campo</option>
          <option>Contratista</option>
          <option>Técnico de Zona</option>
        </select>
      </td>
      <td><input type="text"  name="pers_nombre_${rowCount}"  placeholder="Nombre completo"    maxlength="100"></td>
      <td><input type="tel"   name="pers_tel_${rowCount}"     placeholder="0999999999"          maxlength="15"></td>
      <td><input type="email" name="pers_email_${rowCount}"   placeholder="correo@empresa.com"  maxlength="120"></td>
      <td><button type="button" class="btn-icon" title="Eliminar" aria-label="Eliminar fila">✕</button></td>
    `;
    tr.querySelector('.btn-icon').addEventListener('click', () => { tr.remove(); rowCount--; });
    tbody.appendChild(tr);
  }

  addBtn.addEventListener('click', addRow);
  addRow();
}

/* ─── Formatear fecha española ─── */
function formatDateES(dateStr) {
  if (!dateStr) return '[fecha]';
  const d = new Date(dateStr + 'T00:00:00');
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

/* ─── Obtener valor de formulario sanitizado ─── */
function getVal(id, form) {
  const el = form ? form.querySelector(`#${id}, [name="${id}"]`) : document.getElementById(id) || document.querySelector(`[name="${id}"]`);
  return el ? Sanitize.text(el.value) : '';
}

/* ─── Init global ─── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initAccordions();
  initScrollAnimations();
  Modal.init();
});

// Exportar para uso en páginas
window.CNEL = { Sanitize, Toast, Modal, DocGenerator, PdfGenerator, FormValidator, RateLimit, createRouteTable, createPersonnelTable, formatDateES, getVal };
