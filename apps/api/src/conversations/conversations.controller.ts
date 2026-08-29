import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  createConversationSchema,
  updateConversationSchema,
  type CreateConversationInput,
  type UpdateConversationInput,
} from "@mindmap/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  ConversationDto,
  ConversationSummaryDto,
  CreateConversationDto,
  UpdateConversationDto,
} from "./conversation.dto";
import { ConversationsService } from "./conversations.service";

@ApiTags("conversations")
@Controller("api/conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationsService)
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ConversationSummaryDto] })
  findMine(@Session() session: UserSession) {
    return this.conversationsService.findAllByOwner(session.user.id);
  }

  @Get(":id")
  @ApiOkResponse({ type: ConversationDto })
  @ApiNotFoundResponse()
  findOne(@Session() session: UserSession, @Param("id") id: string) {
    return this.conversationsService.findOne(session.user.id, id);
  }

  @Post()
  @ApiBody({ type: CreateConversationDto })
  @ApiCreatedResponse({ type: ConversationDto })
  @ApiBadRequestResponse({ description: "Body failed validation" })
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createConversationSchema))
    body: CreateConversationInput,
  ) {
    return this.conversationsService.create(session.user.id, body.title);
  }

  @Patch(":id")
  @ApiBody({ type: UpdateConversationDto })
  @ApiOkResponse({ type: ConversationDto })
  @ApiBadRequestResponse({ description: "Body failed validation" })
  @ApiNotFoundResponse()
  rename(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateConversationSchema))
    body: UpdateConversationInput,
  ) {
    return this.conversationsService.rename(session.user.id, id, body.title);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Session() session: UserSession, @Param("id") id: string) {
    return this.conversationsService.remove(session.user.id, id);
  }
}
