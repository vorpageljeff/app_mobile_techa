# Projeto canonico do Techa

Esta e a pasta correta para manutencao e build do APK atual.

Checklist antes de gerar APK:

```bash
npx tsc --noEmit
npx jest --watchAll=false
npx expo config --type public
```

Build Android preview:

```bash
npx eas-cli build --platform android --profile preview
```
