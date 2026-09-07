import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { searchSources } from "../traceSearch";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/trace/search", async (req, res) => {
    try {
      const body = req.body as {
        faceEmbedding?: unknown;
        query?: unknown;
        sourceHints?: unknown;
        imageData?: unknown;
      };

      const response = await searchSources({
        faceEmbedding: body.faceEmbedding,
        query: typeof body.query === "string" ? body.query : undefined,
        sourceHints: Array.isArray(body.sourceHints)
          ? body.sourceHints.filter((item): item is string => typeof item === "string")
          : [],
        imageData: typeof body.imageData === "string" ? body.imageData : undefined,
      });

      const statusCode = response.status === "search_configuration_error" ? 503
        : response.status === "search_authentication_error" ? 401
          : response.status === "search_rate_limited" ? 429
            : response.status === "search_request_timed_out" ? 504
              : response.status === "search_request_failed" || response.status === "search_provider_error" ? 502
                : 200;
      res.status(statusCode).json(response);
    } catch (error) {
      console.error("[Trace Search] Invalid request:", error);
      res.status(400).json({
        status: "search_request_failed",
        provider: "UNKNOWN",
        message: "SEARCH REQUEST FAILED. Invalid request payload.",
        results: [],
      });
    }
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
