import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { IonicModule, AlertController, ActionSheetController, ToastController, LoadingController } from '@ionic/angular';
import { Firestore, doc, updateDoc, getDoc } from '@angular/fire/firestore';
import { Auth, updateProfile, user } from '@angular/fire/auth';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { camera, person } from 'ionicons/icons';
import { User } from 'src/app/models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  userData: User | null = null;
  profileForm: FormGroup;
  selectedPhoto: string | null = null;
  private userSub: Subscription | undefined;

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private formBuilder: FormBuilder,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    this.profileForm = this.formBuilder.group({
      displayName: ['', Validators.required],
      email: [{ value: '', disabled: true }]
    });

    addIcons({ camera, person });
  }

  ngOnDestroy() {
    this.userSub?.unsubscribe();
  }

  async updateProfile() {
    if (!this.userData || this.profileForm.invalid) return;

    const loading = await this.loadingCtrl.create({
      message: 'Actualizando perfil...'
    });
    await loading.present();

    try {
      // Actualizar solo el nombre en Auth
      await updateProfile(this.auth.currentUser!, {
        displayName: this.profileForm.value.displayName,
        photoURL: null // No guardamos imagen en Auth
      });

      // Guardar todo en Firestore
      const userRef = doc(this.firestore, `users/${this.userData.uid}`);
      await updateDoc(userRef, {
        displayName: this.profileForm.value.displayName,
        email: this.userData.email,
        photoURL: this.selectedPhoto || null,
        lastUpdated: new Date()
      });

      // Actualizar datos locales
      if (this.userData) {
        this.userData.displayName = this.profileForm.value.displayName;
        this.userData.photoURL = this.selectedPhoto || undefined;
      }

      const toast = await this.toastCtrl.create({
        message: 'Perfil actualizado correctamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error updating profile:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error al actualizar el perfil',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  // Modificar el ngOnInit para cargar la imagen desde Firestore
  async ngOnInit() {
    this.userSub = user(this.auth).subscribe(async user => {
      if (user) {
        // Obtener datos de Firestore
        const userDoc = await getDoc(doc(this.firestore, `users/${user.uid}`));
        const userDataFromFirestore = userDoc.exists() ? userDoc.data() : {};

        this.userData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || userDataFromFirestore['displayName'] || '',
          role: userDataFromFirestore['role'] || 'user',
          photoURL: userDataFromFirestore['photoURL'] || ''
        };

        this.profileForm.patchValue({
          displayName: this.userData.displayName,
          email: this.userData.email
        });

        this.selectedPhoto = this.userData.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg';
      } else {
        this.userData = null;
      }
    });
  }

  async changeProfilePicture() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar imagen',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.getPicture(CameraSource.Camera);
          }
        },
        {
          text: 'Elegir de la galería',
          icon: 'image',
          handler: () => {
            this.getPicture(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }
  async getPicture(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 70, // Calidad reducida para que el base64 no sea demasiado grande
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source
      });

      if (image.dataUrl) {
        this.selectedPhoto = image.dataUrl;
      }
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  }
}