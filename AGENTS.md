# Regras de trabalho do Techá

## Proteção obrigatória multiplataforma

Este projeto deve evoluir como uma única base para Android, iOS e web mobile de contingência. Uma nova plataforma não pode remover, simplificar ou alterar silenciosamente uma funcionalidade que já funciona em outra.

Estas regras devem ser lidas e aplicadas antes de iniciar qualquer alteração no projeto.

## Protocolo de início

Antes de editar código:

1. Ler `PRODUCAO_ESTAVEL_MVP.md` e identificar o marco estável conhecido.
2. Conferir a branch, o commit atual e `git status`. Nunca sobrescrever mudanças locais existentes.
3. Classificar a mudança como compartilhada, Android, iOS, web ou backend e declarar quais plataformas podem ser afetadas.

Se a versão que o usuário considera estável ainda não tiver tag ou commit confirmado, avisar isso antes de uma mudança estrutural ou de release.

## Regras de implementação

- Manter uma única base de código. Não criar branches permanentes separadas para Android, iOS e web.
- Usar branches curtas por funcionalidade ou correção.
- Priorizar código compartilhado para telas, regras de negócio, tipos, estado e comunicação com a API.
- Quando uma plataforma exigir comportamento diferente, isolar a implementação com arquivos como `.native.ts`, `.android.ts`, `.ios.ts` e `.web.ts`.
- Não adicionar condicionais de plataforma espalhadas pelo projeto quando um adaptador ou componente específico for mais claro.
- Nunca remover uma dependência ou fluxo nativo apenas para fazer o build web funcionar. Criar um fallback web.
- Não alterar sem autorização explícita:
  - `android.package`;
  - `ios.bundleIdentifier`;
  - `extra.eas.projectId`;
  - URL do backend de produção;
  - chaves, certificados ou perfis de assinatura;
  - `versionCode` e `buildNumber`, exceto durante um release combinado.
- Explicar motivo, custo e alternativa antes de adicionar dependências.

## Escopo da web de contingência

A web é mobile-first e online. Ela não precisa substituir inicialmente os recursos nativos de campo.

Funcionalidades essenciais:

- autenticação e recuperação de senha;
- fazendas, talhões, dashboards e anomalias;
- inspeção básica e envio de foto, quando suportado pelo navegador;
- visualização e download de relatórios;
- acesso ao mesmo backend de produção.

Recursos que podem ter fallback web explícito:

- armazenamento seguro nativo;
- SQLite e modo offline;
- push notifications;
- tarefas em segundo plano;
- compartilhamento nativo;
- mapas e navegação GPS.

Um fallback deve informar a limitação ou oferecer uma alternativa. Não pode falhar silenciosamente.

## Matriz mínima de regressão

Para mudanças em código compartilhado, conferir no mínimo:

| Fluxo | Android | iOS | Web |
| --- | --- | --- | --- |
| Inicialização e navegação | Obrigatório | Obrigatório | Obrigatório |
| Login, logout e sessão | Obrigatório | Obrigatório | Obrigatório |
| Fazendas e talhões | Obrigatório | Obrigatório | Obrigatório |
| Dashboard, NDVI e anomalias | Obrigatório | Obrigatório | Obrigatório |
| Mapas e GPS | Obrigatório | Obrigatório | Fallback aceito |
| Inspeção e foto | Obrigatório | Obrigatório | Conforme suporte |
| Relatório PDF | Obrigatório | Obrigatório | Obrigatório |
| Offline e sincronização | Obrigatório | Obrigatório | Fora do escopo inicial |
| Push notification | Obrigatório | Obrigatório | Fora do escopo inicial |

## Validação antes de concluir

Executar as validações proporcionais à mudança:

```bash
npx tsc --noEmit
npx jest --runInBand
npx expo config --type public
```

Quando houver suporte web configurado:

```bash
npx expo export --platform web
```

Antes de um release, gerar e testar o artefato da plataforma correspondente. Mudanças compartilhadas destinadas a release exigem regressão Android, iOS e web; não presumir que compilar em uma plataforma garante as outras.

## Relatório obrigatório ao final

Ao concluir uma mudança relevante, informar:

- o que mudou;
- por que mudou;
- quais plataformas foram afetadas;
- o que foi realmente validado em cada plataforma;
- o que ainda depende de dispositivo físico, credenciais ou build externo;
- riscos conhecidos e próximo teste recomendado.

Nunca afirmar que Android, iOS ou web está funcionando sem ter executado a validação correspondente. Diferenciar claramente inspeção de código, compilação, simulador e teste em dispositivo real.
