# Ambiente de teste online

## Objetivo

Subir o backend em um ambiente de teste online para validar o app no celular sem depender do Docker local.

## Estado atual

- Branch local: `develop`.
- Blueprint de producao existente: `render.yaml`.
- Blueprint de teste criado: `render.test.yaml`.
- Exemplo de variavel mobile criado: `.env.test.example`.

## Parte 1 - Passo a passo para Android fisico usando backend local

Use este caminho se quiser testar no celular antes do deploy online.

### 1. Confirmar backend local

```bash
curl http://localhost:8000/health
```

Esperado:

- `status: ok`
- `database: connected`

### 2. Descobrir IP da maquina

No Windows:

```powershell
ipconfig
```

Use o IPv4 da rede Wi-Fi/cabeada. No teste atual da maquina, o IP identificado foi:

```text
192.168.20.53
```

### 3. Ajustar `.env.local`

Para celular fisico, usar o IP da maquina, nao `10.0.2.2`.

```env
EXPO_PUBLIC_API_URL=http://192.168.20.53:8000/api/v1
```

### 4. Reiniciar Metro

Depois de mudar `.env.local`, reinicie o Expo/Metro.

```bash
npm start
```

### 5. Abrir no celular

- Instalar Expo Go no Android.
- Deixar celular e PC na mesma rede.
- Abrir o QR Code do Expo.
- Validar login, fazenda, talhao, mapa e dashboard.

## Parte 2 - Subir backend no Render em teste

Use este caminho para validar o app no celular usando API online.

### 1. Publicar branch `develop`

Antes do Render conseguir subir o ambiente, o GitHub precisa ter a branch com as alteracoes.

Validar status local:

```bash
git status
```

Depois commitar e enviar a branch:

```bash
git add .
git commit -m "chore: preparar ambiente de teste"
git push origin develop
```

### 2. Criar Blueprint no Render

No painel do Render:

- New
- Blueprint
- Conectar o repositorio `TechaMVP`
- Selecionar o arquivo `render.test.yaml`
- Confirmar criacao dos recursos

Recursos esperados:

- `techa-backend-test`
- `techa-backend-test-db`
- `techa-backend-test-redis`

### 3. Conferir variaveis no Render

O blueprint ja configura:

- `APP_ENV=test`
- `APP_DEBUG=false`
- `ENABLE_PIPELINE=false`
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `JWT_SECRET_KEY`

Variaveis que podem ficar vazias no teste inicial:

- `COPERNICUS_CLIENT_ID`
- `COPERNICUS_CLIENT_SECRET`
- `RESEND_API_KEY`
- `FIREBASE_CREDENTIALS_BASE64`

### 4. Validar API online

Quando o deploy finalizar, testar:

```bash
curl https://techa-backend-test.onrender.com/health
```

Esperado:

- `status: ok`
- `database: connected`

Swagger:

```text
https://techa-backend-test.onrender.com/docs
```

## Parte 3 - Apontar app mobile para API de teste

### 1. Criar `.env.test`

Copiar `.env.test.example` para `.env.test` ou atualizar `.env.local` temporariamente:

```env
EXPO_PUBLIC_API_URL=https://techa-backend-test.onrender.com/api/v1
```

### 2. Reiniciar Metro

```bash
npm start
```

### 3. Validar no celular

No Expo Go:

- Abrir app pelo QR Code.
- Criar usuario novo.
- Fazer login.
- Criar fazenda.
- Criar talhao.
- Abrir dashboard.

## Parte 4 - Build Android de teste via EAS

Quando a API online estiver validada:

```bash
npx eas login
npx eas build -p android --profile preview
```

Resultado esperado:

- APK interno para instalar no Android.
- App passa a ser validado sem depender do Expo Go.

## Observacoes

- `render.test.yaml` e separado de `render.yaml` para evitar misturar teste com producao.
- O ambiente de teste usa branch `develop`.
- Antes de validar no celular, confirme se a URL publica do Render corresponde ao valor usado no `.env`.
- Se o Render gerar URL diferente, ajuste `.env.test.example` e `.env.local`.
