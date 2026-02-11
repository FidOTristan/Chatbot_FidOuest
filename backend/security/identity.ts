// backend/security/identity.ts
import os from 'node:os';

export function getWindowsUserName(): string {
  // Sur Windows, os.userInfo().username est fiable.
  // (process.env.USERNAME est possible aussi, mais os.userInfo est mieux)
  return os.userInfo().username;
}