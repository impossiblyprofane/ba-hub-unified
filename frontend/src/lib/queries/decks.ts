/**
 * GraphQL query/mutation strings for the Deck Publishing feature.
 */

// ── Queries ─────────────────────────────────────────────────────

/** Fetch a single published deck by ID (full detail). */
export const PUBLISHED_DECK_QUERY = `
  query PublishedDeck($id: String!, $viewerId: String) {
    publishedDeck(id: $id, viewerId: $viewerId) {
      id isOwner publisherName name description deckCode
      countryId spec1Id spec2Id
      deckData tags
      viewCount likeCount
      createdAt updatedAt
    }
  }
`;

/** Browse published decks with filters and pagination. */
export const BROWSE_DECKS_QUERY = `
  query BrowseDecks($filter: BrowseDecksFilterInput, $viewerId: String) {
    browseDecks(filter: $filter, viewerId: $viewerId) {
      decks {
        id isOwner publisherName name description deckCode
        countryId spec1Id spec2Id
        tags viewCount likeCount
        createdAt updatedAt
      }
      total page pageSize totalPages
    }
  }
`;

/** Fetch all published decks by a specific author. */
export const PUBLISHED_DECKS_BY_AUTHOR_QUERY = `
  query PublishedDecksByAuthor($authorId: String!) {
    publishedDecksByAuthor(authorId: $authorId) {
      id isOwner publisherName name description deckCode
      countryId spec1Id spec2Id
      tags viewCount likeCount
      createdAt updatedAt
    }
  }
`;

/** Fetch a user's public profile. */
export const USER_PROFILE_QUERY = `
  query UserProfile($userId: String!) {
    userProfile(userId: $userId) {
      id publishedCount totalLikesReceived createdAt
    }
  }
`;

/** Get a trivial math challenge for abuse prevention. */
export const CHALLENGE_QUERY = `
  query Challenge {
    challenge {
      challengeId question
    }
  }
`;

/** Check if the current user has liked a specific deck. */
export const DECK_LIKE_STATUS_QUERY = `
  query DeckLikeStatus($deckId: String!, $userId: String!) {
    deckLikeStatus(deckId: $deckId, userId: $userId) {
      liked
    }
  }
`;

// ── Mutations ───────────────────────────────────────────────────

/** Register (or re-register) an anonymous user identity. */
export const REGISTER_USER_MUTATION = `
  mutation RegisterUser($tentativeId: String!) {
    registerUser(tentativeId: $tentativeId) {
      userId isNew
    }
  }
`;

/** Publish a new deck. */
export const PUBLISH_DECK_MUTATION = `
  mutation PublishDeck($input: PublishDeckInput!) {
    publishDeck(input: $input) {
      id isOwner publisherName name description deckCode
      countryId spec1Id spec2Id
      deckData tags
      viewCount likeCount
      createdAt updatedAt
    }
  }
`;

/** Update an existing published deck. */
export const UPDATE_PUBLISHED_DECK_MUTATION = `
  mutation UpdatePublishedDeck($deckId: String!, $input: UpdatePublishedDeckInput!) {
    updatePublishedDeck(deckId: $deckId, input: $input) {
      id isOwner publisherName name description deckCode
      countryId spec1Id spec2Id
      deckData tags
      viewCount likeCount
      createdAt updatedAt
    }
  }
`;

/** Delete a published deck. */
export const DELETE_PUBLISHED_DECK_MUTATION = `
  mutation DeletePublishedDeck($deckId: String!, $input: DeletePublishedDeckInput!) {
    deletePublishedDeck(deckId: $deckId, input: $input)
  }
`;

/** Toggle like on a published deck. */
export const TOGGLE_DECK_LIKE_MUTATION = `
  mutation ToggleDeckLike($deckId: String!, $userId: String!) {
    toggleDeckLike(deckId: $deckId, userId: $userId) {
      liked newLikeCount
    }
  }
`;

/** Record a view on a published deck. */
export const RECORD_DECK_VIEW_MUTATION = `
  mutation RecordDeckView($deckId: String!, $viewerId: String) {
    recordDeckView(deckId: $deckId, viewerId: $viewerId) {
      newViewCount
    }
  }
`;
