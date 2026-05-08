export interface AlbumItem {
  rank: number | null;
  artistAlbum: string;
  image: string;
  score: number | null;
  genre: string;
  otherListsCount: number | null;
  blurb: string;
  releaseDate: string;
  url: string;
  secondaryGenres: string[];
  mustHear: boolean;
}

export interface ListItem {
  name: string;
  slug: string;
  image: string;
}

export interface ListsMetadata {
  title: string;
  description: string;
  siteName: string;
  image: string;
  year: number | null;
}

export interface Review {
  score: string;
  publication: string;
  author: string;
  text: string;
  image: string;
  link: string;
}

export interface Album {
  artist: string;
  album: string;
  url: string;
  image: string;
  critic: {
    score: string;
    count: string;
    reviews: Review[];
  };
  user: {
    score: string;
    count: string;
  };
  streaming: {
    amazon: string;
    appleMusic: string;
    spotify: string;
    soundcloud: string;
  };
}

export interface ListMetadata {
  title: string;
  description: string;
  siteName: string;
  type: string;
  image: string;
  twitterCard: string;
  twitterSite: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterUrl: string;
  fbAppId: string;
  listImage: string;
  sourceUrl: string;
}

export interface ParsedAlbumItem {
  rank: number;
  artist: string;
  album: string;
  image: string;
  score: number | null;
  genre: string;
  secondaryGenres: string[];
  otherListsCount: number | null;
  blurb: string;
  releaseDate: string;
  url: string;
  mustHear: boolean;
}

export interface AnticipatedAlbum {
  artist: string;
  album: string;
  image: string;
  releaseDate: string;
  url: string;
  score: number | null;
  criticScore: number | null;
  criticReviewCount: number | null;
  userReviewCount: number | null;
  wantCount: number;
}

export type JSONResponse = Response;