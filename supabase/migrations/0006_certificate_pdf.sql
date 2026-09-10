-- Certificado em PDF, guardado junto do registro do curso.
--
-- `certificate_url` continua sendo a imagem que o cartão mostra — a foto
-- enviada, ou a primeira página deste PDF. As duas colunas coexistem porque o
-- PDF é o documento que vale e a imagem é a única coisa que cabe em 44 px.
alter table public.programs
  add column if not exists certificate_pdf text;
