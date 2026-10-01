begin;

create schema auth_mail_suppression;

create function auth_mail_suppression.send_email_v1(event jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select '{}'::jsonb;
$function$;

revoke all on schema auth_mail_suppression from public, anon, authenticated;
grant usage on schema auth_mail_suppression to supabase_auth_admin;

revoke all on function auth_mail_suppression.send_email_v1(jsonb) from public, anon, authenticated;
grant execute on function auth_mail_suppression.send_email_v1(jsonb) to supabase_auth_admin;

commit;
