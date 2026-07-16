export type AuthUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  createdAtUtc: string;
}>;

export type ProgressProfile = Readonly<{
  id: string;
  displayName: string;
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
  user: AuthUser;
  progressProfile: ProgressProfile;
}>;

export type CsrfTokenResponse = Readonly<{
  csrfToken: string;
}>;

export type MeResponse = Readonly<{
  user: AuthUser;
  progressProfile: ProgressProfile;
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

export type RegisterRequest = LoginRequest &
  Readonly<{
    displayName: string;
    progressDisplayName: string;
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
