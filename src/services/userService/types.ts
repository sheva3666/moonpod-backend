export type TeamMembersFilter = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  accountType?: string | null;
  status?: string | null;
};

export type TeamMembersArgs = {
  page?: number | null;
  pageSize?: number | null;
  sortField?: string | null;
  sortDirection?: string | null;
  search?: string | null;
  filter?: TeamMembersFilter | null;
};

export type TeamMemberDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  accountType: string;
  roles: string[];
  createdAt: string;
};

export type TeamMembersResult = {
  members: TeamMemberDto[];
  total: number;
};
