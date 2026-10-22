/** Leitura dos arquivos importados (PDF com várias páginas ou imagens) para imagens em cinza. */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { type ImagemCinza, rgbaParaCinza } from './omr/imagem';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Resolução de trabalho: maior lado da página em pixels (~190 dpi numa folha A4). */
const MAIOR_LADO = 2200;

export interface PaginaImportada {
  arquivo: string;
  pagina: number;
  totalPaginas: number;
  imagem: ImagemCinza;
}

export const TIPOS_ACEITOS = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff';

function canvasParaCinza(canvas: HTMLCanvasElement): ImagemCinza {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return rgbaParaCinza(data, canvas.width, canvas.height);
}

function ehPdf(f: File) {
  return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
}

export async function* lerArquivo(arquivo: File): AsyncGenerator<PaginaImportada> {
  if (ehPdf(arquivo)) {
    const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
    const pdf = await tarefa.promise;
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        const pagina = await pdf.getPage(n);
        const v1 = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: MAIOR_LADO / Math.max(v1.width, v1.height) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pagina.render({ canvasContext: ctx, viewport }).promise;
        yield { arquivo: arquivo.name, pagina: n, totalPaginas: pdf.numPages, imagem: canvasParaCinza(canvas) };
        pagina.cleanup();
      }
    } finally {
      await tarefa.destroy();
    }
    return;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Formato de imagem não suportado: ${arquivo.name}. Use PDF, JPG ou PNG.`);
  }
  const escala = Math.min(1, MAIOR_LADO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  yield { arquivo: arquivo.name, pagina: 1, totalPaginas: 1, imagem: canvasParaCinza(canvas) };
}

/** Converte imagem em cinza para JPEG (data URL), opcionalmente recortando e reduzindo. */
export function cinzaParaDataUrl(
  img: ImagemCinza,
  recorte?: { x: number; y: number; largura: number; altura: number },
  maxLado = 1400,
  qualidade = 0.82,
): string {
  const r = recorte ?? { x: 0, y: 0, largura: img.largura, altura: img.altura };
  const origem = document.createElement('canvas');
  origem.width = r.largura;
  origem.height = r.altura;
  const ctx = origem.getContext('2d')!;
  const id = ctx.createImageData(r.largura, r.altura);
  for (let y = 0; y < r.altura; y++) {
    for (let x = 0; x < r.largura; x++) {
      const sx = x + r.x, sy = y + r.y;
      const v = sx >= 0 && sy >= 0 && sx < img.largura && sy < img.altura ? img.dados[sy * img.largura + sx] : 255;
      const j = (y * r.largura + x) * 4;
      id.data[j] = id.data[j + 1] = id.data[j + 2] = v;
      id.data[j + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
  const escala = Math.min(1, maxLado / Math.max(r.largura, r.altura));
  if (escala >= 1) return origem.toDataURL('image/jpeg', qualidade);
  const destino = document.createElement('canvas');
  destino.width = Math.round(r.largura * escala);
  destino.height = Math.round(r.altura * escala);
  const c2 = destino.getContext('2d')!;
  c2.imageSmoothingQuality = 'high';
  c2.drawImage(origem, 0, 0, destino.width, destino.height);
  return destino.toDataURL('image/jpeg', qualidade);
}
