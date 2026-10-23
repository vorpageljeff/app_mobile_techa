# Web mobile e iOS

## Baseline protegida

- Android estável antes deste trabalho: tag `android-stable-2026-07-22`.
- Branch de implementação: `feat/ios-web-contingency`.
- Android e iOS usam o backend `https://techa-backend.onrender.com/api/v1`.

## Web mobile de contingência

A web é online e reutiliza as telas e regras do aplicativo. Recursos nativos como cache SQLite e push possuem fallback web. O desenho de talhões, os mapas de talhões e as anomalias usam Google Maps quando `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` está configurada no build. Sem essa variável, usam OpenStreetMap. A chave Android não serve automaticamente para o navegador: a chave web precisa permitir a Maps JavaScript API e o domínio publicado. O Google Maps Platform exige faturamento habilitado e cobra conforme o uso.

### Validação local

```bash
npm run typecheck
npm run test:ci
npm run build:web
```

O resultado fica em `dist/`.

### Publicação no Vercel

O `vercel.json` executa o export Expo, publica `dist/`, mantém o roteamento SPA e encaminha `/api` ao backend Hostinger em `https://techa-api.2.25.189.129.nip.io`.

- Projeto: `techa-mobile-web`
- Produção: https://techa-mobile-web.vercel.app

Não é necessário cadastrar `EXPO_PUBLIC_API_URL` no Vercel. Sem essa variável, o frontend usa o proxy de mesma origem definido em `vercel.json`.

Para ativar Google Maps na web, cadastrar `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` nas variáveis de produção do projeto Vercel e fazer um novo deploy. No Google Cloud, habilitar Maps JavaScript API, restringir a chave por referenciador HTTP a `https://techa-mobile-web.vercel.app/*` e limitar seu uso à Maps JavaScript API. Para testar localmente, adicionar também `http://localhost:*/*` aos referenciadores autorizados. A chave é incluída no JavaScript entregue ao navegador, como esperado para essa API; não colocar uma chave de servidor nesse campo.

```bash
npx vercel login
npx vercel --prod
```

Depois do deploy, validar em Chrome Android e Safari iPhone:

- abertura e navegação;
- login, logout e persistência durante a sessão;
- fazendas, talhões, dashboard e anomalias;
- imagem NDVI e fallbacks de mapa;
- geração, abertura e download de PDF.

## iOS

### Simulador

Não exige conta Apple Developer, mas o artefato `.app` roda apenas no Simulator de um Mac:

```bash
npx eas-cli build --platform ios --profile ios-simulator
```

### iPhone físico

Exige conta Apple Developer e dispositivo registrado para assinatura Ad Hoc:

```bash
npx eas-cli build --platform ios --profile ios-device
```

### TestFlight e App Store

Exige conta Apple Developer e aplicativo criado no App Store Connect:

```bash
npx eas-cli build --platform ios --profile ios-production
npx eas-cli submit --platform ios --profile ios-production
```

Antes de qualquer release, repetir a matriz de regressão definida em `AGENTS.md`.
