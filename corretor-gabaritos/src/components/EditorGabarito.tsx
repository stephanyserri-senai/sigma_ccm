import { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Download, FlaskConical, Save, Trash2, Users } from 'lucide-react';
import { LETRAS, MAX_QUESTOES } from '../layout';
import { redimensionar, validarGabarito } from '../correcao';
import { baixarFolhaRespostas, baixarFolhasSimuladas } from '../folhaPdf';
import type { Gabarito, Letra } from '../types';

interface Props {
  gabarito: Gabarito;
  onSalvar: (g: Gabarito) => void;
  onExcluir: (id: string) => void;
  onCorrigir: (id: string) => void;
}

export function EditorGabarito({ gabarito, onSalvar, onExcluir, onCorrigir }: Props) {
  const [g, setG] = useState(gabarito);
  const [colar, setColar] = useState('');
  const [alunosTexto, setAlunosTexto] = useState(() => gabarito.alunos.map((a) => `${a.matricula};${a.nome}`).join('\n'));
  const [simuladas, setSimuladas] = useState(5);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setG(gabarito);
    setAlunosTexto(gabarito.alunos.map((a) => `${a.matricula};${a.nome}`).join('\n'));
    setAviso(null);
  }, [gabarito]);

  const problemas = useMemo(() => validarGabarito(g), [g]);
  const alunosOriginal = gabarito.alunos.map((a) => `${a.matricula};${a.nome}`).join('\n');
  const alterado = JSON.stringify(g) !== JSON.stringify(gabarito) || alunosTexto !== alunosOriginal;
  const alts = LETRAS.slice(0, g.numAlternativas);
  const preenchidas = g.respostas.filter((r, i) => r || g.anuladas[i]).length;

  const marcar = (i: number, l: Letra) => setG((x) => ({ ...x, respostas: x.respostas.map((r, j) => (j === i ? (r === l ? null : l) : r)) }));

  const aplicarColagem = () => {
    const letras = colar.toUpperCase().replace(/[^A-E]/g, '').split('') as Letra[];
    if (!letras.length) return;
    const fora = letras.filter((l) => !alts.includes(l));
    if (fora.length) {
      setAviso(`A prova tem ${g.numAlternativas} alternativas; as letras ${[...new Set(fora)].join(', ')} não existem.`);
      return;
    }
    setG((x) => ({ ...x, respostas: x.respostas.map((r, i) => letras[i] ?? r) }));
    setAviso(`${Math.min(letras.length, g.numQuestoes)} respostas aplicadas${letras.length > g.numQuestoes ? ` (${letras.length - g.numQuestoes} letras a mais foram ignoradas)` : ''}.`);
    setColar('');
  };

  const salvar = () => {
    const alunos = alunosTexto
      .split(/\r?\n/)
      .map((l) => l.split(/[;\t,]/).map((s) => s.trim()))
      .filter((p) => p[0] && p[1])
      .map(([matricula, ...nome]) => ({ matricula: matricula.replace(/\D/g, ''), nome: nome.join(' ') }))
      .filter((a) => a.matricula);
    onSalvar({ ...g, alunos, atualizadoEm: new Date().toISOString() });
  };

  const prontoParaUsar = problemas.length === 0 && !alterado;

  return (
    <div className="editor">
      <div className="card">
        <div className="card-titulo">
          <h2>{gabarito.nome ? 'Editar gabarito matriz' : 'Novo gabarito matriz'}</h2>
          <div className="acoes">
            <button className="btn primario" onClick={salvar} disabled={!alterado}>
              <Save size={16} /> Salvar
            </button>
            <button className="btn perigo-contorno" onClick={() => confirm('Excluir este gabarito e as correções dele?') && onExcluir(g.id)}>
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        </div>
        <div className="grade-campos">
          <label className="campo largo">
            <span>Nome da prova *</span>
            <input value={g.nome} onChange={(e) => setG({ ...g, nome: e.target.value })} placeholder="Ex.: Avaliação Objetiva — Eletricidade Básica" />
          </label>
          <label className="campo">
            <span>Turma</span>
            <input value={g.turma} onChange={(e) => setG({ ...g, turma: e.target.value })} placeholder="Ex.: ELT-2026-1A" />
          </label>
          <label className="campo">
            <span>Unidade curricular / curso</span>
            <input value={g.unidadeCurricular} onChange={(e) => setG({ ...g, unidadeCurricular: e.target.value })} />
          </label>
          <label className="campo curto">
            <span>Nº de questões</span>
            <input
              type="number"
              min={1}
              max={MAX_QUESTOES}
              value={g.numQuestoes}
              onChange={(e) => setG(redimensionar(g, Math.max(1, Math.min(MAX_QUESTOES, Number(e.target.value) || 1))))}
            />
          </label>
          <label className="campo curto">
            <span>Alternativas</span>
            <select
              value={g.numAlternativas}
              onChange={(e) => {
                const na = Number(e.target.value) as 4 | 5;
                setG({ ...g, numAlternativas: na, respostas: g.respostas.map((r) => (r && LETRAS.indexOf(r) >= na ? null : r)) });
              }}
            >
              <option value={5}>A a E</option>
              <option value={4}>A a D</option>
            </select>
          </label>
          <label className="campo curto">
            <span>Nota máxima</span>
            <input type="number" min={0.1} step={0.5} value={g.notaMaxima} onChange={(e) => setG({ ...g, notaMaxima: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-titulo">
          <h2>
            Respostas corretas <small className={preenchidas === g.numQuestoes ? 'ok' : 'pendente'}>{preenchidas}/{g.numQuestoes}</small>
          </h2>
          <div className="colar">
            <input value={colar} onChange={(e) => setColar(e.target.value)} placeholder="Colar sequência: ABCDA EBCAD…" onKeyDown={(e) => e.key === 'Enter' && aplicarColagem()} />
            <button className="btn" onClick={aplicarColagem}>
              <ClipboardPaste size={16} /> Aplicar
            </button>
          </div>
        </div>
        {aviso && <p className="aviso">{aviso}</p>}
        <div className="grade-respostas">
          {g.respostas.map((r, i) => (
            <div key={i} className={`linha-resposta ${g.anuladas[i] ? 'anulada' : ''} ${!r && !g.anuladas[i] ? 'faltando' : ''}`}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <div className="bolhas">
                {alts.map((l) => (
                  <button key={l} className={`bolha ${r === l ? 'marcada' : ''}`} onClick={() => marcar(i, l)} disabled={g.anuladas[i]} aria-label={`Questão ${i + 1} alternativa ${l}`}>
                    {l}
                  </button>
                ))}
              </div>
              <label className="mini" title="Peso da questão">
                peso
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={g.pesos[i]}
                  onChange={(e) => setG({ ...g, pesos: g.pesos.map((p, j) => (j === i ? Number(e.target.value) : p)) })}
                />
              </label>
              <label className="mini" title="Questão anulada: todos ganham o ponto">
                <input type="checkbox" checked={g.anuladas[i]} onChange={(e) => setG({ ...g, anuladas: g.anuladas.map((a, j) => (j === i ? e.target.checked : a)) })} />
                anular
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-titulo">
          <h2>
            <Users size={18} /> Lista da turma <small>(opcional)</small>
          </h2>
        </div>
        <p className="dica">Uma linha por aluno no formato <code>matrícula;nome</code>. Copie direto do Excel (duas colunas). O nome será preenchido automaticamente pela matrícula marcada na folha.</p>
        <textarea rows={5} value={alunosTexto} onChange={(e) => setAlunosTexto(e.target.value)} placeholder={'204517;Ana Souza\n204518;Bruno Lima'} />
      </div>

      <div className="card destaque">
        <div className="card-titulo">
          <h2>Folhas e correção</h2>
        </div>
        {problemas.length > 0 && (
          <ul className="problemas">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {alterado && problemas.length === 0 && <p className="aviso">Salve o gabarito para liberar as ações abaixo.</p>}
        <div className="acoes-grandes">
          <button className="btn primario" disabled={!g.nome.trim() || alterado} onClick={() => baixarFolhaRespostas(gabarito)}>
            <Download size={16} /> Baixar folha de respostas (PDF)
          </button>
          <span className="grupo">
            <button className="btn" disabled={!prontoParaUsar} onClick={() => baixarFolhasSimuladas(gabarito, simuladas)}>
              <FlaskConical size={16} /> Gerar folhas simuladas para teste
            </button>
            <input type="number" min={1} max={40} value={simuladas} onChange={(e) => setSimuladas(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} title="Quantidade" />
          </span>
          <button className="btn vermelho" disabled={!prontoParaUsar} onClick={() => onCorrigir(gabarito.id)}>
            Corrigir provas deste gabarito →
          </button>
        </div>
        <p className="dica">
          Imprima a folha de respostas para os alunos. As folhas simuladas vêm preenchidas aleatoriamente, com o resultado esperado no rodapé — importe-as na correção para conferir a leitura.
        </p>
      </div>
    </div>
  );
}
