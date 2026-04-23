import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers/index.js";
import { createContext } from "./context.js";
import { prisma } from "./db.js";
import { env } from "./config/env.js";

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

const httpServer = app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}/graphql`);
});

const shutdown = async (): Promise<void> => {
  const timer = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, 30_000);

  try {
    httpServer.close();
    await server.stop();
    await prisma.$disconnect();
    clearTimeout(timer);
  } catch (err) {
    console.error("Error during shutdown:", err);
    clearTimeout(timer);
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});
