import { cinzaParaDataUrl, type PaginaImportada } from './arquivos';
import { novoId } from './correcao';
import { CAMPO_NOME } from './layout';
import { reduzir } from './omr/imagem';
import { PX_POR_MM, lerFolha } from './omr/leitor';
import type { FolhaCorrigida, Gabarito, LeituraQuestao } from './types';

export function statusDasLeituras(leituras: LeituraQuestao[]): 'ok' | 'revisar' {
  return leituras.some((l) => !l.editadaManualmente && (l.situacao === 'duvida' || l.situacao === 'multipla')) ? 'revisar' : 'ok';
}

export function nomePorMatricula(g: Gabarito, matricula: string): string {
  if (!matricula) return '';
  const limpa = matricula.replace(/^0+/, '');
  const a = g.alunos.find((x) => x.matricula === matricula || x.matricula.replace(/^0+/, '') === limpa);
  return a?.nome ?? '';
}

export function processarPagina(p: PaginaImportada, g: Gabarito): FolhaCorrigida {
  const r = lerFolha(p.imagem, g.numQuestoes, g.numAlternativas);
  const base = { id: novoId(), arquivo: p.arquivo, pagina: p.pagina, revisadaManualmente: false };
  if (!r.sucesso || !r.folha) {
    return {
      ...base,
      status: 'erro',
      mensagens: r.mensagens,
      matricula: '',
      nome: '',
      leituras: Array.from({ length: g.numQuestoes }, () => ({ resposta: null, situacao: 'branco', preenchimento: [] })),
      imagem: cinzaParaDataUrl(reduzir(p.imagem, 1400), undefined, 1400),
      recorteNome: null,
    };
  }
  const mensagens = [...r.mensagens];
  if (r.matriculaDuvidosa) mensagens.push('Matrícula com marcação duvidosa — confira.');
  const duvidas = r.leituras.filter((l) => l.situacao === 'duvida').length;
  const multiplas = r.leituras.filter((l) => l.situacao === 'multipla').length;
  if (duvidas) mensagens.push(`${duvidas} questão(ões) com marcação fraca ou rasurada.`);
  if (multiplas) mensagens.push(`${multiplas} questão(ões) com mais de uma alternativa marcada.`);
  if (r.leituras.every((l) => l.situacao === 'branco')) mensagens.push('Nenhuma alternativa marcada — confira se é a folha certa ou se a marcação está muito clara.');
  const status = mensagens.length || statusDasLeituras(r.leituras) === 'revisar' ? 'revisar' : 'ok';
  return {
    ...base,
    status,
    mensagens,
    matricula: r.matricula,
    nome: nomePorMatricula(g, r.matricula),
    leituras: r.leituras,
    imagem: cinzaParaDataUrl(r.folha, undefined, 1050, 0.8),
    recorteNome: cinzaParaDataUrl(r.folha, {
      x: Math.round(CAMPO_NOME.x * PX_POR_MM),
      y: Math.round((CAMPO_NOME.y - 0.5) * PX_POR_MM),
      largura: Math.round(CAMPO_NOME.largura * PX_POR_MM),
      altura: Math.round((CAMPO_NOME.altura + 1) * PX_POR_MM),
    }, 540, 0.75),
  };
}
