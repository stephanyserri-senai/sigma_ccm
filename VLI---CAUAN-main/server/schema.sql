PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT,
  username TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('CCM', 'PCM', 'EXECUTANTE')) DEFAULT 'EXECUTANTE',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT,
  especialidade TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL UNIQUE,
  descricao TEXT,
  localizacao TEXT,
  classe TEXT,
  criticidade TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  matricula TEXT,
  especialidade TEXT,
  equipe_id INTEGER,
  usuario_id INTEGER,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipe_id) REFERENCES equipes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS notas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  equipamento_id INTEGER,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Corretiva',
  status TEXT NOT NULL DEFAULT 'Aberta',
  solicitante_id INTEGER,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
  FOREIGN KEY (solicitante_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ordens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  tipo TEXT,
  status TEXT NOT NULL DEFAULT 'Aberta',
  equipamento_id INTEGER,
  equipe_id INTEGER,
  nota_id INTEGER,
  hh_previsto REAL DEFAULT 0,
  data_programada TEXT,
  data_encerramento TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id),
  FOREIGN KEY (equipe_id) REFERENCES equipes(id),
  FOREIGN KEY (nota_id) REFERENCES notas(id)
);

CREATE TABLE IF NOT EXISTS apontamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ordem_id INTEGER NOT NULL,
  colaborador_id INTEGER,
  tipo TEXT NOT NULL,
  hh_apropriado REAL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ordem_id) REFERENCES ordens(id),
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id)
);

CREATE TABLE IF NOT EXISTS sinalizacoes_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade_tipo TEXT,
  entidade_id INTEGER,
  ordem_numero TEXT,
  campo TEXT,
  valor_atual REAL,
  valor_sugerido REAL,
  tipo TEXT,
  score REAL,
  explicacao TEXT,
  status TEXT NOT NULL DEFAULT 'Nova',
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trilha_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id INTEGER,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
