/**
 * Minimal GraphQL fetch helper used by stats components.
 * Delegates to the centralized graphqlClient for encryption support.
 */
export { graphqlFetch as fetchGraphQL } from '~/lib/graphqlClient';
