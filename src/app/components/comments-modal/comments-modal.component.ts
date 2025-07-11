import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, IonicModule, ActionSheetController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SocialService } from '../../services/social.service';
import { Post, Comment } from '../../models/post.model';

@Component({
  selector: 'app-comments-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Comentarios ({{ comments.length + totalReplies }})</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="comments-container" *ngIf="comments.length > 0">
        <div class="comment-item" *ngFor="let comment of comments">
          <div class="comment-header">
            <img 
              [src]="comment.userAvatar || 'https://ionicframework.com/docs/img/demos/avatar.svg'" 
              alt="Avatar" 
              class="comment-avatar"
            >
            <div class="comment-info">
              <strong>{{ comment.userName }}</strong>
              <span class="comment-time">{{ formatTime(comment.timestamp) }}</span>
            </div>
            <ion-button *ngIf="isUserComment(comment)" fill="clear" (click)="showCommentOptions(comment)">
              <ion-icon name="ellipsis-vertical-outline"></ion-icon>
            </ion-button>
          </div>
          <p class="comment-content">{{ comment.content }}</p>

          <ion-button fill="clear" size="small" (click)="toggleReply(comment)">
            <ion-icon name="arrow-undo-outline" slot="start"></ion-icon>
            Responder
          </ion-button>

          <div class="reply-area" *ngIf="replyingTo === comment.id">
            <ion-textarea
              [(ngModel)]="replyContent"
              placeholder="Escribe tu respuesta..."
              rows="2"
              maxlength="500"
            ></ion-textarea>
            <ion-button 
              fill="clear" 
              size="small" 
              (click)="addReply(comment)"
              [disabled]="!replyContent?.trim() || isLoading"
            >
              <ion-icon name="send" *ngIf="!isLoading"></ion-icon>
              <ion-spinner name="crescent" *ngIf="isLoading"></ion-spinner>
            </ion-button>
          </div>

          <div class="replies-container" *ngIf="comment.replies && comment.replies.length > 0">
            <div class="reply-item" *ngFor="let reply of comment.replies">
              <div class="reply-header">
                <img 
                  [src]="reply.userAvatar || 'https://ionicframework.com/docs/img/demos/avatar.svg'" 
                  alt="Avatar" 
                  class="reply-avatar"
                >
                <div class="reply-info">
                  <strong>{{ reply.userName }}</strong>
                  <span class="reply-time">{{ formatTime(reply.timestamp) }}</span>
                </div>
                <ion-button *ngIf="isUserComment(reply)" fill="clear" (click)="showCommentOptions(reply)">
                  <ion-icon name="ellipsis-vertical-outline"></ion-icon>
                </ion-button>
              </div>
              <p class="reply-content">{{ reply.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="no-comments" *ngIf="comments.length === 0">
        <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
        <p>Sé el primero en comentar esta publicación.</p>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-item>
          <ion-textarea
            [(ngModel)]="newComment"
            placeholder="Escribe un comentario..."
            rows="2"
            maxlength="500"
            (keyup.enter)="addComment()"
          ></ion-textarea>
          <ion-button 
            fill="clear" 
            slot="end" 
            (click)="addComment()"
            [disabled]="!newComment?.trim() || isLoading"
          >
            <ion-icon name="send" *ngIf="!isLoading"></ion-icon>
            <ion-spinner name="crescent" *ngIf="isLoading"></ion-spinner>
          </ion-button>
        </ion-item>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .comments-container {
      padding: 16px;
    }

    .comment-item {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .comment-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .comment-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .comment-info {
      flex: 1;
    }

    .comment-info strong {
      display: block;
      font-weight: 600;
      color: var(--ion-color-dark);
    }

    .comment-time {
      font-size: 0.8em;
      color: var(--ion-color-medium);
    }

    .comment-content {
      margin: 0;
      color: var(--ion-color-dark);
      line-height: 1.4;
      padding-left: 44px;
    }

    .reply-area {
      padding-left: 44px;
      margin-top: 8px;
      display: flex;
      flex-direction: column;
    }

    .replies-container {
      margin-left: 44px;
      margin-top: 8px;
      border-left: 2px solid var(--ion-color-light);
      padding-left: 8px;
    }

    .reply-item {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .reply-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .reply-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
    }

    .reply-info {
      flex: 1;
    }

    .reply-info strong {
      display: block;
      font-size: 0.9em;
      font-weight: 500;
      color: var(--ion-color-dark);
    }

    .reply-time {
      font-size: 0.7em;
      color: var(--ion-color-medium);
    }

    .reply-content {
      margin: 0;
      color: var(--ion-color-dark);
      line-height: 1.4;
      padding-left: 32px;
      font-size: 0.9em;
    }

    .no-comments {
      text-align: center;
      padding: 40px 20px;
      color: var(--ion-color-medium);
    }

    .no-comments ion-icon {
      font-size: 3em;
      margin-bottom: 16px;
    }

    .no-comments p {
      margin: 0;
      font-style: italic;
    }

    ion-footer ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
    }
  `],
  standalone: true,
  imports: [
    IonicModule,
    FormsModule,
    CommonModule
  ]
})
export class CommentsModalComponent implements OnInit {
  @Input() post!: Post;
  comments: Comment[] = [];
  totalReplies = 0;
  
  newComment: string = ''; // Inicializado como string vacío
  replyContent: string = ''; // Inicializado como string vacío
  replyingTo: string | null = null; // Acepta string o null
  isLoading = false;
  
  private modalController = inject(ModalController);
  private socialService = inject(SocialService);
  private actionSheetController = inject(ActionSheetController);

  async ngOnInit() {
    this.loadComments();
  }

  async loadComments() {
    this.isLoading = true;
    try {
      this.comments = await this.socialService.getCommentsWithReplies(this.post.id!);
      this.calculateTotalReplies();
    } catch (error) {
      console.error('Error al cargar comentarios:', error);
    } finally {
      this.isLoading = false;
    }
  }

  calculateTotalReplies() {
    this.totalReplies = this.comments.reduce((total, comment) => {
      return total + (comment.replies ? comment.replies.length : 0);
    }, 0);
  }

  async addComment() {
    if (!this.newComment.trim() || this.isLoading) return;

    this.isLoading = true;
    
    try {
      await this.socialService.addComment(this.post.id!, this.newComment);
      this.newComment = '';
      await this.loadComments();
    } catch (error) {
      console.error('Error al agregar comentario:', error);
    } finally {
      this.isLoading = false;
    }
  }

  toggleReply(comment: Comment) {
  if (comment.id === undefined) return;
  this.replyingTo = this.replyingTo === comment.id ? null : comment.id;
  this.replyContent = '';
}
  async addReply(comment: Comment) {
    if (!this.replyContent.trim() || this.isLoading) return;

    this.isLoading = true;
    
    try {
      await this.socialService.addReply(this.post.id!, comment.id!, this.replyContent);
      this.replyingTo = null;
      this.replyContent = '';
      await this.loadComments();
    } catch (error) {
      console.error('Error al agregar respuesta:', error);
    } finally {
      this.isLoading = false;
    }
  }

  isUserComment(comment: Comment): boolean {
    return this.socialService.isUserComment(comment);
  }

  async showCommentOptions(comment: Comment) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Opciones del comentario',
      buttons: [
        {
          text: 'Eliminar',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            this.deleteComment(comment);
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

  async deleteComment(comment: Comment) {
    try {
      await this.socialService.deleteComment(comment.id!, this.post.id!);
      await this.loadComments();
    } catch (error) {
      console.error('Error al eliminar comentario:', error);
    }
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

  dismiss() {
    this.modalController.dismiss();
  }
}