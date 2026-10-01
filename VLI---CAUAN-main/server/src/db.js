import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, "..", "sigma-ccm.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Cria o schema
const schema = readFileSync(join(__dirname, "..", "schema.sql"), "utf-8");
db.exec(schema);

// ---------------------------------------------------------------
// Seed inicial (apenas se o banco estiver vazio)
// ---------------------------------------------------------------
export function seed() {
  const count = db.prepare("SELECT COUNT(*) c FROM usuarios").get().c;
  if (count > 0) return;

  const insUser = db.prepare(
    "INSERT INTO usuarios (nome, email, username, senha_hash, papel) VALUES (?,?,?,?,?)"
  );
  const hash = (s) => bcrypt.hashSync(s, 10);
  insUser.run("Ana Souza", "ana@empresa.com", "admin", hash("admin123"), "CCM");
  insUser.run("Carlos Lima", "carlos@empresa.com", "pcm", hash("pcm123"), "PCM");
  insUser.run("João Pereira", "joao@empresa.com", "campo", hash("campo123"), "EXECUTANTE");

  const insEquipe = db.prepare("INSERT INTO equipes (nome, tipo, especialidade) VALUES (?,?,?)");
  const eIds = ["Elétrica Prev.", "Automação", "Mecânica FM", "Caldeiraria"].map((n, i) =>
    insEquipe.run(n, i === 3 ? "Terceirizada" : "Própria", n).lastInsertRowid
  );

  const insEq = db.prepare(
    "INSERT INTO equipamentos (tag, descricao, localizacao, classe, criticidade) VALUES (?,?,?,?,?)"
  );
  const eqIds = [
    ["VT-3330-TR01", "Sistema estrutural TR01", "Terminal Leste", "Estrutura", "Alta"],
    ["TR01-BOMBA-02", "Bomba de recalque 02", "Terminal Leste", "Bomba", "Alta"],
    ["PA-2200-MOT", "Motor de acionamento 2200", "Pátio A", "Motor", "Média"],
    ["ESTR-3330", "Estrutura metálica 3330", "Terminal Leste", "Estrutura", "Média"],
  ].map((r) => insEq.run(...r).lastInsertRowid);

  const insColab = db.prepare(
    "INSERT INTO colaboradores (nome, matricula, especialidade, equipe_id, usuario_id) VALUES (?,?,?,?,?)"
  );
  const cId1 = insColab.run("Marisa A. Rios", "M-1001", "Eletricista", eIds[0], null).lastInsertRowid;
  insColab.run("Flávio H. Ferreira", "M-1002", "Mecânico", eIds[2], null);
  insColab.run("Luiz F. Silva", "M-1003", "Instrumentista", eIds[1], null);
  insColab.run("José M. Alves", "M-1004", "Caldeireiro", eIds[3], 3);

  const insNota = db.prepare(
    "INSERT INTO notas (numero, equipamento_id, descricao, tipo, status, solicitante_id) VALUES (?,?,?,?,?,?)"
  );
  insNota.run("14137", eqIds[0], "Tela de proteção danificada", "Corretiva", "Aberta", 1);
  insNota.run("14205", eqIds[1], "Vibração acima do normal", "Inspeção", "Aberta", 1);
  insNota.run("14210", eqIds[2], "Ruído intermitente no motor", "Corretiva", "Aberta", 1);
  insNota.run("14233", eqIds[3], "Corrosão em estrutura metálica", "Corretiva", "Aberta", 1);

  const insOM = db.prepare(
    "INSERT INTO ordens (numero, tipo, status, equipamento_id, equipe_id, hh_previsto, data_programada) VALUES (?,?,?,?,?,?,?)"
  );
  const om1 = insOM.run("40012345", "Corretiva", "Distribuída", eqIds[0], eIds[0], 6, "09/07").lastInsertRowid;
  insOM.run("40012346", "Inspeção", "Programada", eqIds[1], eIds[2], 3, "09/07");
  insOM.run("40012350", "Corretiva", "Aberta", eqIds[2], eIds[1], 4, "10/07");
  insOM.run("40012352", "Corretiva", "Programada", eqIds[3], eIds[3], 8, "10/07");

  const insAp = db.prepare(
    "INSERT INTO apontamentos (ordem_id, colaborador_id, tipo, hh_apropriado) VALUES (?,?,?,?)"
  );
  insAp.run(om1, cId1, "Apropriação", 6);
  insAp.run(om1, cId1, "Relatório", 6);

  db.prepare(
    "INSERT INTO sinalizacoes_ia (entidade_tipo, ordem_numero, campo, valor_atual, valor_sugerido, tipo, score, explicacao, status) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(
    "apontamento", "40012346", "HH apropriado", 13, 3, "HH fora da faixa", 0.88,
    JSON.stringify([
      { t: "HH acima do previsto na OM", v: 0.9 },
      { t: "Divergência com histórico", v: 0.62 },
      { t: "Turno incompatível", v: 0.45 },
    ]),
    "Nova"
  );

  console.log("Banco populado com dados iniciais.");
}
