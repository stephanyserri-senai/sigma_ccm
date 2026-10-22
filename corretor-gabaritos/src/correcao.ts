import type { Gabarito, LeituraQuestao, Pontuacao, ResultadoQuestao } from './types';

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function novoGabarito(): Gabarito {
  const agora = new Date().toISOString();
  return {
    id: novoId(),
    nome: '',
    turma: '',
    unidadeCurricular: '',
    numQuestoes: 30,
    numAlternativas: 5,
    notaMaxima: 10,
    respostas: Array(30).fill(null),
    anuladas: Array(30).fill(false),
    pesos: Array(30).fill(1),
    alunos: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/** Ajusta os vetores do gabarito ao número de questões. */
export function redimensionar(g: Gabarito, n: number): Gabarito {
  const ajustar = <T,>(v: T[], vazio: T) => Array.from({ length: n }, (_, i) => (i < v.length ? v[i] : vazio));
  return { ...g, numQuestoes: n, respostas: ajustar(g.respostas, null), anuladas: ajustar(g.anuladas, false), pesos: ajustar(g.pesos, 1) };
}

export function arredondar(v: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/**
 * Regras: questão anulada vale para todos; marcação múltipla ou em branco vale zero.
 * Nota = pontos obtidos / pontos possíveis × nota máxima.
 */
export function calcularPontuacao(g: Gabarito, leituras: LeituraQuestao[]): Pontuacao {
  const porQuestao: ResultadoQuestao[] = [];
  let acertos = 0, erros = 0, brancos = 0, multiplas = 0, anuladas = 0, pontos = 0, pontosPossiveis = 0;
  for (let i = 0; i < g.numQuestoes; i++) {
    const l = leituras[i];
    const peso = g.pesos[i] ?? 1;
    const correta = g.respostas[i] ?? null;
    const marcada = l?.resposta ?? null;
    pontosPossiveis += peso;
    let situacao: ResultadoQuestao['situacao'];
    if (g.anuladas[i]) situacao = 'anulada';
    else if (l?.situacao === 'multipla') situacao = 'multipla';
    else if (!marcada) situacao = 'branco';
    else situacao = marcada === correta ? 'acerto' : 'erro';
    const ganho = situacao === 'anulada' || situacao === 'acerto' ? peso : 0;
    if (situacao === 'acerto') acertos++;
    else if (situacao === 'erro') erros++;
    else if (situacao === 'branco') brancos++;
    else if (situacao === 'multipla') multiplas++;
    else anuladas++;
    pontos += ganho;
    porQuestao.push({ questao: i + 1, marcada, correta, situacao, peso, pontos: ganho });
  }
  const nota = pontosPossiveis > 0 ? arredondar((pontos / pontosPossiveis) * g.notaMaxima) : 0;
  return { acertos, erros, brancos, multiplas, anuladas, pontos, pontosPossiveis, nota, porQuestao };
}

/** Problemas que impedem corrigir com este gabarito. */
export function validarGabarito(g: Gabarito): string[] {
  const p: string[] = [];
  if (!g.nome.trim()) p.push('Informe o nome da prova.');
  const faltando = g.respostas.map((r, i) => (!r && !g.anuladas[i] ? i + 1 : 0)).filter(Boolean);
  if (faltando.length) p.push(`Questões sem resposta no gabarito: ${faltando.join(', ')}.`);
  if (!(g.notaMaxima > 0)) p.push('A nota máxima deve ser maior que zero.');
  if (g.pesos.some((x) => !(x > 0))) p.push('Todos os pesos devem ser maiores que zero.');
  return p;
}
