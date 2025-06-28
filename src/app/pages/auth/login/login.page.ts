import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AutheticationService } from 'src/app/services/authetication.service';
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  loginForm: FormGroup;
  private fb = inject(FormBuilder);
  private authService = inject(AutheticationService);
  private loadingController = inject(LoadingController);
  private alertController = inject(AlertController);
  private router = inject(Router);
  
  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }
  async login() {
    if (this.loginForm.valid) {
      const loading = await this.loadingController.create({
        message: 'Iniciando sesión...',
      });
      await loading.present();
      try {
        const { email, password } = this.loginForm.value;
        await this.authService.login(email, password);
        loading.dismiss();
      } catch (error: any) {
        loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Error de inicio de sesión',
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
  goToRegister() {
    this.router.navigate(['/register']);
  }
  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Restablecer contraseña',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Ingresa tu correo electrónico',
          value: this.loginForm.get('email')?.value || ''
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: async (data) => {
            if (!data.email || !data.email.includes('@')) {
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Por favor, introduce un correo electrónico válido.',
                buttons: ['OK']
              });
              await errorAlert.present();
              return false;
            }
            
            const loading = await this.loadingController.create({
              message: 'Enviando instrucciones...',
            });
            await loading.present();
            
            try {
              await this.authService.resetPassword(data.email);
              loading.dismiss();
              const successAlert = await this.alertController.create({
                header: 'Correo enviado',
                message: `Se han enviado las instrucciones para restablecer tu contraseña a ${data.email}`,
                buttons: ['OK']
              });
              await successAlert.present();
              return true; // Agregamos un valor de retorno aquí
            } catch (error: any) {
              loading.dismiss();
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: this.getResetPasswordErrorMessage(error),
                buttons: ['OK']
              });
              await errorAlert.present();
              return false; // Agregamos un valor de retorno aquí
            }
          }
        }
      ]
    });
    await alert.present();
  }
  private getResetPasswordErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'La dirección de correo electrónico no es válida.';
      case 'auth/user-not-found':
        return 'No hay usuario registrado con este correo electrónico.';
      default:
        return `Error: ${error.message}`;
    }
  }
  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'No hay ningún usuario registrado con este correo electrónico.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta.';
      case 'auth/invalid-credential':
        return 'Las credenciales proporcionadas son inválidas.';
      default:
        return `Error: ${error.message}`;
    }
  }
}