/** Operações básicas de imagem em tons de cinza (0 = preto, 255 = branco), sem dependências. */

export interface ImagemCinza {
  largura: number;
  altura: number;
  dados: Uint8Array;
}

/**
 * Converte RGBA em cinza usando o menor canal: tinta azul/preta/vermelha fica escura
 * e o papel branco continua claro, o que aumenta o contraste das marcações a caneta.
 */
export function rgbaParaCinza(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): ImagemCinza {
  const dados = new Uint8Array(largura * altura);
  for (let i = 0, j = 0; i < dados.length; i++, j += 4) {
    const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
    let m = r < g ? r : g;
    if (b < m) m = b;
    // pixels transparentes (PNG) são tratados como papel
    dados[i] = rgba[j + 3] < 128 ? 255 : m;
  }
  return { largura, altura, dados };
}

/** Imagem integral (somas acumuladas) para médias locais em O(1). */
function integral(img: ImagemCinza): Float64Array {
  const { largura: w, altura: h, dados } = img;
  const s = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let linha = 0;
    for (let x = 1; x <= w; x++) {
      linha += dados[(y - 1) * w + (x - 1)];
      s[y * (w + 1) + x] = s[(y - 1) * (w + 1) + x] + linha;
    }
  }
  return s;
}

/**
 * Binarização adaptativa: um pixel é "escuro" quando está bem abaixo da média da vizinhança.
 * Tolera sombras e variações de iluminação de fotos de celular.
 */
export function binarizar(img: ImagemCinza, janela: number, fator = 0.75, limiteAbsoluto = 170): Uint8Array {
  const { largura: w, altura: h, dados } = img;
  const s = integral(img);
  const r = Math.max(2, Math.floor(janela / 2));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const soma = s[y1 * (w + 1) + x1] - s[y0 * (w + 1) + x1] - s[y1 * (w + 1) + x0] + s[y0 * (w + 1) + x0];
      const media = soma / ((x1 - x0) * (y1 - y0));
      const v = dados[y * w + x];
      if (v < media * fator && v < limiteAbsoluto) bin[y * w + x] = 1;
    }
  }
  return bin;
}

export interface Componente {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
}

/** Componentes conexos (vizinhança-8) dos pixels escuros. */
export function componentes(bin: Uint8Array, w: number, h: number, areaMinima = 20): Componente[] {
  const rotulo = new Int32Array(w * h);
  const pilha = new Int32Array(w * h);
  const lista: Componente[] = [];
  let atual = 0;
  for (let inicio = 0; inicio < bin.length; inicio++) {
    if (!bin[inicio] || rotulo[inicio]) continue;
    atual++;
    let topo = 0;
    pilha[topo++] = inicio;
    rotulo[inicio] = atual;
    let area = 0, sx = 0, sy = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    while (topo > 0) {
      const p = pilha[--topo];
      const x = p % w, y = (p - x) / w;
      area++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (bin[q] && !rotulo[q]) {
            rotulo[q] = atual;
            pilha[topo++] = q;
          }
        }
      }
    }
    if (area >= areaMinima) lista.push({ area, minX, maxX, minY, maxY, cx: sx / area, cy: sy / area });
  }
  return lista;
}

/** Homografia 3x3 (vetor de 9) que leva os 4 pontos `de` nos 4 pontos `para`. */
export function homografia(de: [number, number][], para: [number, number][]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i];
    const [u, v] = para[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = resolver(A, b);
  return [...h, 1];
}

function resolver(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) throw new Error('Pontos degenerados para homografia');
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((linha, i) => linha[n] / linha[i]);
}

export function aplicar(H: number[], x: number, y: number): [number, number] {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

function amostrar(img: ImagemCinza, x: number, y: number): number {
  const { largura: w, altura: h, dados } = img;
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 255;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0, fy = y - y0;
  const a = dados[y0 * w + x0], b = dados[y0 * w + x1], c = dados[y1 * w + x0], d = dados[y1 * w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * Gera a folha "desentortada": cada pixel de saída corresponde a uma posição em mm no modelo,
 * levada à imagem original pela homografia H (mm -> pixel da imagem).
 */
export function retificar(img: ImagemCinza, H: number[], larguraMm: number, alturaMm: number, pxPorMm: number): ImagemCinza {
  const largura = Math.round(larguraMm * pxPorMm);
  const altura = Math.round(alturaMm * pxPorMm);
  const dados = new Uint8Array(largura * altura);
  for (let y = 0; y < altura; y++) {
    const my = (y + 0.5) / pxPorMm;
    for (let x = 0; x < largura; x++) {
      const [u, v] = aplicar(H, (x + 0.5) / pxPorMm, my);
      dados[y * largura + x] = amostrar(img, u, v);
    }
  }
  return { largura, altura, dados };
}

/** Valores dos pixels dentro de um anel (raio interno ri, externo re), em pixels. */
export function valoresNoAnel(img: ImagemCinza, cx: number, cy: number, ri: number, re: number): number[] {
  const out: number[] = [];
  const { largura: w, altura: h, dados } = img;
  const r2i = ri * ri, r2e = re * re;
  for (let y = Math.floor(cy - re); y <= Math.ceil(cy + re); y++) {
    if (y < 0 || y >= h) continue;
    for (let x = Math.floor(cx - re); x <= Math.ceil(cx + re); x++) {
      if (x < 0 || x >= w) continue;
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d2 >= r2i && d2 <= r2e) out.push(dados[y * w + x]);
    }
  }
  return out;
}

export function media(v: number[]): number {
  if (!v.length) return 255;
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

export function percentil(v: number[], p: number): number {
  if (!v.length) return 255;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.max(0, Math.round((p / 100) * (o.length - 1))))];
}

/** Reduz a imagem (média por área) para que o maior lado não passe de `maxLado`. */
export function reduzir(img: ImagemCinza, maxLado: number): ImagemCinza {
  const escala = maxLado / Math.max(img.largura, img.altura);
  if (escala >= 1) return img;
  const largura = Math.max(1, Math.round(img.largura * escala));
  const altura = Math.max(1, Math.round(img.altura * escala));
  const dados = new Uint8Array(largura * altura);
  const fx = img.largura / largura, fy = img.altura / altura;
  for (let y = 0; y < altura; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < largura; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += img.dados[yy * img.largura + xx]; n++; }
      dados[y * largura + x] = s / n;
    }
  }
  return { largura, altura, dados };
}
