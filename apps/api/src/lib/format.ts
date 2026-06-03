export function formatValue(value: number | null | undefined): string {
  if (value == null || value === 0) return 'Não informado';
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `R$ ${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} mi`;
  }
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}
