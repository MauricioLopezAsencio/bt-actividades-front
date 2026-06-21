import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  form: FormGroup;
  errorMsg = '';
  loading  = false;
  showPass = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.form = this.fb.group({
      user:     ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.errorMsg = '';
    this.loading  = true;

    const { user, password } = this.form.value;

    this.authService.login(user, password).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          html: '<i class="bi bi-gear-fill swal-gear"></i><p class="swal-loading-text">Cargando...<br><small>Por favor, espere.</small></p>',
          showConfirmButton: false,
          allowOutsideClick: false,
          didOpen: () => setTimeout(() => {
            Swal.close();
            this.router.navigate(['/']);
          }, 1200)
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.status === 401
          ? 'Usuario o contraseña incorrectos.'
          : 'No se pudo conectar al servidor.';
      }
    });
  }
}
