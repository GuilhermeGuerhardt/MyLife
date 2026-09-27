/**
 * A versão do `package.json`, assada no pacote pelo Vite.
 *
 * Existe para o app saber que abriu depois de uma atualização e poder contar o
 * que mudou. Ler em tempo de execução dependeria da API do Tauri, que não
 * existe quando o mesmo código roda no navegador.
 */
declare const __VERSAO__: string
