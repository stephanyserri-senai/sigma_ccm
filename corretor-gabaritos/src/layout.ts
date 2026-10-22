/**
 * Geometria da folha de respostas, em milímetros (A4 retrato).
 * É a mesma fonte de verdade para gerar o PDF e para a leitura óptica:
 * se algo mudar aqui, a impressão e a leitura continuam coerentes.
 */
import type { Letra } from './types';

export const PAGINA = { largura: 210, altura: 297 } as const;

/** Marcadores de canto (quadrados pretos) — centros em ordem TL, TR, BR, BL. */
export const MARCADOR_LADO = 8;
export const MARCADORES: readonly [number, number][] = [
  [12, 12],
  [198, 12],
  [198, 285],
  [12, 285],
];

/** Pequeno quadrado ao lado do marcador superior esquerdo: define a orientação da folha. */
export const ORIENTACAO = { x: 24, y: 12, lado: 4 } as const;

export const RAIO_BOLHA = 2.4;
export const PASSO_ALTERNATIVA = 7;
export const PASSO_LINHA = 8.5;
export const TOPO_QUESTOES = 130;
export const MAX_LINHAS_COLUNA = 15;
export const MAX_QUESTOES = 60;
export const LETRAS: Letra[] = ['A', 'B', 'C', 'D', 'E'];

/** Bloco da matrícula: 6 dígitos, cada coluna com bolhas de 0 a 9. */
export const MATRICULA = {
  digitos: 6,
  x0: 140,
  passoX: 8,
  y0: 56,
  passoY: 6.2,
} as const;

/** Área onde o aluno escreve o nome (usada para recortar a imagem na revisão). */
export const CAMPO_NOME = { x: 20, y: 40, largura: 108, altura: 9 } as const;

export interface Ponto {
  x: number;
  y: number;
}

export interface QuestaoLayout {
  numero: number;
  rotulo: Ponto;
  bolhas: Ponto[];
}

export function layoutQuestoes(numQuestoes: number, numAlternativas: number): QuestaoLayout[] {
  const n = Math.max(1, Math.min(MAX_QUESTOES, Math.floor(numQuestoes)));
  const colunas = Math.ceil(n / MAX_LINHAS_COLUNA);
  const linhasPorColuna = Math.ceil(n / colunas);
  const larguraUtil = 170;
  const larguraBloco = 11 + (numAlternativas - 1) * PASSO_ALTERNATIVA + RAIO_BOLHA;
  const questoes: QuestaoLayout[] = [];
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / linhasPorColuna);
    const l = i % linhasPorColuna;
    const centro = 20 + (c + 0.5) * (larguraUtil / colunas);
    const x0 = centro - larguraBloco / 2;
    const y = TOPO_QUESTOES + l * PASSO_LINHA;
    const bolhas: Ponto[] = [];
    for (let a = 0; a < numAlternativas; a++) bolhas.push({ x: x0 + 11 + a * PASSO_ALTERNATIVA, y });
    questoes.push({ numero: i + 1, rotulo: { x: x0 + 5.5, y }, bolhas });
  }
  return questoes;
}

/** bolhas[coluna][digito] */
export function layoutMatricula(): Ponto[][] {
  const colunas: Ponto[][] = [];
  for (let c = 0; c < MATRICULA.digitos; c++) {
    const col: Ponto[] = [];
    for (let d = 0; d < 10; d++) col.push({ x: MATRICULA.x0 + c * MATRICULA.passoX, y: MATRICULA.y0 + d * MATRICULA.passoY });
    colunas.push(col);
  }
  return colunas;
}
