import type { Express } from "express";
import type { ApolloServer } from "@apollo/server";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import type { AppContext } from "../../src/context.js";

describe("GraphQL smoke test", () => {
  let app: Express;
  let apolloServer: ApolloServer<AppContext>;

  beforeAll(async () => {
    ({ app, apolloServer } = await createApp());
  });

  afterAll(async () => {
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  it("answers a simple query over a real HTTP request", async () => {
    const response = await request(app)
      .post("/graphql")
      .send({ query: `query { checkEmail(email: "nobody@example.com") { exists } }` });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.checkEmail).toEqual({ exists: false });
  });
});
