import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { InactivityService } from './services/inactivity.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy {

  isLoginPage = false;

  @ViewChild('gokuCanvas') gokuCanvas!: ElementRef<HTMLCanvasElement>;

  // ── Estado de la animación "lluvia binaria con forma de Goku" ──────────────
  private ctx!: CanvasRenderingContext2D;
  private rafId = 0;
  private fontSize = 14;
  private cols = 0;
  private rows = 0;
  private drops: number[] = [];         // posición (fila) de la onda por columna
  private shape: Float32Array[] = [];   // intensidad (0..1) por celda [col][row]
  private chars!: Uint8Array;           // dígito actual (0/1) por celda
  private readonly speed = 0.28;        // filas por frame que baja la onda
  private readonly img = new Image();
  private imgReady = false;
  private readonly onResize = () => this.setup();

  constructor(
    public authService: AuthService,
    private router: Router,
    private inactivity: InactivityService,
    private zone: NgZone
  ) {
    if (this.authService.isLoggedIn()) {
      this.inactivity.start();
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isLoginPage = e.urlAfterRedirects === '/login';

      if (e.urlAfterRedirects === '/login') {
        this.inactivity.stop();
      } else if (this.authService.isLoggedIn()) {
        this.inactivity.start();
      }
    });
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    const canvas = this.gokuCanvas?.nativeElement;
    if (!canvas) { return; }
    this.ctx = canvas.getContext('2d')!;

    this.img.onload = () => { this.imgReady = true; this.setup(); };
    this.img.src = 'assets/goku-binary.png';

    window.addEventListener('resize', this.onResize, { passive: true });
    this.setup();
    // La animación corre fuera de Angular para no disparar change-detection.
    this.zone.runOutsideAngular(() => this.loop());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
  }

  // ── Configuración / re-cálculo de la malla y la forma ───────────────────────
  private setup(): void {
    const canvas = this.gokuCanvas?.nativeElement;
    if (!canvas || !this.ctx) { return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.fontSize = w < 600 ? 11 : 14;
    this.cols = Math.ceil(w / this.fontSize);
    this.rows = Math.ceil(h / this.fontSize);
    // Cada columna arranca su onda en una fila distinta (desfasadas).
    this.drops = Array.from({ length: this.cols }, () => Math.random() * this.rows);

    this.buildShape();
  }

  /** Muestrea la imagen a la resolución de la malla y guarda la intensidad
   *  (zonas oscuras de la imagen = silueta de Goku). */
  private buildShape(): void {
    this.shape = [];
    if (!this.imgReady || this.cols === 0 || this.rows === 0) { return; }

    const off = document.createElement('canvas');
    off.width = this.cols;
    off.height = this.rows;
    const octx = off.getContext('2d', { willReadFrequently: true })!;

    // Imagen "cover": llena toda la pantalla (recorta lo que sobre).
    const iw = this.img.width;
    const ih = this.img.height;
    const scale = Math.max(this.cols / iw, this.rows / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    // Posición horizontal del recorte: 0 = izquierda, 0.5 = centro.
    const dx = (this.cols - dw) * 0.32;
    const dy = (this.rows - dh) / 2;

    octx.fillStyle = '#ffffff';                 // fuera de la imagen = blanco = ignorado
    octx.fillRect(0, 0, this.cols, this.rows);
    octx.drawImage(this.img, dx, dy, dw, dh);

    const data = octx.getImageData(0, 0, this.cols, this.rows).data;
    for (let c = 0; c < this.cols; c++) {
      const arr = new Float32Array(this.rows);
      for (let r = 0; r < this.rows; r++) {
        const i = (r * this.cols + c) * 4;
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        arr[r] = Math.max(0, (255 - lum) / 255);   // oscuro -> intensidad alta
      }
      this.shape.push(arr);
    }

    // Dígitos iniciales aleatorios (0/1) por celda.
    this.chars = new Uint8Array(this.cols * this.rows);
    for (let k = 0; k < this.chars.length; k++) {
      this.chars[k] = Math.random() < 0.5 ? 0 : 1;
    }
  }

  // ── Bucle de render ──────────────────────────────────────────────────────────
  private loop = (): void => {
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) { return; }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fs = this.fontSize;

    ctx.clearRect(0, 0, w, h);

    const hasShape = this.shape.length === this.cols && !!this.chars;
    if (!hasShape) { return; }

    ctx.font = `${fs}px "Consolas", "Courier New", monospace`;
    ctx.textBaseline = 'top';

    const waveLen = 8;   // largo de la onda brillante (en filas)

    for (let c = 0; c < this.cols; c++) {
      const colShape = this.shape[c];
      const head = this.drops[c];

      for (let r = 0; r < this.rows; r++) {
        const intensity = colShape[r];
        if (intensity <= 0.14) { continue; }   // fuera de la silueta de Goku

        const k = c * this.rows + r;
        // Parpadeo ocasional del dígito
        if (Math.random() < 0.03) { this.chars[k] = this.chars[k] ? 0 : 1; }

        // Distancia (con wrap) por debajo de la cabeza de la onda
        let d = head - r;
        if (d < 0) { d += this.rows; }
        const wave = d < waveLen ? (1 - d / waveLen) : 0;

        // Presencia constante (Goku siempre visible) + brillo de la onda
        const a = Math.min(1, 0.18 + intensity * 0.42 + wave * 0.85);
        const x = c * fs;
        const y = r * fs;

        ctx.fillStyle = wave > 0.82
          ? `rgba(225, 240, 255, ${a})`     // cabeza brillante (blanco)
          : `rgba(96, 165, 250, ${a})`;     // cuerpo azul del tema
        ctx.fillText(this.chars[k] ? '1' : '0', x, y);
      }

      // La onda baja de forma constante y reaparece arriba (sin huecos).
      this.drops[c] += this.speed;
      if (this.drops[c] >= this.rows) { this.drops[c] -= this.rows; }
    }
  }

  logout(): void {
    this.inactivity.stop();
    this.authService.logout();
  }
}
