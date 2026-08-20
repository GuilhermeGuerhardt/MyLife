// O `windows_subsystem` evita que uma janela de console apareça atrás do app
// no Windows. Só em release: em desenvolvimento o console é onde o log sai.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    life_lib::run()
}
