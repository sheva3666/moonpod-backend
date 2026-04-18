import type { User, Company } from "@prisma/client";

export type UserWithCompany = User & { company: Company };

export type AuthPayloadResult = {
  accessToken: string;
  refreshToken: string;
  user: UserWithCompany;
};
