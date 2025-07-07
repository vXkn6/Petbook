// src/app/components/comments-modal/comments-modal.component.ts
import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SocialService } from '../../services/social.service';
import { Post, Comment } from '../../models/post.model';

@Component({
  selector: 'app-comments-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Comentarios ({{ comments.length }})</ion-title>
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
          </div>
          <p class="comment-content">{{ comment.content }}</p>
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

    .comment-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
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
  @Input() comments: Comment[] = [];
  
  newComment = '';
  isLoading = false;
  
  private modalController = inject(ModalController);
  private socialService = inject(SocialService);

  ngOnInit() {
    // Inicialización si es necesaria
  }

  async addComment() {
    if (!this.newComment.trim() || this.isLoading) return;

    this.isLoading = true;
    
    try {
      await this.socialService.addComment(this.post.id!, this.newComment);
      
      // Recargar comentarios
      this.comments = await this.socialService.getComments(this.post.id!);
      this.newComment = '';
      
    } catch (error) {
      console.error('Error al agregar comentario:', error);
    } finally {
      this.isLoading = false;
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