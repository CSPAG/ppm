import { ApiError } from '@vollholz/iam-web';
import { describe, expect, it } from 'vitest';
import { retryQuery } from './iam.tsx';

describe('retryQuery', () => {
  it('wiederholt 4xx nie (404 zeigt sofort «gibt es nicht mehr»)', () => {
    for (const status of [400, 403, 404, 412]) expect(retryQuery(0, new ApiError(status, {}))).toBe(false);
  });
  it('wiederholt Netz- und Serverfehler höchstens dreimal', () => {
    expect(retryQuery(0, new ApiError(503, {}))).toBe(true);
    expect(retryQuery(2, new TypeError('Failed to fetch'))).toBe(true);
    expect(retryQuery(3, new ApiError(500, {}))).toBe(false);
  });
});
