import { Injectable, inject } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  authState,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AutheticationService {
 private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  
  private authState = new BehaviorSubject<boolean>(false);
  currentUser$ = authState(this.auth);
  isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  constructor() {
    this.currentUser$.subscribe(user => {
      this.authState.next(!!user);
    });
  }

  get isAuthenticated(): Observable<boolean> {
    return this.authState.asObservable();
  }

  // Método para registrar un nuevo usuario
  async register(email: string, password: string): Promise<any> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return userCredential;
    } catch (error) {
      throw error;
    }
  }

  // Método para iniciar sesión
  async login(email: string, password: string): Promise<any> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      this.router.navigate(['/home']);
      return userCredential;
    } catch (error) {
      throw error;
    }
  }

  // Método para cerrar sesión
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error) {
      throw error;
    }
  }

  // Obtener el usuario actual
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Método para restablecer la contraseña
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      throw error;
    }
  }
}