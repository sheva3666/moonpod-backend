export const typeDefs = `#graphql
  enum UserStatus {
    PENDING
    ACTIVE
    INACTIVE
  }

  enum AccountType {
    EMPLOYEE
    MANAGER
    ADMIN
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    shortName: String!
    email: String!
    pin: String!
    status: UserStatus!
    accountType: AccountType!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type RefreshPayload {
    accessToken: String!
    refreshToken: String!
  }

  type Query {
    me: User!
    users: [User!]!
  }

  type Mutation {
    register(
      firstName: String!
      lastName: String!
      shortName: String!
      email: String!
      password: String!
      pin: String!
    ): AuthPayload!

    login(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): RefreshPayload!
    logout(refreshToken: String!): Boolean!
  }
`;
