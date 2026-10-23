# Producao estavel do MVP

Data do marco: 2026-05-29
Tag: `prod-stable-mvp-2026-05-29`
Commit base do app/monorepo: `fca9552`
Commit base do backend Render: `71e58e5`
APK estavel: https://expo.dev/artifacts/eas/vGyRE8KgNXskGM1qpuxyQ8.apk
Backend: https://techa-backend.onrender.com

Este commit marca a versao estavel do MVP em producao.

Estado esperado:
- Backend online no Render Free.
- Banco conectado.
- API leve com `ENABLE_PIPELINE=false`.
- Login, cadastro e recuperacao revisados.
- NDVI protegido com fallback quando arquivo local some no Render Free.
- PDF corrigido e abrindo/compartilhando no app.
- APK final de teste gerado a partir do commit `fca9552`.

Decisoes importantes:
- O plano pago e o disco persistente do Render ficaram para depois.
- O pipeline Sentinel automatico nao roda junto da API no plano Free.
- Para testar, acordar o Render acessando `/health` antes de usar o app.

Daqui para frente, novas mudancas devem partir deste marco e preservar estes fluxos antes de evoluir novas features.
