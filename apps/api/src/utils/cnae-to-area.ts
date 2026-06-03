// Maps CNAE fiscal codes (7-digit strings or numeric prefixes) to Capta thematic areas.
// Source: IBGE CNAE 2.3 — https://cnae.ibge.gov.br

const CNAE_MAP: Array<{ prefix: string; area: string }> = [
  // Cultura & Artes
  { prefix: '9001', area: 'cultura' }, // Artes cênicas
  { prefix: '9002', area: 'cultura' }, // Criação artística
  { prefix: '9003', area: 'cultura' }, // Gestão de espaços artísticos
  { prefix: '9101', area: 'cultura' }, // Atividades de bibliotecas e arquivos
  { prefix: '9102', area: 'cultura' }, // Museus e patrimônio histórico
  { prefix: '9103', area: 'cultura' }, // Jardins botânicos e zoológicos
  { prefix: '5912', area: 'cultura' }, // Produção de filmes e vídeos
  { prefix: '5920', area: 'cultura' }, // Gravação e edição de som
  { prefix: '9000', area: 'cultura' }, // Artes (genérico)
  { prefix: '7420', area: 'cultura' }, // Atividades fotográficas
  { prefix: '9011', area: 'cultura' }, // Produção teatral, musical e de artes
  { prefix: '9012', area: 'cultura' }, // Atividades de artistas plásticos

  // Educação
  { prefix: '8511', area: 'educação' }, // Educação infantil — creche
  { prefix: '8512', area: 'educação' }, // Educação infantil — pré-escola
  { prefix: '8513', area: 'educação' }, // Ensino fundamental
  { prefix: '8520', area: 'educação' }, // Ensino médio
  { prefix: '8531', area: 'educação' }, // Educação superior — graduação
  { prefix: '8532', area: 'educação' }, // Educação superior — pós-graduação
  { prefix: '8541', area: 'educação' }, // Educação profissional técnica
  { prefix: '8542', area: 'educação' }, // Educação profissional tecnológica
  { prefix: '8550', area: 'educação' }, // Atividades de apoio à educação
  { prefix: '8591', area: 'educação' }, // Ensino de esportes e lazer
  { prefix: '8592', area: 'educação' }, // Ensino de artes e música
  { prefix: '8593', area: 'educação' }, // Ensino de idiomas
  { prefix: '8599', area: 'educação' }, // Outras atividades de ensino

  // Saúde
  { prefix: '8610', area: 'saúde' }, // Atividades de atendimento hospitalar
  { prefix: '8621', area: 'saúde' }, // UTI móvel
  { prefix: '8622', area: 'saúde' }, // Serviços de remoção de pacientes
  { prefix: '8630', area: 'saúde' }, // Atividades de atenção à saúde humana
  { prefix: '8640', area: 'saúde' }, // Serviços de apoio diagnóstico
  { prefix: '8650', area: 'saúde' }, // Profissionais da saúde
  { prefix: '8660', area: 'saúde' }, // Atividades de saúde coletiva
  { prefix: '8690', area: 'saúde' }, // Outras atividades de saúde

  // Assistência Social
  { prefix: '8711', area: 'assistência social' }, // Assistência em residência coletiva
  { prefix: '8712', area: 'assistência social' }, // Assistência a deficientes
  { prefix: '8720', area: 'assistência social' }, // Assistência a portadores de transtornos
  { prefix: '8730', area: 'assistência social' }, // Assistência ao idoso
  { prefix: '8741', area: 'assistência social' }, // Assistência a crianças e adolescentes
  { prefix: '8742', area: 'assistência social' }, // Assistência à pessoa com deficiência
  { prefix: '8800', area: 'assistência social' }, // Assistência social sem alojamento

  // Meio Ambiente
  { prefix: '0210', area: 'meio ambiente' }, // Silvicultura
  { prefix: '0220', area: 'meio ambiente' }, // Exploração florestal
  { prefix: '3700', area: 'meio ambiente' }, // Esgoto e atividades relacionadas
  { prefix: '3800', area: 'meio ambiente' }, // Coleta, tratamento de resíduos
  { prefix: '3900', area: 'meio ambiente' }, // Descontaminação e gestão ambiental
  { prefix: '7490', area: 'meio ambiente' }, // Outras atividades profissionais científicas
  { prefix: '7410', area: 'meio ambiente' }, // Design ambiental

  // Esporte
  { prefix: '9311', area: 'esporte' }, // Gestão de instalações esportivas
  { prefix: '9312', area: 'esporte' }, // Clubes esportivos
  { prefix: '9313', area: 'esporte' }, // Academias de condicionamento físico
  { prefix: '9319', area: 'esporte' }, // Outras atividades esportivas

  // Direitos Humanos
  { prefix: '9101', area: 'direitos humanos' },
  { prefix: '9491', area: 'direitos humanos' }, // Atividades de organizações religiosas
  { prefix: '9492', area: 'direitos humanos' }, // Atividades de organizações políticas
  { prefix: '9493', area: 'direitos humanos' }, // Atividades de organizações associativas
  { prefix: '9499', area: 'direitos humanos' }, // Outras organizações

  // Ciência e Tecnologia
  { prefix: '7210', area: 'ciência e tecnologia' }, // P&D em ciências físicas e naturais
  { prefix: '7220', area: 'ciência e tecnologia' }, // P&D em ciências sociais
  { prefix: '6201', area: 'ciência e tecnologia' }, // Desenvolvimento de software
  { prefix: '6209', area: 'ciência e tecnologia' }, // Outras TI

  // Associações (genérico — cobre 9430)
  { prefix: '9430', area: 'direitos humanos' }, // Atividades de associações de defesa de direitos
];

export function cnaeToArea(cnae: number | string | undefined): string[] {
  if (!cnae) return [];

  const code = String(cnae).replace(/\D/g, '');
  const areas = new Set<string>();

  for (const entry of CNAE_MAP) {
    const prefix = entry.prefix.replace(/\D/g, '');
    if (code.startsWith(prefix)) {
      areas.add(entry.area);
    }
  }

  return [...areas];
}

export function cnaesToAreas(
  primary: number | string | undefined,
  secondary: Array<{ codigo?: number | string }> = [],
): string[] {
  const areas = new Set<string>();

  for (const a of cnaeToArea(primary)) areas.add(a);

  for (const s of secondary) {
    for (const a of cnaeToArea(s.codigo)) areas.add(a);
  }

  return [...areas];
}
