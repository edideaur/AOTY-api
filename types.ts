export interface AlbumBlock {
  url: string;
  artist: string;
  title: string;
  cover: string;
  mediaType: string;
  releaseDate: string;
  criticScore: string | null;
  criticCount: string | null;
  userScore: string | null;
  userCount: string | null;
  mustHear: boolean;
}

export interface Track {
  number: string;
  title: string;
  url: string;
  length: string;
  rating: string | null;
  ratingCount: number | null;
  notes: string | null;
  features: string[];
}

export interface CriticReview {
  score: string;
  publication: string;
  author: string;
  text: string;
  image: string;
  url: string;
  date: string;
}

export interface StreamingLink {
  platform: string;
  url: string;
}

export interface AlbumStats {
  favorites: number | null;
  likes: number | null;
  listens: number | null;
  libraryCount: number | null;
  lists: number | null;
}

export interface CreditEntry {
  name: string;
  url: string;
  image: string | null;
  roles: string[];
}

export interface CreditSection {
  title: string;
  credits: CreditEntry[];
}

export interface AlbumDetail {
  url: string;
  id: string;
  title: string;
  artist: string;
  artistUrl: string;
  cover: string;
  datePublished: string;
  format: string;
  label: string | null;
  labelUrl: string | null;
  genres: string[];
  tags: string[];
  criticScore: string | null;
  criticScoreExact: string | null;
  criticCount: string | null;
  userScore: string | null;
  userScoreExact: string | null;
  userCount: string | null;
  tracklist: Track[];
  streamingLinks: StreamingLink[];
  reviews: CriticReview[];
  stats: AlbumStats | null;
  credits: CreditSection[] | null;
}

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  image: string | null;
  source: string;
  sourceUrl: string;
  date: string;
  likes: string;
  comments: string;
}

export interface ListEntry {
  url: string;
  title: string;
  publication: string;
  cover: string | null;
}

export interface ListDetailItem {
  rank: string;
  title: string;
  url: string;
  cover: string;
  date: string;
  genres: string[];
}

export interface SearchArtist {
  url: string;
  name: string;
  image: string | null;
}

export interface SearchLabel {
  url: string;
  name: string;
  description: string | null;
}
