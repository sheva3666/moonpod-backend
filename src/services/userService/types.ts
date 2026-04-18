export type TeamMembersArgs = {
  page?: number | null;
  pageSize?: number | null;
  sortField?: string | null;
  sortDirection?: string | null;
  search?: string | null;
};

export type TeamMemberDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pin: string;
  status: string;
  accountType: string;
  roles: string[];
  createdAt: string;
};

export type TeamMembersResult = {
  members: TeamMemberDto[];
  total: number;
};
