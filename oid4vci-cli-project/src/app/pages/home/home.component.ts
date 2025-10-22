import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { KeycloakWrapperService } from '../../services/keycloak-wrapper.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  styleUrls: ['./home.component.scss'],
  template: `
    <div class="page">
      <div class="landing">
        <aside class="left">
          <div class="left-inner">
            <div class="logos">
              <img
                class="logo-bstbk"
                src="assets/bstbk-logo.svg"
                alt="Bundes Steuerberater Kammer"
              />
              <div class="teaser-holder">
                <img class="logo-teaser" src="assets/teaser.svg" alt="Teaser" />
              </div>
            </div>
            <div class="sidebar-links">
              <a href="https://www.bstbk.de/de/impressum" target="_blank" rel="noopener"
                >Impressum</a
              >
              <span class="sep">·</span>
              <a
                href="https://www.bstbk.de/de/datenschutzinformation"
                target="_blank"
                rel="noopener"
                >Datenschutz</a
              >
              <span class="sep">·</span>
              <a
                href="https://apps.dev.datev.de/self-service-testing/nutzungsbedingungen"
                rel="noopener"
                >Nutzungsbedingungen</a
              >
            </div>
          </div>
        </aside>
        <main class="right">
          <div class="content">
            <h1 class="title">Steuerberaterplattform</h1>
            <h2 class="subtitle">Willkommen!</h2>

            <div class="cta-row">
              <div class="cta">
                <div class="cta-hint">Noch nicht registriert?</div>
                <button mat-stroked-button class="btn-ghost" disabled>Registrieren</button>
              </div>
              <div class="cta">
                <div class="cta-hint">Bereits registriert?</div>
                <button mat-raised-button class="btn-primary" (click)="onLogin()">Anmelden</button>
              </div>
            </div>

            <hr class="divider" />

            <p class="info-text">
              Weiterführende Informationen zum besonderen elektronischen Steuerberaterpostfach
              (beSt) unter:
            </p>
            <p class="info-link">
              <a href="https://steuerberaterplattform-bstbk.de" target="_blank" rel="noopener"
                >BStBK - Steuerberaterplattform</a
              >
            </p>
          </div>
        </main>
      </div>
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private keycloak = inject(KeycloakWrapperService);
  private router = inject(Router);

  ngOnInit() {
    // Check if user is already authenticated
    if (this.keycloak.isLoggedIn()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  async onLogin() {
    try {
      await this.keycloak.login({ redirectUri: window.location.origin + '/callback' });
    } catch (err: unknown) {
      console.error('Login error:', err);
      alert('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
  }
}
