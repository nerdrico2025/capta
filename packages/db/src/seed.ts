import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 0, 0);
  return d;
}

const MOCK_OPPORTUNITIES = [
  // ── Transferegov (EDITAL) ────────────────────────────────────────────────
  {
    title: 'Chamamento Público — Apoio a Projetos Culturais 2025',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-001',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-001',
    deadline: daysFromNow(2),
    value: 150000,
    areas: ['cultura'],
    summary:
      'Órgão: Ministério da Cultura — Apoio a projetos de artes cênicas, musicais e audiovisuais em regiões de baixo IDH.',
  },
  {
    title: 'Edital de Fomento à Educação Básica no Campo',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-002',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-002',
    deadline: daysFromNow(7),
    value: 500000,
    areas: ['educação'],
    summary:
      'Órgão: MEC — Fomento a projetos de educação básica em comunidades rurais e ribeirinhas.',
  },
  {
    title: 'Chamamento — Atenção Básica à Saúde em Comunidades Quilombolas',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-003',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-003',
    deadline: daysFromNow(7),
    value: 800000,
    areas: ['saúde'],
    summary:
      'Órgão: Ministério da Saúde — Ampliação de cobertura de atenção primária em territórios quilombolas.',
  },
  {
    title: 'Edital de Recuperação de Matas Ciliares — Amazônia Legal',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-004',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-004',
    deadline: daysFromNow(15),
    value: 2000000,
    areas: ['meio ambiente'],
    summary:
      'Órgão: MMA — Projetos de reflorestamento e recuperação de áreas degradadas na Amazônia Legal.',
  },
  {
    title: 'Chamamento Público — Esporte e Cidadania nas Periferias',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-005',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-005',
    deadline: daysFromNow(15),
    value: 300000,
    areas: ['esporte'],
    summary:
      'Órgão: Ministério do Esporte — Projetos de inclusão social via esporte em territórios vulneráveis.',
  },
  {
    title: 'Edital Nacional de Assistência à Primeira Infância',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-006',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-006',
    deadline: daysFromNow(30),
    value: 650000,
    areas: ['assistência social', 'educação'],
    summary:
      'Órgão: MDS — Apoio a projetos de desenvolvimento integral para crianças de 0 a 6 anos em situação de vulnerabilidade.',
  },
  {
    title: 'Chamamento — Segurança Alimentar e Nutricional no Semiárido',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-007',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-007',
    deadline: daysFromNow(30),
    value: 1200000,
    areas: ['segurança alimentar'],
    summary:
      'Órgão: MDS — Projetos de combate à insegurança alimentar em municípios do semiárido nordestino.',
  },
  {
    title: 'Edital de Preservação do Patrimônio Histórico',
    source: 'Transferegov',
    type: 'EDITAL' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-008',
    portalUrl: 'https://transferegov.sistema.gov.br/chamamento/mock-008',
    deadline: daysFromNow(60),
    value: 400000,
    areas: ['cultura'],
    summary:
      'Órgão: IPHAN — Restauração e preservação de bens tombados em municípios de pequeno porte.',
  },

  // ── SALIC / Lei Rouanet (LEI) ────────────────────────────────────────────
  {
    title: 'Festival Internacional de Teatro de Rua — São Paulo 2025',
    source: 'SALIC',
    type: 'LEI' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-001',
    portalUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-001',
    deadline: daysFromNow(2),
    value: 920000,
    areas: ['cultura'],
    summary:
      'Proponente: Instituto Arte Viva — Realização do festival com 40 companhias nacionais e internacionais.',
  },
  {
    title: 'Orquestra Sinfônica Comunitária do Nordeste — Temporada 2025',
    source: 'SALIC',
    type: 'LEI' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-002',
    portalUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-002',
    deadline: daysFromNow(7),
    value: 450000,
    areas: ['cultura'],
    summary:
      'Proponente: Associação Musical Nordestina — Temporada com 20 concertos gratuitos em 10 municípios do Nordeste.',
  },
  {
    title: 'Publicação: Vozes da Floresta — Literatura Indígena Contemporânea',
    source: 'SALIC',
    type: 'LEI' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-003',
    portalUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-003',
    deadline: daysFromNow(15),
    value: 180000,
    areas: ['cultura'],
    summary:
      'Proponente: Editora Plural — Publicação de antologia com 50 autores indígenas de 12 etnias brasileiras.',
  },
  {
    title: 'Documentário — Mulheres do Sertão: Resistência e Memória',
    source: 'SALIC',
    type: 'LEI' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-004',
    portalUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-004',
    deadline: daysFromNow(30),
    value: 750000,
    areas: ['cultura', 'direitos humanos'],
    summary:
      'Proponente: Produtora Sertão Vivo — Documentário de longa-metragem sobre a resistência de mulheres rurais.',
  },
  {
    title: 'Escola de Circo Social — Rio de Janeiro',
    source: 'SALIC',
    type: 'LEI' as const,
    sourceType: 'api' as const,
    sourceUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-005',
    portalUrl: 'https://salic.cultura.gov.br/projeto/mock-sal-005',
    deadline: daysFromNow(60),
    value: 320000,
    areas: ['cultura', 'assistência social'],
    summary:
      'Proponente: Associação Circo Cidadão — Formação de 120 jovens em artes circenses com inclusão social.',
  },

  // ── Privado / Fundações (PRIVADO) ────────────────────────────────────────
  {
    title: 'Prêmio Itaú Social — Inovação em Educação 2025',
    source: 'Fundação Itaú Social',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://fundacaoitausocial.org.br/premio-2025/mock-001',
    portalUrl: 'https://fundacaoitausocial.org.br/premio-2025',
    deadline: daysFromNow(2),
    value: 1000000,
    areas: ['educação'],
    summary:
      'Premiação para projetos inovadores em educação básica com impacto mensurável em aprendizagem.',
  },
  {
    title: 'Edital Fundação Vale — Saúde e Desenvolvimento Comunitário',
    source: 'Fundação Vale',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://fundacaovale.org/editais/mock-001',
    portalUrl: 'https://fundacaovale.org/editais',
    deadline: daysFromNow(7),
    value: 600000,
    areas: ['saúde', 'desenvolvimento urbano'],
    summary:
      'Apoio a projetos de saúde comunitária em municípios mineradores com foco em prevenção.',
  },
  {
    title: 'Prêmio Lemann — Gestão Educacional Eficaz',
    source: 'Fundação Lemann',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://fundacaolemann.org.br/premios/mock-001',
    portalUrl: 'https://fundacaolemann.org.br/premios',
    deadline: daysFromNow(15),
    value: 500000,
    areas: ['educação', 'ciência e tecnologia'],
    summary:
      'Prêmio para organizações com evidências de melhoria de aprendizagem em escolas públicas.',
  },
  {
    title: 'Edital Natura Musical — Diversidade Cultural Brasileira',
    source: 'Instituto Natura',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://institutonatural.com.br/musical/mock-001',
    portalUrl: 'https://institutonatural.com.br/musical',
    deadline: daysFromNow(30),
    value: 200000,
    areas: ['cultura'],
    summary:
      'Apoio a projetos musicais que promovam a diversidade cultural e a valorização de ritmos regionais.',
  },
  {
    title: 'Chamada Aberta — Conservação da Caatinga: Akatu + ISA',
    source: 'Instituto Akatu / ISA',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://akatu.org.br/caatinga/mock-001',
    portalUrl: 'https://akatu.org.br/editais',
    deadline: daysFromNow(30),
    value: 350000,
    areas: ['meio ambiente'],
    summary:
      'Projetos de educação ambiental e conservação do bioma Caatinga com envolvimento de comunidades locais.',
  },
  {
    title: 'Fundo ELAS — Direitos das Mulheres e Igualdade de Gênero',
    source: 'Fundo ELAS',
    type: 'PRIVADO' as const,
    sourceType: 'manual' as const,
    sourceUrl: 'https://fundoelas.org.br/ciclo-2025/mock-001',
    portalUrl: 'https://fundoelas.org.br/ciclo-2025',
    deadline: daysFromNow(60),
    value: 120000,
    areas: ['direitos humanos', 'assistência social'],
    summary:
      'Doações para organizações lideradas por mulheres que promovam igualdade de gênero e combate à violência.',
  },
] as const;

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ── Sample organization ─────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { cnpj: '12345678000195' },
    update: {},
    create: {
      cnpj: '12345678000195',
      name: 'Associação Cultural Exemplo',
      areas: ['cultura', 'educação'],
      size: 'SMALL',
      location: 'São Paulo, SP',
    },
  });
  console.log(`✅ Organização: ${org.name}`);

  // ── Mock opportunities ──────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const opp of MOCK_OPPORTUNITIES) {
    try {
      await prisma.opportunity.upsert({
        where: { sourceUrl: opp.sourceUrl },
        update: {
          title: opp.title,
          deadline: opp.deadline,
          value: opp.value,
          areas: [...opp.areas],
          summary: opp.summary,
          isActive: true,
        },
        create: {
          ...opp,
          areas: [...opp.areas],
          isActive: true,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`✅ Oportunidades: ${created} criadas/atualizadas, ${skipped} ignoradas`);

  // ── Sample saved opportunity ─────────────────────────────────────────────
  const firstOpp = await prisma.opportunity.findFirst({ where: { source: 'Transferegov' } });
  if (firstOpp) {
    await prisma.savedOpportunity.upsert({
      where: {
        organizationId_opportunityId: { organizationId: org.id, opportunityId: firstOpp.id },
      },
      update: {},
      create: { organizationId: org.id, opportunityId: firstOpp.id },
    });
    console.log(`✅ Oportunidade salva: ${firstOpp.title.slice(0, 60)}...`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const counts = await prisma.$queryRaw<Array<{ source: string; count: bigint }>>`
    SELECT source, COUNT(*)::int as count FROM "Opportunity" WHERE "isActive" = true GROUP BY source ORDER BY source
  `;

  console.log('\n📊 Oportunidades por fonte:');
  for (const row of counts) {
    console.log(`   ${row.source.padEnd(20)} ${row.count}`);
  }

  console.log('\n✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
