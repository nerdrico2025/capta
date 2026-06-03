export function formatValue(value: number | null | undefined): string {
  if (value == null || value === 0) return 'Não informado';
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `R$ ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} mi`;
  }
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type DeadlineUrgency = 'expired' | 'critical' | 'warning' | 'ok';

interface DeadlineInfo {
  urgency: DeadlineUrgency;
  days: number;
  label: string;
  badgeClass: string;
  dotClass: string;
}

export function getDeadlineInfo(deadline: string | Date): DeadlineInfo {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      urgency: 'expired',
      days,
      label: 'Encerrado',
      badgeClass: 'bg-gray-100 text-gray-500',
      dotClass: 'bg-gray-400',
    };
  }
  if (days < 7) {
    return {
      urgency: 'critical',
      days,
      label: `${days}d restantes`,
      badgeClass: 'bg-red-100 text-red-700',
      dotClass: 'bg-red-500',
    };
  }
  if (days <= 15) {
    return {
      urgency: 'warning',
      days,
      label: `${days}d restantes`,
      badgeClass: 'bg-amber-100 text-amber-700',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    urgency: 'ok',
    days,
    label: `${days}d restantes`,
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
  };
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function getTimeLeft(deadline: string | Date) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
