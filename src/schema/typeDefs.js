export const typeDefs = `#graphql
  enum UserStatus {
    PENDING
    ACTIVE
    INACTIVE
  }

  enum AccountType {
    OWNER
    EMPLOYEE
    MANAGER
    ADMIN
  }

  type Company {
    id: ID!
    name: String!
    address: String!
    phone: String!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    pin: String!
    status: UserStatus!
    accountType: AccountType!
    company: Company!
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
      companyName: String!
      companyAddress: String!
      companyPhone: String!
      firstName: String!
      lastName: String!
      email: String!
      password: String!
      pin: String!
    ): AuthPayload!

    login(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): RefreshPayload!
    logout(refreshToken: String!): Boolean!
  }
`;
