import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { buildOpenApiDocument } from "./swagger";

// Writes openapi.json without starting the HTTP server; the web app's
// generate:types script turns it into TypeScript types.
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, "..", "openapi.json");
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
  process.exit(0);
}

void generate();
