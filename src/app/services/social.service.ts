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
  onSnapshot,
  getDoc
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
  private currentFilter: string | null = null;
  private allPosts: Post[] = [];

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private auth: Auth
  ) {
    this.loadPosts();
  }

  private loadPosts() {
    const postsRef = collection(this.firestore, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'), limit(50));
    
    onSnapshot(q, (snapshot) => {
      const posts: Post[] = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() } as Post);
      });
      this.allPosts = posts;
      this.applyFilter();
    });
  }

  private applyFilter() {
    if (!this.currentFilter) {
      this.postsSubject.next(this.allPosts);
    } else {
      const filteredPosts = this.allPosts.filter(post => 
        post.petType === this.currentFilter
      );
      this.postsSubject.next(filteredPosts);
    }
  }

  setFilter(petType: 'dog' | 'cat' | null) {
    this.currentFilter = petType;
    this.applyFilter();
  }

  async createPost(
    content: string, 
    imageBase64?: string, 
    petType: 'dog' | 'cat' | 'other' = 'other'
  ): Promise<void> {
    if (!this.auth.currentUser) return;

    const user = this.auth.currentUser;
    let userAvatar: string | null = null;
    let userName: string = user.displayName || user.email?.split('@')[0] || 'Usuario';

    try {
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData?.['photoURL']) {
          userAvatar = userData['photoURL'];
        }
        if (userData?.['displayName']) {
          userName = userData['displayName'];
        } else if (userData?.['name']) {
          userName = userData['name'];
        }
      }
    } catch (error) {
      console.error('Error al obtener el avatar del usuario para el post:', error);
    }

    const postData: Post = {
      userId: user.uid,
      userEmail: user.email || '',
      userName: userName,
      userAvatar: userAvatar || undefined,
      content,
      petType,
      imageBase64: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
      timestamp: serverTimestamp(),
      likes: [],
      likesCount: 0,
      commentsCount: 0
    };

    await addDoc(collection(this.firestore, 'posts'), postData);
  }

  async toggleLike(postId: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const postRef = doc(this.firestore, 'posts', postId);
    const userId = this.auth.currentUser.uid;
    
    const post = this.postsSubject.value.find(p => p.id === postId);
    if (!post) return;

    const hasLiked = post.likes.includes(userId);

    if (hasLiked) {
      await updateDoc(postRef, {
        likes: arrayRemove(userId),
        likesCount: increment(-1)
      });
    } else {
      await updateDoc(postRef, {
        likes: arrayUnion(userId),
        likesCount: increment(1)
      });
    }
  }

  async addComment(postId: string, commentContent: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const user = this.auth.currentUser;
    let userAvatar: string | null = null;
    let userName: string = user.displayName || user.email?.split('@')[0] || 'Usuario';

    try {
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData?.['photoURL']) {
          userAvatar = userData['photoURL'];
        }
        if (userData?.['displayName']) {
          userName = userData['displayName'];
        } else if (userData?.['name']) {
          userName = userData['name'];
        }
      }
    } catch (error) {
      console.error('Error al obtener el avatar del usuario para el comentario:', error);
    }

    const commentData: Omit<Comment, 'id'> = {
      postId,
      userId: user.uid,
      userEmail: user.email || '',
      userName: userName,
      userAvatar: userAvatar || undefined,
      content: commentContent,
      timestamp: serverTimestamp()
    };

    const commentsRef = collection(this.firestore, 'comments');
    await addDoc(commentsRef, commentData);

    const postRef = doc(this.firestore, 'posts', postId);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });
  }

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

  async deletePost(postId: string): Promise<void> {
    if (!this.auth.currentUser) return;

    const post = this.postsSubject.value.find(p => p.id === postId);
    if (!post || post.userId !== this.auth.currentUser.uid) return;

    if (post.imageBase64) {
      try {
        if (post.imageBase64.startsWith('gs://') || post.imageBase64.startsWith('https://firebasestorage')) {
          const imageRef = ref(this.storage, post.imageBase64);
          await deleteObject(imageRef);
        }
      } catch (error) {
        console.error('Error deleting image from storage:', error);
      }
    }

    const postRef = doc(this.firestore, 'posts', postId);
    await deleteDoc(postRef);
  }

  hasUserLiked(post: Post): boolean {
    if (!this.auth.currentUser) return false;
    return post.likes.includes(this.auth.currentUser.uid);
  }

  isUserPost(post: Post): boolean {
    if (!this.auth.currentUser) return false;
    return post.userId === this.auth.currentUser.uid;
  }
  async getCommentsWithReplies(postId: string): Promise<Comment[]> {
  const commentsRef = collection(this.firestore, 'comments');
  const q = query(
    commentsRef,
    where('postId', '==', postId),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(q);
  const allComments: Comment[] = [];
  
  snapshot.forEach((doc) => {
    allComments.push({ id: doc.id, ...doc.data() } as Comment);
  });

  const comments = allComments.filter(c => !c.parentCommentId);
  const replies = allComments.filter(c => c.parentCommentId);

  comments.forEach(comment => {
    comment.replies = replies.filter(reply => reply.parentCommentId === comment.id);
  });

  return comments;
}

async addReply(postId: string, parentCommentId: string, replyContent: string): Promise<void> {
  if (!this.auth.currentUser) return;

  const user = this.auth.currentUser;
  let userAvatar: string | null = null;
  let userName: string = user.displayName || user.email?.split('@')[0] || 'Usuario';

  try {
    const userDocRef = doc(this.firestore, `users/${user.uid}`);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData?.['photoURL']) {
        userAvatar = userData['photoURL'];
      }
      if (userData?.['displayName']) {
        userName = userData['displayName'];
      } else if (userData?.['name']) {
        userName = userData['name'];
      }
    }
  } catch (error) {
    console.error('Error al obtener el avatar del usuario para la respuesta:', error);
  }

  const replyData: Omit<Comment, 'id'> = {
    postId,
    parentCommentId,
    userId: user.uid,
    userEmail: user.email || '',
    userName,
    userAvatar: userAvatar || undefined,
    content: replyContent,
    timestamp: serverTimestamp()
  };

  const commentsRef = collection(this.firestore, 'comments');
  await addDoc(commentsRef, replyData);

  const postRef = doc(this.firestore, 'posts', postId);
  await updateDoc(postRef, {
    commentsCount: increment(1)
  });
}

async deleteComment(commentId: string, postId: string): Promise<void> {
  if (!this.auth.currentUser) return;

  const commentRef = doc(this.firestore, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  
  if (!commentSnap.exists() || commentSnap.data()['userId'] !== this.auth.currentUser.uid) {
    throw new Error('No tienes permiso para eliminar este comentario');
  }

  await deleteDoc(commentRef);

  const postRef = doc(this.firestore, 'posts', postId);
  await updateDoc(postRef, {
    commentsCount: increment(-1)
  });
}

isUserComment(comment: Comment): boolean {
  if (!this.auth.currentUser) return false;
  return comment.userId === this.auth.currentUser.uid;
}

reset() {
  this.allPosts = [];
  this.postsSubject.next([]);
  this.currentFilter = null;
}

}