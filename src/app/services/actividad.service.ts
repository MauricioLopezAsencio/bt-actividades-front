import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Constants } from '../utils/Constants';
import { ActividadData, ActividadRequest, CatalogoItem, EstadisticasMes, Fase, RegistroScoca } from '../models/actividad.model';
import { WorkItemDto } from '../models/work-item.model';

export interface ActividadApiResponse {
  status: number;
  data: ActividadData;
}

interface CatalogoApiResponse {
  status: number;
  data: CatalogoItem[];
}

@Injectable({ providedIn: 'root' })
export class ActividadService {

  private readonly urlConsulta        = Constants.baseUrl + 'actividades';
  private readonly urlRegistro        = Constants.baseUrl + 'bitacora/actividades';
  private readonly urlCatalogoActiv   = Constants.baseUrl + 'bitacora/actividades';
  private readonly urlEstadisticas    = Constants.baseUrl + 'estadisticas/mes';
  private readonly urlRegistrosFecha  = Constants.baseUrl + 'bitacora/registros/byFecha';
  private readonly urlWorkItemsImportar = Constants.baseUrl + 'actividades/work-items/importar';
  private readonly urlWorkItemsPreparar = Constants.baseUrl + 'actividades/work-items/preparar';
  private readonly urlFases             = Constants.baseUrl + 'actividades/fases';

  constructor(private http: HttpClient) {}

  consultar(req: ActividadRequest): Observable<ActividadApiResponse> {
    return this.http.post<ActividadApiResponse>(this.urlConsulta, req);
  }

  registrar(body: object): Observable<any> {
    return this.http.post<any>(this.urlRegistro, body);
  }

  obtenerEstadisticasMes(username: string, password: string, mes: number, anio: number): Observable<EstadisticasMes> {
    return this.http.post<any>(this.urlEstadisticas, { username, password, mes, anio }).pipe(
      map(res => res?.data ?? res)
    );
  }

  obtenerRegistrosPorFecha(username: string, password: string, fecha: string): Observable<RegistroScoca[]> {
    return this.http.post<any>(this.urlRegistrosFecha, { username, password, fecha }).pipe(
      map(res => res?.data ?? [])
    );
  }

  importarWorkItems(file: File): Observable<WorkItemDto[]> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(this.urlWorkItemsImportar, formData).pipe(
      map(res => res?.data ?? res)
    );
  }

  prepararWorkItems(file: File, fecha: string, username: string, password: string): Observable<ActividadData['actividades']> {
    const formData = new FormData();
    formData.append('file',     file);
    formData.append('fecha',    fecha);
    formData.append('username', username);
    formData.append('password', password);
    return this.http.post<any>(this.urlWorkItemsPreparar, formData).pipe(
      map(res => res?.data ?? res)
    );
  }

  getCatalogoFases(): Observable<Fase[]> {
    return this.http.get<any>(this.urlFases).pipe(
      map(res => res?.data ?? [])
    );
  }

  getCatalogoActividades(idTipo: number, creds: { username: string; password: string }): Observable<CatalogoItem[]> {
    const params = new HttpParams()
      .set('username', creds.username)
      .set('password', creds.password);
    return this.http.get<any>(`${this.urlCatalogoActiv}/${idTipo}`, { params }).pipe(
      map(res => {
        const inner = res?.data;
        return Array.isArray(inner) ? inner : (inner?.data ?? []);
      })
    );
  }
}
