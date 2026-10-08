export const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;
export const normalizeUsername = (value:string) => value.trim().toLowerCase();
