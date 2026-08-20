/* =========================================================
   VIDAPET · STORE.JS
   Capa de datos 100% offline sobre localStorage.
   3 entidades: mascotas, citas, historial.
   Toda mutación relevante (alta/edición/baja de mascota,
   agendar/reagendar/cancelar cita, nota manual) genera
   automáticamente una entrada de auditoría en "historial".
   No depende de frameworks ni de la UI: es reutilizable.
   ========================================================= */

class VidaPetStore {
  /**
   * @param {string} namespace Prefijo de las claves en localStorage,
   *   útil para no chocar con otros datos del mismo dominio.
   */
  constructor(namespace = 'vidapet'){
    this.KEYS = {
      mascotas:  `${namespace}_mascotas`,
      citas:     `${namespace}_citas`,
      historial: `${namespace}_historial`
    };
    this._seedIfEmpty();
  }

  /* ---------- utilidades internas de persistencia ---------- */
  _read(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      console.error(`VidaPetStore: error leyendo "${key}", se reinicia vacío.`, e);
      return [];
    }
  }
  _write(key, arr){
    localStorage.setItem(key, JSON.stringify(arr));
  }
  _uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  _seedIfEmpty(){
    if(localStorage.getItem(this.KEYS.mascotas) === null) this._write(this.KEYS.mascotas, []);
    if(localStorage.getItem(this.KEYS.citas) === null) this._write(this.KEYS.citas, []);
    if(localStorage.getItem(this.KEYS.historial) === null) this._write(this.KEYS.historial, []);
  }

  /* =========================================================
     AUDITORÍA / HISTORIAL
     Cada entrada: { id, fecha, hora, tipo, descripcion, mascotaId }
     tipo ∈ 'mascota' | 'cita' | 'nota'
     ========================================================= */
  _log(tipo, descripcion, mascotaId = null){
    const now = new Date();
    const entry = {
      id: this._uid(),
      fecha: now.toISOString().slice(0,10),          // YYYY-MM-DD
      hora: now.toTimeString().slice(0,5),            // HH:MM
      tipo,
      descripcion,
      mascotaId
    };
    const historial = this._read(this.KEYS.historial);
    historial.unshift(entry); // más reciente primero
    this._write(this.KEYS.historial, historial);
    return entry;
  }

  getHistorial({ mascotaId = null, tipo = null } = {}){
    return this._read(this.KEYS.historial)
      .filter(h => (mascotaId ? h.mascotaId === mascotaId : true))
      .filter(h => (tipo ? h.tipo === tipo : true));
  }

  /** Nota clínica/manual, opcionalmente asociada a una mascota */
  registrarNota(texto, mascotaId = null){
    if(!texto || !texto.trim()) throw new Error('La nota no puede estar vacía.');
    const mascota = mascotaId ? this.getMascota(mascotaId) : null;
    const prefijo = mascota ? `Nota sobre ${mascota.nombre}: ` : 'Nota general: ';
    return this._log('nota', prefijo + texto.trim(), mascotaId);
  }

  /* =========================================================
     MASCOTAS
     ========================================================= */
  getMascotas(){ return this._read(this.KEYS.mascotas); }
  getMascota(id){ return this.getMascotas().find(m => m.id === id) || null; }

  addMascota(data){
    const mascotas = this.getMascotas();
    const mascota = { id: this._uid(), ...data };
    mascotas.push(mascota);
    this._write(this.KEYS.mascotas, mascotas);
    this._log('mascota', `Alta de mascota: ${mascota.nombre}`, mascota.id);
    return mascota;
  }

  updateMascota(id, cambios){
    const mascotas = this.getMascotas();
    const idx = mascotas.findIndex(m => m.id === id);
    if(idx === -1) throw new Error('Mascota no encontrada.');
    mascotas[idx] = { ...mascotas[idx], ...cambios };
    this._write(this.KEYS.mascotas, mascotas);
    this._log('mascota', `Edición de datos de: ${mascotas[idx].nombre}`, id);
    return mascotas[idx];
  }

  deleteMascota(id){
    const mascotas = this.getMascotas();
    const mascota = mascotas.find(m => m.id === id);
    if(!mascota) return false;
    this._write(this.KEYS.mascotas, mascotas.filter(m => m.id !== id));
    // Baja en cascada de sus citas (sin generar un log por cada una, solo el resumen)
    const citas = this.getCitas();
    const citasEliminadas = citas.filter(c => c.mascotaId === id).length;
    this._write(this.KEYS.citas, citas.filter(c => c.mascotaId !== id));
    this._log('mascota', `Baja de mascota: ${mascota.nombre}` +
      (citasEliminadas ? ` (se cancelaron ${citasEliminadas} cita(s) asociadas)` : ''), id);
    return true;
  }

  /** Registro de un servicio prestado (baño, corte, etc.) directo en el historial */
  registrarServicio(nombreServicio, cantidad, mascotaId = null){
    const mascota = mascotaId ? this.getMascota(mascotaId) : null;
    return this._log('servicio',
      `Servicio: ${nombreServicio} (x${cantidad})` + (mascota ? ` — ${mascota.nombre}` : ''),
      mascotaId);
  }

  /* =========================================================
     CITAS
     estado ∈ 'programada' | 'reagendada' | 'cancelada' | 'completada'
     ========================================================= */
  getCitas(){ return this._read(this.KEYS.citas); }
  getCita(id){ return this.getCitas().find(c => c.id === id) || null; }
  getCitasPorMascota(mascotaId){ return this.getCitas().filter(c => c.mascotaId === mascotaId); }

  addCita(data){
    const citas = this.getCitas();
    const cita = { id: this._uid(), estado: 'programada', ...data };
    citas.push(cita);
    this._write(this.KEYS.citas, citas);
    const mascota = this.getMascota(cita.mascotaId);
    this._log('cita', `Cita agendada — ${cita.nombre} (${cita.fecha}) para ${mascota ? mascota.nombre : 'mascota eliminada'}`, cita.mascotaId);
    return cita;
  }

  reagendarCita(id, nuevaFecha){
    const citas = this.getCitas();
    const idx = citas.findIndex(c => c.id === id);
    if(idx === -1) throw new Error('Cita no encontrada.');
    const anterior = citas[idx].fecha;
    citas[idx].fecha = nuevaFecha;
    citas[idx].estado = 'reagendada';
    this._write(this.KEYS.citas, citas);
    this._log('cita', `Cita reagendada — ${citas[idx].nombre}: ${anterior} → ${nuevaFecha}`, citas[idx].mascotaId);
    return citas[idx];
  }

  cancelarCita(id){
    const citas = this.getCitas();
    const idx = citas.findIndex(c => c.id === id);
    if(idx === -1) throw new Error('Cita no encontrada.');
    citas[idx].estado = 'cancelada';
    this._write(this.KEYS.citas, citas);
    this._log('cita', `Cita cancelada — ${citas[idx].nombre} (${citas[idx].fecha})`, citas[idx].mascotaId);
    return citas[idx];
  }

  /** Cambio de estado genérico (ej. marcar como 'completada') */
  cambiarEstadoCita(id, estado){
    const citas = this.getCitas();
    const idx = citas.findIndex(c => c.id === id);
    if(idx === -1) throw new Error('Cita no encontrada.');
    const anterior = citas[idx].estado;
    citas[idx].estado = estado;
    this._write(this.KEYS.citas, citas);
    this._log('cita', `Cambio de estado — ${citas[idx].nombre}: ${anterior} → ${estado}`, citas[idx].mascotaId);
    return citas[idx];
  }
}
