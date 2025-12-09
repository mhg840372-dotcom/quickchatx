export interface BaseContent {
  _id: string;
  author: {
    _id: string;
    username: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt?: string;
  content: string;
  mediaUrl?: string;
  type: "post" | "news" | "youtube";
}

export interface Post extends BaseContent {
  type: "post";
}

export interface News extends BaseContent {
  type: "news";
  source: string;
  title: string;
  url?: string;
}

export interface YouTubeVideo extends BaseContent {
  type: "youtube";
  videoId: string;
  title: string;
}

export type FeedItem = Post | News | YouTubeVideo;

export type User = {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  safeAvatar?: string;
  // allow additional provider-specific fields without causing type errors
  [key: string]: any;
};
