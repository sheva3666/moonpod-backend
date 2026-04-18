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

  enum SortDirection {
    ASC
    DESC
  }

  enum UserSortField {
    FIRST_NAME
    LAST_NAME
    EMAIL
    STATUS
    ACCOUNT_TYPE
    CREATED_AT
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

  type TeamMember {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    pin: String!
    status: UserStatus!
    accountType: AccountType!
    roles: [String!]!
    createdAt: String!
  }

  type TeamMembersResult {
    members: [TeamMember!]!
    total: Int!
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

  type EmailCheckResult {
    exists: Boolean!
  }

  input TeamMembersFilter {
    firstName: String
    lastName: String
    email: String
    role: String
    accountType: AccountType
    pin: String
    status: UserStatus
  }

  type Query {
    me: User!
    users: [User!]!
    checkEmail(email: String!): EmailCheckResult!
    teamMembers(
      page: Int
      pageSize: Int
      sortField: UserSortField
      sortDirection: SortDirection
      search: String
      filter: TeamMembersFilter
    ): TeamMembersResult!
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

    sendMagicLink(email: String!): Boolean!
    verifyMagicLink(token: String!): AuthPayload!
  }
`;
