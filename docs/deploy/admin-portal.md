# Portal administrativo Techá

## Endereços

- Portal: `https://techa-admin-portal.vercel.app`
- API: `https://techa-backend.onrender.com/api/v1`
- Projeto Vercel: `techa-admin-portal`

O portal é um frontend estático separado e acessa o mesmo backend e o mesmo
banco usados por Android, iOS e web mobile. O proxy `/api/*` do Vercel evita
expor configurações diferentes no navegador.

## Primeiro acesso

- Login curto: `admin`
- E-mail da conta: `admin@techa.com.py`
- Senha: temporária, forte e comunicada fora do repositório

A migração `0003_admin_portal` cria ou promove a conta inicial somente quando
nenhum administrador existe. A troca de senha é obrigatória no primeiro acesso.
O valor em texto da senha temporária não deve ser salvo no Git.

## Escopo atual

- visão geral de usuários, fazendas, talhões, análises e anomalias;
- gestão de planos `free`, `pro` e `admin`;
- bloqueio e reativação de acesso;
- geração de senha temporária, exibida uma única vez ao administrador;
- último login;
- trilha de auditoria para login, senha, plano e acesso;
- alteração da senha do administrador.

## Segurança e operação

- o token fica em `sessionStorage` e é removido ao fechar a aba;
- o administrador não pode remover o próprio perfil nem bloquear a própria conta;
- senhas administrativas exigem no mínimo 12 caracteres;
- senhas atuais nunca são exibidas: somente uma senha temporária recém-gerada
  pode ser copiada no momento da redefinição;
- o bootstrap público antigo foi substituído por um fluxo protegido e fica
  inoperante depois que existe um administrador;
- a disponibilidade do portal depende do backend do Render e do banco.

## Validação mínima após deploy

1. Conferir `/health` e `/ready` no backend.
2. Entrar com a credencial temporária e trocar a senha.
3. Conferir métricas e lista de usuários.
4. Alterar um plano de teste e confirmar o evento em Auditoria.
5. Bloquear e reativar somente uma conta de teste.
