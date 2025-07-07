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
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
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
        const { username, email, password } = this.registerForm.value;
        
        // Verificar si el nombre de usuario ya existe
        const isUsernameAvailable = await this.authService.checkUsernameAvailability(username);
        
        if (!isUsernameAvailable) {
          loading.dismiss();
          const alert = await this.alertController.create({
            header: 'Nombre de usuario no disponible',
            message: 'Este nombre de usuario ya está en uso. Por favor, elige otro.',
            buttons: ['OK']
          });
          await alert.present();
          return;
        }

        // Crear cuenta de usuario
        const userCredential = await this.authService.register(email, password);

        // Guardar datos adicionales en Firestore incluyendo el username
        if (userCredential.user) {
          await this.authService.saveUserData(
            userCredential.user.uid, 
            userCredential.user.email || email,
            username
          );
        }

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

  // Método para obtener mensajes de error del formulario
  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} es requerido`;
      if (field.errors['email']) return 'Formato de email inválido';
      if (field.errors['minlength']) return `${fieldName} debe tener al menos ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['maxlength']) return `${fieldName} no puede tener más de ${field.errors['maxlength'].requiredLength} caracteres`;
      if (field.errors['mismatch']) return 'Las contraseñas no coinciden';
    }
    return '';
  }
}