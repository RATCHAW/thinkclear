import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Mindmap API")
    .setDescription("Mindmap app API")
    .setVersion("0.0.1")
    .addCookieAuth("better-auth.session_token")
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup("docs", app, buildOpenApiDocument(app));
}
