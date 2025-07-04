import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ActionSheetController, AlertController, IonTextarea } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  logOutOutline, personCircleOutline, cameraOutline,
  imagesOutline, heartOutline, heart, chatbubbleOutline,
  ellipsisVerticalOutline, trashOutline, closeOutline, personOutline, pawOutline, calendarOutline, medicalOutline, chatbubblesOutline, send, sync, add
} from 'ionicons/icons';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { AutheticationService } from '../services/authetication.service';
import { SocialService } from '../services/social.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Post, Comment } from '../models/post.model';
import { Observable } from 'rxjs';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import Compressor from 'compressorjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  // Propiedades del usuario
  userEmail: string | null = null;
  userRole: string | null = null;
  userName: string | null = null;
  currentUser: any = null;

  // Propiedades de la red social
  posts$: Observable<Post[]>;
  newPostContent = '';
  selectedImageBase64: string | undefined = undefined;
  selectedImagePreview: string | undefined = undefined;

  isLoading = false;

  // Referencia al ion-textarea para poder enfocarlo
  @ViewChild('postTextarea') postTextarea!: IonTextarea;

  // Servicios inyectados
  private authService = inject(AutheticationService);
  private socialService = inject(SocialService);
  private router = inject(Router);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);
  private localImagePaths: { [postId: string]: string } = {};

  constructor() {
    addIcons({
      personCircleOutline, personOutline, pawOutline, calendarOutline, medicalOutline, chatbubblesOutline,
      logOutOutline, closeOutline, cameraOutline, send, sync, ellipsisVerticalOutline,
      chatbubbleOutline, add, imagesOutline, heartOutline, heart, trashOutline
    });

    // Inicializar posts observable si el servicio existe
    if (this.socialService) {
      this.posts$ = this.socialService.posts$;
    } else {
      // Crear un observable vacío como fallback
      this.posts$ = new Observable<Post[]>(observer => {
        observer.next([]);
      });
    }
  }

  async ngOnInit() {
    // Verificar autenticación
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = user;
    this.userEmail = user.email;

    // Obtener datos adicionales del usuario desde Firestore
    try {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData) {
        this.userRole = userData['role'] || null;
        this.userName = userData['name'] || null;
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
    }
  }

  // ¡¡AQUÍ DEBE ESTAR LA FUNCIÓN focusTextarea!!
  async focusTextarea() {
    if (this.postTextarea) {
      await this.postTextarea.setFocus(); // Usa setFocus() directamente en el componente Ionic
    }
  }

  // Métodos de autenticación
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
            } catch (error) {
              console.error('Error al cerrar sesión:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Métodos de la red social
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
      quality: 70,  // ↓ Calidad reducida (70%)
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source,
      width: 800,   // ↓ Ancho máximo
      height: 800   // ↓ Alto máximo
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
  // 1. Convertir base64 a Blob
  const blob = this.base64ToBlob(base64);
  
  // 2. Comprimir el Blob
  const compressedBlob = await new Promise<Blob>((resolve, reject) => {
    new Compressor(blob, {
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      success: resolve,
      error: reject
    });
  });
  
  // 3. Convertir el Blob comprimido de vuelta a base64
  return this.blobToBase64(compressedBlob);
}

private blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Extrae solo el base64
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

  async createPost() {
    if (!this.newPostContent.trim() && !this.selectedImageBase64) {
      this.showToast('Escribe algo o selecciona una imagen', 'warning');
      return;
    }

    this.isLoading = true;

    try {
      await this.socialService.createPost(
        this.newPostContent,
        this.selectedImageBase64
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

  getPostImage(post: Post): string | null | undefined {
    return post.imageBase64;
  }

  removeSelectedImage() {
    this.selectedImageBase64 = undefined; // En lugar de null
    this.selectedImagePreview = undefined;
  }
  async toggleLike(postId: string) {
    if (!this.socialService) return;

    try {
      await this.socialService.toggleLike(postId);
    } catch (error) {
      console.error('Error al dar like:', error);
      this.showToast('Error al dar like', 'danger');
    }
  }

  hasUserLiked(post: Post): boolean {
    if (!this.socialService) return false;
    return this.socialService.hasUserLiked(post);
  }

  isUserPost(post: Post): boolean {
    if (!this.socialService) return false;
    return this.socialService.isUserPost(post);
  }

  async showComments(post: Post) {
    if (!this.socialService) return;

    try {
      const comments = await this.socialService.getComments(post.id!);

      const alert = await this.alertController.create({
        header: `Comentarios (${comments.length})`,
        cssClass: 'comments-alert',
        inputs: [
          {
            name: 'newComment',
            type: 'textarea',
            placeholder: 'Escribe un comentario...',
            attributes: {
              maxlength: 500
            }
          }
        ],
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Comentar',
            handler: async (data: any) => {
              if (data.newComment?.trim()) {
                try {
                  await this.socialService.addComment(post.id!, data.newComment);
                  this.showToast('Comentario agregado', 'success');
                } catch (error) {
                  this.showToast('Error al comentar', 'danger');
                }
              }
            }
          }
        ]
      });

      // Agregar comentarios existentes al alert
      let message = '';
      if (comments.length > 0) {
        message = comments.map((comment: Comment) =>
          `<div class="comment">
            <div class="comment-header">
              <strong>${comment.userName}</strong>
              <span class="comment-time">${this.formatTime(comment.timestamp)}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
          </div>`
        ).join('');
      } else {
        message = '<div class="no-comments">No hay comentarios aún. ¡Sé el primero en comentar!</div>';
      }
      alert.message = message;

      await alert.present();
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
    if (!this.socialService) return;

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

  // Métodos utilitarios
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