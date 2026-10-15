/**
 * 병원 롤플레이(2026-10-15) 자료 — PPT "ESL Let's Go to the Doctor Lesson (Kids A1)"의 낱말 8개(cough·sick·earache·headache·
 * stomach-ache·toothache·temperature·tired), 짝 맞추기 2세트(슬라이드 11·12), "What's the problem?"(슬라이드 13~19)를 옮겼다.
 * PPT에는 의사–환자 대화가 없어서(낱말 수업), **진료 대화(진료실 단계)는 우리가 보탠 것이다**. 우리말 해석은 Claude 초안.
 * 이름·예문은 PPT 낱말 슬라이드 그대로, 그림은 우리 점토 그림이라 환자 성별은 우리 그림에 맞췄다.
 */

export type PatientId = 'cough' | 'sick' | 'earache' | 'headache' | 'stomach' | 'toothache' | 'temperature' | 'tired';

export interface Patient {
  id: PatientId;
  /** PPT 낱말(슬라이드 3~10) */
  word: string;
  ko: string;
  /** 낱말 슬라이드의 예문(이름 포함) */
  sentence: string;
  /** "What's the problem?" 답(He/She …) */
  problem: string;
  art: string;
  /** 진료 대화 */
  doctorAsk: string;
  doctorAskKo: string;
  patientAnswer: string;
  patientAnswerKo: string;
  /** 환자가 처음에 하는 말 */
  complaint: string;
  complaintKo: string;
  advice: string;
  adviceKo: string;
}

const ADVICE = 'Take some medicine and rest. Feel better soon!';
const ADVICE_KO = '약을 먹고 푹 쉬세요. 얼른 나으세요!';

export const PATIENTS: Patient[] = [
  {
    id: 'cough',
    word: 'cough',
    ko: '기침',
    sentence: 'Jack has a cough.',
    problem: 'He has a cough.',
    art: 'p-cough',
    complaint: 'I have a cough.',
    complaintKo: '기침이 나요.',
    doctorAsk: 'Let me listen to your chest.',
    doctorAskKo: '가슴 소리를 들어 볼게요.',
    patientAnswer: 'OK.',
    patientAnswerKo: '네.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'sick',
    word: 'sick',
    ko: '아픈',
    sentence: 'Fatima doesn’t feel well. She is sick.',
    problem: 'She is sick.',
    art: 'p-sick',
    complaint: 'I am sick.',
    complaintKo: '몸이 아파요.',
    doctorAsk: 'Do you feel well?',
    doctorAskKo: '기분이 괜찮아요?',
    patientAnswer: 'No, I don’t feel well.',
    patientAnswerKo: '아니요, 몸이 안 좋아요.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'earache',
    word: 'earache',
    ko: '귀 아픔',
    sentence: 'Bella has an earache. Her ear hurts.',
    problem: 'She has an earache.',
    art: 'p-earache',
    complaint: 'I have an earache.',
    complaintKo: '귀가 아파요.',
    doctorAsk: 'Does your ear hurt?',
    doctorAskKo: '귀가 아파요?',
    patientAnswer: 'Yes, my ear hurts.',
    patientAnswerKo: '네, 귀가 아파요.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'headache',
    word: 'headache',
    ko: '두통',
    sentence: 'Usala has a headache. Her head hurts.',
    problem: 'She has a headache.',
    art: 'p-headache',
    complaint: 'I have a headache.',
    complaintKo: '머리가 아파요.',
    doctorAsk: 'Does your head hurt?',
    doctorAskKo: '머리가 아파요?',
    patientAnswer: 'Yes, my head hurts.',
    patientAnswerKo: '네, 머리가 아파요.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'stomach',
    word: 'stomach-ache',
    ko: '복통',
    sentence: 'Anthony has a stomach-ache. His stomach hurts.',
    problem: 'He has a stomach-ache.',
    art: 'p-stomach',
    complaint: 'I have a stomach-ache.',
    complaintKo: '배가 아파요.',
    doctorAsk: 'Does your stomach hurt?',
    doctorAskKo: '배가 아파요?',
    patientAnswer: 'Yes, my stomach hurts.',
    patientAnswerKo: '네, 배가 아파요.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'toothache',
    word: 'toothache',
    ko: '치통',
    sentence: 'Sofia has a toothache. Her tooth hurts.',
    problem: 'She has a toothache.',
    art: 'p-toothache',
    complaint: 'I have a toothache.',
    complaintKo: '이가 아파요.',
    doctorAsk: 'Does your tooth hurt?',
    doctorAskKo: '이가 아파요?',
    patientAnswer: 'Yes, my tooth hurts.',
    patientAnswerKo: '네, 이가 아파요.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'temperature',
    word: 'temperature',
    ko: '열',
    sentence: 'Pierre has a temperature. He feels sick.',
    problem: 'He has a temperature.',
    art: 'p-temperature',
    complaint: 'I have a temperature.',
    complaintKo: '열이 나요.',
    doctorAsk: 'Let me check your temperature.',
    doctorAskKo: '열을 재 볼게요.',
    patientAnswer: 'OK.',
    patientAnswerKo: '네.',
    advice: ADVICE,
    adviceKo: ADVICE_KO,
  },
  {
    id: 'tired',
    word: 'tired',
    ko: '피곤한',
    sentence: 'Jorge is tired. He wants to sleep.',
    problem: 'He is tired.',
    art: 'p-tired',
    complaint: 'I am tired.',
    complaintKo: '피곤해요.',
    doctorAsk: 'Do you want to sleep?',
    doctorAskKo: '자고 싶어요?',
    patientAnswer: 'Yes, I want to sleep.',
    patientAnswerKo: '네, 자고 싶어요.',
    advice: 'Go home and sleep. Feel better soon!',
    adviceKo: '집에 가서 푹 자요. 얼른 나으세요!',
  },
];

export function patientById(id: PatientId): Patient {
  return PATIENTS.find((p) => p.id === id) ?? PATIENTS[0];
}

/** PPT 짝 맞추기 슬라이드 11·12 */
export const MATCH_SETS: PatientId[][] = [
  ['cough', 'earache', 'sick', 'headache'],
  ['toothache', 'temperature', 'stomach', 'tired'],
];

/** PPT "What's the problem?" 슬라이드 13~19 순서 */
export const PROBLEM_ORDER: PatientId[] = ['headache', 'toothache', 'stomach', 'temperature', 'cough', 'sick', 'tired'];

export interface ClinicLine {
  who: 'doctor' | 'patient';
  text: string;
  ko: string;
}

/** 진료실 대화 6줄(우리가 보탠 것) */
export function clinicLines(p: Patient): ClinicLine[] {
  return [
    { who: 'doctor', text: 'Hello. What’s the problem?', ko: '안녕하세요. 어디가 안 좋으세요?' },
    { who: 'patient', text: p.complaint, ko: p.complaintKo },
    { who: 'doctor', text: p.doctorAsk, ko: p.doctorAskKo },
    { who: 'patient', text: p.patientAnswer, ko: p.patientAnswerKo },
    { who: 'doctor', text: p.advice, ko: p.adviceKo },
    { who: 'patient', text: 'Thank you, doctor!', ko: '고맙습니다, 선생님!' },
  ];
}
