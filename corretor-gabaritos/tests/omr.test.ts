import { describe, expect, it } from 'vitest';
import { lerFolha } from '../src/omr/leitor';
import { calcularPontuacao, novoGabarito } from '../src/correcao';
import { LETRAS } from '../src/layout';
import type { Letra } from '../src/types';
import { cantosRetos, gerarFolha } from './sintetico';

function respostasAleatorias(n: number, semente: number, alternativas = 5): (Letra | null)[] {
  let s = semente;
  return Array.from({ length: n }, () => {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    return r < 0.06 ? null : LETRAS[Math.floor(r * 1000) % alternativas];
  });
}

function rotacionar(cantos: [number, number][], graus: number, cx: number, cy: number): [number, number][] {
  const a = (graus * Math.PI) / 180;
  return cantos.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
}

function lidas(r: ReturnType<typeof lerFolha>) {
  return r.leituras.map((l) => l.resposta);
}

describe('leitura óptica', () => {
  const respostas = respostasAleatorias(30, 7);

  it('lê folha escaneada reta com 100% de acerto', () => {
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas, matricula: '204517', cantos: cantosRetos(6), largura: 1260, altura: 1782 });
    const r = lerFolha(img, 30, 5);
    expect(r.sucesso).toBe(true);
    expect(lidas(r)).toEqual(respostas);
    expect(r.leituras.every((l) => l.situacao === 'ok' || l.situacao === 'branco')).toBe(true);
    expect(r.matricula).toBe('204517');
  });

  it('lê foto torta, com perspectiva, sombra, ruído e fundo escuro', () => {
    const base = cantosRetos(5.2, 120);
    const rot = rotacionar(base, 4, 700, 900);
    rot[2] = [rot[2][0] - 25, rot[2][1] + 10]; // perspectiva
    const img = gerarFolha({
      numQuestoes: 30, numAlternativas: 5, respostas, matricula: '000981', cantos: rot, largura: 1400, altura: 1850,
      sombra: 0.45, ruido: 25, tinta: 70, desvioMarca: 0.6, raioMarca: 0.8, semente: 3,
    });
    const r = lerFolha(img, 30, 5);
    expect(r.sucesso).toBe(true);
    expect(lidas(r)).toEqual(respostas);
    expect(r.matricula).toBe('000981');
  });

  it('lê folha de ponta-cabeça', () => {
    const base = cantosRetos(5);
    const invertida: [number, number][] = [base[2], base[3], base[0], base[1]];
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas, cantos: invertida, largura: 1050, altura: 1485 });
    const r = lerFolha(img, 30, 5);
    expect(r.sucesso).toBe(true);
    expect(lidas(r)).toEqual(respostas);
    expect(r.confiancaAlinhamento).toBeGreaterThan(0.7);
  });

  it('lê folha deitada (paisagem, 90°)', () => {
    const e = 5;
    const H = 297 * e;
    // página girada 90° no sentido horário: TL da folha vai para o canto superior direito da imagem
    const cantos: [number, number][] = [[H, 0], [H, 210 * e], [0, 210 * e], [0, 0]];
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas, cantos, largura: H, altura: 210 * e });
    const r = lerFolha(img, 30, 5);
    expect(r.sucesso).toBe(true);
    expect(lidas(r)).toEqual(respostas);
  });

  it('lê marcação a lápis clara e bolhas preenchidas só no miolo', () => {
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas, cantos: cantosRetos(5), largura: 1050, altura: 1485, tinta: 125, raioMarca: 0.65, ruido: 10 });
    const r = lerFolha(img, 30, 5);
    expect(lidas(r)).toEqual(respostas);
  });

  it('detecta marcação múltipla e questão em branco', () => {
    const resp: (Letra | Letra[] | null)[] = [...respostas];
    resp[4] = ['A', 'C'];
    resp[9] = null;
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas: resp, cantos: cantosRetos(5), largura: 1050, altura: 1485 });
    const r = lerFolha(img, 30, 5);
    expect(r.leituras[4].situacao).toBe('multipla');
    expect(r.leituras[4].resposta).toBeNull();
    expect(r.leituras[9].situacao).toBe('branco');
  });

  it('marca como dúvida uma marca fraca demais (rasura)', () => {
    const img = gerarFolha({ numQuestoes: 30, numAlternativas: 5, respostas, cantos: cantosRetos(5), largura: 1050, altura: 1485, tinta: 185 });
    const r = lerFolha(img, 30, 5);
    const marcadas = respostas.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    expect(marcadas.every((i) => r.leituras[i].situacao === 'duvida')).toBe(true);
  });

  it('suporta 60 questões com 4 alternativas', () => {
    const resp = respostasAleatorias(60, 11, 4);
    const img = gerarFolha({ numQuestoes: 60, numAlternativas: 4, respostas: resp, cantos: cantosRetos(6), largura: 1260, altura: 1782 });
    const r = lerFolha(img, 60, 4);
    expect(lidas(r)).toEqual(resp);
  });

  it('recusa imagem que não é a folha de respostas', () => {
    const dados = new Uint8Array(800 * 1000).fill(230);
    for (let i = 0; i < dados.length; i += 7) dados[i] = 40;
    const r = lerFolha({ largura: 800, altura: 1000, dados }, 30, 5);
    expect(r.sucesso).toBe(false);
  });
});

describe('pontuação', () => {
  it('calcula nota com pesos e questão anulada', () => {
    const g = novoGabarito();
    g.numQuestoes = 4;
    g.respostas = ['A', 'B', 'C', 'D'];
    g.pesos = [1, 1, 2, 1];
    g.anuladas = [false, false, false, true];
    g.notaMaxima = 10;
    const p = calcularPontuacao(g, [
      { resposta: 'A', situacao: 'ok', preenchimento: [] },
      { resposta: 'C', situacao: 'ok', preenchimento: [] },
      { resposta: null, situacao: 'branco', preenchimento: [] },
      { resposta: 'A', situacao: 'ok', preenchimento: [] },
    ]);
    expect(p.acertos).toBe(1);
    expect(p.erros).toBe(1);
    expect(p.brancos).toBe(1);
    expect(p.anuladas).toBe(1);
    expect(p.pontos).toBe(2);
    expect(p.pontosPossiveis).toBe(5);
    expect(p.nota).toBe(4);
  });
});
