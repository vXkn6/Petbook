import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ActionSheetController, AlertController, IonTextarea, MenuController, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  logOutOutline, personCircleOutline, cameraOutline,
  imagesOutline, heartOutline, heart, chatbubbleOutline,
  ellipsisVerticalOutline, trashOutline, closeOutline, personOutline, pawOutline, calendarOutline,
  medicalOutline, chatbubblesOutline, send, sync, clipboardOutline, barChartOutline
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { AutheticationService } from '../services/authetication.service';
import { SocialService } from '../services/social.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Post, Comment } from '../models/post.model';
import { Observable } from 'rxjs';
import Compressor from 'compressorjs';
import { CommentsModalComponent } from '../components/comments-modal/comments-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  userEmail: string | null = null;
  userRole: string | null = null;
  userName: string | null = null;
  userPhotoURL: string | null = null;
  currentUser: any = null;

  posts$: Observable<Post[]>;
  newPostContent = '';
  selectedImageBase64: string | undefined = undefined;
  selectedImagePreview: string | undefined = undefined;
  selectedPetType: 'dog' | 'cat' | 'other' = 'other';
  currentFilter: 'dog' | 'cat' | null = null;

  isLoading = false;

  @ViewChild('postTextarea') postTextarea!: IonTextarea;

  private authService = inject(AutheticationService);
  private socialService = inject(SocialService);
  private router = inject(Router);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);
  private menuCtrl = inject(MenuController);
  private modalController = inject(ModalController);

  constructor() {
    addIcons({
      personCircleOutline, personOutline, pawOutline, calendarOutline, medicalOutline, chatbubblesOutline,
      logOutOutline, closeOutline, cameraOutline, send, sync, ellipsisVerticalOutline,
      chatbubbleOutline, heartOutline, heart, trashOutline, clipboardOutline, barChartOutline
    });

    this.posts$ = this.socialService.posts$;
  }

  async ngOnInit() {
    // Verificar autenticación y cargar datos
    await this.loadUserData();

    // Escuchar cambios de autenticación
    this.authService.currentUser$.subscribe(async (user) => {
      if (user) {
        await this.loadUserData();
      } else {
        // Limpiar datos si no hay usuario
        this.clearUserData();
        this.router.navigate(['/login']);
      }
    });
  }

  private async loadUserData() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.clearUserData();
      return;
    }

    this.currentUser = user;
    this.userEmail = user.email;

    try {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData) {
        this.userRole = userData['role'] || null;
        this.userName = userData['displayName'] || userData['name'] || null;
        this.userPhotoURL = userData['photoURL'] || null;
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
  }

  private clearUserData() {
    this.userEmail = null;
    this.userRole = null;
    this.userName = null;
    this.userPhotoURL = null;
    this.currentUser = null;
  }

  getUserPhoto(): string {
    return this.userPhotoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg';
  }

  async focusTextarea() {
    if (this.postTextarea) {
      await this.postTextarea.setFocus();
    }
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar Sesión',
          handler: async () => {
            try {
              await this.authService.logout();
              // Limpiar los datos locales
              this.userEmail = null;
              this.userRole = null;
              this.userName = null;
              this.userPhotoURL = null;
              this.currentUser = null;

              // Cerrar el menú
              await this.menuCtrl.close('main-menu');

              // Redirigir al login
              this.router.navigate(['/login']);
            } catch (error) {
              console.error('Error al cerrar sesión:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async selectImage() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Seleccionar Imagen',
      buttons: [
        {
          text: 'Cámara',
          icon: 'camera-outline',
          handler: () => {
            this.takePicture(CameraSource.Camera);
          }
        },
        {
          text: 'Galería',
          icon: 'images-outline',
          handler: () => {
            this.takePicture(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async takePicture(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source,
        width: 800,
        height: 800
      });

      if (image.base64String) {
        const compressedBase64 = await this.compressImage(image.base64String);
        this.selectedImageBase64 = compressedBase64;
        this.selectedImagePreview = `data:image/jpeg;base64,${compressedBase64}`;
      }
    } catch (error) {
      console.error('Error al tomar foto:', error);
      this.showToast('Error al capturar imagen', 'danger');
    }
  }

  private async compressImage(base64: string): Promise<string> {
    const blob = this.base64ToBlob(base64);
    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      new Compressor(blob, {
        quality: 0.7,
        maxWidth: 1024,
        maxHeight: 1024,
        success: resolve,
        error: reject
      });
    });
    return this.blobToBase64(compressedBlob);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, contentType = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }

  setFilter(petType: 'dog' | 'cat' | null) {
    this.currentFilter = petType;
    this.socialService.setFilter(petType);
  }

  async createPost() {
    if (!this.newPostContent.trim() && !this.selectedImageBase64) {
      this.showToast('Escribe algo o selecciona una imagen', 'warning');
      return;
    }

    this.isLoading = true;

    try {
      await this.socialService.createPost(
        this.newPostContent,
        this.selectedImageBase64,
        this.selectedPetType
      );

      this.resetPostForm();
      this.showToast('¡Publicación creada!', 'success');
    } catch (error) {
      console.error('Error:', error);
      this.showToast('Error al crear publicación', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private resetPostForm() {
    this.newPostContent = '';
    this.selectedImageBase64 = undefined;
    this.selectedImagePreview = undefined;
  }

  removeSelectedImage() {
    this.selectedImageBase64 = undefined;
    this.selectedImagePreview = undefined;
  }

  async toggleLike(postId: string) {
    try {
      await this.socialService.toggleLike(postId);
    } catch (error) {
      console.error('Error al dar like:', error);
      this.showToast('Error al dar like', 'danger');
    }
  }

  hasUserLiked(post: Post): boolean {
    return this.socialService.hasUserLiked(post);
  }

  isUserPost(post: Post): boolean {
    return this.socialService.isUserPost(post);
  }

  async showComments(post: Post) {
    try {
      const comments = await this.socialService.getComments(post.id!);

      const modal = await this.modalController.create({
        component: CommentsModalComponent,
        componentProps: {
          post: post,
          comments: comments
        },
        cssClass: 'comments-modal'
      });

      modal.onDidDismiss().then((result) => {
        if (result.data?.newComment) {
          this.showToast('Comentario agregado', 'success');
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error al cargar comentarios:', error);
      this.showToast('Error al cargar comentarios', 'danger');
    }
  }

  async showPostOptions(post: Post) {
    if (!this.isUserPost(post)) return;

    const actionSheet = await this.actionSheetController.create({
      header: 'Opciones de la publicación',
      buttons: [
        {
          text: 'Eliminar',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.confirmDeletePost(post);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async confirmDeletePost(post: Post) {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.socialService.deletePost(post.id!);
              this.showToast('Publicación eliminada', 'success');
            } catch (error) {
              this.showToast('Error al eliminar publicación', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  }

  trackByPostId(index: number, post: Post): string {
    return post.id || index.toString();
  }

  private async showToast(message: string, color: string) {
    const toast = document.createElement('ion-toast');
    toast.message = message;
    toast.duration = 2000;
    toast.color = color;
    toast.position = 'bottom';
    document.body.appendChild(toast);
    return toast.present();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  getUserName(): string {
    if (this.userName) return this.userName;
    if (this.userEmail) return this.userEmail.split('@')[0];
    return 'Usuario';
  }

  getUserDisplayName(): string {
    return this.userName || this.userEmail?.split('@')[0] || 'Usuario';
  }
}