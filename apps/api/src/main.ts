import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { CLIENT_ORIGINS } from "./auth";
import { setupSwagger } from "./swagger";

async function bootstrap() {
  // Better Auth needs the raw request body; the auth module re-adds
  // body parsers for non-auth routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Vestigial in production, where the browser reaches this API same-origin
  // through the web server's proxy — but the same list either way, so the two
  // answers can never disagree.
  app.enableCors({ origin: CLIENT_ORIGINS, credentials: true });

  setupSwagger(app);

  // A deploy replaces this container by sending it SIGTERM. Without this, Node's
  // default handler kills the process where it stands — in-flight requests
  // dropped, the Mongo connection severed mid-write. With it, Nest stops
  // accepting, drains what is open, and closes the connection.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
