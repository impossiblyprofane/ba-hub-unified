export interface PageMeta {
  title: string;
  description: string;
  ogType?: string;
  ogImage?: string | null;
  twitterCard?: 'summary' | 'summary_large_image';
}
