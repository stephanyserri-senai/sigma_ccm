import { FormEvent, useState } from 'react';
import { Logo } from '../components/Logo';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !senha.trim()) {
      setError('Informe usuário e senha para continuar.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username.trim(), senha);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar no sistema.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'radial-gradient(circle at top, rgba(77,141,255,0.12), transparent 30%), #071421',
      padding: 24,
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: 440,
        padding: 28,
        background: '#0d1b2d',
        border: '1px solid rgba(146, 176, 220, 0.18)',
        borderRadius: 18,
        boxShadow: '0 18px 40px rgba(3, 9, 17, 0.42)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <Logo />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 28, color: '#edf5ff' }}>Entrar</h2>
          <p style={{ margin: 0, color: '#8aa3c6' }}>Acesse o SIGMA-CCM</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: '#bfd1f1', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Usuário</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                style={{
                  height: 46,
                  borderRadius: 10,
                  border: '1px solid rgba(146, 176, 220, 0.2)',
                  background: '#0a1522',
                  color: '#edf5ff',
                  padding: '0 14px',
                  outline: 'none',
                }}
                placeholder="Digite seu usuário"
                autoComplete="username"
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: '#bfd1f1', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Senha</span>
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                style={{
                  height: 46,
                  borderRadius: 10,
                  border: '1px solid rgba(146, 176, 220, 0.2)',
                  background: '#0a1522',
                  color: '#edf5ff',
                  padding: '0 14px',
                  outline: 'none',
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && (
            <div style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              color: '#ffd4b3',
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 20,
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
