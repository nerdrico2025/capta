import { describe, it, expect } from 'vitest';
import { validate, type ValidateInput } from '../validate.js';

const future = new Date(Date.now() + 30 * 86_400_000);

function base(overrides: Partial<ValidateInput> = {}): ValidateInput {
  return {
    title: 'Edital de Cultura 2026',
    sourceUrl: 'https://x.org/editais/1',
    submissionDeadline: future,
    isOpen: true,
    linkStatus: null,
    ...overrides,
  };
}

describe('validate — portão de inválidos duros', () => {
  it('aprova um registro válido', () => {
    expect(validate(base())).toEqual({ valid: true });
  });

  it('rejeita título ausente/vazio', () => {
    expect(validate(base({ title: '' })).reason).toBe('missing_title');
    expect(validate(base({ title: '   ' })).reason).toBe('missing_title');
  });

  it('rejeita sourceUrl ausente', () => {
    expect(validate(base({ sourceUrl: null })).reason).toBe('missing_sourceUrl');
  });

  it('rejeita submissionDeadline ausente', () => {
    expect(validate(base({ submissionDeadline: null })).reason).toBe('missing_submissionDeadline');
  });

  it('rejeita submissionDeadline não-parseável', () => {
    expect(validate(base({ submissionDeadline: new Date('not-a-date') })).reason).toBe(
      'unparseable_submissionDeadline',
    );
  });

  it('rejeita isOpen != true', () => {
    expect(validate(base({ isOpen: false })).reason).toBe('not_open');
    expect(validate(base({ isOpen: null })).reason).toBe('not_open');
  });

  it('rejeita linkStatus REQUIRES_AUTH e BROKEN', () => {
    expect(validate(base({ linkStatus: 'REQUIRES_AUTH' })).reason).toBe('link_requires_auth');
    expect(validate(base({ linkStatus: 'BROKEN' })).reason).toBe('link_broken');
  });

  it('aceita linkStatus OK / null / UNREACHABLE (não bloqueia)', () => {
    expect(validate(base({ linkStatus: 'OK' })).valid).toBe(true);
    expect(validate(base({ linkStatus: null })).valid).toBe(true);
    expect(validate(base({ linkStatus: 'UNREACHABLE' })).valid).toBe(true);
  });
});
