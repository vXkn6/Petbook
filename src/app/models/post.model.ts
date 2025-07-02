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