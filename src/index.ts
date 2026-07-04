import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { env } from "./config/env.js";

const { app, apolloServer } = await createApp();

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
    await apolloServer.stop();
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
