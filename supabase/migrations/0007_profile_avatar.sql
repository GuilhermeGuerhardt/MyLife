-- Foto de perfil, guardada junto do registro da pessoa.
--
-- Recortada em quadrado de 256 px e comprimida antes de chegar aqui (ver
-- src/lib/avatar.ts): o que aparece no menu tem 24 px, e guardar o original
-- seria carregar pixels que ninguem ve.
alter table public.profiles
  add column if not exists avatar_url text;
