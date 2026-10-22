import type { Letra, LeituraQuestao } from '../types';

/**
 * Limiares de preenchimento (0 = bolha vazia, 1 = totalmente preenchida).
 * Entre FRACA e MARCADA a leitura é considerada duvidosa e vai para revisão manual.
 */
export const LIMIAR = {
  MARCADA: 0.45,
  FRACA: 0.22,
  /** a 2ª bolha mais escura acima disso indica rasura/segunda marca */
  SEGUNDA_SUSPEITA: 0.25,
  /** 2ª marca precisa ter pelo menos esta fração da 1ª para ser "múltipla" com segurança */
  MULTIPLA_RELATIVA: 0.65,
} as const;

function ordenar(p: number[]) {
  return p.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
}

export function classificarQuestao(preenchimento: number[], letras: Letra[]): LeituraQuestao {
  const o = ordenar(preenchimento);
  const top = o[0], seg = o[1] ?? { v: 0, i: -1 };
  const base = { preenchimento: preenchimento.map((v) => Math.round(v * 1000) / 1000) };
  if (top.v < LIMIAR.FRACA) return { ...base, resposta: null, situacao: 'branco' };
  if (top.v < LIMIAR.MARCADA) {
    return { ...base, resposta: top.v >= 0.3 && seg.v < LIMIAR.FRACA ? letras[top.i] : null, situacao: 'duvida' };
  }
  if (seg.v >= LIMIAR.MARCADA && seg.v >= top.v * LIMIAR.MULTIPLA_RELATIVA) return { ...base, resposta: null, situacao: 'multipla' };
  if (seg.v >= LIMIAR.SEGUNDA_SUSPEITA) return { ...base, resposta: letras[top.i], situacao: 'duvida' };
  return { ...base, resposta: letras[top.i], situacao: 'ok' };
}

/** Lê uma coluna da matrícula: '0'..'9', '_' (em branco) ou '?' (dúvida/múltipla). */
export function classificarDigito(preenchimento: number[]): { digito: string; duvida: boolean } {
  const o = ordenar(preenchimento);
  const top = o[0], seg = o[1];
  if (top.v < LIMIAR.FRACA) return { digito: '_', duvida: false };
  if (top.v < LIMIAR.MARCADA || seg.v >= LIMIAR.SEGUNDA_SUSPEITA) return { digito: '?', duvida: true };
  return { digito: String(top.i), duvida: false };
}
