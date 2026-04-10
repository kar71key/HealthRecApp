export type AuthFormMode = 'sign-in' | 'sign-up';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  avatarLabel: string;
};

export type ProfileUpdateInput = {
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goal?: string | null;
};
