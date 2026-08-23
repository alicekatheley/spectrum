import {
  CalendarioCelula,
  CalendarioGerado,
  CalendarioSemana,
  DiaSemana,
  InputCalendario,
  RecomendacaoVolume,
} from "../types";

// Gerador local usado enquanto o endpoint de calendário inteligente não existe. Serve só
// para popular o layout com uma grade coerente — nenhum dado aqui vem de GA4 ou do histórico.

const DIAS: DiaSemana[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const OFERTAS = ['15off', '20off', 'caixa', 'escovagringa', 'expresso', 'noite', 'ativacao', 'necessaire'];
const RECOMENDACOES: RecomendacaoVolume[] = ['aumentar', 'manter', 'manter', 'manter', 'reduzir'];

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function deISO(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

function montarCelula(iso: string, semente: number): CalendarioCelula {
  const base = hash(`${semente}-${iso}`);
  const c1Nome = OFERTAS[base % OFERTAS.length];
  const temC2 = base % 7 !== 0;
  const c2Reforco = (base >> 3) % 3 === 0;

  return {
    data: iso,
    diaSemana: DIAS[deISO(iso).getDay()],
    c1: { nome: c1Nome, receitaPorMil: Math.round(((base >> 5) % 900) + 200) / 10 },
    c2: temC2
      ? {
          nome: c2Reforco ? `${c1Nome} (últimas horas)` : OFERTAS[(base >> 7) % OFERTAS.length],
          receitaPorMil: Math.round(((base >> 11) % 550) + 150) / 10,
          tipo: c2Reforco ? 'reforco' : 'novo',
        }
      : null,
    recomendacao: RECOMENDACOES[(base >> 13) % RECOMENDACOES.length],
  };
}

export function gerarCalendarioDemo(input: InputCalendario): CalendarioGerado {
  const semente = hash(`${input.marca}-${input.dataInicio}-${input.dataFim}-${input.volumeMensagens}`);
  const fim = deISO(input.dataFim);
  const semanas: CalendarioSemana[] = [];
  let atual: CalendarioCelula[] = [];

  for (const cursor = deISO(input.dataInicio); cursor <= fim; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() === 0 && atual.length > 0) {
      semanas.push({ label: `S${semanas.length + 1}`, celulas: atual });
      atual = [];
    }
    atual.push(montarCelula(paraISO(cursor), semente));
  }
  if (atual.length > 0) semanas.push({ label: `S${semanas.length + 1}`, celulas: atual });

  return {
    id: `cal-${Date.now()}`,
    marca: input.marca,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
    semanas,
    criadoEm: new Date().toISOString(),
  };
}
