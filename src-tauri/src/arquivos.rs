//! Leitura e escrita de arquivos de texto em caminho absoluto.
//!
//! Por que não o `tauri-plugin-fs`: o escopo dele é declarado em tempo de
//! compilação, e a pasta de trabalho é escolhida em tempo de execução. Uma
//! pasta em `D:\` ou num pen drive cairia fora de qualquer lista que eu
//! escrevesse hoje — e a promessa do recurso é justamente "aponte para onde
//! você quiser, inclusive dentro do Drive ou do OneDrive".
//!
//! O caminho sempre vem de um seletor nativo aberto pela pessoa. A interface
//! nunca inventa um caminho: ela repassa o que o Windows devolveu.

use std::fs;
use std::path::{Path, PathBuf};

/// Recusa caminho relativo.
///
/// Nada na interface deveria produzir um, mas um `..` que escapasse até aqui
/// seria resolvido contra o diretório de trabalho do processo — que é a pasta
/// de instalação do programa, não a pasta escolhida.
fn conferir(caminho: &str) -> Result<PathBuf, String> {
    let caminho = Path::new(caminho);
    if !caminho.is_absolute() {
        return Err("O caminho precisa ser absoluto.".into());
    }
    Ok(caminho.to_path_buf())
}

/// Lê um arquivo de texto. `None` quando ele ainda não existe.
///
/// Ausência não é erro: tabela nunca usada simplesmente não tem arquivo, e
/// tratar isso como falha faria a primeira abertura de uma pasta nova parecer
/// quebrada.
#[tauri::command]
pub fn ler_texto(caminho: String) -> Result<Option<String>, String> {
    let caminho = conferir(&caminho)?;
    match fs::read_to_string(&caminho) {
        Ok(conteudo) => Ok(Some(conteudo)),
        Err(erro) if erro.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(erro) => Err(format!("Não consegui ler {}: {erro}", caminho.display())),
    }
}

/// Grava um arquivo de texto, criando as pastas que faltarem no caminho.
///
/// A gravação passa por um arquivo temporário ao lado e só então é renomeada.
/// Escrever direto no destino significa truncá-lo primeiro: uma queda de
/// energia no meio deixaria `transactions.json` existindo, porém vazio — e o
/// app leria zero lançamentos sem nada indicar que houve perda. O rename é
/// atômico no mesmo volume, então ou o arquivo antigo continua inteiro, ou o
/// novo está completo.
#[tauri::command]
pub fn gravar_texto(caminho: String, conteudo: String) -> Result<(), String> {
    let caminho = conferir(&caminho)?;

    if let Some(pasta) = caminho.parent() {
        fs::create_dir_all(pasta)
            .map_err(|erro| format!("Não consegui criar {}: {erro}", pasta.display()))?;
    }

    let temporario = caminho.with_extension("tmp");
    fs::write(&temporario, conteudo)
        .map_err(|erro| format!("Não consegui gravar {}: {erro}", temporario.display()))?;

    fs::rename(&temporario, &caminho).map_err(|erro| {
        // O temporário não pode ficar para trás sujando a pasta da pessoa.
        let _ = fs::remove_file(&temporario);
        format!("Não consegui concluir a gravação de {}: {erro}", caminho.display())
    })
}

/// A pasta existe e é mesmo uma pasta?
///
/// Serve para reconectar a pasta lembrada na abertura: um pen drive removido ou
/// uma pasta renomeada precisam virar "desconectada", não um erro no meio da
/// primeira leitura.
#[tauri::command]
pub fn pasta_existe(caminho: String) -> Result<bool, String> {
    let caminho = conferir(&caminho)?;
    Ok(caminho.is_dir())
}
