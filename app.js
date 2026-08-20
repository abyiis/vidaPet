/* =========================================================
   VIDAPET · APP.JS
   Estado global, navegación SPA y toda la interactividad.
   No requiere backend: todo se simula con un objeto "state"
   persistido en localStorage (Mock API).
   ========================================================= */

const STORAGE_KEY = 'vidapet_state_v1';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOWS = ['D','L','M','M','J','V','S'];

/* ---------------------------------------------------------
   1) ESTADO / MOCK API (localStorage)
   --------------------------------------------------------- */
function defaultState(){
  return {
    theme: 'light',
    notificaciones: true,
    perfil: { nombre: '', telefono: '' },
    selectedPetId: 1,
    pets: [
      { id:1, nombre:'Rocco', especie:'Perro', raza:'Labrador', color:'Dorado', sexo:'Macho', nacimiento:'2022-04-10', peso:'28', altura:'55', comentarios:'', foto:null },
      { id:2, nombre:'Nina', especie:'Gato', raza:'Siames', color:'Blanco', sexo:'Hembra', nacimiento:'2021-09-02', peso:'4', altura:'25', comentarios:'', foto:null }
    ],
    events: [
      { id:101, petId:1, tipo:'vacuna', nombre:'Antirrábica', info:'Dosis anual', fecha:'2026-08-28' },
      { id:102, petId:1, tipo:'medicamento', nombre:'Antipulgas', info:'Aplicación tópica mensual', fecha:'2026-09-05' }
    ],
    historial: [
      { petId:1, mes:'JUL 2026', fecha:'30/07/2026', titulo:'Medicamento', desc:'Antibiótico — Amoxicilina 250mg. Administrar cada 12h por 7 días' },
      { petId:2, mes:'ABR 2026', fecha:'02/04/2026', titulo:'Consulta', desc:'Clínico general — Revisión general. Control de peso' }
    ],
    servicesCatalog: [
      { key:'medicamentos', nombre:'Medicamentos' },
      { key:'antipulgas', nombre:'Antipulgas' },
      { key:'consultas', nombre:'Consultas' },
      { key:'vacunas', nombre:'Vacunas' },
      { key:'banio', nombre:'Baño y corte de uñas' },
      { key:'pelo', nombre:'Corte de pelo' },
      { key:'consultaGeneral', nombre:'Consulta general' }
    ],
    serviceCounts: {}
  };
}

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){ /* localStorage corrupto: se ignora y se usa el estado por defecto */ }
  return defaultState();
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------------------------------------------------
   2) NAVEGACIÓN SPA (sin recarga de página)
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

/* Splash → Mascotas tras 2s */
window.addEventListener('DOMContentLoaded', ()=>{
  applyTheme(state.theme);
  document.getElementById('darkSwitch').checked = (state.theme === 'dark');
  document.getElementById('notifSwitch').checked = state.notificaciones;
  setTimeout(()=>{
    document.getElementById('view-splash').classList.remove('active');
    goTo('mascotas');
  }, 2000);
});

/* ---------------------------------------------------------
   3) TOAST (notificaciones de éxito)
   --------------------------------------------------------- */
let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('vpToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}

/* ---------------------------------------------------------
   4) MODO OSCURO (data-bs-theme, requerido por Bootstrap 5.3)
   --------------------------------------------------------- */
function applyTheme(theme){
  document.documentElement.setAttribute('data-bs-theme', theme);
  state.theme = theme;
}
function toggleDarkMode(isDark){
  applyTheme(isDark ? 'dark' : 'light');
  saveState();
  showToast(isDark ? 'Modo oscuro activado' : 'Modo claro activado');
}
function toggleNotificaciones(checked){
  state.notificaciones = checked;
  saveState();
  showToast(checked ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
}

/* Helper genérico para obtener/crear una instancia de modal Bootstrap */
function modalOf(id){ return bootstrap.Modal.getOrCreateInstance(document.getElementById(id)); }

/* ---------------------------------------------------------
   5) VISTA: MASCOTAS
   --------------------------------------------------------- */
function initials(name){ return (name || '?').trim().charAt(0).toUpperCase(); }

function renderMascotas(){
  const row = document.getElementById('petsAvatarRow');
  const empty = document.getElementById('mascotasEmptyState');
  row.innerHTML = '';

  state.pets.forEach(pet=>{
    const col = document.createElement('div');
    col.className = 'text-center';
    col.innerHTML = `
      <div class="vp-pet-avatar ${pet.id===state.selectedPetId?'selected':''}" onclick="selectPet(${pet.id})">
        ${pet.foto ? `<img src="${pet.foto}" alt="${pet.nombre}">` : initials(pet.nombre)}
      </div>
      <div class="vp-pet-name">${pet.nombre}</div>
      <div class="vp-pet-breed">${pet.raza || pet.especie}</div>
    `;
    row.appendChild(col);
  });

  const addCol = document.createElement('div');
  addCol.className = 'text-center';
  addCol.innerHTML = `
    <button class="vp-add-avatar" onclick="goTo('add-mascota')" aria-label="Añadir mascota"><i class="bi bi-plus-lg"></i></button>
    <div class="vp-pet-name">&nbsp;</div>
  `;
  row.appendChild(addCol);

  const sinMascotas = state.pets.length === 0;
  empty.innerHTML = sinMascotas
    ? `<div class="vp-empty mb-3"><i class="bi bi-heart"></i><p>Aún no tienes mascotas registradas.<br>Toca "+" para añadir la primera.</p></div>`
    : '';

  ['btnEliminarMascota','btnReagendar','btnCancelar'].forEach(id=>{
    document.getElementById(id).disabled = sinMascotas;
  });
}

function selectPet(id){
  state.selectedPetId = id;
  saveState();
  renderMascotas();
}

function eliminarMascotaSeleccionada(){
  if(state.pets.length === 0){ showToast('No hay mascotas para eliminar'); return; }
  const pet = state.pets.find(p=>p.id===state.selectedPetId) || state.pets[0];
  document.getElementById('deletePetMsg').textContent = `¿Eliminar a ${pet.nombre}? Esta acción no se puede deshacer.`;

  const btn = document.getElementById('btnConfirmDeletePet');
  btn.onclick = ()=>{
    state.pets = state.pets.filter(p=>p.id !== pet.id);
    state.events = state.events.filter(ev=>ev.petId !== pet.id);
    if(state.pets.length){ state.selectedPetId = state.pets[0].id; }
    saveState();
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
  const pet = state.pets.find(p=>p.id===state.selectedPetId) || state.pets[0];
  if(!pet){ showToast('No hay mascotas registradas'); return; }

  const eventosPet = state.events.filter(ev=>ev.petId===pet.id)
    .sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));

  document.getElementById('pickEventTitle').textContent =
    modo === 'reagendar' ? `Reagendar cita de ${pet.nombre}` : `Cancelar cita de ${pet.nombre}`;

  const list = document.getElementById('pickEventList');
  if(eventosPet.length === 0){
    list.innerHTML = `<div class="vp-empty"><i class="bi bi-calendar-x"></i><p>${pet.nombre} no tiene citas agendadas.</p></div>`;
  } else {
    list.innerHTML = eventosPet.map(ev => eventCardHTML(ev, `onclick="modalOf('modalPickEvent').hide(); openEventActionModal(${ev.id}, '${modo}');"`)).join('');
  }
  modalOf('modalPickEvent').show();
}

/* ---------------------------------------------------------
   6) VISTA: AÑADIR MASCOTA
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

  const newPet = {
    id: Date.now(),
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
  };
  state.pets.push(newPet);
  state.selectedPetId = newPet.id;
  saveState();

  this.reset();
  pendingPetPhoto = null;
  document.getElementById('petPhotoPreview').innerHTML = `<i class="bi bi-camera-fill"></i><span class="vp-upload-badge"><i class="bi bi-check"></i></span>`;

  showToast(`${nombre} fue añadido con éxito`);
  goTo('agenda');
});

/* ---------------------------------------------------------
   7) VISTA: AGENDA (calendario + eventos + citas)
   --------------------------------------------------------- */
let calDate = new Date(); // mes actual

function pad(n){ return String(n).padStart(2,'0'); }

function renderAgenda(){
  const pet = state.pets.find(p=>p.id===state.selectedPetId) || state.pets[0];
  const infoBox = document.getElementById('agendaPetInfo');

  if(pet){
    const opciones = state.pets.map(p=>`<option value="${p.id}" ${p.id===pet.id?'selected':''}>${p.nombre}</option>`).join('');
    infoBox.innerHTML = `
      <div class="vp-mini-avatar">${pet.foto?`<img src="${pet.foto}">`:initials(pet.nombre)}</div>
      <div class="flex-grow-1">
        <div style="font-weight:700;font-size:.9rem;">${pet.nombre}</div>
        <div style="font-size:.68rem;opacity:.8;">${pet.especie} · ${pet.raza||'—'} · ${edadTexto(pet.nacimiento)}</div>
      </div>
      <select onchange="state.selectedPetId=Number(this.value); saveState(); renderAgenda();">${opciones}</select>`;
  } else {
    infoBox.innerHTML = `<div style="font-size:.85rem;">Añade tu primera mascota para ver su agenda.</div>`;
  }
  renderCalendar();
  renderEventsList();
}

function edadTexto(fechaISO){
  if(!fechaISO) return 'edad desconocida';
  const nac = new Date(fechaISO);
  const hoy = new Date();
  let years = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if(m < 0 || (m===0 && hoy.getDate() < nac.getDate())) years--;
  return years >= 0 ? `${years} años` : '—';
}

function changeMonth(delta){
  calDate.setMonth(calDate.getMonth() + delta);
  renderCalendar();
  renderEventsList();
}

function renderCalendar(){
  document.getElementById('calMonthLabel').textContent = `${MESES[calDate.getMonth()]} ${calDate.getFullYear()}`;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  DOWS.forEach(d=>{
    const el = document.createElement('div');
    el.className = 'vp-cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const year = calDate.getFullYear(), month = calDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  const petEvents = state.events.filter(ev => !state.selectedPetId || ev.petId === state.selectedPetId);
  const eventDays = new Set(petEvents
    .filter(ev=>{ const d=new Date(ev.fecha); return d.getFullYear()===year && d.getMonth()===month; })
    .map(ev=> new Date(ev.fecha).getDate()));

  for(let i=firstDow-1; i>=0; i--){ grid.appendChild(dayCell(daysInPrevMonth - i, true, false, false)); }
  for(let d=1; d<=daysInMonth; d++){
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    grid.appendChild(dayCell(d, false, isToday, eventDays.has(d)));
  }
  const totalCells = firstDow + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for(let d=1; d<=trailing; d++){ grid.appendChild(dayCell(d, true, false, false)); }
}

function dayCell(num, muted, isToday, hasEvent){
  const el = document.createElement('div');
  el.className = 'vp-cal-day' + (muted?' muted':'') + (isToday?' today':'') + (hasEvent?' has-event':'');
  el.textContent = num;
  return el;
}

function eventTipoMeta(tipo){
  if(tipo === 'vacuna') return { icon:'bi-shield-plus', label:'Vacuna' };
  if(tipo === 'consulta') return { icon:'bi-clipboard2-pulse', label:'Consulta' };
  return { icon:'bi-capsule', label:'Medicamento' };
}

function eventCardHTML(ev, extraAttrs=''){
  const pet = state.pets.find(p=>p.id===ev.petId);
  const meta = eventTipoMeta(ev.tipo);
  const fechaFmt = new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'});
  return `
    <button class="vp-event-card" ${extraAttrs}>
      <div class="vp-event-icon ${ev.tipo}"><i class="bi ${meta.icon}"></i></div>
      <div>
        <p class="vp-event-title">${meta.label}: ${ev.nombre}</p>
        <p class="vp-event-sub">${ev.info || '—'}</p>
        <p class="vp-event-sub">${fechaFmt}</p>
      </div>
      <span class="vp-event-badge">${pet ? pet.nombre : '—'}</span>
    </button>`;
}

function renderEventsList(){
  const list = document.getElementById('eventsList');
  const events = state.events
    .filter(ev => !state.selectedPetId || ev.petId === state.selectedPetId)
    .sort((a,b)=> new Date(a.fecha) - new Date(b.fecha));

  if(events.length === 0){
    list.innerHTML = `<div class="vp-empty"><i class="bi bi-calendar2-week"></i><p>No hay eventos próximos.<br>Toca "Nueva cita" para agendar uno.</p></div>`;
    return;
  }
  list.innerHTML = events.map(ev => eventCardHTML(ev, `onclick="openEventActionModal(${ev.id})"`)).join('');
}

/* --- Nueva cita (modal) --- */
function openNuevaCitaModal(){
  if(state.pets.length === 0){ showToast('Añade una mascota antes de crear una cita'); return; }
  const select = document.getElementById('citaPet');
  select.innerHTML = state.pets.map(p=>`<option value="${p.id}" ${p.id===state.selectedPetId?'selected':''}>${p.nombre}</option>`).join('');
  document.getElementById('formNuevaCita').reset();
  select.value = state.selectedPetId;
  modalOf('modalNuevaCita').show();
}

document.getElementById('formNuevaCita').addEventListener('submit', function(e){
  e.preventDefault();
  const nuevoEvento = {
    id: Date.now(),
    petId: Number(document.getElementById('citaPet').value),
    tipo: document.getElementById('citaTipo').value,
    nombre: document.getElementById('citaNombre').value.trim(),
    info: document.getElementById('citaInfo').value.trim(),
    fecha: document.getElementById('citaFecha').value
  };
  if(!nuevoEvento.nombre || !nuevoEvento.fecha){ showToast('Completa nombre y fecha de la cita'); return; }

  state.events.push(nuevoEvento);
  saveState();
  modalOf('modalNuevaCita').hide();
  renderAgenda();
  showToast('Cita agendada con éxito');
});

/* --- Acciones sobre una cita existente: reagendar / cancelar --- */
let activeEventId = null;

function openEventActionModal(eventId, forzarModo){
  const ev = state.events.find(e=>e.id===eventId);
  if(!ev) return;
  activeEventId = eventId;

  const pet = state.pets.find(p=>p.id===ev.petId);
  const meta = eventTipoMeta(ev.tipo);
  const fechaFmt = new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'});

  document.getElementById('eventActionTitle').textContent = `${meta.label}: ${ev.nombre}`;
  document.getElementById('eventActionInfo').textContent = `${pet ? pet.nombre : '—'} · ${ev.info || 'Sin información adicional'} · Fecha actual: ${fechaFmt}`;

  const box = document.getElementById('eventReagendarBox');
  const fechaInput = document.getElementById('eventNuevaFecha');
  box.classList.add('d-none');
  fechaInput.value = ev.fecha;

  document.getElementById('btnEventReagendar').onclick = ()=>{
    if(box.classList.contains('d-none')){
      box.classList.remove('d-none');
      return;
    }
    const nuevaFecha = fechaInput.value;
    if(!nuevaFecha){ showToast('Selecciona una nueva fecha'); return; }
    ev.fecha = nuevaFecha;
    saveState();
    modalOf('modalEventAction').hide();
    renderAgenda();
    showToast('Cita reagendada con éxito');
  };

  document.getElementById('btnEventCancelar').onclick = ()=>{
    state.events = state.events.filter(e=>e.id !== eventId);
    saveState();
    modalOf('modalEventAction').hide();
    renderAgenda();
    showToast('Cita cancelada');
  };

  modalOf('modalEventAction').show();
  if(forzarModo === 'reagendar') box.classList.remove('d-none');
}

/* ---------------------------------------------------------
   8) VISTA: AÑADIR SERVICIO
   --------------------------------------------------------- */
function renderServicios(){
  const wrap = document.getElementById('serviceListWrap');
  wrap.innerHTML = state.servicesCatalog.map(svc=>{
    const count = state.serviceCounts[svc.key] || 0;
    return `
      <div class="vp-service-row">
        <span class="vp-service-name">${svc.nombre}</span>
        <div class="vp-stepper">
          <button class="vp-step-btn" onclick="stepService('${svc.key}',-1)" ${count===0?'disabled':''}>−</button>
          <span class="vp-step-count" id="count-${svc.key}">${count}</span>
          <button class="vp-step-btn plus" onclick="stepService('${svc.key}',1)">+</button>
        </div>
      </div>`;
  }).join('');
}

function stepService(key, delta){
  const current = state.serviceCounts[key] || 0;
  const next = Math.max(0, current + delta);
  state.serviceCounts[key] = next;
  saveState();
  renderServicios();
}

function guardarServicios(){
  if(state.pets.length === 0){ showToast('Añade una mascota antes de agendar un servicio'); return; }
  const pet = state.pets.find(p=>p.id===state.selectedPetId) || state.pets[0];
  const seleccionados = Object.entries(state.serviceCounts).filter(([,c])=> c > 0);

  if(seleccionados.length === 0){ showToast('Selecciona al menos un servicio'); return; }

  const hoy = new Date();
  const mesLabel = MESES[hoy.getMonth()].slice(0,3).toUpperCase() + ' ' + hoy.getFullYear();

  seleccionados.forEach(([key, count])=>{
    const svc = state.servicesCatalog.find(s=>s.key===key);
    state.historial.unshift({
      petId: pet ? pet.id : null,
      mes: mesLabel,
      fecha: `${pad(hoy.getDate())}/${pad(hoy.getMonth()+1)}/${hoy.getFullYear()}`,
      titulo: svc.nombre,
      desc: `Cantidad: ${count}. Servicio agendado desde la app.`
    });
  });

  state.serviceCounts = {};
  saveState();
  renderServicios();
  showToast('Servicio(s) añadido(s) al historial');
  goTo('historial');
}

/* ---------------------------------------------------------
   9) VISTA: HISTORIAL (búsqueda + filtros)
   --------------------------------------------------------- */
const HISTORIAL_FILTROS = [
  { key:'todos', label:'Todos' },
  { key:'medicamentos', label:'Medicamentos' },
  { key:'vacunas', label:'Vacunas' },
  { key:'consultas', label:'Consultas' },
  { key:'banio', label:'Baño y corte' }
];
let historialFiltroActivo = 'todos';

function coincideFiltro(item, filtro){
  const t = item.titulo.toLowerCase();
  if(filtro === 'todos') return true;
  if(filtro === 'medicamentos') return t.includes('medicamento') || t.includes('antibiótico') || t.includes('antipulgas');
  if(filtro === 'vacunas') return t.includes('vacuna');
  if(filtro === 'consultas') return t.includes('consulta');
  if(filtro === 'banio') return t.includes('baño') || t.includes('corte');
  return true;
}

function renderFiltrosHistorial(){
  const wrap = document.getElementById('historialFiltros');
  wrap.innerHTML = HISTORIAL_FILTROS.map(f=>
    `<button class="vp-filter-chip ${f.key===historialFiltroActivo?'active':''}" onclick="setFiltroHistorial('${f.key}')">${f.label}</button>`
  ).join('');
}
function setFiltroHistorial(key){
  historialFiltroActivo = key;
  renderFiltrosHistorial();
  renderHistorial();
}

function renderHistorial(){
  renderFiltrosHistorial();
  const container = document.getElementById('historialList');
  const query = (document.getElementById('historialSearch')?.value || '').toLowerCase().trim();

  let items = state.historial.filter(h=>{
    const matchTexto = !query || (h.titulo + ' ' + h.desc).toLowerCase().includes(query);
    return matchTexto && coincideFiltro(h, historialFiltroActivo);
  });

  if(items.length === 0){
    container.innerHTML = `<div class="vp-empty"><i class="bi bi-search"></i><p>No se encontraron resultados.</p></div>`;
    return;
  }

  const groups = {};
  items.forEach(h=>{
    if(!groups[h.mes]) groups[h.mes] = [];
    groups[h.mes].push(h);
  });

  let html = '';
  Object.keys(groups).forEach(mes=>{
    html += `<div class="vp-month-label">${mes}</div>`;
    groups[mes].forEach(h=>{
      const pet = state.pets.find(p=>p.id===h.petId);
      const t = h.titulo.toLowerCase();
      const icon = t.includes('medic') ? 'bi-capsule'
                 : t.includes('vacuna') ? 'bi-shield-plus'
                 : t.includes('consulta') ? 'bi-clipboard2-pulse'
                 : 'bi-heart-pulse';
      html += `
        <div class="vp-card vp-hist-card">
          <div class="vp-hist-icon"><i class="bi ${icon}"></i></div>
          <div class="flex-grow-1">
            <p class="vp-hist-title">${h.fecha} &nbsp;·&nbsp; ${h.titulo}</p>
            <p class="vp-hist-desc">${h.desc}</p>
          </div>
          <span class="vp-event-badge" style="align-self:flex-start;">${pet ? pet.nombre : '—'}</span>
        </div>`;
    });
  });
  container.innerHTML = html;
}

/* ---------------------------------------------------------
   10) VISTA: CONFIGURACIÓN
   --------------------------------------------------------- */
function editarPerfilCampo(campo){
  const actual = campo === 'nombre' ? state.perfil.nombre : state.perfil.telefono;
  const valor = prompt(campo === 'nombre' ? 'Editar nombre:' : 'Añadir número telefónico:', actual || '');
  if(valor === null) return;
  state.perfil[campo] = valor.trim();
  saveState();
  showToast('Perfil actualizado');
}

/* Contenido de los modales informativos (Sobre nosotros / Política / Términos / Contacto) */
const INFO_CONTENT = {
  sobre: { title:'Sobre nosotros', body:'VidaPet es una app para organizar la salud y el cuidado de tus mascotas: consultas, vacunas, medicamentos y servicios, todo en un solo lugar.' },
  politica: { title:'Política de privacidad', body:'Los datos de tus mascotas se guardan únicamente en este dispositivo. VidaPet no comparte tu información con terceros.' },
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
