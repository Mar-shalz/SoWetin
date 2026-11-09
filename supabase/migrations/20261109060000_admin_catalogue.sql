-- A-06 pairings and A-07 ingredients (doc 02). Staff with the second factor see every pairing and can approve them
-- (BR-42: a person approves each one) and edit ingredients. Allergens, may-contain and animal flags can't change here:
-- allergen changes need a second reviewer (doc 05, 5.2), and allergy safety is absolute.
drop policy read_approved on pairings;
create policy read_pairings on pairings for select using (status = 'approved' or (select private.is_staff()));
create policy staff_update on pairings for update using ((select private.is_staff())) with check ((select private.is_staff()));
create policy staff_update on ingredients for update using ((select private.is_staff())) with check ((select private.is_staff()));

create function private.guard_ingredient() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.allergens is distinct from old.allergens or new.may_contain is distinct from old.may_contain
     or new.is_animal is distinct from old.is_animal or new.is_pork is distinct from old.is_pork then
    raise exception 'Allergen changes need a second reviewer' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function private.guard_ingredient() from public;
create trigger guard_ingredient before update on ingredients for each row execute function private.guard_ingredient();

create trigger audit after insert or update or delete on pairings for each row execute function private.audit();
create trigger audit after insert or update or delete on ingredients for each row execute function private.audit();
