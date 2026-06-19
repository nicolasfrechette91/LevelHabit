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
  user: AuthUser;
  heroProfile: HeroProfile;
}>;

export type MeResponse = Readonly<{
  user: AuthUser;
  heroProfile: HeroProfile;
}>;

export type LoginRequest = Readonly<{
  email: string;
  password: string;
}>;

export type RegisterRequest = LoginRequest &
  Readonly<{
    displayName: string;
    heroName: string;
  }>;
