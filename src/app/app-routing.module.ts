import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { ActividadComponent } from './components/actividad/actividad.component';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'login',       component: LoginComponent },
  { path: '',            component: ActividadComponent, canActivate: [authGuard] },
  { path: 'actividades', redirectTo: '', pathMatch: 'full' },
  { path: '**',          redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
