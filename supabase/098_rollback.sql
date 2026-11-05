-- Pause optional telemetry only. Keep delivery/grading endpoints for already issued lessons and offline answers.
-- Disable VITE_LEARNING_SENSORS_ENABLED in the app build first if practical.
begin;
revoke execute on function public.learning_sensor_report_run(uuid,text,jsonb) from anon,authenticated;
commit;
