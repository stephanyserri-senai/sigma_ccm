/**
 * Leitura óptica da folha de respostas.
 *
 * 1. Binariza a imagem e encontra os 4 marcadores de canto.
 * 2. Descobre a orientação (folha de ponta-cabeça ou deitada) pelo quadradinho de orientação.
 * 3. Calcula a homografia e "desentorta" a folha para uma grade fixa em mm.
 * 4. Mede o preenchimento de cada bolha comparando o miolo da bolha com o papel ao redor dela.
 */
import {
  CAMPO_NOME,
  LETRAS,
  MARCADORES,
  MARCADOR_LADO,
  ORIENTACAO,
  PAGINA,
  RAIO_BOLHA,
  layoutMatricula,
  layoutQuestoes,
} from '../layout';
import type { LeituraQuestao } from '../types';
import {
  type Componente,
  type ImagemCinza,
  aplicar,
  binarizar,
  componentes,
  homografia,
  media,
  percentil,
  retificar,
  valoresNoAnel,
} from './imagem';
import { classificarQuestao, classificarDigito } from './classificar';

export const PX_POR_MM = 5;

export interface ResultadoLeitura {
  sucesso: boolean;
  mensagens: string[];
  folha: ImagemCinza | null;
  leituras: LeituraQuestao[];
  matricula: string;
  matriculaDuvidosa: boolean;
  /** 0 a 1 — quão escuro está o quadradinho de orientação (confiança no alinhamento). */
  confiancaAlinhamento: number;
}

const CANTO_LARGURA = MARCADORES[1][0] - MARCADORES[0][0];
const CANTO_ALTURA = MARCADORES[3][1] - MARCADORES[0][1];
const PROPORCAO = CANTO_ALTURA / CANTO_LARGURA;

type Quad = [Componente, Componente, Componente, Componente];

/** Escolhe os 4 marcadores entre os componentes escuros. Retorna na ordem da imagem: TL, TR, BR, BL. */
export function localizarMarcadores(img: ImagemCinza): Quad | null {
  const D = Math.max(img.largura, img.altura);
  const bin = binarizar(img, Math.round(D / 12));
  const comps = componentes(bin, img.largura, img.altura, Math.max(12, Math.round((D * 0.004) ** 2)));
  const candidatos = comps.filter((c) => {
    const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
    const lado = Math.max(bw, bh);
    const asp = bw / bh;
    const ocupacao = c.area / (bw * bh);
    return lado >= D * 0.008 && lado <= D * 0.08 && asp > 0.5 && asp < 2 && ocupacao > 0.55;
  });
  if (candidatos.length < 4) return null;

  // os K mais extremos em cada direção de canto
  const K = 5;
  const melhores = (f: (c: Componente) => number) => [...candidatos].sort((a, b) => f(b) - f(a)).slice(0, K);
  const tl = melhores((c) => -(c.cx + c.cy));
  const tr = melhores((c) => c.cx - c.cy);
  const br = melhores((c) => c.cx + c.cy);
  const bl = melhores((c) => c.cy - c.cx);

  let melhor: Quad | null = null;
  let melhorNota = -Infinity;
  for (const a of tl) for (const b of tr) for (const c of br) for (const d of bl) {
    if (new Set([a, b, c, d]).size < 4) continue;
    const nota = avaliarQuad([a, b, c, d]);
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = [a, b, c, d];
    }
  }
  return melhorNota > -Infinity ? melhor : null;
}

function dist(a: Componente, b: Componente) {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

/** Nota de plausibilidade de 4 candidatos como os marcadores da folha (-Infinity = inválido). */
function avaliarQuad(q: Quad): number {
  const [a, b, c, d] = q;
  // convexidade: todos os produtos vetoriais com o mesmo sinal
  const pts = q.map((p) => [p.cx, p.cy]);
  let sinal = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 4], [x3, y3] = pts[(i + 2) % 4];
    const cr = (x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2);
    if (Math.abs(cr) < 1e-6) return -Infinity;
    if (sinal === 0) sinal = Math.sign(cr);
    else if (Math.sign(cr) !== sinal) return -Infinity;
  }
  const horiz = (dist(a, b) + dist(d, c)) / 2;
  const vert = (dist(a, d) + dist(b, c)) / 2;
  const razao = vert / horiz;
  const retrato = Math.abs(Math.log(razao / PROPORCAO));
  const paisagem = Math.abs(Math.log(razao * PROPORCAO));
  const erroProp = Math.min(retrato, paisagem);
  if (erroProp > 0.22) return -Infinity;
  // tamanho esperado do marcador pela escala da folha
  const escala = retrato <= paisagem ? (horiz / CANTO_LARGURA + vert / CANTO_ALTURA) / 2 : (horiz / CANTO_ALTURA + vert / CANTO_LARGURA) / 2;
  const ladoEsperado = MARCADOR_LADO * escala;
  let erroTam = 0;
  for (const p of q) {
    const r = Math.sqrt(p.area) / ladoEsperado;
    if (r < 0.6 || r > 1.5) return -Infinity;
    erroTam += Math.abs(Math.log(r));
  }
  // lados opostos parecidos (perspectiva moderada)
  const r1 = dist(a, b) / dist(d, c), r2 = dist(a, d) / dist(b, c);
  if (r1 < 0.7 || r1 > 1.43 || r2 < 0.7 || r2 > 1.43) return -Infinity;
  return horiz * vert - (erroProp * 4 + erroTam) * horiz * vert * 0.25;
}

function escuridaoMedia(img: ImagemCinza, H: number[], cx: number, cy: number, meioLado: number): number {
  const v: number[] = [];
  for (let y = -meioLado; y <= meioLado; y += 0.5)
    for (let x = -meioLado; x <= meioLado; x += 0.5) {
      const [u, w] = aplicar(H, cx + x, cy + y);
      const ix = Math.round(u), iy = Math.round(w);
      v.push(ix < 0 || iy < 0 || ix >= img.largura || iy >= img.altura ? 255 : img.dados[iy * img.largura + ix]);
    }
  return media(v);
}

export function lerFolha(img: ImagemCinza, numQuestoes: number, numAlternativas: number): ResultadoLeitura {
  const falha = (msg: string): ResultadoLeitura => ({
    sucesso: false,
    mensagens: [msg],
    folha: null,
    leituras: [],
    matricula: '',
    matriculaDuvidosa: true,
    confiancaAlinhamento: 0,
  });

  const quad = localizarMarcadores(img);
  if (!quad) return falha('Os 4 marcadores de canto não foram encontrados. Verifique se a folha inteira aparece na imagem e se é a folha de respostas do sistema.');

  const cantosImg = quad.map((c) => [c.cx, c.cy] as [number, number]);
  const horiz = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2;
  const vert = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
  const deitada = vert / horiz < 1;
  const rotacoes = deitada ? [1, 3] : [0, 2];

  // testa as orientações possíveis e fica com a que deixa o quadradinho de orientação escuro
  let melhorH: number[] | null = null;
  let melhorEsc = Infinity;
  let papel = 255;
  let tinta = 0;
  for (const k of rotacoes) {
    const destino = MARCADORES.map((_, i) => cantosImg[(i + k) % 4]);
    const H = homografia(MARCADORES as [number, number][], destino);
    const esc = escuridaoMedia(img, H, ORIENTACAO.x, ORIENTACAO.y, ORIENTACAO.lado * 0.3);
    if (esc < melhorEsc) {
      melhorEsc = esc;
      melhorH = H;
    }
  }
  if (!melhorH) return falha('Não foi possível alinhar a folha.');

  const folha = retificar(img, melhorH, PAGINA.largura, PAGINA.altura, PX_POR_MM);
  const mensagens: string[] = [];

  // níveis de referência: tinta = miolo dos marcadores; papel = região em branco perto da orientação
  tinta = media(MARCADORES.map(([x, y]) => media(valoresNoAnel(folha, x * PX_POR_MM, y * PX_POR_MM, 0, MARCADOR_LADO * 0.3 * PX_POR_MM))));
  papel = percentil(Array.from(folha.dados.subarray(Math.round(folha.dados.length * 0.4), Math.round(folha.dados.length * 0.85))), 90);
  const contraste = papel - tinta;
  const escOrient = media(valoresNoAnel(folha, ORIENTACAO.x * PX_POR_MM, ORIENTACAO.y * PX_POR_MM, 0, ORIENTACAO.lado * 0.3 * PX_POR_MM));
  const confiancaAlinhamento = Math.max(0, Math.min(1, (papel - escOrient) / Math.max(1, contraste)));
  if (contraste < 40) mensagens.push('Imagem com pouco contraste (muito escura ou desbotada).');
  if (confiancaAlinhamento < 0.5) mensagens.push('Marca de orientação fraca — confira se o alinhamento está correto.');

  const tintaRef = tinta;
  const preencher = (x: number, y: number): number => {
    const cx = x * PX_POR_MM, cy = y * PX_POR_MM;
    const miolo = media(valoresNoAnel(folha, cx, cy, 0, RAIO_BOLHA * 0.6 * PX_POR_MM));
    // papel local: anel logo fora da bolha (robusto a sombras)
    const anel = valoresNoAnel(folha, cx, cy, RAIO_BOLHA * 1.25 * PX_POR_MM, RAIO_BOLHA * 1.45 * PX_POR_MM);
    const papelLocal = Math.max(percentil(anel, 75), tintaRef + 30);
    const f = (papelLocal - miolo) / (papelLocal - tintaRef);
    return Math.max(0, Math.min(1, f));
  };

  const leituras = layoutQuestoes(numQuestoes, numAlternativas).map((q) =>
    classificarQuestao(q.bolhas.map((b) => preencher(b.x, b.y)), LETRAS),
  );

  let matriculaDuvidosa = false;
  const matricula = layoutMatricula()
    .map((col) => {
      const r = classificarDigito(col.map((b) => preencher(b.x, b.y)));
      if (r.duvida) matriculaDuvidosa = true;
      return r.digito;
    })
    .join('')
    .replace(/_+$/, '');

  return { sucesso: true, mensagens, folha, leituras, matricula, matriculaDuvidosa, confiancaAlinhamento };
}

export const RECORTE_NOME = CAMPO_NOME;
