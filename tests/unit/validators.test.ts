/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest';
import { hasExactlyOne, isImageMimeType } from '../../src/lib/validators';

describe('hasExactlyOne', () => {
  it('returns true when exactly one value is truthy', () => {
    expect(hasExactlyOne(1, null)).toBe(true);
    expect(hasExactlyOne(undefined, 'x')).toBe(true);
    expect(hasExactlyOne(false, true)).toBe(true);
  });

  it('returns false when none are truthy', () => {
    expect(hasExactlyOne(undefined, null)).toBe(false);
    expect(hasExactlyOne(0, false)).toBe(false);
  });

  it('returns false when more than one is truthy', () => {
    expect(hasExactlyOne(1, 'x')).toBe(false);
    expect(hasExactlyOne(true, 123, 'y')).toBe(false);
  });
});

describe('isImageMimeType', () => {
  it('accepts image/* mimetypes', () => {
    expect(isImageMimeType('image/jpeg')).toBe(true);
    expect(isImageMimeType('image/png')).toBe(true);
  });

  it('rejects non-image mimetypes or invalid values', () => {
    expect(isImageMimeType('application/json')).toBe(false);
    expect(isImageMimeType(undefined)).toBe(false);
    expect(isImageMimeType(null as any)).toBe(false);
  });
});

