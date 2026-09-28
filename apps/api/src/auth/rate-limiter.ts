import { Injectable } from '@nestjs/common';
import { ApiError } from '../http.js';

interface Counter { count: number; resetAt: number }

@Injectable()
export class AuthRateLimiter {
  private readonly counters = new Map<string, Counter>();

  login(email: string, ip: string) {
    this.consume(`login-account:${email}:${ip}`, 5);
    this.consume(`login-ip:${ip}`, 20);
  }

  refresh(sessionKey: string, ip: string) { this.consume(`refresh:${sessionKey}:${ip}`, 30); }

  private consume(key: string, limit: number) {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (current.count >= limit) throw new ApiError(429, 'RATE_LIMITED', 'Too many authentication attempts.', Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
    current.count += 1;
  }
}
