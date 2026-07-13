export type AuthUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  createdAtUtc: string;
}>;

export type HeroProfile = Readonly<{
  id: string;
  heroName: string;
  level: number;
  totalXp: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  xpToNextLevel: number;
  currentStreak: number;
  createdAtUtc: string;
}>;

export type AuthResponse = Readonly<{
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: AuthUser;
  heroProfile: HeroProfile;
}>;

export type MeResponse = Readonly<{
  user: AuthUser;
  heroProfile: HeroProfile;
}>;

export type AuthMessageResponse = Readonly<{
  message: string;
}>;

export type RegisterResponse = AuthMessageResponse &
  Readonly<{
    email: string;
    requiresEmailVerification: boolean;
  }>;

export type LoginRequest = Readonly<{
  email: string;
  password: string;
}>;

export type RefreshRequest = Readonly<{
  refreshToken: string;
}>;

export type LogoutRequest = RefreshRequest;

export type RegisterRequest = LoginRequest &
  Readonly<{
    displayName: string;
    heroName: string;
  }>;

export type ForgotPasswordRequest = Readonly<{
  email: string;
}>;

export type ResetPasswordRequest = Readonly<{
  email: string;
  token: string;
  newPassword: string;
}>;

export type ConfirmEmailRequest = Readonly<{
  email: string;
  code: string;
}>;

export type ResendVerificationCodeRequest = ForgotPasswordRequest;
