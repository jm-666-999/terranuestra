-- ====================================================================
-- EduKanbanPro — esquema de base de datos para Supabase
-- Cómo usarlo: Supabase > tu proyecto > SQL Editor > pega esto > Run
-- ====================================================================

-- Tabla de tableros
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  color text default '#00d9ff',
  progress int default 0,
  members int default 1,
  deadline text default 'Sin fecha',
  description text,
  created_at timestamptz default now()
);

-- Tabla de tareas
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  board_id uuid references boards(id) on delete cascade,
  title text not null,
  description text,
  priority text default 'medium',
  assignee text default 'YO',
  date text,
  column_name text default 'pending',
  created_at timestamptz default now()
);

-- Activar seguridad a nivel de fila (RLS): cada usuario solo ve/edita lo suyo
alter table boards enable row level security;
alter table tasks enable row level security;

drop policy if exists "Los usuarios gestionan solo sus tableros" on boards;
create policy "Los usuarios gestionan solo sus tableros"
  on boards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Los usuarios gestionan solo sus tareas" on tasks;
create policy "Los usuarios gestionan solo sus tareas"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
