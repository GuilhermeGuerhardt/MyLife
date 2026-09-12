//! Processo nativo do Life.
//!
//! Quase nada acontece aqui de propósito. O app inteiro é a interface web que
//! já existia; este processo abre a janela, registra os plugins que dão acesso
//! ao disco e sai da frente. Não há regra de negócio em Rust — duplicá-la aqui
//! criaria uma segunda verdade sobre saldo, plano alimentar e sequência de
//! hábito, e a segunda envelheceria em silêncio.

mod arquivos;

use tauri_plugin_sql::{Migration, MigrationKind};

/// Esquema do banco local.
///
/// Uma tabela só, guardando JSON. O app nunca consulta por campo: toda tela
/// carrega a coleção inteira e filtra em memória. Um esquema com 24 tabelas
/// tipadas seria cerimônia sem uso, e cobraria uma migração a cada campo novo —
/// enquanto aqui a forma dos dados continua vivendo no TypeScript, que é onde
/// ela já era definida.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "cria o armazenamento de coleções",
        sql: "
            CREATE TABLE IF NOT EXISTS rows (
                collection TEXT NOT NULL,
                id         TEXT NOT NULL,
                data       TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (collection, id)
            );

            -- Toda leitura do app é 'me dê a coleção inteira'. Sem este índice
            -- cada uma delas viria de uma varredura da tabela toda.
            CREATE INDEX IF NOT EXISTS idx_rows_collection ON rows (collection);
        ",
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:life.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            arquivos::ler_texto,
            arquivos::gravar_texto,
            arquivos::gravar_bytes,
            arquivos::pasta_existe,
        ])
        .setup(|_app| {
            // Em desenvolvimento o inspetor abre junto: sem ele, depurar a
            // interface dentro da janela nativa vira adivinhação.
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Life");
}
