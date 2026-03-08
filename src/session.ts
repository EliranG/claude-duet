import { customAlphabet } from "nanoid";
import { randomBytes } from "node:crypto";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export interface Session {
  code: string;
  password: string;
  hostUser: string;
  guestUser?: string;
  createdAt: number;
}

const UNCLAIMED_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export class SessionManager {
  private sessions = new Map<string, Session>();

  create(hostUser: string): Session {
    const code = `cd-${nanoid()}`;
    const password = randomBytes(4).toString("hex"); // 8-char hex
    const session: Session = {
      code,
      password,
      hostUser,
      createdAt: Date.now(),
    };
    this.sessions.set(code, session);
    return session;
  }

  validate(code: string, password: string): boolean {
    const session = this.sessions.get(code);
    if (!session) return false;
    if (!session.guestUser && Date.now() - session.createdAt > UNCLAIMED_EXPIRY_MS) {
      this.sessions.delete(code);
      return false;
    }
    return session.password === password;
  }

  addGuest(code: string, guestUser: string): void {
    const session = this.sessions.get(code);
    if (session) {
      session.guestUser = guestUser;
    }
  }

  getSession(code: string): Session | undefined {
    return this.sessions.get(code);
  }

  destroy(code: string): void {
    this.sessions.delete(code);
  }
}
