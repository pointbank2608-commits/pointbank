/** Learning role is independent of a block's visual/game format. Reused across lesson modes. */
export type EvidenceRole = 'diagnostic' | 'learn' | 'practice' | 'check' | 'delayed_check';
export interface EvidenceProfile {
  role: EvidenceRole;
  name: { ko: string; en: string };
  individualResponse: boolean;
  feedback: 'after_response' | 'available' | 'not_scored';
  required: readonly string[];
  /** A group presentation alone cannot provide individual learning evidence. */
  groupEvidence: 'individual_response_required' | 'exposure_only';
}
export const EVIDENCE_PROFILES: readonly EvidenceProfile[] = [
  {role:'diagnostic',name:{ko:'사전 확인',en:'Initial check'},individualResponse:true,feedback:'after_response',required:['goal','version','first_response','prior_cues'],groupEvidence:'individual_response_required'},
  {role:'learn',name:{ko:'설명과 예시',en:'Explanation and examples'},individualResponse:false,feedback:'not_scored',required:['goal','version','shown_content','audio','time'],groupEvidence:'exposure_only'},
  {role:'practice',name:{ko:'도움받아 연습',en:'Supported practice'},individualResponse:true,feedback:'available',required:['goal','version','first_response','hints','retries'],groupEvidence:'individual_response_required'},
  {role:'check',name:{ko:'혼자 확인',en:'Independent check'},individualResponse:true,feedback:'after_response',required:['goal','version','first_response','prior_cues','help'],groupEvidence:'individual_response_required'},
  {role:'delayed_check',name:{ko:'시간을 둔 확인',en:'Delayed check'},individualResponse:true,feedback:'after_response',required:['goal','version','due_time','actual_time','first_response','intervening_exposure','eligible_students'],groupEvidence:'individual_response_required'},
];
export const evidenceRolesFor = (type: string): EvidenceRole[] => type==='meet'||type==='rule'||type==='example'?['learn']
  :['typeWord','pickMeaning','pickWord','dictation','gapType','translatePick'].includes(type)?['diagnostic','practice','check','delayed_check']
  :type==='spell'?['practice']:[];
