# Sprints

## Sprint 1 - Integracao mobile, backend e banco

Objetivo: rodar o prototipo em ambiente `develop`, com o app mobile consumindo a API local e a API conectada ao PostgreSQL.

Backlog detalhado: [docs/sprints/sprint-1-backlog.md](docs/sprints/sprint-1-backlog.md)

Escopo:

- Backend FastAPI dentro de `backend/`.
- PostgreSQL e Redis via Docker Compose.
- Migrations executadas antes da API subir.
- App Expo apontando para a API de desenvolvimento.
- Validacao em Android e iOS.

Fluxo de branch:

```text
feature/* -> develop -> test -> main
```

Checklist de aceite:

- `GET /health` responde `status: ok`.
- Cadastro/login do app mobile chama o backend real.
- Android consegue acessar a API pela rede local ou pelo alias do emulador.
- iOS consegue acessar a API pela rede local.
- Nenhuma configuracao de producao e usada durante teste local.

Comandos locais:

```bash
cd backend
docker compose up --build
```

Em outro terminal:

```bash
npm install
npm start
```
