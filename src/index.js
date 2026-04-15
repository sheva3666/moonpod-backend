import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./schema/typeDefs.js";
import { resolvers } from "./schema/resolvers/index.js";
import { createContext } from "./context.js";
import { prisma } from "./db.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());

const server = new ApolloServer({ typeDefs, resolvers, stopOnTerminationSignals: false });
await server.start();

app.use("/graphql", expressMiddleware(server, { context: createContext }));

const PORT = process.env.PORT || 4000;
const httpServer = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/graphql`);
});

const shutdown = async () => {
  httpServer.close();
  await server.stop();
  await prisma.$disconnect();
};

process.on("SIGTERM", async () => { await shutdown(); process.exit(0); });
process.on("SIGINT", async () => { await shutdown(); process.exit(0); });

