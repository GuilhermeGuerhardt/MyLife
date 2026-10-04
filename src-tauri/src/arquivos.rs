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

/// Grava um arquivo binário, criando as pastas que faltarem no caminho.
///
/// Existe separada da `gravar_texto` porque o certificado em PDF não é texto:
/// passá-lo por uma `String` obrigaria a inventar uma codificação no meio do
/// caminho, e o arquivo salvo não abriria em leitor nenhum.
///
/// Mesma gravação em duas etapas da irmã de texto, pelo mesmo motivo: o destino
/// não pode ficar truncado se a energia cair no meio.
#[tauri::command]
pub fn gravar_bytes(caminho: String, dados: Vec<u8>) -> Result<(), String> {
    let caminho = conferir(&caminho)?;

    if let Some(pasta) = caminho.parent() {
        fs::create_dir_all(pasta)
            .map_err(|erro| format!("Não consegui criar {}: {erro}", pasta.display()))?;
    }

    let temporario = caminho.with_extension("tmp");
    fs::write(&temporario, dados)
        .map_err(|erro| format!("Não consegui gravar {}: {erro}", temporario.display()))?;

    fs::rename(&temporario, &caminho).map_err(|erro| {
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

/// Nomes dos arquivos de uma pasta, sem entrar em subpastas.
///
/// Existe para o backup automático saber quais cópias já estão lá e apagar as
/// mais velhas. Pasta que não existe devolve lista vazia: é o primeiro backup,
/// e a pasta nasce na gravação.
#[tauri::command]
pub fn listar_arquivos(pasta: String) -> Result<Vec<String>, String> {
    let pasta = conferir(&pasta)?;
    let entradas = match fs::read_dir(&pasta) {
        Ok(entradas) => entradas,
        Err(erro) if erro.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(erro) => return Err(format!("Não consegui ler {}: {erro}", pasta.display())),
    };

    Ok(entradas
        .filter_map(|entrada| entrada.ok())
        .filter(|entrada| entrada.path().is_file())
        .filter_map(|entrada| entrada.file_name().into_string().ok())
        .collect())
}

/// Apaga uma cópia antiga do backup automático, e só isso.
///
/// A trava do nome mora aqui, e não na interface, de propósito: é o único
/// comando que apaga arquivo no disco da pessoa, e um caminho errado vindo de
/// um defeito na tela não pode levar junto um documento que estava na mesma
/// pasta. Só passa o que se chama `life-auto-*.json`.
#[tauri::command]
pub fn apagar_backup_automatico(caminho: String) -> Result<(), String> {
    let caminho = conferir(&caminho)?;
    let nome = caminho
        .file_name()
        .and_then(|nome| nome.to_str())
        .unwrap_or_default();

    if !nome.starts_with("life-auto-") || !nome.ends_with(".json") {
        return Err(format!("{nome} não é um backup automático do Life."));
    }

    fs::remove_file(&caminho)
        .map_err(|erro| format!("Não consegui apagar {}: {erro}", caminho.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pasta_de_teste(nome: &str) -> PathBuf {
        let pasta = std::env::temp_dir().join(format!("life-teste-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&pasta);
        fs::create_dir_all(&pasta).unwrap();
        pasta
    }

    #[test]
    fn apaga_so_o_que_tem_nome_de_backup_automatico() {
        let pasta = pasta_de_teste("apagar");
        let backup = pasta.join("life-auto-2026-10-01.json");
        let manual = pasta.join("life-backup-2026-10-01.json");
        let documento = pasta.join("contrato.json");
        for arquivo in [&backup, &manual, &documento] {
            fs::write(arquivo, "{}").unwrap();
        }

        assert!(apagar_backup_automatico(backup.display().to_string()).is_ok());
        assert!(apagar_backup_automatico(manual.display().to_string()).is_err());
        assert!(apagar_backup_automatico(documento.display().to_string()).is_err());

        assert!(!backup.exists());
        assert!(manual.exists());
        assert!(documento.exists());
        let _ = fs::remove_dir_all(&pasta);
    }

    #[test]
    fn lista_so_arquivos_e_aceita_pasta_que_ainda_nao_existe() {
        let pasta = pasta_de_teste("listar");
        fs::write(pasta.join("life-auto-2026-10-01.json"), "{}").unwrap();
        fs::create_dir_all(pasta.join("subpasta")).unwrap();

        let nomes = listar_arquivos(pasta.display().to_string()).unwrap();
        assert_eq!(nomes, vec!["life-auto-2026-10-01.json".to_string()]);

        let ausente = pasta.join("nao-existe");
        assert!(listar_arquivos(ausente.display().to_string()).unwrap().is_empty());
        let _ = fs::remove_dir_all(&pasta);
    }

    #[test]
    fn recusa_caminho_relativo() {
        assert!(apagar_backup_automatico("life-auto-2026-10-01.json".into()).is_err());
        assert!(listar_arquivos("backups".into()).is_err());
    }
}
