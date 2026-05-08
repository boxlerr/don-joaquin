-- Tabla para registrar intentos de login (fallidos y exitosos)
create table if not exists login_attempts (
  id bigint primary key generated always as identity,
  email text not null,
  ip_address text not null,
  user_agent text,
  success boolean not null default false,
  reason text, -- Motivo si falló: "wrong_password", "user_inactive", "rate_limit", etc
  created_at timestamp with time zone not null default now()
);

-- Índices para queries rápidas
create index if not exists idx_login_attempts_email_time
  on login_attempts(email, created_at desc);

create index if not exists idx_login_attempts_ip_time
  on login_attempts(ip_address, created_at desc);

-- RLS para que solo el sistema pueda insertarlos
alter table login_attempts enable row level security;

create policy "No direct select" on login_attempts
  for select using (false);

create policy "Insert only from authenticated" on login_attempts
  for insert with check (true);

create policy "No updates" on login_attempts
  for update using (false);

create policy "No deletes" on login_attempts
  for delete using (false);
