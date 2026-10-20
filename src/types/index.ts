export interface Lesson {
  id: string; // YouTube Video ID
  title: string;
  duration?: string;
  thumbnailUrl?: string;
  completed: boolean;
  completedAt?: string;
  lastPositionSeconds?: number;
  notes?: string;
}

export interface Course {
  id: string;
  playlistId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  lessons: Lesson[];
  currentLessonId: string;
  createdAt: string;
  lastAccessedAt: string;
  category?: string;
}

export interface UserSettings {
  autoPlayNext: boolean;
  autoMarkCompleted: boolean;
  playbackRate: number;
  youtubeApiKey: string;
}
