import { describe, it, expect } from 'vitest';
import { resolveSourceUrl, isLoginWall, classifyResponse } from '../link-check.js';

describe('resolveSourceUrl — guarda de ingestão', () => {
  it('aceita URL http(s) absoluta (trim)', () => {
    expect(resolveSourceUrl('  https://fbb.org.br/edital/1  ')).toBe('https://fbb.org.br/edital/1');
  });

  it('resolve URL relativa contra a base (portalUrl)', () => {
    expect(resolveSourceUrl('/editais/123', 'https://itausocial.org.br/editais/')).toBe(
      'https://itausocial.org.br/editais/123',
    );
  });

  it('rejeita string vazia', () => {
    expect(resolveSourceUrl('')).toBeNull();
    expect(resolveSourceUrl('   ')).toBeNull();
    expect(resolveSourceUrl(null)).toBeNull();
  });

  it('rejeita relativa sem base resolvível', () => {
    expect(resolveSourceUrl('/editais/123')).toBeNull();
    expect(resolveSourceUrl('Acessar')).toBeNull();
  });

  it('rejeita esquemas não-http (mailto, javascript)', () => {
    expect(resolveSourceUrl('mailto:foo@bar.com', 'https://x.org')).toBeNull();
    expect(resolveSourceUrl('javascript:void(0)', 'https://x.org')).toBeNull();
  });
});

describe('isLoginWall — detecção de parede de login', () => {
  it('detecta input[type=password] em HTML', () => {
    const body = '<html><form><input type="password" name="senha"></form></html>';
    expect(isLoginWall('https://x.org/edital/1', 'text/html', body)).toBe(true);
  });

  it('detecta form com action de login', () => {
    const body = '<form action="/sso/login" method="post"><input type="text"></form>';
    expect(isLoginWall('https://x.org/edital/1', 'text/html; charset=utf-8', body)).toBe(true);
  });

  it('detecta redirecionamento para URL de login', () => {
    expect(isLoginWall('https://x.org/entrar?next=/edital/1', 'text/html', '<html></html>')).toBe(
      true,
    );
  });

  it('NÃO marca página de conteúdo normal', () => {
    const body =
      '<html><body><h1>Edital de Cultura 2026</h1><a href="/sobre">Sobre</a></body></html>';
    expect(isLoginWall('https://x.org/edital/1', 'text/html', body)).toBe(false);
  });

  it('NÃO inspeciona conteúdo não-HTML (ex: PDF)', () => {
    expect(isLoginWall('https://x.org/edital.pdf', 'application/pdf', '%PDF senha password')).toBe(
      false,
    );
  });
});

describe('classifyResponse', () => {
  it('200 HTML com form de senha → REQUIRES_AUTH', () => {
    const body = '<form action="/login"><input type="password"></form>';
    expect(classifyResponse(200, 'https://x.org/e/1', 'text/html', body)).toBe('REQUIRES_AUTH');
  });

  it('200 HTML de conteúdo → OK', () => {
    expect(classifyResponse(200, 'https://x.org/e/1', 'text/html', '<h1>Edital</h1>')).toBe('OK');
  });

  it('404 → BROKEN', () => {
    expect(classifyResponse(404, 'https://x.org/e/1', 'text/html', '')).toBe('BROKEN');
  });

  it('500 → BROKEN', () => {
    expect(classifyResponse(500, 'https://x.org/e/1', null, '')).toBe('BROKEN');
  });

  it('405 (método não permitido, servidor vivo) → OK', () => {
    expect(classifyResponse(405, 'https://x.org/e/1', null, '')).toBe('OK');
  });
});
