import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { KeycloakWrapperService } from '../../../services/keycloak-wrapper.service';
import { Oid4vcService } from '../../../services/oid4vc.service';

@Component({
  selector: 'app-qr-content',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule],
  template: `
    <h1>Steuerberaterplattform</h1>
    <p class="instruction-text">
      Bitte scannen sie den angezeigten QR-Code mit Ihrer EUDI Wallet App und bestätigen Sie die
      Speicherung Ihres Nachweises in ihrer digitalen Brieftasche
    </p>
    <div *ngIf="!qrDataReady" class="loading-container">
      <mat-spinner diameter="60"></mat-spinner>
      <p>QR-Code wird generiert...</p>
    </div>
    <div class="qr-container" *ngIf="qrDataReady && qrImageSrc">
      <img [src]="qrImageSrc!" alt="Credential Offer QR" width="360" height="360" />
    </div>
    <div *ngIf="qrDataReady && !qrImageSrc && offerDeeplink" class="deeplink-fallback">
      <p><b>Deeplink (Fallback):</b></p>
      <textarea cols="60" rows="2" readonly>{{ offerDeeplink }}</textarea>
    </div>
    <div class="button-group">
      <button mat-raised-button class="btn-primary" (click)="onLogout()">Abmelden</button>
    </div>
  `,
  styleUrls: ['./qr-content.component.scss'],
})
export class QrContentComponent implements OnInit {
  @Output() back = new EventEmitter<void>();

  offerDeeplink: string | null = null;
  qrImageSrc: string | null = null;
  qrDataReady = false;

  private oid4vcService = inject(Oid4vcService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private keycloakService = inject(KeycloakWrapperService);

  ngOnInit(): void {
    this.prepareQr();
  }

  private async prepareQr() {
    this.qrDataReady = false;
    try {
      // Try server-generated QR (PNG)
      const dataUrl = await this.oid4vcService.getCredentialOfferQrDataUrl();
      this.qrImageSrc = dataUrl;
      this.offerDeeplink = null;
      this.qrDataReady = true;
      this.cdr.detectChanges();
    } catch {
      // Fallback to deeplink rendering
      try {
        const deeplink = await this.oid4vcService.getCredentialOfferDeeplink();
        this.offerDeeplink = deeplink;
        this.qrImageSrc = null;
        this.qrDataReady = true;
        this.cdr.detectChanges();
      } catch {
        this.offerDeeplink = null;
        this.qrImageSrc = null;
        this.qrDataReady = false;
        alert('Failed to fetch credential offer. Please try again.');
      }
    }
  }

  onBack(): void {
    this.back.emit();
  }

  async onLogout(): Promise<void> {
    try {
      await this.keycloakService.logout(window.location.origin + '/logout');
    } finally {
      this.router.navigateByUrl('/');
    }
  }
}
