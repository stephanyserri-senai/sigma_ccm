import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

import { db, seed } from "./db.js";
import { detectar } from "./ia.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "sigma-ccm-dev-secret-change-me";

seed();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
function sign(user) {
  return jwt.sign({ id: user.id, papel: user.papel, nome: user.nome, username: user.username }, JWT_SECRET, { expiresIn: "8h" });
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.papel) ? next() : res.status(403).json({ error: "Acesso não permitido para o seu perfil." });
}
function audit(usuarioId, acao, entidade, entidadeId, detalhe) {
  db.prepare("INSERT INTO trilha_auditoria (usuario_id, acao, entidade, entidade_id, detalhe) VALUES (?,?,?,?,?)")
    .run(usuarioId, acao, entidade || null, entidadeId || null, detalhe || null);
}

app.post("/api/auth/login", (req, res) => {
  const { username, senha } = req.body || {};
  const user = db.prepare("SELECT * FROM usuarios WHERE username = ? AND ativo = 1").get(username || "");
  if (!user || !bcrypt.compareSync(senha || "", user.senha_hash))
    return res.status(401).json({ error: "Usuário ou senha inválidos." });
  audit(user.id, "login", "usuario", user.id, null);
  res.json({ token: sign(user), user: { id: user.id, nome: user.nome, papel: user.papel, username: user.username } });
});

app.get("/api/auth/me", auth, (req, res) => {
  const u = db.prepare("SELECT id, nome, papel, username, email FROM usuarios WHERE id = ?").get(req.user.id);
  res.json(u);
});

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------
app.get("/api/dashboard", auth, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) c FROM ordens").get().c;
  const encerradas = db.prepare("SELECT COUNT(*) c FROM ordens WHERE status = 'Encerrada'").get().c;
  const notasAbertas = db.prepare("SELECT COUNT(*) c FROM notas WHERE status = 'Aberta'").get().c;
  const apont = db.prepare("SELECT COUNT(*) c FROM apontamentos").get().c;
  const pendencias = db.prepare(
    `SELECT o.numero, e.tag AS equipamento, eq.nome AS equipe, o.data_programada, o.status
     FROM ordens o
     LEFT JOIN equipamentos e ON e.id = o.equipamento_id
     LEFT JOIN equipes eq ON eq.id = o.equipe_id
     WHERE o.status <> 'Encerrada' ORDER BY o.data_programada`
  ).all();
  const aderencia = [
    { m: "Jan", v: 91.6 }, { m: "Fev", v: 92.8 }, { m: "Mar", v: 90.1 }, { m: "Abr", v: 91.9 },
    { m: "Mai", v: 94.5 }, { m: "Jun", v: 92.4 }, { m: "Jul", v: 94.8 }, { m: "Ago", v: 97.2 },
    { m: "Set", v: 97.9 }, { m: "Out", v: 95.0 }, { m: "Nov", v: 93.0 }, { m: "Dez", v: 93.8 },
  ];
  res.json({
    kpis: {
      aderenciaSistematica: 94.5, aderenciaProgramacao: 89.7, iamot: 83,
      apontamento: Math.min(100, Math.round((apont / (total * 2 || 1)) * 100)),
      encerradas, notasAbertas,
    },
    pendencias, aderencia,
  });
});

// ---------------------------------------------------------------
// Cadastros auxiliares (para selects)
// ---------------------------------------------------------------
app.get("/api/cadastros", auth, (req, res) => {
  res.json({
    equipamentos: db.prepare("SELECT id, tag, descricao FROM equipamentos ORDER BY tag").all(),
    equipes: db.prepare("SELECT id, nome, tipo FROM equipes ORDER BY nome").all(),
    colaboradores: db.prepare("SELECT id, nome FROM colaboradores ORDER BY nome").all(),
  });
});

// ---------------------------------------------------------------
// Notas
// ---------------------------------------------------------------
app.get("/api/notas", auth, (req, res) => {
  res.json(db.prepare(
    `SELECT n.*, e.tag AS equipamento FROM notas n LEFT JOIN equipamentos e ON e.id = n.equipamento_id ORDER BY n.id DESC`
  ).all());
});

app.post("/api/notas", auth, (req, res) => {
  const { equipamento_id, descricao, tipo } = req.body || {};
  if (!descricao) return res.status(400).json({ error: "Informe a descrição da nota." });
  const max = db.prepare("SELECT MAX(CAST(numero AS INTEGER)) m FROM notas").get().m || 14233;
  const numero = String(max + 1);
  const info = db.prepare(
    "INSERT INTO notas (numero, equipamento_id, descricao, tipo, status, solicitante_id) VALUES (?,?,?,?, 'Aberta', ?)"
  ).run(numero, equipamento_id || null, descricao, tipo || "Corretiva", req.user.id);
  audit(req.user.id, "abrir_nota", "nota", info.lastInsertRowid, numero);
  res.status(201).json({ id: info.lastInsertRowid, numero });
});

app.post("/api/notas/:id/converter", auth, requireRole("CCM", "PCM"), (req, res) => {
  const nota = db.prepare("SELECT * FROM notas WHERE id = ?").get(req.params.id);
  if (!nota) return res.status(404).json({ error: "Nota não encontrada." });
  if (nota.status !== "Aberta") return res.status(400).json({ error: "A nota já foi convertida." });
  const max = db.prepare("SELECT MAX(CAST(numero AS INTEGER)) m FROM ordens").get().m || 40012352;
  const numero = String(max + 1);
  const equipe = db.prepare("SELECT id FROM equipes ORDER BY id LIMIT 1").get();
  const info = db.prepare(
    `INSERT INTO ordens (numero, tipo, status, equipamento_id, nota_id, equipe_id, hh_previsto, data_programada)
     VALUES (?,?, 'Aberta', ?,?,?, 4, '11/07')`
  ).run(numero, nota.tipo, nota.equipamento_id, nota.id, equipe ? equipe.id : null);
  db.prepare("UPDATE notas SET status = 'Em OM' WHERE id = ?").run(nota.id);
  audit(req.user.id, "converter_nota", "ordem", info.lastInsertRowid, numero);
  res.status(201).json({ id: info.lastInsertRowid, numero });
});

// ---------------------------------------------------------------
// Ordens
// ---------------------------------------------------------------
const CONDICOES = ["Apropriação", "Relatório", "Validação"];

function ordemCompleta(list) {
  return { ...list };
}

app.get("/api/ordens", auth, (req, res) => {
  res.json(db.prepare(
    `SELECT o.*, e.tag AS equipamento, eq.nome AS equipe
     FROM ordens o LEFT JOIN equipamentos e ON e.id = o.equipamento_id
     LEFT JOIN equipes eq ON eq.id = o.equipe_id ORDER BY o.id DESC`
  ).all());
});

app.get("/api/ordens/:id", auth, (req, res) => {
  const o = db.prepare(
    `SELECT o.*, e.tag AS equipamento, eq.nome AS equipe
     FROM ordens o LEFT JOIN equipamentos e ON e.id = o.equipamento_id
     LEFT JOIN equipes eq ON eq.id = o.equipe_id WHERE o.id = ?`
  ).get(req.params.id);
  if (!o) return res.status(404).json({ error: "Ordem não encontrada." });
  const aps = db.prepare("SELECT tipo FROM apontamentos WHERE ordem_id = ?").all(o.id);
  const tipos = new Set(aps.map((a) => a.tipo));
  o.condicoes = CONDICOES.map((c) => ({ tipo: c, ok: tipos.has(c) }));
  res.json(o);
});

app.patch("/api/ordens/:id/status", auth, requireRole("CCM", "PCM"), (req, res) => {
  const { status } = req.body || {};
  const valid = ["Aberta", "Programada", "Distribuída", "Em execução", "Encerrada", "Cancelada"];
  if (!valid.includes(status)) return res.status(400).json({ error: "Status inválido." });
  const enc = status === "Encerrada" ? "10/07" : null;
  db.prepare("UPDATE ordens SET status = ?, data_encerramento = COALESCE(?, data_encerramento) WHERE id = ?")
    .run(status, enc, req.params.id);
  audit(req.user.id, "status_ordem", "ordem", Number(req.params.id), status);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Apontamentos (detecção IA + encerramento automático)
// ---------------------------------------------------------------
app.post("/api/apontamentos", auth, (req, res) => {
  const { ordem_id, tipo, colaborador_id, hh } = req.body || {};
  const om = db.prepare("SELECT * FROM ordens WHERE id = ?").get(ordem_id);
  if (!om) return res.status(404).json({ error: "Ordem não encontrada." });
  if (!CONDICOES.includes(tipo)) return res.status(400).json({ error: "Tipo de registro inválido." });

  const info = db.prepare(
    "INSERT INTO apontamentos (ordem_id, colaborador_id, tipo, hh_apropriado) VALUES (?,?,?,?)"
  ).run(ordem_id, colaborador_id || null, tipo, Number(hh) || 0);
  audit(req.user.id, "apontar", "apontamento", info.lastInsertRowid, `OM ${om.numero} · ${tipo}`);

  // detecção de inconsistência
  let sinal = null;
  const flag = detectar(Number(hh), om.hh_previsto);
  if (flag) {
    const s = db.prepare(
      `INSERT INTO sinalizacoes_ia (entidade_tipo, entidade_id, ordem_numero, campo, valor_atual, valor_sugerido, tipo, score, explicacao, status)
       VALUES ('apontamento', ?, ?, 'HH apropriado', ?, ?, ?, ?, ?, 'Nova')`
    ).run(info.lastInsertRowid, om.numero, Number(hh), flag.sugerido, flag.tipo, flag.score, JSON.stringify(flag.fatores));
    sinal = { id: s.lastInsertRowid, tipo: flag.tipo, score: flag.score };
  }

  // encerramento automático das 3 condições
  const tipos = new Set(db.prepare("SELECT DISTINCT tipo FROM apontamentos WHERE ordem_id = ?").all(ordem_id).map((r) => r.tipo));
  let encerrada = false;
  if (CONDICOES.every((c) => tipos.has(c)) && om.status !== "Encerrada") {
    db.prepare("UPDATE ordens SET status = 'Encerrada', data_encerramento = '10/07' WHERE id = ?").run(ordem_id);
    audit(req.user.id, "encerrar_auto", "ordem", ordem_id, om.numero);
    encerrada = true;
  }

  res.status(201).json({ id: info.lastInsertRowid, sinal, encerrada, ordem_numero: om.numero });
});

// ---------------------------------------------------------------
// Sinalizações IA
// ---------------------------------------------------------------
app.get("/api/sinalizacoes", auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM sinalizacoes_ia ORDER BY id DESC").all();
  rows.forEach((r) => { try { r.fatores = JSON.parse(r.explicacao || "[]"); } catch { r.fatores = []; } });
  res.json(rows);
});

app.post("/api/sinalizacoes/:id/aceitar", auth, (req, res) => {
  const s = db.prepare("SELECT * FROM sinalizacoes_ia WHERE id = ?").get(req.params.id);
  if (!s) return res.status(404).json({ error: "Sinalização não encontrada." });
  if (s.entidade_tipo === "apontamento" && s.entidade_id)
    db.prepare("UPDATE apontamentos SET hh_apropriado = ? WHERE id = ?").run(s.valor_sugerido, s.entidade_id);
  db.prepare("UPDATE sinalizacoes_ia SET status = 'Aceita', valor_atual = valor_sugerido WHERE id = ?").run(s.id);
  audit(req.user.id, "aceitar_sinal", "sinalizacao", s.id, s.tipo);
  res.json({ ok: true });
});

app.post("/api/sinalizacoes/:id/rejeitar", auth, (req, res) => {
  db.prepare("UPDATE sinalizacoes_ia SET status = 'Rejeitada' WHERE id = ?").run(req.params.id);
  audit(req.user.id, "rejeitar_sinal", "sinalizacao", Number(req.params.id), null);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// Usuários (cadastro — restrito ao papel CCM)
// ---------------------------------------------------------------
app.get("/api/usuarios", auth, requireRole("CCM"), (req, res) => {
  res.json(db.prepare("SELECT id, nome, email, username, papel, ativo, criado_em FROM usuarios ORDER BY id").all());
});

app.post("/api/usuarios", auth, requireRole("CCM"), (req, res) => {
  const { nome, username, senha, papel, email } = req.body || {};
  if (!nome || !username || !senha) return res.status(400).json({ error: "Nome, usuário e senha são obrigatórios." });
  if (!["CCM", "PCM", "EXECUTANTE"].includes(papel)) return res.status(400).json({ error: "Papel inválido." });
  const existe = db.prepare("SELECT id FROM usuarios WHERE username = ?").get(username);
  if (existe) return res.status(409).json({ error: "Este usuário já existe." });
  try {
    const info = db.prepare(
      "INSERT INTO usuarios (nome, email, username, senha_hash, papel) VALUES (?,?,?,?,?)"
    ).run(nome, email || null, username, bcrypt.hashSync(senha, 10), papel);
    audit(req.user.id, "criar_usuario", "usuario", info.lastInsertRowid, username);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: "Não foi possível criar o usuário." });
  }
});

// ---------------------------------------------------------------
// Servir o frontend buildado (produção)
// ---------------------------------------------------------------
// Procura a build do front em locais comuns, seja o server uma subpasta
// do projeto (../../dist) ou um projeto irmão (../../client/dist).
const distCandidates = [
  join(__dirname, "..", "..", "dist"),
  join(__dirname, "..", "..", "client", "dist"),
];
const clientDist = distCandidates.find((p) => existsSync(p));
if (clientDist) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(clientDist, "index.html")));
}

app.listen(PORT, () => console.log(`SIGMA-CCM API em http://localhost:${PORT}`));
