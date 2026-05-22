-- Run this after:
-- 1. You have created two users in Supabase Auth.
-- 2. You have copied their user IDs from Authentication > Users.
--
-- Replace the placeholders below before running.

do $$
declare
  household_id uuid := gen_random_uuid();
  user_1 uuid := 'REPLACE_WITH_FIRST_AUTH_USER_ID';
  user_2 uuid := 'REPLACE_WITH_SECOND_AUTH_USER_ID';
begin
  insert into households (id, name, base_currency)
  values (household_id, '家庭投資', 'TWD');

  insert into profiles (id, display_name)
  values
    (user_1, 'Jason'),
    (user_2, 'Family Member')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into household_members (household_id, user_id, role)
  values
    (household_id, user_1, 'admin'),
    (household_id, user_2, 'admin');

  insert into accounts (household_id, name, kind, broker, currency)
  values
    (household_id, '富邦台股帳戶 A', 'brokerage', 'Fubon Securities', 'TWD'),
    (household_id, '富邦台股帳戶 B', 'brokerage', 'Fubon Securities', 'TWD'),
    (household_id, '富邦複委託美股', 'brokerage', 'Fubon Securities', 'TWD'),
    (household_id, '台幣現金帳戶', 'cash', 'Fubon Bank', 'TWD');

  insert into fee_rules (
    household_id,
    market,
    name,
    commission_rate,
    commission_discount,
    minimum_commission,
    sell_tax_rate,
    currency,
    is_default
  )
  values
    (household_id, 'TW', '富邦台股預設費率', 0.001425, 1, 20, 0.003, 'TWD', true),
    (household_id, 'US', '富邦複委託美股定期定額買進', 0.001, 1, 0, 0, 'USD', true);
end $$;
