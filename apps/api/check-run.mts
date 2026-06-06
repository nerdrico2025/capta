import { PrismaClient } from '@prisma/client';
import { Observatorio3SetorCollector } from './src/collectors/observatorio3setor.collector.js';
import { BndesCollector } from './src/collectors/bndes.collector.js';

const prisma = new PrismaClient();

console.log('Rodando OBSERVATORIO_3SETOR...');
const r1 = await new Observatorio3SetorCollector().run({ prisma });
console.log('OBSERVATORIO_3SETOR:', JSON.stringify(r1));

console.log('Rodando BNDES...');
const r2 = await new BndesCollector().run({ prisma });
console.log('BNDES:', JSON.stringify(r2));

await prisma.$disconnect();
