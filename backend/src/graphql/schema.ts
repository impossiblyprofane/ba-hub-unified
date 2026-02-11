// GraphQL schema definition
export const schema = `
  type Query {
    hello: String!
  }
  
  type Mutation {
    ping: String!
  }
  
  type Subscription {
    messageAdded: String!
  }
`;
