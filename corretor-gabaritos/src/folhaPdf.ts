/** Geração da folha de respostas oficial (PDF A4) e de folhas simuladas para teste. */
import { jsPDF } from 'jspdf';
import {
  CAMPO_NOME,
  LETRAS,
  MARCADORES,
  MARCADOR_LADO,
  MATRICULA,
  ORIENTACAO,
  PAGINA,
  RAIO_BOLHA,
  TOPO_QUESTOES,
  layoutMatricula,
  layoutQuestoes,
} from './layout';
import { calcularPontuacao } from './correcao';
import type { Gabarito, Letra } from './types';

export interface Preenchimento {
  nome: string;
  matricula: string;
  respostas: (Letra | Letra[] | null)[];
  rodape?: string;
}

function desenharFolha(doc: jsPDF, g: Gabarito, p?: Preenchimento) {
  doc.setDrawColor(0);
  doc.setTextColor(0);
  doc.setFillColor(0, 0, 0);
  for (const [x, y] of MARCADORES) doc.rect(x - MARCADOR_LADO / 2, y - MARCADOR_LADO / 2, MARCADOR_LADO, MARCADOR_LADO, 'F');
  doc.rect(ORIENTACAO.x - ORIENTACAO.lado / 2, ORIENTACAO.y - ORIENTACAO.lado / 2, ORIENTACAO.lado, ORIENTACAO.lado, 'F');

  // cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('FOLHA DE RESPOSTAS', 32, 14);
  doc.setFontSize(13);
  doc.text('SENAI', 186, 14, { align: 'right' });
  doc.setLineWidth(0.4);
  doc.line(20, 19, 190, 19);

  doc.setFontSize(10);
  doc.text('Prova:', 20, 25);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(g.nome || '—', 150)[0], 33, 25);
  doc.setFont('helvetica', 'bold');
  doc.text('UC/Curso:', 20, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(g.unidadeCurricular || '', 50)[0] ?? '', 39, 31);
  doc.setFont('helvetica', 'bold');
  doc.text('Turma:', 95, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(g.turma || '', 30)[0] ?? '', 108, 31);

  // nome
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('NOME DO ALUNO (letra de forma)', CAMPO_NOME.x, CAMPO_NOME.y - 1.2);
  doc.setLineWidth(0.3);
  doc.rect(CAMPO_NOME.x, CAMPO_NOME.y, CAMPO_NOME.largura, CAMPO_NOME.altura);
  doc.text('DATA', 20, 54.8);
  doc.rect(20, 56, 34, 7);
  doc.text('ASSINATURA', 58, 54.8);
  doc.rect(58, 56, 70, 7);

  // instruções
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUÇÕES', 20, 71);
  doc.setFont('helvetica', 'normal');
  const instr = [
    '• Use caneta esferográfica azul ou preta.',
    '• Preencha TODA a bolha da alternativa escolhida.',
    '• Marque apenas UMA alternativa por questão.',
    '• Não rasure, não dobre e não amasse a folha.',
    '• Não escreva sobre os quadrados pretos dos cantos.',
    '• Preencha a matrícula escrevendo e marcando os números.',
  ];
  instr.forEach((t, i) => doc.text(t, 20, 76 + i * 4.3));
  doc.setFont('helvetica', 'bold');
  doc.text('Correto:', 20, 106);
  doc.circle(37, 105, 2, 'F');
  doc.text('Incorreto:', 48, 106);
  const exemplosErrados = [66, 75, 84];
  exemplosErrados.forEach((x) => doc.circle(x, 105, 2, 'S'));
  doc.line(64.6, 103.6, 67.4, 106.4);
  doc.line(64.6, 106.4, 67.4, 103.6);
  doc.line(73.8, 105, 74.8, 106.2);
  doc.line(74.8, 106.2, 76.6, 103.6);
  doc.circle(84, 105, 0.7, 'F');

  // matrícula
  const mat = layoutMatricula();
  const xMin = MATRICULA.x0 - 5, xMax = MATRICULA.x0 + (MATRICULA.digitos - 1) * MATRICULA.passoX + 5;
  doc.setLineWidth(0.3);
  doc.rect(xMin, 35, xMax - xMin, 81);
  doc.setFontSize(8);
  doc.text('MATRÍCULA', (xMin + xMax) / 2, 39.5, { align: 'center' });
  mat.forEach((col, c) => {
    const x = col[0].x;
    doc.rect(x - 3, 42, 6, 7);
    if (p?.matricula?.[c]) {
      doc.setFontSize(11);
      doc.setTextColor(20, 30, 110);
      doc.text(p.matricula[c], x, 47.6, { align: 'center' });
      doc.setTextColor(0);
    }
    col.forEach((b, d) => bolha(doc, b.x, b.y, String(d), p?.matricula?.[c] === String(d)));
  });

  // questões
  doc.setLineWidth(0.4);
  doc.line(20, TOPO_QUESTOES - 8, 190, TOPO_QUESTOES - 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESPOSTAS', 20, TOPO_QUESTOES - 9.5);
  const qs = layoutQuestoes(g.numQuestoes, g.numAlternativas);
  qs.forEach((q, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text(String(q.numero).padStart(2, '0'), q.rotulo.x + 1.8, q.rotulo.y + 1.2, { align: 'right' });
    const marcadas = p ? p.respostas[i] : null;
    const lista = marcadas == null ? [] : Array.isArray(marcadas) ? marcadas : [marcadas];
    q.bolhas.forEach((b, a) => bolha(doc, b.x, b.y, LETRAS[a], lista.includes(LETRAS[a])));
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(90);
  doc.text(p?.rodape ?? 'Corretor de Gabaritos SENAI · leitura óptica — mantenha os quatro quadrados pretos visíveis ao digitalizar', PAGINA.largura / 2, 293, { align: 'center' });
  doc.setTextColor(0);

  if (p?.nome) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 30, 110);
    doc.text(p.nome.toUpperCase(), CAMPO_NOME.x + 2, CAMPO_NOME.y + 6.3);
    doc.setTextColor(0);
  }
}

function bolha(doc: jsPDF, x: number, y: number, rotulo: string, marcada: boolean) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.circle(x, y, RAIO_BOLHA, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(140);
  doc.text(rotulo, x, y + 0.75, { align: 'center' });
  doc.setTextColor(0);
  if (marcada) {
    // simula caneta azul, levemente fora do centro
    const dx = (Math.random() - 0.5) * 0.5, dy = (Math.random() - 0.5) * 0.5;
    doc.setFillColor(25, 35, 120);
    doc.circle(x + dx, y + dy, RAIO_BOLHA * 0.88, 'F');
    doc.setFillColor(0, 0, 0);
  }
}

function nomeArquivo(base: string) {
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 60) || 'prova';
}

export function baixarFolhaRespostas(g: Gabarito) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  desenharFolha(doc, g);
  doc.save(`folha_respostas_${nomeArquivo(g.nome)}.pdf`);
}

const NOMES = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Rocha', 'Eduarda Alves', 'Felipe Costa', 'Gabriela Dias', 'Heitor Nunes', 'Isabela Ramos', 'João Pereira', 'Larissa Gomes', 'Mateus Barros', 'Natália Pinto', 'Otávio Freitas', 'Paula Cardoso', 'Rafael Teixeira', 'Sofia Martins', 'Thiago Moreira', 'Vitória Lopes', 'William Castro'];

/**
 * Gera um PDF com folhas preenchidas aleatoriamente para testar a correção.
 * O rodapé de cada página informa o resultado esperado para conferência.
 */
export function baixarFolhasSimuladas(g: Gabarito, quantidade: number) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const alternativas = LETRAS.slice(0, g.numAlternativas);
  for (let s = 0; s < quantidade; s++) {
    if (s > 0) doc.addPage();
    const habilidade = 0.35 + Math.random() * 0.6;
    const respostas: (Letra | Letra[] | null)[] = g.respostas.map((certa) => {
      const r = Math.random();
      if (r < 0.04) return null;
      if (r < 0.06 && s % 3 === 0) return [alternativas[0], alternativas[2]];
      if (certa && Math.random() < habilidade) return certa;
      return alternativas[Math.floor(Math.random() * alternativas.length)];
    });
    const matricula = String(100000 + Math.floor(Math.random() * 899999));
    const leituras = respostas.map((r) => ({
      resposta: Array.isArray(r) ? null : r,
      situacao: Array.isArray(r) ? ('multipla' as const) : r ? ('ok' as const) : ('branco' as const),
      preenchimento: [],
    }));
    const esperado = calcularPontuacao(g, leituras);
    desenharFolha(doc, g, {
      nome: NOMES[s % NOMES.length],
      matricula,
      respostas,
      rodape: `FOLHA SIMULADA — esperado: matrícula ${matricula} · ${esperado.acertos} acertos · ${esperado.brancos} em branco · ${esperado.multiplas} múltiplas · nota ${esperado.nota.toFixed(2)}`,
    });
  }
  doc.save(`folhas_simuladas_${nomeArquivo(g.nome)}.pdf`);
}
