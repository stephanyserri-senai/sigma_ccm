export type Letra = 'A' | 'B' | 'C' | 'D' | 'E';

/** Gabarito matriz (chave de respostas) cadastrado pelo docente. */
export interface Gabarito {
  id: string;
  nome: string;
  turma: string;
  unidadeCurricular: string;
  numQuestoes: number;
  numAlternativas: 4 | 5;
  notaMaxima: number;
  respostas: (Letra | null)[];
  anuladas: boolean[];
  pesos: number[];
  /** Lista opcional "matricula;nome" para preencher o nome a partir da matrícula marcada. */
  alunos: { matricula: string; nome: string }[];
  criadoEm: string;
  atualizadoEm: string;
}

/** Situação da leitura de uma questão. */
export type SituacaoLeitura = 'ok' | 'branco' | 'multipla' | 'duvida';

export interface LeituraQuestao {
  /** Letra lida (null = branco ou múltipla). */
  resposta: Letra | null;
  situacao: SituacaoLeitura;
  /** Preenchimento de cada alternativa, 0 (vazia) a 1 (totalmente preenchida). */
  preenchimento: number[];
  /** true quando o docente alterou manualmente na revisão. */
  editadaManualmente?: boolean;
}

export type StatusFolha = 'ok' | 'revisar' | 'erro';

export interface FolhaCorrigida {
  id: string;
  arquivo: string;
  pagina: number;
  status: StatusFolha;
  mensagens: string[];
  matricula: string;
  nome: string;
  leituras: LeituraQuestao[];
  /** Imagem da folha alinhada (ou a original, quando falhou) para revisão. */
  imagem: string;
  /** Recorte do campo "Nome" escrito à mão. */
  recorteNome: string | null;
  revisadaManualmente: boolean;
}

export interface ResultadoQuestao {
  questao: number;
  marcada: Letra | null;
  correta: Letra | null;
  situacao: 'acerto' | 'erro' | 'branco' | 'multipla' | 'anulada';
  peso: number;
  pontos: number;
}

export interface Pontuacao {
  acertos: number;
  erros: number;
  brancos: number;
  multiplas: number;
  anuladas: number;
  pontos: number;
  pontosPossiveis: number;
  nota: number;
  porQuestao: ResultadoQuestao[];
}
