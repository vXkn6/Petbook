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
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  getDoc 
} from '@angular/fire/firestore';
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
  async register(email: string, password: string): Promise<UserCredential> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return userCredential;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si un nombre de usuario está disponible
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      const q = query(usersCollectionRef, where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.empty; // true si está disponible, false si ya existe
    } catch (error) {
      console.error('Error checking username availability:', error);
      throw error;
    }
  }
  
  // Método actualizado para guardar datos del usuario incluyendo username
  async saveUserData(uid: string, email: string, username: string, displayName?: string): Promise<void> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      const userDocRef = doc(usersCollectionRef, uid);

      await setDoc(userDocRef, {
        uid: uid,
        email: email,
        username: username.toLowerCase(), // Guardamos en minúsculas para consistencia
        displayName: displayName || username, // Usamos el username como displayName por defecto
        role: 'user',
        creationTime: new Date(),
        updatedTime: new Date(),
        isActive: true
      });
      console.log('Datos de usuario guardados en Firestore:', uid);
    } catch (error) {
      console.error('Error al guardar datos del usuario en Firestore:', error);
      throw error;
    }
  }

  // Método para obtener datos del usuario desde Firestore
  async getUserData(uid: string): Promise<any> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        throw new Error('Usuario no encontrado en Firestore');
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }

  // Método para obtener usuario por username
  async getUserByUsername(username: string): Promise<any> {
    try {
      const usersCollectionRef = collection(this.firestore, 'users');
      const q = query(usersCollectionRef, where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data();
      } else {
        throw new Error('Usuario no encontrado');
      }
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  // Método para iniciar sesión
  async login(email: string, password: string): Promise<UserCredential> {
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

  // Método para verificar si el usuario actual está autenticado
  isUserAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  // Método para actualizar datos del usuario
  async updateUserData(uid: string, data: any): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      await setDoc(userDocRef, {
        ...data,
        updatedTime: new Date()
      }, { merge: true });
      console.log('Datos del usuario actualizados');
    } catch (error) {
      console.error('Error al actualizar datos del usuario:', error);
      throw error;
    }
  }
}