import type { Express } from "express";
import type { ApolloServer } from "@apollo/server";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import type { AppContext } from "../../src/context.js";

describe("register -> login flow", () => {
  let app: Express;
  let apolloServer: ApolloServer<AppContext>;

  const email = `e2e-${Date.now()}@example.com`;
  const password = "correct-horse-battery";

  beforeAll(async () => {
    ({ app, apolloServer } = await createApp());
  });

  afterAll(async () => {
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  it("registers a new company owner and returns an auth payload", async () => {
    const response = await request(app)
      .post("/graphql")
      .send({
        query: `
          mutation {
            register(
              companyName: "E2E Test Co"
              companyAddress: "1 Test St"
              companyPhone: "555-0100"
              firstName: "Ada"
              lastName: "Lovelace"
              email: "${email}"
              password: "${password}"
              pin: "1234"
            ) {
              accessToken
              refreshToken
              user {
                email
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.register.accessToken).toEqual(expect.any(String));
    expect(response.body.data.register.user.email).toBe(email);
  });

  it("logs the same user back in with their credentials", async () => {
    const response = await request(app)
      .post("/graphql")
      .send({
        query: `
          mutation {
            login(email: "${email}", password: "${password}") {
              accessToken
              refreshToken
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.login.accessToken).toEqual(expect.any(String));
  });
});
