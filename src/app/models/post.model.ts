export interface Post {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  content: string;
  imageUrl?: string;
  timestamp: any; 
  likes: string[]; 
  likesCount: number;
  commentsCount: number;
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
}