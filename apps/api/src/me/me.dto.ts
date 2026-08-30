import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  DEFAULT_LAYOUT_DIRECTION,
  LAYOUT_DIRECTIONS,
  SOCIAL_PROVIDERS as KNOWN_SOCIAL_PROVIDERS,
} from "@thinkclear/shared";

export class MeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

export class PreferencesDto {
  @ApiProperty({
    enum: LAYOUT_DIRECTIONS,
    example: DEFAULT_LAYOUT_DIRECTION,
    description:
      'Which way a mindmap grows from its root: "down" the screen or "right" across it. Every preference is answered at its default, so a person who has never changed one still gets a complete object.',
  })
  layoutDirection: string;
}

/** At least one field is required; an empty body is rejected. */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    enum: LAYOUT_DIRECTIONS,
    example: "right",
  })
  layoutDirection?: string;
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

  /**
   * The person's own settings, on the same answer for the same reason: the
   * canvas needs them to draw its first frame, and a second round trip for one
   * object the account screen was going to fetch anyway is a round trip.
   */
  @ApiProperty({ type: PreferencesDto })
  preferences: PreferencesDto;
}
