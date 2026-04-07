import { component$ } from '@builder.io/qwik';

/**
 * Renders a pre-serialized JSON-LD string inside a
 * `<script type="application/ld+json">` tag.
 *
 * Always escape `<` → `\u003c` in the JSON body before passing it in.
 * Use `serializeJsonLd()` from `~/lib/meta/structured-data.ts`.
 */
export const JsonLd = component$<{ data: string }>(({ data }) => {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={data} />
  );
});
