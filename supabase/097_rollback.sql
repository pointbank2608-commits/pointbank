-- Disable VITE_LEARNING_SENSORS_ENABLED first. Preserve observations for investigation/recovery.
begin;
revoke execute on function public.learning_sensor_report(text,text,uuid,jsonb) from anon,authenticated;
revoke execute on function public.admin_learning_sensor_summary(int) from authenticated;
commit;
