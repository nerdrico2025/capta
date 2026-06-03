export interface AreaOption {
  value: string;
  label: string;
  emoji: string;
}

export const AREAS: AreaOption[] = [
  { value: 'cultura', label: 'Cultura', emoji: '🎭' },
  { value: 'educação', label: 'Educação', emoji: '📚' },
  { value: 'saúde', label: 'Saúde', emoji: '🏥' },
  { value: 'meio ambiente', label: 'Meio Ambiente', emoji: '🌿' },
  { value: 'assistência social', label: 'Assistência Social', emoji: '🤝' },
  { value: 'esporte', label: 'Esporte', emoji: '⚽' },
  { value: 'direitos humanos', label: 'Direitos Humanos', emoji: '⚖️' },
  { value: 'ciência e tecnologia', label: 'Ciência e Tecnologia', emoji: '🔬' },
  { value: 'habitação', label: 'Habitação', emoji: '🏠' },
  { value: 'segurança alimentar', label: 'Segurança Alimentar', emoji: '🌾' },
  { value: 'turismo', label: 'Turismo', emoji: '🗺️' },
  { value: 'desenvolvimento urbano', label: 'Desenvolvimento Urbano', emoji: '🏙️' },
];
