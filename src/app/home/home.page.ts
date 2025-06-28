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
  selectedImage: string | null = null;
  selectedImagePreview: string | null = null;

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
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });

      if (image.dataUrl) {
        this.selectedImagePreview = image.dataUrl;
        this.selectedImage = image.dataUrl;

        // Guardar localmente (opcional, si quieres persistencia)
        if (Capacitor.isNativePlatform()) {
          const fileName = `post_preview_${Date.now()}.jpeg`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: image.dataUrl,
            directory: Directory.Data
          });
          this.selectedImage = savedFile.uri;
        }
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      this.showToast('Error al seleccionar imagen', 'danger');
    }
  }

  async createPost() {
    if (!this.newPostContent.trim() && !this.selectedImage) {
      this.showToast('Escribe algo o selecciona una imagen', 'warning');
      return;
    }

    if (!this.socialService) {
      this.showToast('Servicio no disponible', 'danger');
      return;
    }

    this.isLoading = true;
    try {
      // Inicializamos como null en lugar de undefined
      let imageToUpload: string | null = null;

      if (this.selectedImage) {
        // Si es una imagen local (capacitor), cargarla como data URL
        if (!this.selectedImage.startsWith('data:')) {
          try {
            const file = await Filesystem.readFile({
              path: this.selectedImage,
              directory: Directory.Data
            });
            imageToUpload = `data:image/jpeg;base64,${file.data}`;
          } catch (error) {
            console.error('Error reading local image:', error);
            imageToUpload = null;
          }
        } else {
          // Si ya es un data URL
          imageToUpload = this.selectedImage;
        }
      }

      await this.socialService.createPost(
        this.newPostContent,
        imageToUpload // Ahora es string | null, que coincide con lo que espera el servicio
      );

      this.newPostContent = '';
      this.selectedImage = null;
      this.selectedImagePreview = null;
      this.showToast('¡Publicación creada exitosamente!', 'success');
    } catch (error) {
      console.error('Error al crear post:', error);
      this.showToast('Error al crear la publicación', 'danger');
    }
    this.isLoading = false;
  }

  private async loadLocalImageForPost(post: Post): Promise<string> {
    if (!post.imageUrl) return '';

    // Si ya tenemos la ruta local
    if (this.localImagePaths[post.id!]) {
      return this.localImagePaths[post.id!];
    }

    // Si es una URL web normal
    if (post.imageUrl.startsWith('http')) {
      return post.imageUrl;
    }

    // Si es una imagen local (capacitor)
    if (Capacitor.isNativePlatform()) {
      try {
        const file = await Filesystem.readFile({
          path: post.imageUrl,
          directory: Directory.Data
        });
        const dataUrl = `data:image/jpeg;base64,${file.data}`;
        this.localImagePaths[post.id!] = dataUrl;
        return dataUrl;
      } catch (error) {
        console.error('Error loading local image:', error);
        return '';
      }
    }

    return post.imageUrl;
  }
  async getPostImage(post: Post): Promise<string> {
    if (!post.imageUrl) return '';
    return this.loadLocalImageForPost(post);
  }
  removeSelectedImage() {
    this.selectedImage = null;
    this.selectedImagePreview = null;
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

