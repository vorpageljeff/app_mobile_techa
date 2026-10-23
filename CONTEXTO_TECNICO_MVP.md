# CONTEXTO TECNICO DO MVP TECHA

Data deste contexto: 2026-05-29

Este documento registra o estado tecnico e operacional validado do MVP Techa. Ele deve ser tratado como a fonte oficial de contexto antes de qualquer nova alteracao no projeto.

## 1. Visao geral do produto

O Techa e um MVP da InnovaAgro voltado ao agro. O produto apoia o produtor rural no cadastro de fazendas e talhoes, acompanhamento de vigor vegetativo por NDVI, identificacao de anomalias e geracao de relatorios.

O objetivo do MVP e provar um fluxo funcional de monitoramento agricola:

- criar conta e acessar o app;
- cadastrar fazendas;
- cadastrar talhoes com geometria/poligono;
- visualizar informacoes de NDVI;
- acompanhar anomalias detectadas;
- registrar inspecoes;
- gerar relatorio PDF do talhao;
- manter o app funcional em Android.

O problema central resolvido pelo MVP e reduzir a dificuldade do produtor em acompanhar variacao de vigor da lavoura e priorizar areas que precisam de atencao no campo.

## 2. Estado atual do MVP

O MVP esta funcionando corretamente no Android, com backend online no Render e banco conectado.

Ultimo estado validado:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "Techa",
  "environment": "production",
  "database": "connected"
}
```

O app nao deve ser refeito do zero daqui para frente. O trabalho deve ser evolutivo, incremental e preservando o que ja esta funcionando.

## 3. Arquitetura atual

### Mobile

- Expo / React Native.
- Roteamento com `expo-router`.
- Estado local com `zustand`.
- HTTP com `axios` e `fetch` em fluxos especificos.
- Token JWT salvo com `expo-secure-store`.
- Cache/offline com `expo-sqlite` e `expo-file-system`.
- Mapas com `react-native-maps`.
- Abertura/compartilhamento de PDF com `expo-sharing`.

### Backend

- FastAPI.
- SQLAlchemy async.
- PostgreSQL no Render.
- Redis / Key Value no Render.
- JWT para autenticacao.
- Rate limit com `slowapi`.
- Pipeline Sentinel/NDVI existente no codigo, mas desligado em producao Free.
- PDF com `fpdf2`.
- Processamento geoespacial com `shapely` e `pyproj`.

### Banco de dados

Modelos principais existentes:

- `User`: usuario, email, senha hash, plano, token FCM, status ativo.
- `Farm`: fazenda vinculada ao usuario.
- `Field`: talhao vinculado a fazenda, com geometria WKT, cultura, data de plantio e area.
- `SatelliteAnalysis`: analises Sentinel/NDVI por talhao.
- `Anomaly`: anomalias detectadas a partir de queda de NDVI.
- `FieldInspection`: registros de inspecao de campo.

### Comunicacao app/backend

O app usa a API em:

```text
https://techa-backend.onrender.com/api/v1
```

O token JWT e enviado como `Authorization: Bearer <token>` nas chamadas autenticadas.

## 4. Repositorios

### Mobile / monorepo

Repositorio:

```text
Innovagro-py/TechaMVP
```

Este repositorio contem:

- app Expo/React Native;
- pasta `app/` com rotas do `expo-router`;
- pasta `src/` com telas, servicos, stores, componentes e tipos;
- uma copia do backend em `backend/`;
- documentacao e arquivos de build.

Commit estavel do app/monorepo:

```text
fca9552
```

Commit de documentacao do marco estavel:

```text
acdec93
```

Tag:

```text
prod-stable-mvp-2026-05-29
```

### Backend real do Render

Repositorio:

```text
vorpageljeff/techa-backend
```

Este e o backend efetivamente usado pelo Render em producao.

Commit estavel do backend:

```text
71e58e5
```

Commit de documentacao do marco estavel:

```text
4b7dad2
```

Tag:

```text
prod-stable-mvp-2026-05-29
```

Observacao importante: historicamente existiu divergencia entre o backend dentro do monorepo e o backend real do Render. Antes de alterar backend, confirmar qual repositorio sera publicado.

## 5. Ambiente de producao

Backend de producao:

```text
https://techa-backend.onrender.com
```

Health check:

```text
https://techa-backend.onrender.com/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "Techa",
  "environment": "production",
  "database": "connected"
}
```

### Render Free

O backend esta no Render Free.

Consequencias praticas:

- o servico pode dormir quando fica sem uso;
- a primeira chamada pode demorar;
- antes de testar o app, acessar `/health` para acordar o Render;
- filesystem local do Render nao deve ser tratado como persistente;
- arquivos locais podem sumir em restart, rebuild ou deploy.

Configuracao operacional atual no backend real:

```text
ENABLE_PIPELINE=false
TILES_STORAGE_PATH=/tmp/techa/tiles
RASTER_STORAGE_PATH=/tmp/techa/rasters
```

O pipeline Sentinel automatico foi desligado para manter a API leve e online no plano Free.

## 6. APK validada

Ultima APK validada:

```text
Commit: fca9552
Build: f0830530-66a0-4035-82ba-fa1e12d6585f
APK: https://expo.dev/artifacts/eas/vGyRE8KgNXskGM1qpuxyQ8.apk
```

Essa APK inclui:

- MVP consolidado e funcional em Android;
- correcao do PDF;
- abertura/compartilhamento de PDF com `expo-sharing`;
- fluxo apontando para backend de producao;
- NDVI com fallback no backend;
- historico NDVI com datas mais claras.

O que foi validado:

- backend online;
- banco conectado;
- app Android funcional;
- geracao de PDF retornando arquivo valido;
- abertura/compartilhamento de PDF no fluxo novo;
- NDVI funcionando com fallback;
- autenticacao revisada.

## 7. Funcionalidades ja existentes

Esta secao lista funcionalidades observadas no codigo atual. Nao considerar como existente algo que nao esteja abaixo ou nao tenha sido confirmado no codigo.

### App mobile

Rotas principais em `app/`:

- `app/index.tsx`: entrada inicial.
- `app/(tabs)/farms.tsx`: aba de fazendas.
- `app/(tabs)/alerts.tsx`: aba de alertas/anomalias.
- `app/(tabs)/profile.tsx`: aba de perfil.
- `app/auth/login.tsx`: login.
- `app/auth/register.tsx`: cadastro.
- `app/auth/forgot-password.tsx`: recuperacao de senha.
- `app/farm/new.tsx`: criar fazenda.
- `app/farm/[farmId]/fields.tsx`: listar talhoes da fazenda.
- `app/farm/[farmId]/new-field.tsx`: criar talhao.
- `app/field/[fieldId]/dashboard.tsx`: dashboard do talhao.
- `app/field/[fieldId]/anomalies.tsx`: anomalias do talhao.
- `app/field/[fieldId]/report.tsx`: relatorio PDF.
- `app/anomaly/[anomalyId]/index.tsx`: detalhe da anomalia.
- `app/anomaly/[anomalyId]/navigate.tsx`: navegacao ate anomalia.
- `app/anomaly/[anomalyId]/inspect.tsx`: registrar inspecao.

Servicos do app:

- `src/services/api.ts`: cliente HTTP centralizado, token JWT, auth, fazendas, talhoes, anomalias e relatorios.
- `src/services/database.ts`: SQLite local para cache de talhao, cache de anomalias e inspecoes pendentes.
- `src/services/sync.ts`: sincronizacao offline/online, envio de inspecoes pendentes e cache.
- `src/services/notifications.ts`: push/local notifications e registro de token.
- `src/services/offline.ts`: facade para servicos offline.

Componentes relevantes:

- `src/components/ndvi/NDVIHeatmap.tsx`: overlay NDVI georreferenciado no mapa, cache local e fallback offline.
- `src/components/ndvi/NDVIOverlay.tsx`: overlay NDVI alternativo com cache e anomalias.
- `src/components/map/AnomalyMap.tsx`: mapa de anomalia.
- `src/components/map/FieldPolygonMap.tsx`: mapa/poligono de talhao.
- `src/components/common/AnomalyCard.tsx`: card de anomalia.
- `src/components/common/NDVIBadge.tsx`: badge visual de NDVI.
- `src/components/common/OfflineIndicator.tsx`: indicador offline.

Fluxos funcionais observados:

- registro e login;
- persistencia do token;
- perfil do usuario;
- cadastro/listagem de fazendas;
- cadastro/listagem de talhoes;
- dashboard de talhao;
- listagem de analises NDVI;
- analise NDVI mais recente;
- mapa NDVI com overlay;
- fallback de cache local para NDVI;
- listagem de anomalias;
- detalhe de anomalia;
- descartar anomalia;
- confirmar/inspecionar anomalia;
- navegacao ate anomalia;
- cache offline em SQLite;
- sincronizacao de inspecoes pendentes;
- notificacoes locais e push token;
- geracao, download e abertura/compartilhamento de PDF.

### Backend

Rotas principais em `backend/app/api/v1`:

#### Auth

- `POST /api/v1/auth/register`: cria usuario e retorna token.
- `POST /api/v1/auth/login`: login com email/senha e retorna token.
- `GET /api/v1/auth/me`: dados do usuario autenticado.
- `PATCH /api/v1/auth/me`: atualiza nome do usuario.
- `PATCH /api/v1/auth/change-password`: altera senha autenticada.
- `DELETE /api/v1/auth/account`: exclui conta.
- `POST /api/v1/auth/forgot-password`: solicita OTP de recuperacao.
- `POST /api/v1/auth/reset-password`: redefine senha via OTP.
- `POST /api/v1/auth/verify-reset-code`: valida OTP.
- `PATCH /api/v1/auth/fcm-token`: salva token FCM/push.

#### Fazendas

- `POST /api/v1/farms`: cria fazenda.
- `GET /api/v1/farms`: lista fazendas do usuario.
- `GET /api/v1/farms/{farm_id}`: detalhe da fazenda.
- `PATCH /api/v1/farms/{farm_id}`: atualiza fazenda.
- `DELETE /api/v1/farms/{farm_id}`: remove fazenda.

#### Talhoes / NDVI / relatorios

- `POST /api/v1/farms/{farm_id}/fields`: cria talhao com geometria GeoJSON.
- `POST /api/v1/farms/{farm_id}/fields/import-kml`: importa talhoes via KML.
- `GET /api/v1/farms/{farm_id}/fields`: lista talhoes.
- `GET /api/v1/fields/{field_id}`: detalhe do talhao.
- `GET /api/v1/fields/{field_id}/analyses`: historico de analises.
- `GET /api/v1/fields/{field_id}/analyses/export`: exporta CSV de historico NDVI.
- `GET /api/v1/fields/{field_id}/analyses/latest`: analise mais recente.
- `GET /api/v1/fields/{field_id}/ndvi-tile`: PNG NDVI real ou fallback.
- `GET /api/v1/fields/{field_id}/growth-stage`: estagio fenologico por cultura/data de plantio.
- `GET /api/v1/fields/{field_id}/ndvi-history`: serie historica para grafico.
- `PATCH /api/v1/fields/{field_id}`: atualiza talhao.
- `GET /api/v1/fields/{field_id}/anomalies`: lista anomalias do talhao.
- `DELETE /api/v1/fields/{field_id}`: remove talhao.
- `POST /api/v1/fields/{field_id}/report`: gera PDF.
- `POST /api/v1/fields/{field_id}/report/whatsapp`: envio/simulacao WhatsApp conforme Twilio configurado.

#### Anomalias

- `GET /api/v1/anomalies`: lista anomalias do usuario.
- `GET /api/v1/anomalies/{anomaly_id}`: detalhe.
- `PATCH /api/v1/anomalies/{anomaly_id}/confirm`: confirma/inspeciona.
- `PATCH /api/v1/anomalies/{anomaly_id}/dismiss`: descarta/falso positivo.
- `GET /api/v1/anomalies/{anomaly_id}/inspections`: lista inspecoes.

#### Dashboard

- `GET /api/v1/dashboard`: resumo agregado para tela inicial, com contagem de fazendas, talhoes, area, anomalias ativas, NDVI mais recente e anomalias recentes.

#### Admin

- `GET /api/v1/admin/stats`: estatisticas globais.
- `GET /api/v1/admin/users`: lista usuarios.
- `PATCH /api/v1/admin/users/{target_user_id}/plan`: altera plano.
- `PATCH /api/v1/admin/users/{target_user_id}/active`: ativa/desativa usuario.
- `POST /api/v1/admin/bootstrap`: promove primeiro admin, se ainda nao existir admin.

### Pipeline NDVI existente no codigo

Existe codigo para:

- buscar imagens Sentinel-2;
- baixar bandas;
- aplicar mascara de nuvem;
- calcular NDVI;
- salvar analise;
- gerar PNG NDVI;
- detectar anomalia;
- enviar alertas.

Estado operacional atual: pipeline automatico desligado em producao Free (`ENABLE_PIPELINE=false`) para manter a API online.

## 8. Fluxo de arquivos e PDF

### PDF no app

Arquivo principal:

```text
app/field/[fieldId]/report.tsx
```

Fluxo atual:

1. App chama `POST /api/v1/fields/{fieldId}/report`.
2. Resposta esperada: `application/pdf`.
3. App converte o binario em base64.
4. App salva o PDF localmente em:

```text
FileSystem.documentDirectory/informe_{fieldId}_{timestamp}.pdf
```

5. App abre/compartilha usando `expo-sharing`.
6. Se `expo-sharing` nao estiver disponivel, tenta fallback com `Linking.openURL`.

### PDF no backend

Arquivos principais:

```text
backend/app/api/v1/fields.py
backend/app/services/report_service.py
backend/app/services/map_renderer.py
```

Fluxo atual:

1. Backend valida propriedade do talhao.
2. Busca fazenda, analises validas e anomalias.
3. Gera PDF em memoria com `fpdf2`.
4. Inclui identificacao do talhao, dados NDVI, historico, anomalias e recomendacoes.
5. Tenta incluir mapa/NDVI.
6. Se imagem real nao existir, usa fallback visual com base no NDVI medio.
7. Retorna bytes diretamente na resposta HTTP.

O PDF nao deve ser considerado persistido no backend. Ele e gerado sob demanda e retornado ao app.

### NDVI e arquivos locais

Arquivos NDVI podem existir em:

```text
TILES_STORAGE_PATH=/tmp/techa/tiles
RASTER_STORAGE_PATH=/tmp/techa/rasters
```

No Render Free, esses caminhos sao temporarios. Nao devem ser usados como armazenamento permanente.

O backend possui fallback:

- se `ndvi_latest.png` existir, retorna a imagem real;
- se nao existir, mas houver `ndvi_mean` no banco, retorna PNG fallback;
- se nao houver analise, retorna erro/sem tile.

Risco principal: qualquer funcionalidade que depender apenas de arquivo local no Render pode quebrar apos restart/deploy.

Antes de alterar fluxo de arquivo, propor persistencia adequada:

- banco de dados, quando fizer sentido;
- storage externo S3 compativel;
- Cloudflare R2;
- Supabase Storage;
- outro storage persistente.

## 9. Variaveis de ambiente

Nao expor segredos reais em commits, logs ou documentacao.

### Backend

Variaveis observadas em `config.py` e `render.yaml`:

```env
APP_NAME=Techa
APP_ENV=production
APP_DEBUG=false
APP_HOST=0.0.0.0
APP_PORT=10000
PORT=10000

DATABASE_URL=****
DATABASE_URL_SYNC=****
REDIS_URL=****

SECRET_KEY=****
JWT_SECRET_KEY=****
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=30

ENABLE_PIPELINE=false
TILES_STORAGE_PATH=/tmp/techa/tiles
RASTER_STORAGE_PATH=/tmp/techa/rasters

COPERNICUS_USER=****
COPERNICUS_PASSWORD=****
COPERNICUS_CLIENT_ID=****
COPERNICUS_CLIENT_SECRET=****
COPERNICUS_TOKEN_URL=****
SENTINEL_STAC_URL=****

RESEND_API_KEY=****
EMAIL_FROM_ADDRESS=****
EMAIL_FROM_NAME=Techa - InnovAgro
GMAIL_USER=****
GMAIL_APP_PASSWORD=****
RESET_CODE_TTL_MINUTES=15

FIREBASE_CREDENTIALS_PATH=****

SENTINEL_CHECK_INTERVAL_MINUTES=30
CLOUD_COVER_THRESHOLD=20.0
NDVI_DROP_THRESHOLD=15.0
ALERT_AREA_PCT_SMALL=3.0
ALERT_AREA_PCT_MEDIUM=2.0
ALERT_AREA_PCT_LARGE=1.5
ALERT_AREA_MIN_HA_LARGE=10.0

TWILIO_ACCOUNT_SID=****
TWILIO_AUTH_TOKEN=****
TWILIO_WHATSAPP_FROM=****
```

### App

Variaveis observadas:

```env
EXPO_PUBLIC_API_URL=https://techa-backend.onrender.com/api/v1
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=****
GOOGLE_MAPS_ANDROID_API_KEY=****
```

EAS preview usa:

```json
{
  "EXPO_PUBLIC_API_URL": "https://techa-backend.onrender.com/api/v1"
}
```

Profile EAS para teste iOS em simulador:

```text
ios-simulator
```

Esse profile usa o mesmo backend de producao (`https://techa-backend.onrender.com/api/v1`) e gera build para iOS Simulator. Ele nao substitui a APK Android validada e nao serve para instalar em iPhone fisico. Para iPhone real/TestFlight sera necessario um build iOS assinado com conta Apple.

Observacao iOS: o app usa o mesmo backend Render do Android. Nao ha backend separado para iOS.

Em 2026-05-29, o primeiro build `ios-simulator` falhou no target nativo `@maplibre/maplibre-react-native`. A dependencia foi removida porque o codigo real do app nao importa MapLibre; os mapas implementados usam `react-native-maps`. Essa remocao reduz risco no build iOS sem alterar o fluxo Android validado.

Tambem foi criado `.easignore` para impedir que o EAS envie artefatos locais grandes ou pastas operacionais que nao fazem parte do app mobile, como APKs baixadas, `builds/`, `.codex-render-backend/`, logs e arquivos `.env` locais.

Build iOS Simulator validado pelo EAS:

- Commit: `5b604854ddb28caeb6038b782698066d24fa3cea`
- Build: `937d420c-0829-4fa7-8af8-58b5fe4ba208`
- Artefato: `https://expo.dev/artifacts/eas/jdkd288EC5GrteN6n7m4JY.tar.gz`
- Observacao: esse artefato e para iOS Simulator, nao para iPhone fisico.

## 10. Dependencias importantes

### Mobile

- `expo`: base do app.
- `expo-router`: roteamento.
- `react-native`: base nativa.
- `axios`: chamadas HTTP centralizadas.
- `expo-secure-store`: armazenamento seguro do JWT.
- `expo-file-system`: salvar PDF, cache de tiles/imagens e arquivos locais.
- `expo-sharing`: abrir/compartilhar PDF.
- `expo-sqlite`: cache offline local.
- `expo-location`: localizacao para mapa/navegacao/inspecao.
- `expo-camera`: fotos de inspecao.
- `expo-notifications`: notificacoes locais/push.
- `react-native-maps`: renderizacao de mapas e overlays.
- `zustand`: estado global.
- `zod` e `react-hook-form`: validacao/formularios onde aplicavel.
- `date-fns`: datas.

Dependencia removida:

- `@maplibre/maplibre-react-native`: removida em 2026-05-29 porque nao havia import real no app e o target nativo quebrava o build iOS Simulator. Se MapLibre for necessario no futuro, reintroduzir com teste Android e iOS dedicado.

### Backend

- `fastapi`: API.
- `uvicorn`: servidor ASGI.
- `sqlalchemy`: ORM.
- `asyncpg`: driver PostgreSQL async.
- `alembic`: migracoes.
- `pydantic` / `pydantic-settings`: schemas e configuracao.
- `python-jose`: JWT.
- `bcrypt`: hash de senha.
- `redis`: OTP/recuperacao e suporte a cache/filas.
- `slowapi`: rate limit.
- `apscheduler`: scheduler do pipeline.
- `rasterio`, `numpy`, `scipy`: processamento raster/NDVI.
- `shapely`, `pyproj`: geometria e calculo de area.
- `pystac-client`, `requests`, `httpx`: integracao Sentinel/Copernicus.
- `fpdf2`: geracao de PDF.
- `firebase-admin`: push notifications.
- `resend`: envio de email transacional.
- `twilio`: WhatsApp, se configurado.
- `pytest`: testes.

## 11. Regras de evolucao daqui para frente

Regras obrigatorias:

- Nunca refatorar grandes partes sem necessidade.
- Nunca remover codigo funcional sem justificar.
- Nunca trocar arquitetura sem autorizacao.
- Nunca alterar fluxo de deploy sem documentar.
- Nunca depender de armazenamento local persistente no Render.
- Antes de qualquer alteracao, consultar este Markdown.
- Ao final de qualquer alteracao relevante, atualizar este Markdown.
- Preservar compatibilidade com Android.
- Pensar em evolucao futura para iOS.
- Manter o MVP funcionando antes de adicionar novas features.
- Toda mudanca deve ser incremental, testavel e reversivel.
- Diferenciar backend real do Render (`vorpageljeff/techa-backend`) do backend copiado no monorepo.
- Ao mexer em NDVI/PDF, testar mapa, fallback e abertura de PDF no Android.
- Ao mexer em autenticacao, testar cadastro, login, `/auth/me` e recuperacao de senha.

## 12. Checklist antes de alterar algo

Antes de alterar:

- [ ] Li o CONTEXTO_TECNICO_MVP.md
- [ ] Entendi o que ja funciona
- [ ] Identifiquei se a alteracao impacta Android
- [ ] Identifiquei se a alteracao impacta backend
- [ ] Identifiquei se a alteracao impacta banco
- [ ] Identifiquei se a alteracao depende de arquivo local no Render
- [ ] Tenho plano de rollback
- [ ] Nao vou remover funcionalidade existente sem justificativa

Depois de alterar:

- [ ] Testei o app
- [ ] Testei o backend
- [ ] Testei o health check
- [ ] Testei geracao/abertura de PDF, se aplicavel
- [ ] Atualizei este Markdown
- [ ] Registrei o que foi alterado
- [ ] Registrei riscos ou pendencias

## 13. Historico de decisoes

| Data | Decisao | Motivo | Impacto | Status |
|---|---|---|---|---|
| 2026-05-29 | Usar Expo/React Native no mobile | Entregar MVP Android rapido com ecossistema Expo | App Android funcional com build EAS | Mantido |
| 2026-05-29 | Usar FastAPI no backend | API Python compativel com pipeline NDVI/geoespacial | Backend simples e produtivo | Mantido |
| 2026-05-29 | Usar Render Free no MVP | Reduzir custo inicial | Necessario acordar `/health`; sem disco persistente | Mantido |
| 2026-05-29 | Usar PostgreSQL Free do Render | Persistencia relacional para usuarios, fazendas, talhoes, analises e anomalias | Dados principais ficam em banco | Mantido |
| 2026-05-29 | Usar Redis/Key Value Render | Suporte a OTP/recuperacao e integracoes futuras | Dependencia operacional adicional | Mantido |
| 2026-05-29 | Separar repo real do backend | Render publica `vorpageljeff/techa-backend`, nao apenas o backend do monorepo | Evita publicar no lugar errado | Mantido |
| 2026-05-29 | Validar APK Android `f0830530-66a0-4035-82ba-fa1e12d6585f` | Consolidar app funcional com PDF corrigido | APK de referencia do MVP | Mantido |
| 2026-05-29 | Nao depender de arquivo local no Render | Render Free apaga filesystem local em restart/deploy | NDVI/PDF precisam de fallback ou storage externo | Mantido |
| 2026-05-29 | Voltar Render para Free sem disco | Evitar custo do plano pago no MVP | Sem disco persistente; precisa fallback | Mantido |
| 2026-05-29 | Desligar `ENABLE_PIPELINE` em producao | Scheduler Sentinel deixava API pesada/travada no Free | API fica online; processamento automatico fica pendente | Mantido |
| 2026-05-29 | Criar fallback NDVI | Evitar mapa vazio quando PNG local some | Mapa continua exibindo NDVI aproximado pelos dados salvos | Mantido |
| 2026-05-29 | Corrigir PDF e abrir com `expo-sharing` | PDF nao abria corretamente em Android | Fluxo de PDF validado na APK nova | Mantido |
| 2026-05-29 | Criar tag `prod-stable-mvp-2026-05-29` | Marcar ponto estavel antes de evoluir | Facilita rollback e referencia historica | Mantido |
| 2026-05-29 | Criar `PRODUCAO_ESTAVEL_MVP.md` | Registrar marco estavel no Git | Contexto minimo de producao preservado | Mantido |
| 2026-05-29 | Criar `CONTEXTO_TECNICO_MVP.md` | Centralizar contexto tecnico e operacional | Deve ser lido antes de futuras alteracoes | Criado |
| 2026-05-29 | Criar profile EAS `ios-simulator` | Preparar teste tecnico em iPhone virtual sem alterar Android | Permite build para iOS Simulator usando o mesmo backend Render | Em preparacao |
| 2026-05-29 | Remover `@maplibre/maplibre-react-native` | Dependencia nao usada no codigo e falha no build iOS Simulator | Reduz risco nativo no iOS; mapas continuam em `react-native-maps` | Em validacao |
| 2026-05-29 | Declarar `ITSAppUsesNonExemptEncryption=false` | Evitar bloqueio manual no App Store Connect/TestFlight quando chegar a fase iPhone real | Ajuste restrito a configuracao iOS | Em validacao |
| 2026-05-29 | Criar `.easignore` | Evitar upload de APKs, logs, backend copiado e arquivos locais no build EAS | Build mobile fica mais leve e previsivel | Em validacao |
| 2026-05-29 | Validar build iOS Simulator `937d420c-0829-4fa7-8af8-58b5fe4ba208` | Confirmar que o MVP compila para simulador sem quebrar Android | Gera artefato `.tar.gz` para Mac/Xcode Simulator | Validado no EAS |
| 2026-07-23 | Criar portal administrativo separado no Vercel | Centralizar planos, acessos, métricas e auditoria sem duplicar o app mobile | Novo frontend usa o mesmo backend/banco; backend recebe migração `0003` e conta admin com troca obrigatória de senha | Validado em produção |

## 14. Pendencias e proximos passos

Nao executar automaticamente. Avaliar e planejar antes.

- Evoluir funcionalidades do MVP preservando os fluxos atuais.
- Preparar estrategia para iOS.
- Testar build `ios-simulator` em ambiente macOS/Xcode ou Mac cloud.
- Gerar build iOS para iPhone real/TestFlight quando houver conta Apple e dispositivo do socio.
- Validar no iOS Simulator que login, cadastro, mapa/NDVI e PDF abrem usando o mesmo backend Render.
- Melhorar persistencia de arquivos.
- Definir storage externo para PDFs/imagens/tiles quando necessario.
- Avaliar Cloudflare R2, S3 compativel, Supabase Storage ou alternativa equivalente.
- Melhorar documentacao de deploy.
- Criar rotina segura de backup do banco.
- Melhorar observabilidade e logs do backend.
- Separar pipeline Sentinel/NDVI da API em worker/job proprio.
- Reativar processamento automatico apenas quando houver infraestrutura adequada.
- Criar rotina de teste de regressao para login, cadastro, NDVI e PDF.
- Revisar endpoint de upload de foto de inspecao antes de depender dele em producao, pois o app referencia `/upload/inspection-photo` no fluxo de sync.
- Corrigir divergencias de configuracao entre `render.yaml` do monorepo e `render.yaml` do backend real antes de qualquer novo deploy estrutural.
- Avaliar plano pago ou worker separado quando o MVP precisar de processamento Sentinel recorrente.

## 15. Instrucao final para o Codex

Este arquivo deve ser lido antes de qualquer alteracao no projeto. Ele representa o estado validado do MVP Techa. O objetivo daqui para frente e evoluir sem quebrar o que ja funciona.
