/** Exportação do relatório de correção em Excel (.xlsx) com formatação nas cores SENAI. */
import ExcelJS from 'exceljs';
import { arredondar, calcularPontuacao } from './correcao';
import { LETRAS } from './layout';
import type { FolhaCorrigida, Gabarito, ResultadoQuestao } from './types';

const AZUL = 'FF004A8D';
const AZUL_CLARO = 'FFE6EEF6';
const VERMELHO = 'FFE30613';
const CORES: Record<ResultadoQuestao['situacao'], { fundo: string; fonte: string; rotulo: string }> = {
  acerto: { fundo: 'FFC6EFCE', fonte: 'FF006100', rotulo: 'Acerto' },
  erro: { fundo: 'FFFFC7CE', fonte: 'FF9C0006', rotulo: 'Erro' },
  branco: { fundo: 'FFEDEDED', fonte: 'FF595959', rotulo: 'Em branco' },
  multipla: { fundo: 'FFFFEB9C', fonte: 'FF9C5700', rotulo: 'Múltipla' },
  anulada: { fundo: 'FFDDEBF7', fonte: 'FF1F4E78', rotulo: 'Anulada' },
};

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const borda: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

function cabecalho(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.fill = fill(AZUL);
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = borda;
  });
  row.height = 22;
}

function titulo(ws: ExcelJS.Worksheet, texto: string, g: Gabarito, colunas: number) {
  ws.mergeCells(1, 1, 1, Math.max(colunas, 4));
  const t = ws.getCell(1, 1);
  t.value = texto;
  t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  t.fill = fill(AZUL);
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, Math.max(colunas, 4));
  const s = ws.getCell(2, 1);
  s.value = `Prova: ${g.nome}   ·   Turma: ${g.turma || '—'}   ·   UC/Curso: ${g.unidadeCurricular || '—'}   ·   Corrigido em ${new Date().toLocaleString('pt-BR')}`;
  s.font = { italic: true, color: { argb: 'FF404040' } };
  s.border = { bottom: { style: 'medium', color: { argb: VERMELHO } } };
}

export function nomeExibicao(f: FolhaCorrigida, i: number) {
  return f.nome.trim() || `Aluno ${i + 1} (sem nome)`;
}

export async function exportarExcel(g: Gabarito, folhas: FolhaCorrigida[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Corretor de Gabaritos SENAI';
  wb.created = new Date();
  const validas = folhas.filter((f) => f.status !== 'erro');
  const resultados = validas.map((f) => ({ f, p: calcularPontuacao(g, f.leituras) }));
  const n = g.numQuestoes;

  // ---------- Resumo ----------
  const ws = wb.addWorksheet('Resumo', { views: [{ state: 'frozen', ySplit: 4 }] });
  titulo(ws, 'Relatório de correção — Resumo por aluno', g, 10);
  const hdr = ws.getRow(4);
  hdr.values = ['Nº', 'Aluno', 'Matrícula', 'Acertos', 'Erros', 'Em branco', 'Múltiplas', `Nota (0–${g.notaMaxima})`, '% de acerto', 'Leitura', 'Arquivo / página'];
  cabecalho(hdr);
  resultados.forEach(({ f, p }, i) => {
    const r = ws.addRow([
      i + 1,
      nomeExibicao(f, folhas.indexOf(f)),
      f.matricula || '—',
      p.acertos,
      p.erros,
      p.brancos,
      p.multiplas,
      p.nota,
      p.pontosPossiveis ? p.pontos / p.pontosPossiveis : 0,
      f.status === 'ok' ? (f.revisadaManualmente ? 'Revisada' : 'Automática') : 'Pendente de revisão',
      `${f.arquivo} (p. ${f.pagina})`,
    ]);
    r.eachCell((c) => (c.border = borda));
    r.getCell(8).numFmt = '0.00';
    r.getCell(8).font = { bold: true, color: { argb: p.nota >= g.notaMaxima * 0.6 ? 'FF006100' : 'FF9C0006' } };
    r.getCell(9).numFmt = '0.0%';
    if (f.status !== 'ok') r.getCell(10).fill = fill('FFFFEB9C');
    if (i % 2 === 1) [1, 2, 3, 4, 5, 6, 7, 11].forEach((c) => (r.getCell(c).fill = fill(AZUL_CLARO)));
  });
  [6, 34, 13, 10, 8, 11, 11, 12, 12, 20, 32].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = 1; c <= 10; c++) if (c !== 2) ws.getColumn(c).alignment = { horizontal: 'center' };

  if (resultados.length) {
    const notas = resultados.map((r) => r.p.nota);
    const linha = ws.rowCount + 2;
    const stats: [string, number | string][] = [
      ['Alunos corrigidos', resultados.length],
      ['Média da turma', arredondar(notas.reduce((a, b) => a + b, 0) / notas.length)],
      ['Maior nota', Math.max(...notas)],
      ['Menor nota', Math.min(...notas)],
      ['Mediana', mediana(notas)],
      [`Alunos com nota ≥ ${arredondar(g.notaMaxima * 0.6)} (60%)`, notas.filter((x) => x >= g.notaMaxima * 0.6).length],
    ];
    stats.forEach(([k, v], i) => {
      const r = ws.getRow(linha + i);
      r.getCell(2).value = k;
      r.getCell(2).font = { bold: true };
      r.getCell(2).fill = fill(AZUL_CLARO);
      r.getCell(3).value = v;
      r.getCell(3).font = { bold: true, color: { argb: AZUL } };
      if (typeof v === 'number' && !Number.isInteger(v)) r.getCell(3).numFmt = '0.00';
    });
  }
  const pendentes = folhas.filter((f) => f.status === 'erro');
  if (pendentes.length) {
    const l = ws.rowCount + 2;
    ws.getCell(l, 2).value = 'Arquivos não lidos (não entram no relatório):';
    ws.getCell(l, 2).font = { bold: true, color: { argb: 'FF9C0006' } };
    pendentes.forEach((f, i) => (ws.getCell(l + 1 + i, 2).value = `${f.arquivo} (p. ${f.pagina}) — ${f.mensagens.join(' ')}`));
  }

  // ---------- Respostas marcadas ----------
  const wr = wb.addWorksheet('Respostas marcadas', { views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }] });
  titulo(wr, 'Respostas marcadas por aluno (verde = acerto · vermelho = erro · cinza = em branco · amarelo = múltipla · azul = anulada)', g, n + 6);
  const hq = wr.getRow(4);
  hq.values = ['Nº', 'Aluno', 'Matrícula', ...Array.from({ length: n }, (_, i) => `Q${i + 1}`), 'Acertos', 'Nota'];
  cabecalho(hq);
  const gab = wr.getRow(5);
  gab.values = ['', 'GABARITO', '', ...g.respostas.map((r, i) => (g.anuladas[i] ? 'ANUL' : r ?? '')), '', ''];
  gab.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(VERMELHO);
    c.alignment = { horizontal: 'center' };
    c.border = borda;
  });
  resultados.forEach(({ f, p }, i) => {
    const r = wr.addRow([
      i + 1,
      nomeExibicao(f, folhas.indexOf(f)),
      f.matricula || '—',
      ...p.porQuestao.map((q) => (q.situacao === 'multipla' ? '*' : q.marcada ?? '-')),
      p.acertos,
      p.nota,
    ]);
    p.porQuestao.forEach((q, j) => {
      const c = r.getCell(4 + j);
      const cor = CORES[q.situacao];
      c.fill = fill(cor.fundo);
      c.font = { bold: true, color: { argb: cor.fonte } };
      c.alignment = { horizontal: 'center' };
      c.border = borda;
      if (f.leituras[j]?.editadaManualmente) c.note = 'Alterada manualmente na revisão';
    });
    r.getCell(n + 5).numFmt = '0.00';
    r.getCell(n + 5).font = { bold: true };
    [1, 2, 3, n + 4, n + 5].forEach((k) => (r.getCell(k).border = borda));
  });
  wr.getColumn(1).width = 5;
  wr.getColumn(2).width = 30;
  wr.getColumn(3).width = 12;
  for (let j = 0; j < n; j++) wr.getColumn(4 + j).width = 5.2;
  wr.getColumn(n + 4).width = 9;
  wr.getColumn(n + 5).width = 8;
  const leg = wr.rowCount + 2;
  wr.getCell(leg, 2).value = 'Legenda: "-" = em branco · "*" = mais de uma alternativa marcada';
  wr.getCell(leg, 2).font = { italic: true, color: { argb: 'FF595959' } };

  // ---------- Análise por questão ----------
  const wa = wb.addWorksheet('Análise por questão', { views: [{ state: 'frozen', ySplit: 4 }] });
  const alts = LETRAS.slice(0, g.numAlternativas);
  titulo(wa, 'Análise por questão — índice de acerto e distribuição das respostas', g, 9 + alts.length);
  const ha = wa.getRow(4);
  ha.values = ['Questão', 'Gabarito', 'Peso', 'Acertos', '% acerto', 'Dificuldade', ...alts.map((a) => `Marcaram ${a}`), 'Em branco', 'Múltiplas', 'Distrator mais escolhido'];
  cabecalho(ha);
  for (let q = 0; q < n; q++) {
    const lista = resultados.map(({ p }) => p.porQuestao[q]);
    const total = lista.length || 1;
    const acertos = lista.filter((x) => x.situacao === 'acerto' || x.situacao === 'anulada').length;
    const pct = acertos / total;
    const contagem = alts.map((a) => lista.filter((x) => x.marcada === a && x.situacao !== 'multipla').length);
    const distratores = alts.map((a, k) => ({ a, c: contagem[k] })).filter((x) => x.a !== g.respostas[q] && x.c > 0).sort((a, b) => b.c - a.c);
    const dif = g.anuladas[q] ? 'Anulada' : pct >= 0.7 ? 'Fácil' : pct >= 0.4 ? 'Média' : 'Difícil';
    const r = wa.addRow([
      q + 1,
      g.anuladas[q] ? 'ANULADA' : g.respostas[q] ?? '',
      g.pesos[q] ?? 1,
      acertos,
      pct,
      dif,
      ...contagem,
      lista.filter((x) => x.situacao === 'branco').length,
      lista.filter((x) => x.situacao === 'multipla').length,
      distratores[0] ? `${distratores[0].a} (${distratores[0].c})` : '—',
    ]);
    r.eachCell((c) => {
      c.border = borda;
      c.alignment = { horizontal: 'center' };
    });
    r.getCell(5).numFmt = '0.0%';
    const corDif = dif === 'Fácil' ? CORES.acerto : dif === 'Média' ? CORES.multipla : dif === 'Difícil' ? CORES.erro : CORES.anulada;
    r.getCell(6).fill = fill(corDif.fundo);
    r.getCell(6).font = { bold: true, color: { argb: corDif.fonte } };
    const correta = alts.indexOf(g.respostas[q] as (typeof alts)[number]);
    if (correta >= 0) r.getCell(7 + correta).fill = fill(CORES.acerto.fundo);
  }
  [10, 10, 7, 9, 10, 12, ...alts.map(() => 12), 11, 11, 22].forEach((w, i) => (wa.getColumn(i + 1).width = w));

  // ---------- Detalhado (formato longo, bom para filtros e tabelas dinâmicas) ----------
  const wd = wb.addWorksheet('Detalhado', { views: [{ state: 'frozen', ySplit: 1 }] });
  wd.columns = [
    { header: 'Aluno', key: 'aluno', width: 30 },
    { header: 'Matrícula', key: 'mat', width: 12 },
    { header: 'Questão', key: 'q', width: 9 },
    { header: 'Gabarito', key: 'gab', width: 10 },
    { header: 'Marcada', key: 'marc', width: 10 },
    { header: 'Resultado', key: 'res', width: 12 },
    { header: 'Peso', key: 'peso', width: 7 },
    { header: 'Pontos', key: 'pts', width: 8 },
    { header: 'Leitura', key: 'leit', width: 16 },
  ];
  cabecalho(wd.getRow(1));
  resultados.forEach(({ f, p }) =>
    p.porQuestao.forEach((q, j) => {
      const r = wd.addRow({
        aluno: nomeExibicao(f, folhas.indexOf(f)),
        mat: f.matricula || '—',
        q: q.questao,
        gab: g.anuladas[j] ? 'ANULADA' : q.correta ?? '',
        marc: q.situacao === 'multipla' ? 'Múltipla' : q.marcada ?? 'Em branco',
        res: CORES[q.situacao].rotulo,
        peso: q.peso,
        pts: q.pontos,
        leit: f.leituras[j]?.editadaManualmente ? 'Corrigida à mão' : 'Automática',
      });
      r.getCell('res').fill = fill(CORES[q.situacao].fundo);
      r.getCell('res').font = { color: { argb: CORES[q.situacao].fonte } };
    }),
  );
  wd.autoFilter = { from: 'A1', to: 'I1' };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `correcao_${(g.nome || 'prova').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function mediana(v: number[]) {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : arredondar((o[m - 1] + o[m]) / 2);
}
