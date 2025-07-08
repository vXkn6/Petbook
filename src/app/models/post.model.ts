export interface Post {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  content: string;
  imageBase64?: string | null;
  timestamp: any; 
  likes: string[]; 
  likesCount: number;
  commentsCount: number;
  petType?: 'dog' | 'cat' | 'other'; // Added petType field
}

export interface Comment {
  id?: string;
  postId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: any; 
  parentCommentId?: string;
  replies?: Comment[];
}