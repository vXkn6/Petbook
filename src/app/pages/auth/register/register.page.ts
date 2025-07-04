import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController } from '@ionic/angular';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AutheticationService } from 'src/app/services/authetication.service';


@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {

registerForm: FormGroup;

  private fb = inject(FormBuilder);
  private authService = inject(AutheticationService);
  private loadingController = inject(LoadingController);
  private alertController = inject(AlertController);
  private router = inject(Router);
  
  constructor() {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { 
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password === confirmPassword) {
      form.get('confirmPassword')?.setErrors(null);
      return null;
    } else {
      form.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
  }

  async register() {
    if (this.registerForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Registrando usuario...',
      });
      await loading.present();

      try {
        const { email, password } = this.registerForm.value;
        // La llamada a register ahora devuelve el UserCredential
        const userCredential = await this.authService.register(email, password);

        // --- Guardar datos adicionales en Firestore ---
        if (userCredential.user) {
          await this.authService.saveUserData(userCredential.user.uid, userCredential.user.email || email);
        }
        // ----------------------------------------------

        loading.dismiss();

        const alert = await this.alertController.create({
          header: 'Registro exitoso',
          message: 'Tu cuenta ha sido creada con éxito. Ya puedes iniciar sesión.',
          buttons: [
            {
              text: 'Ir al login',
              handler: () => {
                this.router.navigate(['/login']);
              }
            }
          ]
        });
        await alert.present();
      } catch (error: any) {
        loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Error de registro',
          message: this.getErrorMessage(error),
          buttons: ['OK']
        });
        await alert.present();
      }
    } else {
      const alert = await this.alertController.create({
        header: 'Formulario inválido',
        message: 'Por favor, completa todos los campos correctamente.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Este correo electrónico ya está registrado.';
      case 'auth/invalid-email':
        return 'El formato del correo electrónico es inválido.';
      case 'auth/weak-password':
        return 'La contraseña es demasiado débil.';
      default:
        return `Error: ${error.message}`;
    }
  }
}
