-- À exécuter UNE SEULE FOIS dans l'Éditeur SQL de Supabase.
alter table public.cadeaux
  add column if not exists ordre integer,
  add column if not exists coup_de_coeur boolean not null default false;

alter table public.cadeaux enable row level security;

drop policy if exists "Lecture publique des cadeaux" on public.cadeaux;
create policy "Lecture publique des cadeaux"
on public.cadeaux for select to anon, authenticated using (true);

drop policy if exists "Tout le monde peut réserver un cadeau" on public.cadeaux;

create or replace function public.reserver_cadeau(cadeau_id bigint, prenom_reservant text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare lignes_modifiees integer;
begin
  if prenom_reservant is null or length(trim(prenom_reservant)) < 1 or length(trim(prenom_reservant)) > 60 then return false; end if;
  update public.cadeaux set reserve=true, reserve_par=trim(prenom_reservant)
  where id=cadeau_id and coalesce(reserve,false)=false;
  get diagnostics lignes_modifiees = row_count;
  return lignes_modifiees=1;
end;
$$;

revoke all on function public.reserver_cadeau(bigint,text) from public;
grant execute on function public.reserver_cadeau(bigint,text) to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.cadeaux;
exception when duplicate_object then null;
end $$;
