import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KeycloakWrapperService } from '../../services/keycloak-wrapper.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `<p style="padding:1rem">Finishing login…</p>`,
})
export class CallbackComponent implements OnInit {
  private kc = inject(KeycloakWrapperService);
  private router = inject(Router);

  // No constructor needed when using inject()

  async ngOnInit() {
    try {
      console.log('Callback component initialized, redirecting to home');

      // Ensure we're logged in before redirecting
      const isLoggedIn = this.kc.isLoggedIn();
      console.log('Is logged in:', isLoggedIn);

      // Redirect to home if logged in
      this.router.navigateByUrl('/');
    } catch (error) {
      console.error('Error in callback component:', error);

      // Check login status before redirecting
      if (this.kc.isLoggedIn()) {
        // If somehow still logged in despite the error, go to home
        this.router.navigateByUrl('/');
      } else {
        // If not logged in, show an alert and stay on callback page
        // This gives the user a chance to see the error or try again
        alert('Login failed. Please try again.');
      }
    }
  }
}
