// 관리자 개선 마이그레이션 적용 순서(supabase/ 기준) — 테스트가 이 순서로 임시 DB에 적용한다.
export const ALL_FILES = [
  '086a_admin_flags.sql', '086b_admin_settings_and_log.sql', '086c_admin_facts_and_plan.sql', '086d_admin_overview.sql',
  '086e_support_state.sql', '086f_support_triggers.sql', '086g_academy_rollup.sql', '086h_academy_search.sql', '086i_support_search.sql',
  '086j_automation_tables.sql', '086k_automation_seed_and_record.sql', '086l_lifecycle_targets.sql', '086m_lifecycle_run.sql',
  '086n_jobs_status.sql', '086o_issues_tables.sql', '086p_issues_sync.sql', '086q_error_groups.sql',
  '086r_bulk_tables.sql', '086s_bulk_apply.sql', '086t_deletion_safety.sql', '086u_billing_overview.sql',
];
