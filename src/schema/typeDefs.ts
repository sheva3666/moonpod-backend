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

  enum PayType {
    HOURLY
    SALARY
    CASUAL
    COMMISSION
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

  type UserSkill {
    id: ID!
    name: String!
    level: String
    createdAt: String!
    updatedAt: String!
  }

  type UserPay {
    id: ID!
    payType: PayType
    payRate: Float
    currency: String!
    bankAccountName: String
    bankBsb: String
    bankAccountNumber: String
    superFund: String
    superMemberNumber: String
    createdAt: String!
    updatedAt: String!
  }

  type UserNextOfKin {
    id: ID!
    name: String!
    relationship: String
    phone: String
    email: String
    createdAt: String!
    updatedAt: String!
  }

  type UserNote {
    id: ID!
    content: String!
    createdAt: String!
    updatedAt: String!
  }

  type UserDocument {
    id: ID!
    name: String!
    url: String!
    mimeType: String
    createdAt: String!
    updatedAt: String!
  }

  type UserPrompt {
    id: ID!
    content: String!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    nickName: String
    designation: String
    email: String!
    pin: String!
    phone: String
    dateOfBirth: String
    address: String
    isKeyHolder: Boolean!
    status: UserStatus!
    accountType: AccountType!
    company: Company!
    skills: [UserSkill!]!
    pay: UserPay
    nextOfKin: [UserNextOfKin!]!
    notes: [UserNote!]!
    documents: [UserDocument!]!
    prompts: [UserPrompt!]!
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
    teamMember(id: ID!): User
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

    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
  }
`;
