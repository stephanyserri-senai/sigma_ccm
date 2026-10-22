/** Gera imagens sintéticas da folha de respostas para testar a leitura óptica. */
import { LETRAS, MARCADORES, MARCADOR_LADO, ORIENTACAO, PAGINA, RAIO_BOLHA, layoutMatricula, layoutQuestoes } from '../src/layout';
import { type ImagemCinza, aplicar, homografia } from '../src/omr/imagem';
import type { Letra } from '../src/types';

export interface OpcoesSinteticas {
  numQuestoes: number;
  numAlternativas: number;
  respostas: (Letra | Letra[] | null)[];
  matricula?: string;
  /** cantos da página (TL, TR, BR, BL) na imagem de saída, em px */
  cantos: [number, number][];
  largura: number;
  altura: number;
  tinta?: number;
  ruido?: number;
  sombra?: number;
  /** marcas parciais: fração do raio preenchida */
  raioMarca?: number;
  desvioMarca?: number;
  fundo?: number;
  semente?: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function gerarFolha(o: OpcoesSinteticas): ImagemCinza {
  const rand = rng(o.semente ?? 1);
  const cantosPagina: [number, number][] = [[0, 0], [PAGINA.largura, 0], [PAGINA.largura, PAGINA.altura], [0, PAGINA.altura]];
  const pxParaMm = homografia(o.cantos, cantosPagina);
  const tinta = o.tinta ?? 35;
  const raioMarca = (o.raioMarca ?? 0.92) * RAIO_BOLHA;
  const marcas: { x: number; y: number }[] = [];
  const bolhas: { x: number; y: number }[] = [];
  layoutQuestoes(o.numQuestoes, o.numAlternativas).forEach((q, i) => {
    const r = o.respostas[i];
    const lista = r == null ? [] : Array.isArray(r) ? r : [r];
    q.bolhas.forEach((b, a) => {
      bolhas.push(b);
      if (lista.includes(LETRAS[a])) {
        const d = o.desvioMarca ?? 0;
        marcas.push({ x: b.x + (rand() - 0.5) * d, y: b.y + (rand() - 0.5) * d });
      }
    });
  });
  layoutMatricula().forEach((col, c) => {
    col.forEach((b, d) => {
      bolhas.push(b);
      if (o.matricula && o.matricula[c] === String(d)) marcas.push(b);
    });
  });

  // índice espacial (células de 5 mm) para não testar todas as bolhas em cada pixel
  const celula = (x: number, y: number) => `${Math.floor(x / 5)},${Math.floor(y / 5)}`;
  const indice = new Map<string, { bolhas: typeof bolhas; marcas: typeof marcas }>();
  const pegar = (k: string) => {
    let e = indice.get(k);
    if (!e) indice.set(k, (e = { bolhas: [], marcas: [] }));
    return e;
  };
  for (const b of bolhas) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) pegar(celula(b.x + dx * 5, b.y + dy * 5)).bolhas.push(b);
  for (const m of marcas) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) pegar(celula(m.x + dx * 5, m.y + dy * 5)).marcas.push(m);
  const vazio = { bolhas: [], marcas: [] };

  const { largura: w, altura: h } = o;
  const dados = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [mx, my] = aplicar(pxParaMm, x + 0.5, y + 0.5);
      let v = 245;
      if (mx < 0 || my < 0 || mx > PAGINA.largura || my > PAGINA.altura) v = o.fundo ?? 90;
      else {
        for (const [cx, cy] of MARCADORES) if (Math.abs(mx - cx) <= MARCADOR_LADO / 2 && Math.abs(my - cy) <= MARCADOR_LADO / 2) v = 20;
        if (Math.abs(mx - ORIENTACAO.x) <= ORIENTACAO.lado / 2 && Math.abs(my - ORIENTACAO.y) <= ORIENTACAO.lado / 2) v = 20;
        // "texto" do cabeçalho
        if (my > 20 && my < 34 && mx > 30 && mx < 180 && Math.floor(mx * 1.3) % 3 === 0 && Math.floor(my * 2) % 3 !== 0) v = 60;
        const local = indice.get(celula(mx, my)) ?? vazio;
        for (const b of local.bolhas) {
          const d = Math.hypot(mx - b.x, my - b.y);
          if (Math.abs(d - RAIO_BOLHA) < 0.15) v = Math.min(v, 110);
          else if (Math.abs(mx - b.x) < 0.6 && Math.abs(my - b.y) < 0.8 && Math.floor((mx - b.x) * 5) % 2 === 0) v = Math.min(v, 175);
        }
        for (const m of local.marcas) if (Math.hypot(mx - m.x, my - m.y) <= raioMarca) v = Math.min(v, tinta);
      }
      if (o.sombra) v *= 1 - o.sombra * (x / w) * (y / h);
      if (o.ruido) v += (rand() - 0.5) * 2 * o.ruido;
      dados[y * w + x] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return { largura: w, altura: h, dados };
}

/** Cantos da página para uma folha escaneada reta numa imagem de `escala` px/mm. */
export function cantosRetos(escala: number, margem = 0): [number, number][] {
  return [
    [margem, margem],
    [margem + PAGINA.largura * escala, margem],
    [margem + PAGINA.largura * escala, margem + PAGINA.altura * escala],
    [margem, margem + PAGINA.altura * escala],
  ];
}
