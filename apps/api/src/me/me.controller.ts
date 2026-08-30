import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  updatePreferencesSchema,
  type UpdatePreferencesInput,
} from "@thinkclear/shared";
import { SOCIAL_PROVIDERS } from "../auth";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { MeResponseDto, PreferencesDto, UpdatePreferencesDto } from "./me.dto";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("api/me")
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  async me(@Session() session: UserSession): Promise<MeResponseDto> {
    const { id, email, name } = session.user;
    return {
      user: { id, email, name },
      socialProviders: SOCIAL_PROVIDERS,
      preferences: await this.meService.findPreferences(id),
    };
  }

  /**
   * A PATCH rather than a PUT because the body names what changed: the client
   * that flips one setting should not have to send back the ones it never read.
   */
  @Patch("preferences")
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiOkResponse({ type: PreferencesDto })
  @ApiBadRequestResponse({ description: "Body failed validation" })
  updatePreferences(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(updatePreferencesSchema))
    body: UpdatePreferencesInput,
  ) {
    return this.meService.updatePreferences(session.user.id, body);
  }
}
