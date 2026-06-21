export interface CatalogoItem {
  id: number;
  descripcion: string;
}

// Alias semántico reutilizado para proyectos, tipos y actividades
export type ProyectoDisponible = CatalogoItem;

// Fase de Scoca — solo aplica a tipo de actividad "Servicio"
export interface Fase {
  id: number;
  nombre: string;
}

export interface ActividadItem {
  idEmpleado: number;
  idActividad: number;
  idTipoActividad: number;
  idProyecto: number | string; // number cuando está emparejado, 'N/A' cuando no
  descripcion: string;
  fechaRegistro: string;   // yyyy-MM-dd
  horaInicio: string;      // HH:mm
  horaFin: string;         // HH:mm
  fase?: string | null;    // resuelta por backend; solo aplica para tipo "Servicio"

  // Estado UI — añadido en cliente, nunca enviado al servidor
  registrando?: boolean;
  registrado?: boolean;
  proyectoSeleccionado?:       number | null;      // usado solo en sesionesNoPareadasAProyecto
  tipoActividadSeleccionado?:  number | null;      // sobreescribe idTipoActividad al registrar
  actividadSeleccionada?:      number | null;      // sobreescribe idActividad al registrar
  faseSeleccionada?:           string | null;      // sobreescribe fase al registrar
  catalogoActividades?:        CatalogoItem[];     // catálogo dinámico cargado por fila
}

// El backend envuelve tiposActividad en su propio envelope interno
export interface TiposActividadEnvelope {
  status: string;
  statusCode: number;
  data: CatalogoItem[];
  message: string | null;
}

export interface ActividadData {
  actividades: ActividadItem[];
  sesionesNoPareadasAProyecto: ActividadItem[];
  proyectosDisponibles: ProyectoDisponible[];
  tiposActividad: TiposActividadEnvelope;
}

export interface ActividadRequest {
  tokenMicrosoft: string;
  username: string;
  password: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface RegistroScoca {
  id: number;
  idActividad: number;
  idTipoActividad: number;
  idProyecto: number;
  descripcion: string;
  fechaRegistro: string;
  horaInicio: string;
  horaFin: string;
  fase?: string | null;
}

export interface EstadisticasMes {
  nombreMes: string;
  mes: number;
  anio: number;
  diasHabiles: number;
  diasConRegistro: number;
  horasEsperadas: number;
  horasRegistradas: number;
  porcentaje: number;
}
