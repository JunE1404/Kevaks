export const SPECIAL_CHARS = "!\"#$%&'()*+-/:<=>?@[\\]^_`{|}~";

export function isValidName(name: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(name);
}

export type PasswordError = "length" | "special" | "characters";

export function validatePassword(password: string): PasswordError | null {
  if (password.length < 8) {
    return "length";
  }

  let hasSpecial = false;
  for (const char of password) {
    if (/^[a-zA-Z0-9]$/.test(char)) {
      continue;
    }
    if (SPECIAL_CHARS.includes(char)) {
      hasSpecial = true;
      continue;
    }
    return "characters";
  }

  if (!hasSpecial) {
    return "special";
  }

  return null;
}

export function passwordsMatch(password: string, repeat: string): boolean {
  return password.length > 0 && password === repeat;
}

export type PasswordFormError = PasswordError | "empty" | "mismatch";

export function validatePasswordForm(
  password: string,
  repeat: string,
): PasswordFormError | null {
  if (password.length === 0 || repeat.length === 0) {
    return "empty";
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return passwordError;
  }

  if (!passwordsMatch(password, repeat)) {
    return "mismatch";
  }

  return null;
}
