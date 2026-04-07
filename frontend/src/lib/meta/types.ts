export interface PageMeta {
  title: string;
  description: string;
  ogType?: string;
  ogImage?: string | null;
  twitterCard?: 'summary' | 'summary_large_image';
  /**
   * Pre-serialized JSON-LD strings. Each entry is rendered as a
   * separate `<script type="application/ld+json">` block in the
   * crawler-stub HTML. Use `serializeJsonLd()` from
   * `./structured-data.ts` to build these safely.
   */
  structuredData?: string | string[];
}
