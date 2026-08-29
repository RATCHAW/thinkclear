import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { SOCIAL_PROVIDERS as KNOWN_SOCIAL_PROVIDERS } from "@mindmap/shared";
import { SOCIAL_PROVIDERS } from "../auth";

export class MeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

export class MeResponseDto {
  @ApiProperty({ type: MeUserDto })
  user: MeUserDto;

  /**
   * Which social providers this deployment holds credentials for, and can
   * therefore let the signed-in user connect.
   *
   * It rides on `me` rather than a config route of its own because it is the
   * same question — what this account is and what can be done to it — and
   * because it is only ever asked by the screen that already needs the user.
   */
  @ApiProperty({
    type: [String],
    enum: KNOWN_SOCIAL_PROVIDERS,
    example: KNOWN_SOCIAL_PROVIDERS,
  })
  socialProviders: string[];
}

@ApiTags("me")
@Controller("api/me")
export class MeController {
  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  me(@Session() session: UserSession): MeResponseDto {
    const { id, email, name } = session.user;
    return { user: { id, email, name }, socialProviders: SOCIAL_PROVIDERS };
  }
}
