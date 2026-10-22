import { useEffect, useState } from 'react';
import { BookOpenCheck, ClipboardCheck, HelpCircle, Plus } from 'lucide-react';
import { carregarGabaritos, salvarFolhas, salvarGabaritos } from './armazenamento';
import { novoGabarito, validarGabarito } from './correcao';
import { EditorGabarito } from './components/EditorGabarito';
import { Correcao } from './components/Correcao';
import { ComoUsar } from './components/ComoUsar';
import type { Gabarito } from './types';

type Aba = 'gabaritos' | 'correcao' | 'ajuda';

export default function App() {
  const [gabaritos, setGabaritos] = useState<Gabarito[]>(carregarGabaritos);
  const [aba, setAba] = useState<Aba>(() => (carregarGabaritos().length ? 'correcao' : 'gabaritos'));
  const [editando, setEditando] = useState<Gabarito | null>(() => carregarGabaritos()[0] ?? null);
  const [corrigindoId, setCorrigindoId] = useState<string | null>(() => carregarGabaritos()[0]?.id ?? null);

  useEffect(() => salvarGabaritos(gabaritos), [gabaritos]);

  const salvar = (g: Gabarito) => {
    setGabaritos((lista) => (lista.some((x) => x.id === g.id) ? lista.map((x) => (x.id === g.id ? g : x)) : [...lista, g]));
    setEditando(g);
  };

  const excluir = (id: string) => {
    const resto = gabaritos.filter((x) => x.id !== id);
    setGabaritos(resto);
    salvarFolhas(id, []);
    setEditando(resto[0] ?? null);
    if (corrigindoId === id) setCorrigindoId(resto[0]?.id ?? null);
  };

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="selo">SENAI</span>
          <div>
            <strong>Corretor de Gabaritos</strong>
            <small>Leitura óptica de folhas de respostas</small>
          </div>
        </div>
        <nav>
          <button className={aba === 'gabaritos' ? 'ativo' : ''} onClick={() => setAba('gabaritos')}>
            <BookOpenCheck size={18} /> Gabaritos
          </button>
          <button className={aba === 'correcao' ? 'ativo' : ''} onClick={() => setAba('correcao')}>
            <ClipboardCheck size={18} /> Correção
          </button>
          <button className={aba === 'ajuda' ? 'ativo' : ''} onClick={() => setAba('ajuda')}>
            <HelpCircle size={18} /> Como usar
          </button>
        </nav>
      </header>

      <main className="conteudo">
        {aba === 'gabaritos' && (
          <div className="layout-gabaritos">
            <aside className="lista-gabaritos card">
              <button className="btn vermelho largo" onClick={() => setEditando(novoGabarito())}>
                <Plus size={16} /> Novo gabarito
              </button>
              {gabaritos.length === 0 && <p className="dica">Nenhum gabarito cadastrado ainda.</p>}
              <ul>
                {gabaritos.map((g) => {
                  const ok = validarGabarito(g).length === 0;
                  return (
                    <li key={g.id}>
                      <button className={editando?.id === g.id ? 'ativo' : ''} onClick={() => setEditando(g)}>
                        <strong>{g.nome || '(sem nome)'}</strong>
                        <small>
                          {g.turma || 'sem turma'} · {g.numQuestoes} questões {ok ? '' : '· incompleto'}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
            {editando ? (
              <EditorGabarito
                key={editando.id}
                gabarito={editando}
                onSalvar={salvar}
                onExcluir={excluir}
                onCorrigir={(id) => {
                  setCorrigindoId(id);
                  setAba('correcao');
                }}
              />
            ) : (
              <div className="vazio card">
                <h2>Comece cadastrando o gabarito matriz</h2>
                <p>Clique em <b>Novo gabarito</b>, informe o nome da prova e marque a alternativa correta de cada questão.</p>
              </div>
            )}
          </div>
        )}
        {aba === 'correcao' && <Correcao gabaritos={gabaritos.filter((g) => validarGabarito(g).length === 0)} gabaritoId={corrigindoId} onSelecionar={setCorrigindoId} />}
        {aba === 'ajuda' && <ComoUsar />}
      </main>
      <footer className="rodape">Corretor de Gabaritos SENAI · os dados ficam salvos apenas neste navegador</footer>
    </div>
  );
}
