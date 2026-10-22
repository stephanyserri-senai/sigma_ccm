/**
 * Persistência local no navegador: gabaritos no localStorage e as folhas corrigidas
 * (com imagens) no IndexedDB, separadas por gabarito. Nada sai do computador do docente.
 */
import type { FolhaCorrigida, Gabarito } from './types';

const CHAVE_GABARITOS = 'corretor-senai.gabaritos.v1';

export function carregarGabaritos(): Gabarito[] {
  try {
    const bruto = localStorage.getItem(CHAVE_GABARITOS);
    return bruto ? (JSON.parse(bruto) as Gabarito[]) : [];
  } catch {
    return [];
  }
}

export function salvarGabaritos(lista: Gabarito[]) {
  try {
    localStorage.setItem(CHAVE_GABARITOS, JSON.stringify(lista));
  } catch {
    /* armazenamento indisponível (modo privado): segue apenas em memória */
  }
}

let banco: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  banco ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('corretor-senai', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('correcoes');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return banco;
}

export async function carregarFolhas(gabaritoId: string): Promise<FolhaCorrigida[]> {
  try {
    const db = await abrir();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('correcoes').objectStore('correcoes').get(gabaritoId);
      req.onsuccess = () => resolve((req.result as FolhaCorrigida[] | undefined) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function salvarFolhas(gabaritoId: string, folhas: FolhaCorrigida[]) {
  try {
    const db = await abrir();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('correcoes', 'readwrite');
      if (folhas.length) tx.objectStore('correcoes').put(folhas, gabaritoId);
      else tx.objectStore('correcoes').delete(gabaritoId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* sem IndexedDB: resultados ficam só nesta aba */
  }
}
