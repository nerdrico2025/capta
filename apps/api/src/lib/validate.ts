/**
 * validate.ts — portão de validação UNIFICADO (sem efeitos colaterais).
 *
 * Reúne as verificações "duras" que já estavam espalhadas: campos obrigatórios,
 * prazo parseável + aberto, e saúde de link. NÃO valida classification — isso
 * é tratado separadamente pelo gate do classificador na ingestão
 * (classifyForUpsert) e pelo filtro de leitura (buildOpenWhere).
 */

export interface ValidateInput {
  title?: string | null;
  sourceUrl?: string | null;
  submissionDeadline?: Date | null;
  isOpen?: boolean | null;
  linkStatus?: string | null; // OK | REQUIRES_AUTH | BROKEN | RELATIVE | UNREACHABLE | null
}

export interface ValidateResult {
  valid: boolean;
  reason?: string;
}

const VALID = { valid: true } as const;

/** Erro tipado para o gate de ingestão sinalizar reprovação (não-persistência). */
export class ValidationRejectedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`validation rejected: ${reason}`);
    this.name = 'ValidationRejectedError';
    this.reason = reason;
  }
}

export function validate(o: ValidateInput): ValidateResult {
  // Campos obrigatórios
  if (!o.title || !o.title.trim()) return { valid: false, reason: 'missing_title' };
  if (!o.sourceUrl || !o.sourceUrl.trim()) return { valid: false, reason: 'missing_sourceUrl' };
  if (o.submissionDeadline == null) {
    return { valid: false, reason: 'missing_submissionDeadline' };
  }

  // submissionDeadline parseável + aberto
  if (!(o.submissionDeadline instanceof Date) || Number.isNaN(o.submissionDeadline.getTime())) {
    return { valid: false, reason: 'unparseable_submissionDeadline' };
  }
  if (o.isOpen !== true) return { valid: false, reason: 'not_open' };

  // Saúde de link (apenas se preenchido)
  if (o.linkStatus === 'REQUIRES_AUTH') return { valid: false, reason: 'link_requires_auth' };
  if (o.linkStatus === 'BROKEN') return { valid: false, reason: 'link_broken' };

  return VALID;
}
