# Sprint 1 - Backlog

## Objetivo

Conectar mobile, backend e banco em ambiente `develop`, permitindo validar o prototipo em Android e iOS antes de promover para `test`.

## Ambiente alvo

- Branch: `develop`
- Mobile: Expo / React Native
- Backend: FastAPI em `backend/`
- Banco: PostgreSQL
- Cache/fila: Redis
- API local esperada: `http://<ip-da-maquina>:8000/api/v1`
- Health check: `GET /health`

## Status geral

| Item | Status | Observacao |
| --- | --- | --- |
| Backend incorporado ao repo principal | Feito | Backend esta em `backend/` no repo `TechaMVP`. |
| Branch `develop` com backend | Feito | Backend ja foi promovido para `develop`. |
| Dependencias Expo alinhadas | Feito | `expo install --check` sem pendencias. |
| Testes mobile | Feito | `npx jest --runInBand` passando. |
| Backend local rodando | Parcial | API respondeu `/health`, mas banco esta `degraded`. |
| Banco local conectado | Bloqueado | Docker Desktop nao iniciou corretamente; Postgres local exige senha. |
| Android consumindo API local | Pendente | Depende do backend com banco OK. |
| iOS consumindo API local | Pendente | Depende do backend com banco OK. |

## Backlog

### S1-001 - Consolidar monorepo mobile + backend

Status: Feito

Descricao:
Incorporar o backend FastAPI ao repositorio `Innovagro-py/TechaMVP.git`, mantendo o app mobile e backend no mesmo projeto.

Criterios de aceite:

- `backend/` existe no repo principal.
- `render.yaml` na raiz aponta para `backend/`.
- Branch `develop` contem mobile e backend.

### S1-002 - Preparar ambiente local de desenvolvimento

Status: Feito

Descricao:
Criar configuracoes e documentacao minima para rodar mobile e backend localmente.

Criterios de aceite:

- `.env.development.example` documenta a URL da API para Android/iOS.
- `SPRINTS.md` descreve comandos locais.
- `.env.local` fica ignorado pelo Git.

### S1-003 - Subir banco e Redis para desenvolvimento

Status: Bloqueado

Descricao:
Rodar PostgreSQL e Redis locais para que o backend consiga conectar e executar migrations.

Criterios de aceite:

- PostgreSQL acessivel pelo backend.
- Redis acessivel pelo backend.
- `alembic upgrade head` executa sem erro.
- `GET /health` retorna `database: connected`.

Bloqueio atual:
Docker Desktop esta instalado, mas o engine retornou erro 500 e o servico `com.docker.service` nao iniciou pelo terminal. Existe PostgreSQL local rodando, mas sem senha disponivel para criar banco/usuario.

Proxima acao pratica:
Iniciar Docker Desktop manualmente ou fornecer a credencial admin do PostgreSQL local.

### S1-004 - Validar backend em desenvolvimento

Status: Pendente

Descricao:
Garantir que a API sobe corretamente com banco e migrations aplicadas.

Criterios de aceite:

- `GET /health` retorna `status: ok`.
- Swagger local abre em `/docs`.
- Cadastro e login respondem via `/api/v1/auth/register` e `/api/v1/auth/login`.
- Logs nao mostram erro de conexao com banco.

### S1-005 - Conectar mobile ao backend local

Status: Parcial

Descricao:
Apontar o app Expo para a API local usando IP acessivel por Android e iOS.

Criterios de aceite:

- App carrega `EXPO_PUBLIC_API_URL` de `.env.local`.
- Android fisico consegue chamar `http://<ip-da-maquina>:8000/api/v1`.
- iOS fisico consegue chamar `http://<ip-da-maquina>:8000/api/v1`.
- Emulador Android documentado com `http://10.0.2.2:8000/api/v1`.

Observacao:
Na maquina atual, o IP detectado foi `192.168.20.53`.

### S1-006 - Validar fluxo de autenticacao ponta a ponta

Status: Pendente

Descricao:
Testar cadastro, login, persistencia de token e chamada autenticada do usuario logado.

Criterios de aceite:

- Cadastro cria usuario no banco.
- Login retorna `access_token`.
- Token e salvo no SecureStore.
- `/auth/me` retorna usuario autenticado.
- Erros de rede aparecem de forma tratavel no app.

### S1-007 - Validar primeiro fluxo funcional do MVP

Status: Pendente

Descricao:
Testar o primeiro caminho util do produto apos login: fazenda, talhao e dashboard.

Criterios de aceite:

- Criar fazenda pelo app.
- Listar fazendas pelo app.
- Criar talhao com geometria.
- Abrir dashboard do talhao.
- App nao quebra em Android nem iOS.

### S1-008 - Preparar promocao para `test`

Status: Pendente

Descricao:
Quando `develop` estiver validado localmente, abrir PR de `develop` para `test`.

Criterios de aceite:

- Backlog da Sprint 1 atualizado.
- Testes automatizados passando.
- Evidencia manual do teste Android/iOS registrada no PR.
- `GET /health` OK no ambiente de teste.

## Decisoes tecnicas

- Backend fica em `backend/` dentro do repo `TechaMVP`.
- Producao no Render deve acompanhar `main`, mas Sprint 1 trabalha em `develop`.
- Para desenvolvimento local, `ENABLE_PIPELINE=false` evita rodar scheduler Sentinel-2 junto da API.
- Segredos locais ficam fora do Git.

## Comandos de referencia

Backend:

```bash
cd backend
docker compose up --build
```

Mobile:

```bash
npm install
npm start
```

Validacoes:

```bash
npx expo install --check
npx jest --runInBand
```
