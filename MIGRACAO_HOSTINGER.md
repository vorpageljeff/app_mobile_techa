# App Techá recuperado da Vercel

Origem: deployment `dpl_2MpqSV6xSwqdq7oAXgWKKTHZDERt`, projeto `techa-mobile-web`.
Metadados da publicação: commit `a064151e2cae331d96177631ad4b679827cce391`, com alterações locais não commitadas. Esta cópia não recupera o histórico Git.

Backup original: `~/Documents/Backups_Techa/2026-09-09/frontend-source/mobile/src`.

## Alteração de migração

A URL padrão nativa, os perfis EAS e os encaminhamentos Vercel agora usam `https://techa-api.2.25.189.129.nip.io`. Identificadores Android/iOS/EAS e versões foram preservados. Uma variável `EXPO_PUBLIC_API_URL` definida externamente tem precedência: conferir também a configuração do ambiente de execução/build.

A nova API contém uma cópia inicial dos dados. A sincronização final e a troca da produção ainda estão pendentes. Não usar esta cópia para cadastrar dados reais antes do corte definitivo.

## Validação

- TypeScript: aprovado.
- Jest: 7 testes aprovados.
- Configuração pública Expo: gerada com sucesso.
- Android/iOS em dispositivo: pendente.

Para iniciar a versão Expo local após a troca definitiva:

```sh
npm ci
npx expo start --clear
```

Abrir o QR Code no celular com o Expo Go compatível com o SDK deste projeto (54). Um APK instalado anteriormente precisa de uma nova versão; ele não recebe a alteração apenas porque estes arquivos mudaram.

A exportação web do app recuperado foi concluída com sucesso (`npm run build:web`).

Exportação dos bundles Android e iOS concluída (`expo export --platform android --platform ios`). Isso valida o empacotamento JavaScript; não constitui build APK/IPA nem teste em dispositivo ou simulador. Os 118 arquivos originais recuperados tiveram SHA-1 correspondente ao ID de conteúdo informado pela Vercel.

## APK para atualização

O usuário confirmou uso do APK instalado. O build Android preview `01008e4b-9d31-4635-9836-5da66049b165` foi solicitado ao Expo em 2026-09-09, conta `jefferagroinova`, plano Free com franquia disponível. `versionCode` passou de 11 para 12; assinatura remota original `Build Credentials EF8IoroS_W (default)` preservada. O ambiente preview carregou a variável existente de Google Maps. Build ainda aguardava fila no último acompanhamento; não há APK entregue nem teste no celular concluído.
