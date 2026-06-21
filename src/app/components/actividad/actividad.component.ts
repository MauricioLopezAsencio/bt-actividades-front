import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { from, of } from 'rxjs';
import { concatMap, catchError, tap } from 'rxjs/operators';
import { ActividadService } from 'src/app/services/actividad.service';
import { AuthService } from 'src/app/services/auth.service';
import { MsalAuthService } from 'src/app/services/msal-auth.service';
import { ActividadItem, ActividadRequest, CatalogoItem, EstadisticasMes, Fase, ProyectoDisponible, RegistroScoca } from 'src/app/models/actividad.model';

// Mapeo nombre de tipo de actividad -> fase por defecto (clave normalizada: lowercase + sin acentos)
const MAPEO_TIPO_FASE: Record<string, string> = {
  'analisis':                     'Análisis y Diseño',
  'arquitectura':                 'Desarrollo y Construcción',
  'atencion de defecto':          'Pruebas',
  'bases de datos':               'Desarrollo y Construcción',
  'capacitacion':                 'Despliegue',
  'capacitacion al usuario':      'Despliegue',
  'codificacion':                 'Desarrollo y Construcción',
  'desarrollo':                   'Desarrollo y Construcción',
  'despliegue':                   'Despliegue',
  'diseno':                       'Análisis y Diseño',
  'diversos':                     'Garantía',
  'elaboracion de documentos':    'Análisis y Diseño',
  'entregables':                  'Despliegue',
  'implementacion':               'Despliegue',
  'investigacion':                'Análisis y Diseño',
  'legales y tramites':           'Garantía',
  'plan de trabajo':              'Análisis y Diseño',
  'pruebas':                      'Pruebas',
  'reportes':                     'Garantía',
  'seguimiento a cumplimiento':   'Garantía',
  'seguridad de la informacion':  'Desarrollo y Construcción',
  'sesion externa':               'Garantía',
  'sesion interna':                'Garantía',
  'soporte':                      'Garantía',
  'tableros':                     'Desarrollo y Construcción',
  'ventas/comercial':             'Garantía'
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function fechasValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('fechaInicio')?.value;
  const fin = group.get('fechaFin')?.value;
  if (inicio && fin && inicio > fin) {
    return { fechasInvalidas: true };
  }
  return null;
}

@Component({
  selector: 'app-actividad',
  templateUrl: './actividad.component.html',
  styleUrls: ['./actividad.component.css']
})
export class ActividadComponent implements OnInit, OnDestroy {

  formulario!: FormGroup;
  msAccountName: string | null = null;
  msLoading = false;
  showTokenInput = false;
  showPass = false;

  actividades: ActividadItem[] = [];
  sesionesNoPareadas: ActividadItem[] = [];
  proyectosDisponibles: ProyectoDisponible[] = [];
  tiposActividad: CatalogoItem[] = [];
  catalogoFases: Fase[] = [];
  hasResults = false;

  pAct = 1;
  pSin = 1;
  readonly itemsPerPage = 10;

  registrandoTodoAct = false;
  registrandoTodoSin = false;
  progresoAct = 0;
  progresoSin = 0;
  totalAct = 0;
  totalSin = 0;

  // ─── Registros por fecha ──────────────────────────────────────────────────
  showRegistrosModal = false;
  registrosPorFecha: RegistroScoca[] = [];
  loadingRegistros = false;
  fechaRegistrosSel: string = new Date().toISOString().split('T')[0];
  registrosCargados = false;

  // ─── Estadísticas del mes ─────────────────────────────────────────────────
  showStatsModal = false;
  estadisticasMes: EstadisticasMes | null = null;
  loadingStats = false;
  mesSel: number = new Date().getMonth() + 1;
  anioSel: number = new Date().getFullYear();
  readonly meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Credenciales Bitácora guardadas en memoria (nunca en localStorage)
  private credencialesSco: { username: string; password: string } | null = null;

  // Proyecto solo es obligatorio cuando el tipo de actividad es SERVICIO
  private readonly ID_TIPO_SERVICIO = 3;

  constructor(
    private fb: FormBuilder,
    private actividadService: ActividadService,
    private authService: AuthService,
    private msalAuth: MsalAuthService
  ) {}

  ngOnInit(): void {
    this.formulario = this.fb.group(
      {
        tokenMicrosoft: ['', Validators.required],
        fechaInicio:    ['', Validators.required],
        fechaFin:       ['', Validators.required]
      },
      { validators: fechasValidator }
    );

    this.msalAuth.getAccountName().then(name => {
      this.msAccountName = name;
    }).catch(() => {});

    this.cargarCatalogoFases();
  }

  private cargarCatalogoFases(): void {
    this.actividadService.getCatalogoFases().subscribe({
      next: (fases) => this.catalogoFases = fases ?? [],
      error: () => this.catalogoFases = []
    });
  }

  ngOnDestroy(): void {
    // Limpiar credenciales de memoria al salir del componente
    this.credencialesSco = null;
  }

  // ─── Microsoft ────────────────────────────────────────────────────────────

  async conectarMicrosoft(): Promise<void> {
    this.msLoading = true;
    Swal.fire({
      html: '<i class="bi bi-gear-fill swal-gear"></i><p class="swal-loading-text">Conectando con Microsoft...<br><small>Se abrirá una ventana de autenticación.</small></p>',
      showConfirmButton: false,
      allowOutsideClick: false
    });
    try {
      const token = await this.msalAuth.acquireToken();
      this.formulario.patchValue({ tokenMicrosoft: token });
      const name = await this.msalAuth.getAccountName();
      this.msAccountName = name;
      Swal.fire({
        title: '¡Conectado con Microsoft!',
        text: name ?? 'Token obtenido exitosamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        title: 'Error al conectar con Microsoft',
        text: err?.message ?? 'No se pudo obtener el token.',
        icon: 'error'
      });
    } finally {
      this.msLoading = false;
    }
  }

  async desconectarMicrosoft(): Promise<void> {
    try {
      await this.msalAuth.logout();
      this.msAccountName = null;
      this.formulario.patchValue({ tokenMicrosoft: '' });
      Swal.fire({ title: 'Sesión de Microsoft cerrada', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: 'Error al desconectar', text: err?.message, icon: 'error' });
    }
  }

  // ─── Consulta ─────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.ejecutarConsulta();
  }

  private ejecutarConsulta(): void {
    const raw = this.formulario.value;
    const creds = {
      username: this.authService.getUsername() ?? '',
      password: this.authService.getPassword() ?? ''
    };
    const req: ActividadRequest = {
      tokenMicrosoft: raw.tokenMicrosoft,
      fechaInicio:    raw.fechaInicio,
      fechaFin:       raw.fechaFin,
      username:       creds.username,
      password:       creds.password
    };

    Swal.fire({
      html: '<i class="bi bi-gear-fill swal-gear"></i><p class="swal-loading-text">Consultando actividades...<br><small>Por favor, espere.</small></p>',
      showConfirmButton: false,
      allowOutsideClick: false
    });

    this.actividadService.consultar(req).subscribe({
      next: (resp) => {
        Swal.close();
        this.tiposActividad       = resp?.data?.tiposActividad?.data   ?? [];
        this.proyectosDisponibles = resp?.data?.proyectosDisponibles   ?? [];

        // Pre-poblar actividades emparejadas con campos UI
        const actividades = (resp?.data?.actividades ?? []).map(s => ({
          ...s,
          tipoActividadSeleccionado: s.idTipoActividad ?? null,
          actividadSeleccionada:     typeof s.idActividad === 'number' ? s.idActividad : null,
          proyectoSeleccionado:      typeof s.idProyecto === 'number' ? s.idProyecto : null,
          faseSeleccionada:          s.fase ?? this.resolverFasePorTipo(s.idTipoActividad),
          catalogoActividades:       [] as CatalogoItem[]
        }));
        this.actividades = actividades;

        // Pre-poblar sesiones no pareadas con campos UI
        const sesiones = (resp?.data?.sesionesNoPareadasAProyecto ?? []).map(s => ({
          ...s,
          tipoActividadSeleccionado: s.idTipoActividad ?? null,
          actividadSeleccionada:     typeof s.idActividad === 'number' ? s.idActividad : null,
          faseSeleccionada:          s.fase ?? this.resolverFasePorTipo(s.idTipoActividad),
          catalogoActividades:       [] as CatalogoItem[]
        }));
        this.sesionesNoPareadas = sesiones;

        // Cargar catálogos de actividades para todas las filas de ambas tablas (una llamada por tipo único)
        const todasLasFilas = [...actividades, ...sesiones];
        const tiposUnicos = [...new Set(
          todasLasFilas.map(s => s.tipoActividadSeleccionado).filter((t): t is number => !!t)
        )];
        tiposUnicos.forEach(idTipo => {
          this.actividadService.getCatalogoActividades(idTipo, creds).subscribe({
            next: items => {
              todasLasFilas
                .filter(s => s.tipoActividadSeleccionado === idTipo)
                .forEach(s => {
                  s.catalogoActividades = items;

                  // 🔥 AQUÍ ESTÁ LA MAGIA
                  if (!s.faseSeleccionada) {
                    s.faseSeleccionada = this.resolverFasePorActividad(
                      s,
                      s.actividadSeleccionada ?? s.idActividad
                    );
                  }
                });
            }
          });
        });

        this.hasResults = true;
        this.pAct = 1;
        this.pSin = 1;
        this.credencialesSco = creds;
        this.estadisticasMes = null;
        this.cargarEstadisticas();
      },
      error: (err) => {
        const status = err?.status;
        if (status === 400) {
          const errors = err?.error?.validationErrors as Record<string, string> | undefined;
          const html = errors
            ? Object.values(errors).map(e => `<p style="margin:0.2rem 0">${e}</p>`).join('')
            : 'Verifique los datos enviados.';
          Swal.fire({ title: 'Datos inválidos', html, icon: 'warning' });
        } else {
          Swal.fire({
            title: 'Error al consultar actividades',
            text: err?.error?.message ?? 'Ocurrió un error inesperado.',
            icon: 'error'
          });
        }
      }
    });
  }

  // ─── Getters pendientes ────────────────────────────────────────────────────

  get pendientesAct(): ActividadItem[] {
    return this.actividades.filter(
      i => !i.registrado && !i.registrando
        && !!i.tipoActividadSeleccionado
        && !!i.actividadSeleccionada
        && (!this.requiereProyecto(i) || !!i.proyectoSeleccionado)
        && (!this.requiereFase(i) || !!i.faseSeleccionada)
    );
  }

  private requiereProyecto(item: ActividadItem): boolean {
    return (item.tipoActividadSeleccionado ?? item.idTipoActividad) === this.ID_TIPO_SERVICIO;
  }

  // La fase es obligatoria solo cuando el tipo de actividad es "Servicio"
  requiereFase(item: ActividadItem): boolean {
    return (item.tipoActividadSeleccionado ?? item.idTipoActividad) === this.ID_TIPO_SERVICIO;
  }

  get pendientesSin(): ActividadItem[] {
    return this.sesionesNoPareadas.filter(
      i => !i.registrado && !i.registrando
        && !!i.tipoActividadSeleccionado
        && !!i.actividadSeleccionada
        && (!this.requiereProyecto(i) || !!i.proyectoSeleccionado)
        && (!this.requiereFase(i) || !!i.faseSeleccionada)
    );
  }

  get hayIncompletas(): boolean {
    return this.sesionesNoPareadas.some(
      i => !i.registrado && (
        !i.tipoActividadSeleccionado
        || !i.actividadSeleccionada
        || (this.requiereProyecto(i) && !i.proyectoSeleccionado)
        || (this.requiereFase(i) && !i.faseSeleccionada)
      )
    );
  }

  // ─── Registro individual ───────────────────────────────────────────────────

  private buildBody(item: ActividadItem): object {
    return {
      username:        this.credencialesSco!.username,
      password:        this.credencialesSco!.password,
      idActividad:     item.actividadSeleccionada     ?? item.idActividad,
      idTipoActividad: item.tipoActividadSeleccionado ?? item.idTipoActividad,
      idProyecto:      item.proyectoSeleccionado
                       ?? (typeof item.idProyecto === 'number' ? item.idProyecto : null),
      descripcion:     item.descripcion,
      fechaRegistro:   item.fechaRegistro,
      horaInicio:      item.horaInicio,
      horaFin:         item.horaFin,
      fase:            this.requiereFase(item) ? (item.faseSeleccionada ?? null) : null
    };
  }

  registrarActividad(item: ActividadItem): void {
    if (!this.credencialesSco) return;

    item.registrando = true;

    this.actividadService.registrar(this.buildBody(item)).subscribe({
      next: () => {
        item.registrando = false;
        item.registrado  = true;
        Swal.fire({
          title: '¡Actividad registrada!',
          text: 'La actividad se registró correctamente en Bitácora.',
          icon: 'success',
          timer: 1800,
          showConfirmButton: false
        }).then(() => {
          //this.ejecutarConsulta();
          if (this.estadisticasMes) this.cargarEstadisticas();
          if (this.registrosCargados) this.cargarRegistrosPorFecha();
        });
      },
      error: (err) => {
        item.registrando = false;
        Swal.fire({
          title: 'Error al registrar actividad',
          text: err?.error?.message ?? 'Ocurrió un error inesperado.',
          icon: 'error'
        });
      }
    });
  }

  // ─── Registro masivo ───────────────────────────────────────────────────────

  registrarTodasActividades(): void {
    if (!this.credencialesSco || this.registrandoTodoAct) return;
    const pendientes = [...this.pendientesAct];
    if (pendientes.length === 0) return;

    this.registrandoTodoAct = true;
    this.progresoAct = 0;
    this.totalAct = pendientes.length;
    let erroresAct = 0;

    from(pendientes).pipe(
      concatMap(item => {
        item.registrando = true;
        return this.actividadService.registrar(this.buildBody(item)).pipe(
          tap(() => { item.registrando = false; item.registrado = true; this.progresoAct++; }),
          catchError(() => { item.registrando = false; erroresAct++; return of(null); })
        );
      })
    ).subscribe({
      complete: () => {
        this.registrandoTodoAct = false;
        if (erroresAct === 0) {
          Swal.fire({
            title: '¡Registro masivo completado!',
            text: `${this.progresoAct} actividad${this.progresoAct !== 1 ? 'es registradas' : ' registrada'} exitosamente.`,
            icon: 'success',
            timer: 2500,
            showConfirmButton: false
          }).then(() => { this.ejecutarConsulta(); if (this.estadisticasMes) this.cargarEstadisticas(); if (this.registrosCargados) this.cargarRegistrosPorFecha(); });
        } else {
          Swal.fire({
            title: 'Registro completado con advertencias',
            html: `<p><strong>${this.progresoAct}</strong> registrada${this.progresoAct !== 1 ? 's' : ''} correctamente.</p>
                   <p><strong>${erroresAct}</strong> con error — revisa los registros pendientes.</p>`,
            icon: 'warning'
          }).then(() => { this.ejecutarConsulta(); if (this.estadisticasMes) this.cargarEstadisticas(); if (this.registrosCargados) this.cargarRegistrosPorFecha(); });
        }
      }
    });
  }

  registrarTodasSesiones(): void {
    if (!this.credencialesSco || this.registrandoTodoSin) return;
    const pendientes = [...this.pendientesSin];
    if (pendientes.length === 0) return;

    this.registrandoTodoSin = true;
    this.progresoSin = 0;
    this.totalSin = pendientes.length;
    let erroresSin = 0;

    from(pendientes).pipe(
      concatMap(item => {
        item.registrando = true;
        return this.actividadService.registrar(this.buildBody(item)).pipe(
          tap(() => { item.registrando = false; item.registrado = true; this.progresoSin++; }),
          catchError(() => { item.registrando = false; erroresSin++; return of(null); })
        );
      })
    ).subscribe({
      complete: () => {
        this.registrandoTodoSin = false;
        if (erroresSin === 0) {
          Swal.fire({
            title: '¡Registro masivo completado!',
            text: `${this.progresoSin} sesión${this.progresoSin !== 1 ? 'es registradas' : ' registrada'} exitosamente.`,
            icon: 'success',
            timer: 2500,
            showConfirmButton: false
          }).then(() => { this.ejecutarConsulta(); if (this.estadisticasMes) this.cargarEstadisticas(); });
        } else {
          Swal.fire({
            title: 'Registro completado con advertencias',
            html: `<p><strong>${this.progresoSin}</strong> registrada${this.progresoSin !== 1 ? 's' : ''} correctamente.</p>
                   <p><strong>${erroresSin}</strong> con error — revisa los registros pendientes.</p>`,
            icon: 'warning'
          }).then(() => { this.ejecutarConsulta(); if (this.estadisticasMes) this.cargarEstadisticas(); });
        }
      }
    });
  }

  // ─── Importar DevOps CSV ──────────────────────────────────────────────────

  cargandoWorkItems = false;
  fechaDevOps: string = new Date().toISOString().split('T')[0];

  onArchivoSeleccionado(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.cargandoWorkItems = true;
    Swal.fire({
      html: '<i class="bi bi-gear-fill swal-gear"></i><p class="swal-loading-text">Procesando archivo...<br><small>Por favor, espere.</small></p>',
      showConfirmButton: false,
      allowOutsideClick: false
    });

    this.actividadService.prepararWorkItems(
      file,
      this.fechaDevOps,
      this.authService.getUsername() ?? '',
      this.authService.getPassword() ?? ''
    ).subscribe({
      next: (items) => {
        this.cargandoWorkItems = false;
        (event.target as HTMLInputElement).value = '';

        this.credencialesSco = {
          username: this.authService.getUsername() ?? '',
          password: this.authService.getPassword() ?? ''
        };

        this.actividades = items.map(i => ({
          ...i,
          tipoActividadSeleccionado: i.idTipoActividad ?? null,
          actividadSeleccionada:     typeof i.idActividad === 'number' ? i.idActividad : null,
          proyectoSeleccionado:      typeof i.idProyecto  === 'number' ? i.idProyecto  : null,
          faseSeleccionada:          i.fase ?? this.resolverFasePorTipo(i.idTipoActividad),
          catalogoActividades:       [] as CatalogoItem[],
          registrando: false,
          registrado:  false
        }));
        this.sesionesNoPareadas = [];
        this.hasResults         = true;
        this.pAct               = 1;

        // Cargar catálogo de actividades por cada tipo único (igual que ejecutarConsulta)
        const tiposUnicos = [...new Set(
          this.actividades.map(a => a.tipoActividadSeleccionado).filter((t): t is number => !!t)
        )];
        tiposUnicos.forEach(idTipo => {
          this.actividadService.getCatalogoActividades(idTipo, this.credencialesSco!).subscribe({
            next: catalog => this.actividades
              .filter(a => a.tipoActividadSeleccionado === idTipo)
              .forEach(a => a.catalogoActividades = catalog)
          });
        });

        // Recargar KPIs del mes
        this.estadisticasMes = null;
        this.cargarEstadisticas();

        Swal.fire({
          title: `${items.length} actividad${items.length !== 1 ? 'es' : ''} preparada${items.length !== 1 ? 's' : ''}`,
          icon: 'success', timer: 1800, showConfirmButton: false
        });
      },
      error: (err) => {
        this.cargandoWorkItems = false;
        (event.target as HTMLInputElement).value = '';
        Swal.fire({ title: 'Error al preparar', text: err?.error?.message ?? 'No se pudo procesar el archivo.', icon: 'error' });
      }
    });
  }

  // ─── Registros por fecha ──────────────────────────────────────────────────

  abrirRegistros(): void {
    this.showRegistrosModal = true;
    this.cargarRegistrosPorFecha();
  }

  cerrarRegistrosModal(): void {
    this.showRegistrosModal = false;
  }

  cargarRegistrosPorFecha(): void {
    if (!this.credencialesSco || !this.fechaRegistrosSel) return;
    this.loadingRegistros = true;
    this.actividadService.obtenerRegistrosPorFecha(
      this.credencialesSco.username,
      this.credencialesSco.password,
      this.fechaRegistrosSel
    ).subscribe({
      next: (data) => {
        this.registrosPorFecha = data;
        this.loadingRegistros = false;
        this.registrosCargados = true;
      },
      error: () => {
        this.loadingRegistros = false;
        Swal.fire({ title: 'Error al cargar registros', icon: 'error', timer: 2000, showConfirmButton: false });
      }
    });
  }

  get totalDuracionRegistros(): string {
    const total = this.registrosPorFecha.reduce((acc, r) => {
      if (!r.horaInicio || !r.horaFin) return acc;
      const [hI, mI] = r.horaInicio.split(':').map(Number);
      const [hF, mF] = r.horaFin.split(':').map(Number);
      const min = (hF * 60 + mF) - (hI * 60 + mI);
      return acc + (min > 0 ? min : 0);
    }, 0);
    if (total === 0) return '0m';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${m}m`;
  }

  calcularDuracion(horaInicio: string, horaFin: string): string {
    if (!horaInicio || !horaFin) return '—';
    const [hI, mI] = horaInicio.split(':').map(Number);
    const [hF, mF] = horaFin.split(':').map(Number);
    const totalMin = (hF * 60 + mF) - (hI * 60 + mI);
    if (totalMin <= 0) return '—';
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
  }

  // ─── Estadísticas del mes ─────────────────────────────────────────────────

  abrirEstadisticas(): void {
    this.showStatsModal = true;
    if (!this.estadisticasMes) {
      this.cargarEstadisticas();
    }
  }

  cerrarModal(): void {
    this.showStatsModal = false;
  }

  cargarEstadisticas(): void {
    if (!this.credencialesSco) return;
    this.loadingStats = true;
    this.actividadService.obtenerEstadisticasMes(
      this.credencialesSco.username,
      this.credencialesSco.password,
      this.mesSel,
      this.anioSel
    ).subscribe({
      next: (data) => { this.estadisticasMes = data; this.loadingStats = false; },
      error: () => {
        this.loadingStats = false;
        Swal.fire({ title: 'Error al cargar estadísticas', icon: 'error', timer: 2000, showConfirmButton: false });
      }
    });
  }

  get porcentajeClass(): string {
    const p = this.estadisticasMes?.porcentaje ?? 0;
    if (p >= 80) return 'fill-green';
    if (p >= 60) return 'fill-yellow';
    return 'fill-red';
  }

  // ─── Catálogos ────────────────────────────────────────────────────────────

  onTipoActividadChange(item: ActividadItem, idTipo: number | null): void {
    item.actividadSeleccionada = null;
    item.catalogoActividades   = [];
    // Al cambiar el tipo se limpia la actividad y por ende la fase. Se resolverá al elegir la nueva actividad.
    item.faseSeleccionada      = null;
    if (!idTipo || !this.credencialesSco) return;
    this.actividadService.getCatalogoActividades(idTipo, this.credencialesSco).subscribe({
      next: items => item.catalogoActividades = items,
      error: () => item.catalogoActividades = []
    });
  }

  onActividadChange(item: ActividadItem, idActividad: number | null): void {
    item.faseSeleccionada = this.resolverFasePorActividad(item, idActividad);
  }

  // Pre-pobla el campo fase a partir del idActividad inicial venido del backend / DevOps,
  // cuando el backend no envió el valor ya resuelto.
  private resolverFasePorTipo(idTipo: number | null | undefined): string | null {
    // Si no es tipo Servicio, no aplica fase.
    if (!idTipo || idTipo !== this.ID_TIPO_SERVICIO) return null;
    return null;
  }

  // Resuelve la fase por defecto a partir de la actividad seleccionada.
  // Solo aplica cuando el tipo de actividad es "Servicio".
  private resolverFasePorActividad(item: ActividadItem, idActividad: number | null | undefined): string | null {
    const idTipo = item.tipoActividadSeleccionado ?? item.idTipoActividad;
    if (idTipo !== this.ID_TIPO_SERVICIO) return null;
    if (!idActividad) return null;
    const actividad = (item.catalogoActividades ?? []).find(a => a.id === idActividad);
    if (!actividad) return 'No Aplica';
    const clave = normalizar(actividad.descripcion);
    return MAPEO_TIPO_FASE[clave] ?? 'No Aplica';
  }

  // ─── Helpers template ─────────────────────────────────────────────────────

  getNombreProyecto(idProyecto: number | string): string {
    const proyecto = this.proyectosDisponibles.find(p => p.id === idProyecto);
    return proyecto ? proyecto.descripcion : String(idProyecto);
  }

  tipoLabel(item: ActividadItem): string {
    return item.idActividad === 1 ? 'Interna' : 'Externa';
  }

  field(name: string) {
    return this.formulario.get(name);
  }

  get puedeRegistrar(): boolean {
    return this.credencialesSco !== null;
  }
}
