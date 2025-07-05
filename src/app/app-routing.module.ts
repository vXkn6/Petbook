import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/auth/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./pages/auth/register/register.module').then(m => m.RegisterPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule),
    canActivate: [authGuard]
  },
  {
    path: 'veterinarios',
    loadChildren: () => import('./pages/veterinarios/veterinarios.module').then(m => m.VeterinariosPageModule)
  },
  {
    path: 'petfile',
    loadChildren: () => import('./pages/petfile/petfile.module').then(m => m.PetfilePageModule)
  },
  {
    path: 'calendario',
    loadChildren: () => import('./pages/calendario/calendario.module').then(m => m.CalendarioPageModule)
  },
  {
    path: 'chatbot',
    loadChildren: () => import('./pages/chatbot/chatbot.module').then(m => m.ChatbotPageModule)
  },
  {
    path: 'citas',
    loadChildren: () => import('./pages/citas/citas.module').then(m => m.CitasPageModule)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./pages/chat-analytics/chat-analytics.module').then(m => m.ChatAnalyticsPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfilePageModule)
  },
  {
    path: '**',
    redirectTo: 'login'
  },





];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
