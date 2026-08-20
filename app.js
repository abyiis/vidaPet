/* =========================================================
   VIDAPET · APP.JS
   Capa de UI: mapea los formularios/botones/tablas del HTML
   a los métodos de VidaPetStore (store.js) y renderiza el DOM.
   No contiene lógica de persistencia: eso vive en store.js.
   ========================================================= */

const db = new VidaPetStore('vidapet');

/* Preferencias de UI que no son datos de negocio (tema, mascota
   activa, notificaciones) se guardan aparte, fuera del store de datos. */
const UI_KEY = 'vidapet_ui_prefs';
function loadUiPrefs(){
  try{ return Object.assign({ theme:'light', notificaciones:true, selectedPetId:null }, JSON.parse(localStorage.getItem(UI_KEY)) || {}); }
  catch(e){ return { theme:'light', notificaciones:true, selectedPetId:null }; }
}
function saveUiPrefs(){ localStorage.setItem(UI_KEY, JSON.stringify(ui)); }
let ui = loadUiPrefs();

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOWS = ['D','L','M','M','J','V','S'];

/* ---------------------------------------------------------
   1) NAVEGACIÓN SPA (sin recarga de página)
   --------------------------------------------------------- */
function goTo(viewName){
  document.querySelectorAll('.vp-view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.querySelectorAll('.vp-nav-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.target === viewName);
  });

  if(viewName === 'mascotas') renderMascotas();
  if(viewName === 'agenda') renderAgenda();
  if(viewName === 'add-servicio') renderServicios();
  if(viewName === 'historial') renderHistorial();
}
document.querySelectorAll('.vp-nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> goTo(btn.dataset.target));
});

window.addEventListener('DOMContentLoaded', ()=>{
  applyTheme(ui.theme);
  document.getElementById('darkSwitch').checked = (ui.theme === 'dark');
  document.getElementById('notifSwitch').checked = ui.notificaciones;

  if(!ui.selectedPetId){
    const primera = db.getMascotas()[0];
    if(primera) ui.selectedPetId = primera.id;
  }

  setTimeout(()=>{
    document.getElementById('view-splash').classList.remove('active');
    goTo('mascotas');
  }, 2000);
});

/* ---------------------------------------------------------
   2) TOAST + THEME
   --------------------------------------------------------- */
let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('vpToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}
function applyTheme(theme){ document.documentElement.setAttribute('data-bs-theme', theme); ui.theme = theme; }
function toggleDarkMode(isDark){ applyTheme(isDark?'dark':'light'); saveUiPrefs(); showToast(isDark?'Modo oscuro activado':'Modo claro activado'); }
function toggleNotificaciones(checked){ ui.notificaciones = checked; saveUiPrefs(); showToast(checked?'Notificaciones activadas':'Notificaciones desactivadas'); }
function modalOf(id){ return bootstrap.Modal.getOrCreateInstance(document.getElementById(id)); }

/* ---------------------------------------------------------
   3) VISTA: MASCOTAS
   --------------------------------------------------------- */
function initials(name){ return (name||'?').trim().charAt(0).toUpperCase(); }

function renderMascotas(){
  const mascotas = db.getMascotas();
  const row = document.getElementById('petsAvatarRow');
  const empty = document.getElementById('mascotasEmptyState');
  row.innerHTML = '';

  mascotas.forEach(pet=>{
    const col = document.createElement('div');
    col.className = 'text-center';
    col.innerHTML = `
      <div class="vp-pet-avatar ${pet.id===ui.selectedPetId?'selected':''}" data-select-pet="${pet.id}">
        ${pet.foto ? `<img src="${pet.foto}" alt="${pet.nombre}">` : initials(pet.nombre)}
      </div>
      <div class="vp-pet-name">${pet.nombre}</div>
      <div class="vp-pet-breed">${pet.raza || pet.especie}</div>`;
    row.appendChild(col);
  });

  const addCol = document.createElement('div');
  addCol.className = 'text-center';
  addCol.innerHTML = `
    <button class="vp-add-avatar" onclick="goTo('add-mascota')" aria-label="Añadir mascota"><i class="bi bi-plus-lg"></i></button>
    <div class="vp-pet-name">&nbsp;</div>`;
  row.appendChild(addCol);

  row.querySelectorAll('[data-select-pet]').forEach(el=>{
    el.addEventListener('click', ()=> selectPet(el.dataset.selectPet));
  });

  empty.innerHTML = mascotas.length === 0
    ? `<div class="vp-empty mb-3"><i class="bi bi-heart"></i><p>Aún no tienes mascotas registradas.<br>Toca "+" para añadir la primera.</p></div>`
    : '';

  ['btnEliminarMascota','btnReagendar','btnCancelar','btnNota'].forEach(id=>{
    document.getElementById(id).disabled = mascotas.length === 0;
  });
}

function selectPet(id){ ui.selectedPetId = id; saveUiPrefs(); renderMascotas(); }

function eliminarMascotaSeleccionada(){
  const mascotas = db.getMascotas();
  if(mascotas.length === 0){ showToast('No hay mascotas para eliminar'); return; }
  const pet = db.getMascota(ui.selectedPetId) || mascotas[0];
  document.getElementById('deletePetMsg').textContent = `¿Eliminar a ${pet.nombre}? Esta acción no se puede deshacer.`;

  document.getElementById('btnConfirmDeletePet').onclick = ()=>{
    db.deleteMascota(pet.id); // el store hace el log + borra sus citas en cascada
    const restantes = db.getMascotas();
    ui.selectedPetId = restantes.length ? restantes[0].id : null;
    saveUiPrefs();
    renderMascotas();
    modalOf('modalConfirmDeletePet').hide();
    showToast(`${pet.nombre} fue eliminado`);
  };
  modalOf('modalConfirmDeletePet').show();
}

/* "Re agendar" / "Cancelar" desde Mascotas → lista de citas de la mascota activa */
function irReagendar(){ abrirSelectorDeCita('reagendar'); }
function irCancelar(){ abrirSelectorDeCita('cancelar'); }

function abrirSelectorDeCita(modo){
  const pet = db.getMascota(ui.selectedPetId) || db.getMascotas()[0];
  if(!pet){ showToast('No hay mascotas registradas'); return; }

  const citasPet = db.getCitasPorMascota(pet.id)
    .filter(c => c.estado !== 'cancelada')
    .sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));

  document.getElementById('pickEventTitle').textContent =
    modo === 'reagendar' ? `Reagendar cita de ${pet.nombre}` : `Cancelar cita de ${pet.nombre}`;

  const list = document.getElementById('pickEventList');
  if(citasPet.length === 0){
    list.innerHTML = `<div class="vp-empty"><i class="bi bi-calendar-x"></i><p>${pet.nombre} no tiene citas agendadas.</p></div>`;
  } else {
    list.innerHTML = citasPet.map(c => eventCardHTML(c)).join('');
    list.querySelectorAll('[data-event-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        modalOf('modalPickEvent').hide();
        openEventActionModal(btn.dataset.eventId, modo);
      });
    });
  }
  modalOf('modalPickEvent').show();
}

/* ---------------------------------------------------------
   4) VISTA: AÑADIR MASCOTA
   --------------------------------------------------------- */
let pendingPetPhoto = null;

function handlePetPhoto(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    pendingPetPhoto = e.target.result;
    document.getElementById('petPhotoPreview').innerHTML =
      `<img src="${pendingPetPhoto}" alt="foto mascota"><span class="vp-upload-badge"><i class="bi bi-check"></i></span>`;
  };
  reader.readAsDataURL(file);
}

document.getElementById('formAddPet').addEventListener('submit', function(e){
  e.preventDefault();
  const nombre = document.getElementById('petNombre').value.trim();
  if(!nombre){ showToast('Ingresa el nombre de la mascota'); return; }

  const nuevaMascota = db.addMascota({
    nombre,
    especie: document.getElementById('petEspecie').value,
    raza: document.getElementById('petRaza').value.trim(),
    color: document.getElementById('petColor').value.trim(),
    sexo: document.getElementById('petSexo').value,
    nacimiento: document.getElementById('petNacimiento').value,
    peso: document.getElementById('petPeso').value,
    altura: document.getElementById('petAltura').value,
    comentarios: document.getElementById('petComentarios').value.trim(),
    foto: pendingPetPhoto
  });

  ui.selectedPetId = nuevaMascota.id;
  saveUiPrefs();

  this.reset();
  pendingPetPhoto = null;
  document.getElementById('petPhotoPreview').innerHTML = `<i class="bi bi-camera-fill"></i><span class="vp-upload-badge"><i class="bi bi-check"></i></span>`;

  showToast(`${nombre} fue añadido con éxito`);
  goTo('agenda');
});

/* ---------------------------------------------------------
   5) VISTA: AGENDA (calendario + citas)
   --------------------------------------------------------- */
let calDate = new Date();
function pad(n){ return String(n).padStart(2,'0'); }

function renderAgenda(){
  const pet = db.getMascota(ui.selectedPetId) || db.getMascotas()[0];
  const infoBox = document.getElementById('agendaPetInfo');

  if(pet){
    const opciones = db.getMascotas().map(p=>`<option value="${p.id}" ${p.id===pet.id?'selected':''}>${p.nombre}</option>`).join('');
    infoBox.innerHTML = `
      <div class="vp-mini-avatar">${pet.foto?`<img src="${pet.foto}">`:initials(pet.nombre)}</div>
      <div class="flex-grow-1">
        <div style="font-weight:700;font-size:.9rem;">${pet.nombre}</div>
        <div style="font-size:.68rem;opacity:.8;">${pet.especie} · ${pet.raza||'—'} · ${edadTexto(pet.nacimiento)}</div>
      </div>
      <select id="agendaPetSelect">${opciones}</select>`;
    document.getElementById('agendaPetSelect').addEventListener('change', function(){
      ui.selectedPetId = this.value; saveUiPrefs(); renderAgenda();
    });
  } else {
    infoBox.innerHTML = `<div style="font-size:.85rem;">Añade tu primera mascota para ver su agenda.</div>`;
  }
  renderCalendar();
  renderEventsList();
}

function edadTexto(fechaISO){
  if(!fechaISO) return 'edad desconocida';
  const nac = new Date(fechaISO), hoy = new Date();
  let years = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if(m < 0 || (m===0 && hoy.getDate() < nac.getDate())) years--;
  return years >= 0 ? `${years} años` : '—';
}

function changeMonth(delta){ calDate.setMonth(calDate.getMonth()+delta); renderCalendar(); renderEventsList(); }

function renderCalendar(){
  document.getElementById('calMonthLabel').textContent = `${MESES[calDate.getMonth()]} ${calDate.getFullYear()}`;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  DOWS.forEach(d=>{ const el=document.createElement('div'); el.className='vp-cal-dow'; el.textContent=d; grid.appendChild(el); });

  const year=calDate.getFullYear(), month=calDate.getMonth();
  const firstDow = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const daysInPrevMonth = new Date(year,month,0).getDate();
  const today = new Date();

  const citas = db.getCitas().filter(c => c.estado !== 'cancelada' && (!ui.selectedPetId || c.mascotaId === ui.selectedPetId));
  const eventDays = new Set(citas
    .filter(c=>{ const d=new Date(c.fecha); return d.getFullYear()===year && d.getMonth()===month; })
    .map(c=> new Date(c.fecha).getDate()));

  for(let i=firstDow-1;i>=0;i--) grid.appendChild(dayCell(daysInPrevMonth-i, true,false,false));
  for(let d=1; d<=daysInMonth; d++){
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    grid.appendChild(dayCell(d,false,isToday,eventDays.has(d)));
  }
  const trailing = (7 - ((firstDow+daysInMonth)%7))%7;
  for(let d=1; d<=trailing; d++) grid.appendChild(dayCell(d,true,false,false));
}
function dayCell(num,muted,isToday,hasEvent){
  const el=document.createElement('div');
  el.className='vp-cal-day'+(muted?' muted':'')+(isToday?' today':'')+(hasEvent?' has-event':'');
  el.textContent=num;
  return el;
}

function eventTipoMeta(tipo){
  if(tipo==='vacuna') return {icon:'bi-shield-plus', label:'Vacuna'};
  if(tipo==='consulta') return {icon:'bi-clipboard2-pulse', label:'Consulta'};
  return {icon:'bi-capsule', label:'Medicamento'};
}

function eventCardHTML(c){
  const pet = db.getMascota(c.mascotaId);
  const meta = eventTipoMeta(c.tipo);
  const fechaFmt = new Date(c.fecha+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  const estadoTag = c.estado === 'reagendada' ? ' · reagendada' : '';
  return `
    <button class="vp-event-card" data-event-id="${c.id}">
      <div class="vp-event-icon ${c.tipo}"><i class="bi ${meta.icon}"></i></div>
      <div>
        <p class="vp-event-title">${meta.label}: ${c.nombre}</p>
        <p class="vp-event-sub">${c.info || '—'}</p>
        <p class="vp-event-sub">${fechaFmt}${estadoTag}</p>
      </div>
      <span class="vp-event-badge">${pet ? pet.nombre : '—'}</span>
    </button>`;
}

function renderEventsList(){
  const list = document.getElementById('eventsList');
  const citas = db.getCitas()
    .filter(c => c.estado !== 'cancelada' && (!ui.selectedPetId || c.mascotaId === ui.selectedPetId))
    .sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));

  if(citas.length === 0){
    list.innerHTML = `<div class="vp-empty"><i class="bi bi-calendar2-week"></i><p>No hay eventos próximos.<br>Toca "Nueva cita" para agendar uno.</p></div>`;
    return;
  }
  list.innerHTML = citas.map(c => eventCardHTML(c)).join('');
  list.querySelectorAll('[data-event-id]').forEach(btn=>{
    btn.addEventListener('click', ()=> openEventActionModal(btn.dataset.eventId));
  });
}

/* --- Nueva cita --- */
function openNuevaCitaModal(){
  const mascotas = db.getMascotas();
  if(mascotas.length === 0){ showToast('Añade una mascota antes de crear una cita'); return; }
  const select = document.getElementById('citaPet');
  select.innerHTML = mascotas.map(p=>`<option value="${p.id}" ${p.id===ui.selectedPetId?'selected':''}>${p.nombre}</option>`).join('');
  document.getElementById('formNuevaCita').reset();
  select.value = ui.selectedPetId;
  modalOf('modalNuevaCita').show();
}

document.getElementById('formNuevaCita').addEventListener('submit', function(e){
  e.preventDefault();
  const nombre = document.getElementById('citaNombre').value.trim();
  const fecha = document.getElementById('citaFecha').value;
  if(!nombre || !fecha){ showToast('Completa nombre y fecha de la cita'); return; }

  db.addCita({
    mascotaId: document.getElementById('citaPet').value,
    tipo: document.getElementById('citaTipo').value,
    nombre,
    info: document.getElementById('citaInfo').value.trim(),
    fecha
  });

  modalOf('modalNuevaCita').hide();
  renderAgenda();
  showToast('Cita agendada con éxito');
});

/* --- Acciones sobre una cita existente --- */
function openEventActionModal(eventId, forzarModo){
  const cita = db.getCita(eventId);
  if(!cita) return;

  const pet = db.getMascota(cita.mascotaId);
  const meta = eventTipoMeta(cita.tipo);
  const fechaFmt = new Date(cita.fecha+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});

  document.getElementById('eventActionTitle').textContent = `${meta.label}: ${cita.nombre}`;
  document.getElementById('eventActionInfo').textContent = `${pet?pet.nombre:'—'} · ${cita.info||'Sin información adicional'} · Fecha actual: ${fechaFmt}`;

  const box = document.getElementById('eventReagendarBox');
  const fechaInput = document.getElementById('eventNuevaFecha');
  box.classList.add('d-none');
  fechaInput.value = cita.fecha;

  document.getElementById('btnEventReagendar').onclick = ()=>{
    if(box.classList.contains('d-none')){ box.classList.remove('d-none'); return; }
    const nuevaFecha = fechaInput.value;
    if(!nuevaFecha){ showToast('Selecciona una nueva fecha'); return; }
    db.reagendarCita(cita.id, nuevaFecha);
    modalOf('modalEventAction').hide();
    renderAgenda();
    showToast('Cita reagendada con éxito');
  };

  document.getElementById('btnEventCancelar').onclick = ()=>{
    db.cancelarCita(cita.id);
    modalOf('modalEventAction').hide();
    renderAgenda();
    showToast('Cita cancelada');
  };

  modalOf('modalEventAction').show();
  if(forzarModo === 'reagendar') box.classList.remove('d-none');
}

/* ---------------------------------------------------------
   6) VISTA: AÑADIR SERVICIO (stepper + registro en historial)
   --------------------------------------------------------- */
const SERVICES_CATALOG = [
  { key:'medicamentos', nombre:'Medicamentos' },
  { key:'antipulgas', nombre:'Antipulgas' },
  { key:'consultas', nombre:'Consultas' },
  { key:'vacunas', nombre:'Vacunas' },
  { key:'banio', nombre:'Baño y corte de uñas' },
  { key:'pelo', nombre:'Corte de pelo' }
];
let serviceCounts = {};

function renderServicios(){
  const wrap = document.getElementById('serviceListWrap');
  wrap.innerHTML = SERVICES_CATALOG.map(svc=>{
    const count = serviceCounts[svc.key] || 0;
    return `
      <div class="vp-service-row">
        <span class="vp-service-name">${svc.nombre}</span>
        <div class="vp-stepper">
          <button class="vp-step-btn" data-step="${svc.key}" data-delta="-1" ${count===0?'disabled':''}>−</button>
          <span class="vp-step-count">${count}</span>
          <button class="vp-step-btn plus" data-step="${svc.key}" data-delta="1">+</button>
        </div>
      </div>`;
  }).join('');
  wrap.querySelectorAll('[data-step]').forEach(btn=>{
    btn.addEventListener('click', ()=> stepService(btn.dataset.step, Number(btn.dataset.delta)));
  });
}
function stepService(key, delta){
  serviceCounts[key] = Math.max(0, (serviceCounts[key]||0) + delta);
  renderServicios();
}
function guardarServicios(){
  const mascotas = db.getMascotas();
  if(mascotas.length === 0){ showToast('Añade una mascota antes de agendar un servicio'); return; }
  const pet = db.getMascota(ui.selectedPetId) || mascotas[0];
  const seleccionados = Object.entries(serviceCounts).filter(([,c])=> c>0);
  if(seleccionados.length === 0){ showToast('Selecciona al menos un servicio'); return; }

  seleccionados.forEach(([key,count])=>{
    const svc = SERVICES_CATALOG.find(s=>s.key===key);
    db.registrarServicio(svc.nombre, count, pet.id); // auto-log en historial
  });

  serviceCounts = {};
  renderServicios();
  showToast('Servicio(s) añadido(s) al historial');
  goTo('historial');
}

/* ---------------------------------------------------------
   7) VISTA: HISTORIAL (auditoría: mascota | cita | servicio | nota)
   --------------------------------------------------------- */
const HISTORIAL_FILTROS = [
  { key:'todos', label:'Todos' },
  { key:'mascota', label:'Mascotas' },
  { key:'cita', label:'Citas' },
  { key:'servicio', label:'Servicios' },
  { key:'nota', label:'Notas' }
];
let historialFiltroActivo = 'todos';

function renderFiltrosHistorial(){
  const wrap = document.getElementById('historialFiltros');
  wrap.innerHTML = HISTORIAL_FILTROS.map(f=>
    `<button class="vp-filter-chip ${f.key===historialFiltroActivo?'active':''}" data-filtro="${f.key}">${f.label}</button>`
  ).join('');
  wrap.querySelectorAll('[data-filtro]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ historialFiltroActivo = btn.dataset.filtro; renderHistorial(); });
  });
}

function iconoPorTipo(tipo){
  return { mascota:'bi-heart-pulse', cita:'bi-calendar-check', servicio:'bi-bag-check', nota:'bi-journal-medical' }[tipo] || 'bi-clock-history';
}

function renderHistorial(){
  renderFiltrosHistorial();
  const container = document.getElementById('historialList');
  const query = (document.getElementById('historialSearch')?.value || '').toLowerCase().trim();

  const filtroTipo = historialFiltroActivo === 'todos' ? null : historialFiltroActivo;
  let items = db.getHistorial({ tipo: filtroTipo })
    .filter(h => !query || h.descripcion.toLowerCase().includes(query));

  if(items.length === 0){
    container.innerHTML = `<div class="vp-empty"><i class="bi bi-search"></i><p>No se encontraron registros.</p></div>`;
    return;
  }

  const groups = {};
  items.forEach(h=>{
    const d = new Date(h.fecha+'T00:00:00');
    const label = `${MESES[d.getMonth()].slice(0,3).toUpperCase()} ${d.getFullYear()}`;
    (groups[label] ||= []).push(h);
  });

  let html = '';
  Object.keys(groups).forEach(mesLabel=>{
    html += `<div class="vp-month-label">${mesLabel}</div>`;
    groups[mesLabel].forEach(h=>{
      const pet = h.mascotaId ? db.getMascota(h.mascotaId) : null;
      const fechaFmt = new Date(h.fecha+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'});
      html += `
        <div class="vp-card vp-hist-card">
          <div class="vp-hist-icon"><i class="bi ${iconoPorTipo(h.tipo)}"></i></div>
          <div class="flex-grow-1">
            <p class="vp-hist-title">${fechaFmt} ${h.hora} &nbsp;·&nbsp; ${h.descripcion}</p>
          </div>
          ${pet ? `<span class="vp-event-badge" style="align-self:flex-start;">${pet.nombre}</span>` : ''}
        </div>`;
    });
  });
  container.innerHTML = html;
}
document.getElementById('historialSearch').addEventListener('input', renderHistorial);

/* ---------------------------------------------------------
   8) NOTAS CLÍNICAS / MANUALES
   --------------------------------------------------------- */
function openNotaModal(){
  const select = document.getElementById('notaMascota');
  select.innerHTML = `<option value="">General (sin mascota específica)</option>` +
    db.getMascotas().map(p=>`<option value="${p.id}" ${p.id===ui.selectedPetId?'selected':''}>${p.nombre}</option>`).join('');
  document.getElementById('formNota').reset();
  select.value = ui.selectedPetId || '';
  modalOf('modalNota').show();
}
document.getElementById('formNota').addEventListener('submit', function(e){
  e.preventDefault();
  const texto = document.getElementById('notaTexto').value.trim();
  const mascotaId = document.getElementById('notaMascota').value || null;
  try{
    db.registrarNota(texto, mascotaId);
    modalOf('modalNota').hide();
    showToast('Nota guardada en el historial');
  }catch(err){
    showToast(err.message);
  }
});

/* ---------------------------------------------------------
   9) VISTA: CONFIGURACIÓN
   --------------------------------------------------------- */
function editarPerfilCampo(campo){
  const valor = prompt(campo==='nombre' ? 'Editar nombre:' : 'Añadir número telefónico:', '');
  if(valor === null) return;
  showToast('Perfil actualizado');
}

const INFO_CONTENT = {
  sobre: { title:'Sobre nosotros', body:'VidaPet es una app para organizar la salud y el cuidado de tus mascotas: consultas, vacunas, medicamentos y servicios, todo en un solo lugar.' },
  politica: { title:'Política de privacidad', body:'Los datos de tus mascotas se guardan únicamente en este dispositivo (localStorage). VidaPet no comparte tu información con terceros.' },
  terminos: { title:'Términos y condiciones', body:'El uso de VidaPet implica la aceptación de estos términos. La app se ofrece "tal cual", con fines demostrativos.' },
  contacto: { title:'Contáctanos', body:'¿Tienes problemas con la app? Escríbenos a soporte@vidapet.app y te responderemos a la brevedad.' }
};
function openInfoModal(key){
  const data = INFO_CONTENT[key];
  if(!data) return;
  document.getElementById('infoModalTitle').textContent = data.title;
  document.getElementById('infoModalBody').textContent = data.body;
  modalOf('modalInfo').show();
}
