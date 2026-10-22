import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, Loader2, Trash2, Upload, XCircle } from 'lucide-react';
import { TIPOS_ACEITOS, lerArquivo } from '../arquivos';
import { carregarFolhas, salvarFolhas } from '../armazenamento';
import { arredondar, calcularPontuacao, novoId } from '../correcao';
import { nomePorMatricula, processarPagina } from '../processar';
import type { FolhaCorrigida, Gabarito } from '../types';
import { Revisao } from './Revisao';

interface Props {
  gabaritos: Gabarito[];
  gabaritoId: string | null;
  onSelecionar: (id: string) => void;
}

export function Correcao({ gabaritos, gabaritoId, onSelecionar }: Props) {
  const g = gabaritos.find((x) => x.id === gabaritoId) ?? null;
  const [folhas, setFolhas] = useState<FolhaCorrigida[]>([]);
  const [carregado, setCarregado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ atual: string; feitas: number } | null>(null);
  const [revisando, setRevisando] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ativo = true;
    setFolhas([]);
    setCarregado(null);
    setRevisando(null);
    if (gabaritoId)
      carregarFolhas(gabaritoId).then((f) => {
        if (!ativo) return;
        setFolhas(f);
        setCarregado(gabaritoId);
      });
    return () => {
      ativo = false;
    };
  }, [gabaritoId]);

  useEffect(() => {
    if (gabaritoId && carregado === gabaritoId) salvarFolhas(gabaritoId, folhas);
  }, [folhas, gabaritoId, carregado]);

  const pontuacoes = useMemo(() => (g ? folhas.map((f) => (f.status === 'erro' ? null : calcularPontuacao(g, f.leituras))) : []), [g, folhas]);

  const matriculasRepetidas = useMemo(() => {
    const cont = new Map<string, number>();
    folhas.forEach((f) => f.matricula && cont.set(f.matricula, (cont.get(f.matricula) ?? 0) + 1));
    return new Set([...cont].filter(([, c]) => c > 1).map(([m]) => m));
  }, [folhas]);

  const stats = useMemo(() => {
    const notas = pontuacoes.filter((p) => p !== null).map((p) => p!.nota);
    return {
      lidas: notas.length,
      media: notas.length ? arredondar(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
      maior: notas.length ? Math.max(...notas) : null,
      menor: notas.length ? Math.min(...notas) : null,
      revisar: folhas.filter((f) => f.status === 'revisar').length,
      erros: folhas.filter((f) => f.status === 'erro').length,
    };
  }, [pontuacoes, folhas]);

  if (!gabaritos.length) {
    return (
      <div className="vazio card">
        <h2>Cadastre um gabarito matriz primeiro</h2>
        <p>Vá em <b>Gabaritos</b>, crie a prova com as respostas corretas e depois volte aqui para importar as folhas dos alunos.</p>
      </div>
    );
  }

  const importar = async (arquivos: FileList | File[]) => {
    if (!g || progresso) return;
    const lista = [...arquivos];
    let feitas = 0;
    for (const arq of lista) {
      setProgresso({ atual: arq.name, feitas });
      try {
        for await (const pagina of lerArquivo(arq)) {
          setProgresso({ atual: `${arq.name}${pagina.totalPaginas > 1 ? ` — página ${pagina.pagina}/${pagina.totalPaginas}` : ''}`, feitas });
          await new Promise((r) => setTimeout(r, 0));
          const folha = processarPagina(pagina, g);
          feitas++;
          setFolhas((f) => [...f, folha]);
        }
      } catch (e) {
        setFolhas((f) => [
          ...f,
          {
            id: novoId(),
            arquivo: arq.name,
            pagina: 1,
            status: 'erro',
            mensagens: [e instanceof Error ? e.message : 'Falha ao abrir o arquivo.'],
            matricula: '',
            nome: '',
            leituras: Array.from({ length: g.numQuestoes }, () => ({ resposta: null, situacao: 'branco' as const, preenchimento: [] })),
            imagem: '',
            recorteNome: null,
            revisadaManualmente: false,
          },
        ]);
      }
    }
    setProgresso(null);
  };

  const atualizar = (id: string, mudar: (f: FolhaCorrigida) => FolhaCorrigida) => setFolhas((lista) => lista.map((f) => (f.id === id ? mudar(f) : f)));

  return (
    <div className="correcao">
      <div className="card">
        <div className="card-titulo">
          <label className="campo seletor">
            <span>Gabarito matriz</span>
            <select value={gabaritoId ?? ''} onChange={(e) => onSelecionar(e.target.value)}>
              <option value="" disabled>
                Selecione a prova…
              </option>
              {gabaritos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome || '(sem nome)'} {x.turma ? `· ${x.turma}` : ''} — {x.numQuestoes} questões
                </option>
              ))}
            </select>
          </label>
          {g && (
            <div className="gabarito-resumo" title="Gabarito matriz">
              {g.respostas.map((r, i) => (
                <span key={i} className={g.anuladas[i] ? 'anulada' : ''}>
                  <small>{i + 1}</small>
                  {g.anuladas[i] ? '×' : r ?? '?'}
                </span>
              ))}
            </div>
          )}
        </div>

        {g && (
          <div
            className={`area-importar ${arrastando ? 'arrastando' : ''} ${progresso ? 'ocupado' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              importar(e.dataTransfer.files);
            }}
            onClick={() => !progresso && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={TIPOS_ACEITOS}
              hidden
              onChange={(e) => {
                if (e.target.files) importar(e.target.files);
                e.target.value = '';
              }}
            />
            {progresso ? (
              <>
                <Loader2 className="gira" size={32} />
                <strong>Lendo {progresso.atual}…</strong>
                <span>{progresso.feitas} folha(s) processada(s)</span>
              </>
            ) : (
              <>
                <Upload size={32} />
                <strong>Arraste aqui os PDFs ou imagens das folhas de respostas</strong>
                <span>ou clique para escolher · vários arquivos de uma vez · PDF com várias páginas = um aluno por página</span>
              </>
            )}
          </div>
        )}
      </div>

      {g && folhas.length > 0 && (
        <>
          <div className="indicadores">
            <div className="indicador">
              <span>Folhas lidas</span>
              <strong>{stats.lidas}</strong>
            </div>
            <div className="indicador">
              <span>Média da turma</span>
              <strong>{stats.media?.toFixed(2) ?? '—'}</strong>
            </div>
            <div className="indicador">
              <span>Maior / menor nota</span>
              <strong>
                {stats.maior?.toFixed(2) ?? '—'} / {stats.menor?.toFixed(2) ?? '—'}
              </strong>
            </div>
            <div className={`indicador ${stats.revisar ? 'atencao' : ''}`}>
              <span>Para revisar</span>
              <strong>{stats.revisar}</strong>
            </div>
            <div className={`indicador ${stats.erros ? 'erro' : ''}`}>
              <span>Não lidas</span>
              <strong>{stats.erros}</strong>
            </div>
          </div>

          <div className="card">
            <div className="card-titulo">
              <h2>Resultados</h2>
              <div className="acoes">
                <button
                  className="btn primario"
                  disabled={exportando || !!progresso || stats.lidas === 0}
                  onClick={async () => {
                    if (stats.revisar && !confirm(`Ainda há ${stats.revisar} folha(s) para revisar. Exportar mesmo assim?`)) return;
                    setExportando(true);
                    try {
                      const { exportarExcel } = await import('../excel');
                      await exportarExcel(g, folhas);
                    } finally {
                      setExportando(false);
                    }
                  }}
                >
                  <FileSpreadsheet size={16} /> {exportando ? 'Gerando…' : 'Exportar Excel'}
                </button>
                <button className="btn perigo-contorno" disabled={!!progresso} onClick={() => confirm('Remover todas as folhas corrigidas desta prova?') && setFolhas([])}>
                  <Trash2 size={16} /> Limpar
                </button>
              </div>
            </div>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome escrito na folha</th>
                    <th>Aluno</th>
                    <th>Matrícula</th>
                    <th>Acertos</th>
                    <th>Nota</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {folhas.map((f, i) => {
                    const p = pontuacoes[i];
                    return (
                      <tr key={f.id} className={`st-${f.status}`}>
                        <td>{i + 1}</td>
                        <td className="recorte">{f.recorteNome ? <img src={f.recorteNome} alt="Nome manuscrito" /> : <span className="arquivo">{f.arquivo} · p.{f.pagina}</span>}</td>
                        <td>
                          <input
                            className="inline"
                            value={f.nome}
                            placeholder="Digite o nome"
                            onChange={(e) => atualizar(f.id, (x) => ({ ...x, nome: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className={`inline curto ${matriculasRepetidas.has(f.matricula) ? 'repetida' : ''}`}
                            value={f.matricula}
                            title={matriculasRepetidas.has(f.matricula) ? 'Matrícula repetida em outra folha' : ''}
                            onChange={(e) => {
                              const m = e.target.value.replace(/[^\d]/g, '');
                              atualizar(f.id, (x) => ({ ...x, matricula: m, nome: x.nome || nomePorMatricula(g, m) }));
                            }}
                          />
                        </td>
                        <td className="num">{p ? `${p.acertos}/${g.numQuestoes - p.anuladas}` : '—'}</td>
                        <td className="num nota">{p ? p.nota.toFixed(2) : '—'}</td>
                        <td>
                          <Situacao f={f} />
                        </td>
                        <td>
                          <div className="acoes-linha">
                          <button className="btn pequeno" onClick={() => setRevisando(i)}>
                            <Eye size={14} /> {f.status === 'ok' ? 'Ver' : 'Revisar'}
                          </button>
                          <button className="btn pequeno icone" title="Remover" onClick={() => confirm('Remover esta folha?') && setFolhas((l) => l.filter((x) => x.id !== f.id))}>
                            <Trash2 size={14} />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {g && revisando !== null && folhas[revisando] && (
        <Revisao
          gabarito={g}
          folha={folhas[revisando]}
          indice={revisando}
          total={folhas.length}
          onNavegar={(d) => setRevisando((r) => (r === null ? r : Math.max(0, Math.min(folhas.length - 1, r + d))))}
          onAlterar={(nova) => atualizar(nova.id, () => nova)}
          onFechar={() => setRevisando(null)}
        />
      )}
    </div>
  );
}

function Situacao({ f }: { f: FolhaCorrigida }) {
  if (f.status === 'ok')
    return (
      <span className="chip ok">
        <CheckCircle2 size={14} /> {f.revisadaManualmente ? 'Revisada' : 'Lida'}
      </span>
    );
  if (f.status === 'revisar')
    return (
      <span className="chip atencao" title={f.mensagens.join('\n')}>
        <AlertTriangle size={14} /> Revisar
      </span>
    );
  return (
    <span className="chip erro" title={f.mensagens.join('\n')}>
      <XCircle size={14} /> Não lida
    </span>
  );
}
