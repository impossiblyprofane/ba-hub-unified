// GraphQL resolvers
export const resolvers = {
  Query: {
    hello: () => 'Hello from BA Hub GraphQL!',
  },
  Mutation: {
    ping: () => 'pong',
  },
  Subscription: {
    messageAdded: {
      subscribe: async function* () {
        // Example subscription - emit every 5 seconds
        while (true) {
          yield { messageAdded: `Update at ${new Date().toISOString()}` };
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      },
    },
  },
};
