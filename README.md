# Nexum Maintenance Hub

Protótipo navegável de uma plataforma corporativa para manutenção industrial, passagem de turno e operação em campo. A marca é propositalmente configurável e não utiliza ativos proprietários da VLI.

## O que está disponível

- Dashboard executivo com disponibilidade, aderência, MTBF, MTTR e backlog
- Ordens de manutenção com filtros, estados e painel lateral de detalhes
- Gestão e condição dos ativos
- Passagem de turno com registro estruturado e pendências
- Programação semanal em calendário
- Indicadores, alertas e relatórios
- IA de manutenção demonstrativa com consultas rápidas
- Experiência PWA/mobile e simulação de estado offline
- Usuários, acessos e configurações preparados na navegação

Os dados atuais são mockados para demonstrar os fluxos e a experiência visual. Backend, autenticação real e persistência são evoluções posteriores.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Executar localmente

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite no terminal, normalmente `http://localhost:5173`.

## Gerar build de produção

```bash
npm run build
npm run preview
```

Os arquivos otimizados são gerados em `dist/`.

## Estrutura

```text
src/
  App.tsx       Interface, rotas e dados de demonstração
  styles.css    Design system responsivo e layouts
  main.tsx      Entrada da aplicação
```

## Próximas fases recomendadas

1. Separar páginas, componentes e domínio em módulos.
2. Criar API NestJS, Prisma e PostgreSQL.
3. Implementar autenticação Entra ID/Keycloak e RBAC.
4. Adicionar service worker, IndexedDB e fila de sincronização.
5. Integrar anexos, evidências, relatórios e auditoria.

## Branding

O nome provisório **Nexum** e sua marca geométrica são placeholders. Cores, nome e logotipo podem ser substituídos por identidade oficialmente autorizada.
