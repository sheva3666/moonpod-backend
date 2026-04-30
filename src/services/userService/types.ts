export type CreateTeamMemberInput = {
  firstName: string;
  lastName: string;
  email: string;
  pin: string;
  accountType?: string | null;
  nickName?: string | null;
  designation?: string | null;
};

export type UpdateTeamMemberInput = {
  firstName?: string | null;
  lastName?: string | null;
  nickName?: string | null;
  designation?: string | null;
  accountType?: string | null;
  status?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  isKeyHolder?: boolean | null;
  roleIds?: string[] | null;
};

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
