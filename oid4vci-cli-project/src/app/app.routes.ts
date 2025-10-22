import { Routes } from '@angular/router';
import { CallbackComponent } from './pages/callback/callback.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'callback', component: CallbackComponent },
  { path: 'logout', redirectTo: '', pathMatch: 'full' },
];
