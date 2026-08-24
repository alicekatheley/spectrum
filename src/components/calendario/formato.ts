import { DiaSemana } from "../../types";

// Formatação compartilhada pelos painéis de calendário. Moeda em pt-BR, valores grandes
// abreviados (R$ 1,2M / R$ 12k), percentual com 1 casa e vírgula, datas DD/MM na UI.

export function formatarMoeda(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

/** Receita por mil envios — a métrica de eficiência do modelo (§1.4). */
export function formatarRpm(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/mil`;
}

export function formatarEnvios(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M`;
  if (valor >= 1_000) return `${Math.round(valor / 1_000).toLocaleString('pt-BR')}k`;
  return valor.toLocaleString('pt-BR');
}

export function formatarPct(valor: number, comSinal = true): string {
  // Valores que arredondam para zero viram zero de verdade. Sem isto, -0,004% seria exibido
  // como "-0,0%" — um sinal de menos que sugere perda onde a diferença é ruído numérico.
  const normalizado = Math.abs(valor) < 0.05 ? 0 : valor;
  const texto = normalizado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${comSinal && normalizado > 0 ? '+' : ''}${texto}%`;
}

export function formatarHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}h`;
}

/** 'YYYY-MM-DD' → 'DD/MM'. */
export function formatarDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export const DIA_CURTO: Record<DiaSemana, string> = {
  Domingo: 'DOM',
  Segunda: 'SEG',
  Terca: 'TER',
  Quarta: 'QUA',
  Quinta: 'QUI',
  Sexta: 'SEX',
  Sabado: 'SÁB',
};
