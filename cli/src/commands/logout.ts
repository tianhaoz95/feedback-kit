import { clearCredentials, CREDENTIALS_PATH } from "../config.js";

export async function logout(): Promise<void> {
  clearCredentials();
  console.log(`Removed local credentials (${CREDENTIALS_PATH}).`);
}
