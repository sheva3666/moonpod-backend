import { prisma } from "../../db.js";

export const companyRepository = {
  create: (data: { name: string; address: string; phone: string }) =>
    prisma.company.create({ data }),
};
