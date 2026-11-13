import { describe, expect, it } from 'vitest';
import { splitClientAddress } from './projectOffer';

describe('splitClientAddress', () => {
  it('splits street, house number, postal code and city', () => {
    expect(splitClientAddress('Hauptstraße 12a, 20095 Hamburg')).toEqual({
      street: 'Hauptstraße',
      house_number: '12a',
      postal_code: '20095',
      city: 'Hamburg',
      country: 'Deutschland',
    });
  });

  it('falls back to empty fields without an address', () => {
    expect(splitClientAddress(undefined).street).toBe('');
    expect(splitClientAddress('  ').city).toBe('');
  });
});
