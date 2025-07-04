import { Injectable, inject } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  authState,
  sendPasswordResetEmail,
  UserCredential
} from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AutheticationService {
 private auth: Auth = inject(Auth);
   private firestore: Firestore = inject(Firestore);
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
  
  async saveUserData(uid: string, email: string, displayName?: string): Promise<void> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users'); // Referencia a la colección 'users'
      const userDocRef = doc(usersCollectionRef, uid); // Referencia al documento específico con el UID como ID

      await setDoc(userDocRef, {
        email: email,
        displayName: displayName || 'Usuario Nuevo', // Puedes pasar un nombre o usar uno por defecto
        role: 'user', // Rol por defecto al registrar
        creationTime: new Date(), // Fecha de creación del usuario
        isActive: true // Estado por defecto
      });
      console.log('Datos de usuario guardados en Firestore:', uid);
    } catch (error) {
      console.error('Error al guardar datos del usuario en Firestore:', error);
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