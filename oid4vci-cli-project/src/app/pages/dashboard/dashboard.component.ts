import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeycloakWrapperService } from '../../services/keycloak-wrapper.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QrContentComponent } from './qr-content/qr-content.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, QrContentComponent],
  template: `
    <div class="container-fluid">
      <div class="row">
        <header class="col-md-3 sidebar navi--is-visible">
          <div class="bstk-logo">
            <img
              src="assets/bstbk-logo.svg"
              width="158"
              height="auto"
              alt="Besonderes elektronisches Steuerberaterpostfach zur Startseite"
            />
          </div>
          <div class="navi__container">
            <div aria-label="Benutzerinformation" class="user-info">
              <p class="bstbk--blue ellipsis h3 mb-1">{{ userDisplayName() }}</p>
              <span>Teilnehmer-Nr.: 5708128</span>
            </div>
            <nav aria-label="Haupt">
              <ul class="navi">
                <li class="navi__item">
                  <a
                    class="navi__link"
                    [class.navi__link--active]="activeTab === 'postfach'"
                    href="javascript:void(0)"
                    (click)="setActiveTab('postfach')"
                    >Postfachverwaltung</a
                  >
                </li>
                <li class="navi__item">
                  <a
                    class="navi__link"
                    [class.navi__link--active]="activeTab === 'qr'"
                    href="javascript:void(0)"
                    (click)="setActiveTab('qr')"
                    >Steuerberateridentität</a
                  >
                </li>
                <li class="navi__item">
                  <div class="navi__menu">
                    <a role="button" tabindex="0" class="navi__button d-flex align-items-baseline">
                      <span>Nachrichtenübersicht</span>
                    </a>
                    <ul role="menu" id="sub-menu-2" class="collapse">
                      <li role="menuitem" class="pb-4">
                        <a class="d-block" href="javascript:void(0)">Eigene Postfächer</a>
                      </li>
                      <li role="menuitem" class="pb-4">
                        <a class="d-block" href="javascript:void(0)">Vertretene Postfächer</a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li class="navi__item">
                  <a class="navi__link" href="javascript:void(0)">Kontakt</a>
                </li>
                <li class="navi__item">
                  <a
                    tabindex="0"
                    class="navi__link"
                    (click)="onLogout()"
                    (keydown.enter)="onLogout()"
                  >
                    <span>Abmelden</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <nav aria-label="Service">
            <ul class="list-inline">
              <li class="list-inline-item">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-dark"
                  href="https://www.bstbk.de/de/impressum"
                  >Impressum</a
                >
              </li>
              <li class="list-inline-item">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-dark"
                  href="https://www.bstbk.de/de/datenschutzerklaerung"
                  >Datenschutz</a
                >
              </li>
              <li class="list-inline-item">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-dark"
                  href="javascript:void(0)"
                  >Nutzungsbedingungen</a
                >
              </li>
            </ul>
          </nav>
        </header>
        <main class="col-md-9 d-flex flex-column mh-100">
          <div class="content-wrapper">
            <section tabindex="-1" class="content">
              <!-- Postfachverwaltung Tab -->
              <div *ngIf="activeTab === 'postfach'">
                <h1>Postfachverwaltung</h1>

                <div class="alert alert-info">
                  <div class="d-flex align-items-start">
                    <svg
                      fill="inherit"
                      class="bi bi--left"
                      width="25"
                      height="25"
                      role="presentation"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill="#633200"
                        fill-opacity=".9"
                        d="M3.577 19h12.847c1.913 0 3.157-2.013 2.302-3.724L12.302 2.423c-.948-1.897-3.655-1.897-4.603 0L1.275 15.276C.42 16.986 1.664 19 3.577 19Z"
                      ></path>
                      <path
                        fill="#FFC800"
                        d="M10 2c.609 0 1.135.325 1.407.87l6.423 12.853a1.545 1.545 0 0 1-.07 1.53c-.291.475-.78.747-1.337.747H3.577a1.544 1.544 0 0 1-1.338-.746 1.545 1.545 0 0 1-.07-1.531L8.594 2.87A1.54 1.54 0 0 1 10 2Z"
                      ></path>
                      <path
                        fill="#000"
                        d="m11 5-.161 8H9.16L9 5h2Zm-.941 12c-.295 0-.544-.096-.75-.286A.91.91 0 0 1 9 16.019c0-.283.103-.523.309-.721.206-.198.455-.298.75-.298.284 0 .53.099.739.298a.957.957 0 0 1 .312.721.904.904 0 0 1-.313.695 1.06 1.06 0 0 1-.738.286Z"
                      ></path>
                    </svg>
                    <div class="flex-grow-1">
                      <p>
                        Wählen Sie <strong>ein bis maximal 10 Postfächer</strong> aus. Laden Sie
                        anschließend die Zertifikate herunter.
                      </p>
                      <p>
                        <a href="javascript:void(0)" class="link--white"
                          >Download ausführliche Schritt-für-Schritt-Anleitung</a
                        >
                      </p>
                      <div class="d-flex">
                        <div class="form-check me-auto">
                          <input
                            type="checkbox"
                            id="check-postboxes-info"
                            class="form-check-input form-check-input--blue"
                          />
                          <label for="check-postboxes-info" class="form-check-label"
                            >Nicht mehr anzeigen</label
                          >
                        </div>
                        <button type="button" class="btn btn-outline-secondary--white">
                          Verstanden
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="filter-sort-container">
                  <div class="filter-container">
                    <label for="filter" class="form-label">Filter</label>
                    <div class="d-flex">
                      <input
                        id="filter"
                        type="search"
                        autocomplete="off"
                        class="form-control"
                        placeholder="Filterbegriff eingeben..."
                      />
                      <button class="btn btn-outline-secondary ms-2" aria-label="Filterkriterien">
                        <svg
                          fill="inherit"
                          class="bi"
                          width="16"
                          height="16"
                          role="presentation"
                          viewBox="0 0 16 16"
                        >
                          <path
                            d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2h-11z"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="sort-container">
                    <label for="sort" class="form-label">Sortierung</label>
                    <div class="d-flex">
                      <select id="sort" class="form-select">
                        <option selected value="0: null">Sortierung auswählen...</option>
                        <option value="1: name">Name</option>
                        <option value="2: plz">Postleitzahl</option>
                      </select>
                      <button
                        class="btn btn-outline-secondary ms-2"
                        disabled
                        aria-label="Absteigende Sortierung ausgewählt"
                      >
                        <img
                          role="presentation"
                          src="assets/desc.svg"
                          width="10"
                          height="14"
                          alt="Absteigende Sortierung ausgewählt"
                          title="Absteigende Sortierung ausgewählt"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="postbox-list">
                  <div class="postbox__select-all">
                    <div aria-live="polite">
                      <p aria-label="Liste gefiltert auf" class="m-0">4 Postfächer</p>
                    </div>
                  </div>

                  <div role="region" class="postbox card">
                    <div class="card-body p-0">
                      <div class="postbox__head">
                        <input
                          type="checkbox"
                          aria-describedby="pb-list-status"
                          class="form-check-input"
                          id="check-0"
                        />
                        <label class="form-check-label" for="check-0">
                          <h2 class="h4 mb-0 ellipsis" id="pb-list-check-label-0">Iris Speiser</h2>
                        </label>
                      </div>
                      <div class="postbox__info">
                        <div class="d-flex">
                          <span class="postbox__valid" id="pb-list-status"
                            >Gültig bis 26.01.2025</span
                          >
                          <button class="ms-1 btn btn-link" type="button">
                            <svg
                              fill="inherit"
                              class="bi"
                              width="20"
                              height="20"
                              role="presentation"
                              viewBox="0 0 16 16"
                            >
                              <path
                                d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
                              ></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="postbox__data">
                        <ul>
                          <li>
                            <svg
                              fill="inherit"
                              class="bi bi--left"
                              width="16"
                              height="16"
                              role="presentation"
                              viewBox="0 0 16 16"
                            >
                              <path
                                d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                              ></path>
                            </svg>
                            <span class="visually-hidden">Safe ID</span>
                            <span>DE.BStBK_Sandbox.9103746a-ee80-4d3e-a303-7ae2c26bfea1.314a</span>
                          </li>
                          <li>
                            <svg
                              fill="inherit"
                              class="bi bi--left"
                              width="16"
                              height="16"
                              role="presentation"
                              viewBox="0 0 16 16"
                            >
                              <path
                                d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
                              ></path>
                            </svg>
                            <span class="visually-hidden">Adresse</span>
                            <span>test / 12345</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="action-bar">
                  <button type="button" class="btn btn-primary" (click)="onIssueCertificates()">
                    Zertifikat(e) herunterladen
                  </button>
                  <div class="ms-auto d-flex align-items-center">
                    <a href="javascript:void(0)" class="mx-2">Hilfe</a>
                    <button type="button" class="btn btn-tertiary">
                      <svg
                        fill="inherit"
                        class="bi bi--left"
                        width="15"
                        height="15"
                        role="presentation"
                        viewBox="4 4 8 8"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5"
                        ></path>
                      </svg>
                      Nach oben
                    </button>
                  </div>
                </div>
              </div>

              <!-- QR Code Tab -->
              <div *ngIf="activeTab === 'qr'" class="qr-code-container">
                <app-qr-content (back)="setActiveTab('postfach')"> </app-qr-content>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  userDisplayName = signal('•••');
  activeTab: 'postfach' | 'qr' = 'postfach';

  private router = inject(Router);
  private keycloakService = inject(KeycloakWrapperService);

  ngOnInit(): void {
    console.log('Dashboard component initialized');
    this.loadUserDisplayName();
  }

  setActiveTab(tab: 'postfach' | 'qr'): void {
    this.activeTab = tab;
  }

  onIssueCertificates(): void {
    this.setActiveTab('qr');
  }

  async loadUserDisplayName() {
    const userInfo = await this.keycloakService.getUserInfo();
    console.log('User Info:', userInfo);
    this.userDisplayName.set(`${userInfo?.firstName} ${userInfo?.lastName}`);
  }

  async onLogout(): Promise<void> {
    try {
      await this.keycloakService.logout(window.location.origin + '/logout');
    } finally {
      this.router.navigateByUrl('/');
    }
  }
}
