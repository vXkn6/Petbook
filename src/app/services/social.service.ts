import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  onSnapshot
} from '@angular/fire/firestore';
import { 
  Storage, 
  ref, 
  uploadString, 
  getDownloadURL,
  deleteObject 
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { Post, Comment } from '../models/post.model';

@Injectable({
  providedIn: 'root'
})
export class SocialService {
  private postsSubject = new BehaviorSubject<Post[]>([]);
  public posts$ = this.postsSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private auth: Auth
  ) {
    this.loadPosts();
  }

  // Cargar posts en tiempo real
  loadPosts() {
    const postsRef = collection(this.firestore, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(50));
    
    onSnapshot(q, (snapshot) => {
      const posts: Post[] = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() } as Post);
      });
      this.postsSubject.next(posts);
    });
  }

  // Crear nuevo post (ahora acepta imageDataUrl como string)
  async createPost(content: string, imageDataUrl: string | null): Promise<void> {
    if (!this.auth.currentUser) return;

    const user = this.auth.currentUser;
    let imageUrl = '';

    // Subir imagen si existe (como string base64)
    if (imageDataUrl) {
      try {
        // Extraer el tipo MIME y los datos base64 del data URL
        const matches = imageDataUrl.match(/^data:(.+);base64,(.*)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid data URL format');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const fileExtension = mimeType.split('/')[1] || 'jpg';
        const fileName = `posts/${Date.now()}_${user.uid}.${fileExtension}`;

        // Subir a Firebase Storage
        const imageRef = ref(this.storage, fileName);
        await uploadString(imageRef, base64Data, 'base64', {
          contentType: mimeType
        });
        
        imageUrl = await getDownloadURL(imageRef);
      } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image');
      }
    }

    const postData: Omit<Post, 'id'> = {
      userId: user.uid,
      userEmail: user.email || '',
      userName: user.displayName || user.email?.split('@')[0] || 'Usuario',
      userAvatar: user.photoURL || '',
      content,
      imageUrl,
      timestamp: serverTimestamp(),
      likes: [],
      likesCount: 0,
      commentsCount: 0
    };

    const postsRef = collection(this.firestore, 'posts');
    await addDoc(postsRef, postData);
  }

  // Dar o quitar like (sin cambios)
  async toggleLike(postId: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const postRef = doc(this.firestore, 'posts', postId);
    const userId = this.auth.currentUser.uid;
    
    const post = this.postsSubject.value.find(p => p.id === postId);
    if (!post) return;

    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      // Quitar like
      await updateDoc(postRef, {
        likes: arrayRemove(userId),
        likesCount: increment(-1)
      });
    } else {
      // Dar like
      await updateDoc(postRef, {
        likes: arrayUnion(userId),
        likesCount: increment(1)
      });
    }
  }

  // Agregar comentario (sin cambios)
  async addComment(postId: string, commentContent: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const user = this.auth.currentUser;
    
    const commentData: Omit<Comment, 'id'> = {
      postId,
      userId: user.uid,
      userEmail: user.email || '',
      userName: user.displayName || user.email?.split('@')[0] || 'Usuario',
      userAvatar: user.photoURL || '',
      content: commentContent,
      timestamp: serverTimestamp()
    };

    // Agregar comentario
    const commentsRef = collection(this.firestore, 'comments');
    await addDoc(commentsRef, commentData);

    // Incrementar contador de comentarios en el post
    const postRef = doc(this.firestore, 'posts', postId);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });
  }

  // Obtener comentarios de un post (sin cambios)
  async getComments(postId: string): Promise<Comment[]> {
    const commentsRef = collection(this.firestore, 'comments');
    const q = query(
      commentsRef, 
      where('postId', '==', postId), 
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const comments: Comment[] = [];
    snapshot.forEach((doc) => {
      comments.push({ id: doc.id, ...doc.data() } as Comment);
    });
    
    return comments;
  }

  // Eliminar post (ahora también elimina la imagen de Storage si existe)
  async deletePost(postId: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const post = this.postsSubject.value.find(p => p.id === postId);
    if (!post || post.userId !== this.auth.currentUser.uid) return;

    // Eliminar imagen de Storage si existe
    if (post.imageUrl) {
      try {
        const imageRef = ref(this.storage, post.imageUrl);
        await deleteObject(imageRef);
      } catch (error) {
        console.error('Error deleting image from storage:', error);
      }
    }

    // Eliminar el post de Firestore
    const postRef = doc(this.firestore, 'posts', postId);
    await deleteDoc(postRef);
  }

  // Verificar si el usuario actual dio like a un post (sin cambios)
  hasUserLiked(post: Post): boolean {
    if (!this.auth.currentUser) return false;
    return post.likes.includes(this.auth.currentUser.uid);
  }

  // Verificar si el post pertenece al usuario actual (sin cambios)
  isUserPost(post: Post): boolean {
    if (!this.auth.currentUser) return false;
    return post.userId === this.auth.currentUser.uid;
  }
}