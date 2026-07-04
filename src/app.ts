import express, { type Express } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers/index.js";
import { createContext, type AppContext } from "./context.js";
import { env } from "./config/env.js";

export async function createApp(): Promise<{ app: Express; apolloServer: ApolloServer<AppContext> }> {
  const app = express();

  app.use(
    cors({
      origin:
        env.NODE_ENV === "production"
          ? (env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [])
          : "*",
      credentials: true,
    }),
  );

  app.use(express.json());

  app.use(
    "/graphql",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  const server = new ApolloServer({ typeDefs, resolvers, stopOnTerminationSignals: false });
  await server.start();

  app.use("/graphql", expressMiddleware(server, { context: createContext }));

  return { app, apolloServer: server };
}
