import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers/index.js";
import { createContext } from "./context.js";
import { prisma } from "./db.js";
import { env } from "./config/env.js";

const app = express();

app.use(cors());
app.use(express.json());

const server = new ApolloServer({ typeDefs, resolvers, stopOnTerminationSignals: false });
await server.start();

app.use("/graphql", expressMiddleware(server, { context: createContext }));

const httpServer = app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}/graphql`);
});

const shutdown = async (): Promise<void> => {
  httpServer.close();
  await server.stop();
  await prisma.$disconnect();
};

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});
