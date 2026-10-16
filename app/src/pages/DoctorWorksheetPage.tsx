import BackButton from '../components/BackButton';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import PresentPrintBar from '../components/PresentPrintBar';
import { usePresenting } from '../context/LessonRunnerContext';
import { MATCH_SETS, PATIENTS, clinicLines, patientById } from '../lib/doctorVisit';

/**
 * 병원 워크시트(2026-10-15) — 게임(`/games/doctor`)과 같은 낱말·그림으로 만드는 인쇄물 4종.
 * ① 낱말 카드 ② 짝 맞추기(PPT 11·12번) ③ What's the problem?(그림 보고 문장 쓰기 + 진료 대화 빈칸) ④ 역할·환자 카드.
 * 한 장은 A4(내용 273mm) 안에 들어간다.
 */

type Tab = 'words' | 'match' | 'problem' | 'cards';
const TABS: Tab[] = ['words', 'match', 'problem', 'cards'];
const IMG = (n: string) => `/skins/doctor/${n}.webp`;
const BLUE = '#0284c7';

function shuffled<T>(a: T[], seed: number): T[] {
  const r = [...a];
  let s = seed * 9301 + 49297;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function DoctorWorksheetPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const presenting = usePresenting();
  const initial = ((location.state as { materialsTab?: string } | null)?.materialsTab as Tab | undefined) ?? 'words';
  const [tab, setTab] = useState<Tab>(TABS.includes(initial) ? initial : 'words');
  const [seed, setSeed] = useState(1);
  const [ko, setKo] = useState(true);
  const [answers, setAnswers] = useState(false);

  const head = (title: string, sub: string) => (
    <div className="mb-[4mm] flex items-end justify-between border-b-[0.7mm] pb-[2mm]" style={{ borderColor: BLUE }}>
      <div>
        <div className="font-black text-deep-navy" style={{ fontSize: '9mm', lineHeight: 1.1 }}>{title}</div>
        <div className="mt-[1mm] text-[4.2mm] text-slate-600">{sub}</div>
      </div>
      <div className="text-[4.4mm] text-slate-600">
        {t('materials.doctor.name')} ____________ &nbsp; {t('materials.doctor.date')} ______
      </div>
    </div>
  );

  const wordsPage = (
    <div key="words" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head('Vocabulary', t('materials.doctor.wordsSub'))}
        <div className="grid grid-cols-4 gap-[3mm]" style={{ gridAutoRows: '58mm' }}>
          {PATIENTS.map((p) => (
            <div key={p.id} className="flex flex-col items-center overflow-hidden rounded-[3mm] border-[0.5mm] border-slate-300 bg-white p-[2mm] text-center">
              <img src={IMG(p.art)} alt="" className="object-contain" style={{ height: '32mm' }} draggable={false} />
              <div className="mt-[1mm] text-[5mm] font-black text-deep-navy">{p.word}</div>
              {ko && <div className="text-[3.4mm] text-indigo-600">{p.ko}</div>}
              <div className="text-[3.2mm] leading-tight text-slate-600">{p.sentence}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const matchPages = useMemo(
    () =>
      MATCH_SETS.map((ids, si) => ({
        words: ids,
        pics: shuffled(ids, seed * 3 + si + 1),
      })),
    [seed],
  );

  const matchPage = (set: { words: string[]; pics: string[] }, si: number) => (
    <div key={`match-${si}`} className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(`${t('materials.doctor.matchTitle')} ${si + 1}`, t('materials.doctor.matchSub'))}
        <div className="flex justify-between" style={{ minHeight: '200mm' }}>
          <div className="flex w-[50mm] flex-col justify-around">
            {set.words.map((id) => (
              <div key={id} className="rounded-[3mm] border-[0.6mm] px-[4mm] py-[5mm] text-center text-[6.4mm] font-black" style={{ borderColor: BLUE }}>
                {patientById(id as never).word}
              </div>
            ))}
          </div>
          <div className="flex w-[95mm] flex-col justify-around">
            {set.pics.map((id) => (
              <div key={id} className="flex items-center justify-end">
                <div className="flex h-[44mm] w-[44mm] items-center justify-center rounded-[3mm] border-[0.6mm] border-slate-300">
                  <img src={IMG(patientById(id as never).art)} alt="" className="object-contain" style={{ height: '40mm' }} draggable={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {answers && (
          <div className="mt-[4mm] text-[4mm] text-slate-500">
            {t('materials.doctor.answers')}: {set.words.map((w) => patientById(w as never).word).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );

  const problemPage = (
    <div key="problem" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head('What’s the problem?', t('materials.doctor.problemSub'))}
        <div className="grid grid-cols-4 gap-[3mm]" style={{ gridAutoRows: '62mm' }}>
          {PATIENTS.map((p) => (
            <div key={p.id} className="flex flex-col items-center overflow-hidden rounded-[3mm] border-[0.5mm] border-slate-300 bg-white p-[2mm]">
              <img src={IMG(p.art)} alt="" className="object-contain" style={{ height: '34mm' }} draggable={false} />
              <div className="mt-[2mm] w-full border-b-[0.4mm] border-slate-500 text-center text-[4.4mm] font-black text-emerald-700">
                {answers ? p.problem : ' '}
              </div>
              <div className="mt-[1mm] text-[3.2mm] text-slate-400">He / She ______</div>
            </div>
          ))}
        </div>
        <div className="mt-[5mm] rounded-[3mm] bg-sky-50 p-[4mm]">
          <div className="text-[5mm] font-black" style={{ color: BLUE }}>{t('materials.doctor.dialogueTitle')}</div>
          <div className="mt-[2mm] space-y-[2mm] text-[4.6mm]">
            {clinicLines(patientById('headache')).slice(0, 4).map((l, i) => (
              <div key={i}>
                <b style={{ color: l.who === 'doctor' ? BLUE : '#c2410c' }}>{l.who === 'doctor' ? 'Doctor' : 'Patient'}:</b>{' '}
                {i === 1 || i === 3 ? <span className="inline-block w-[90mm] border-b-[0.4mm] border-slate-500">&nbsp;</span> : l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const cardsPage = (
    <div key="cards" className="print-sheet print-board mx-auto">
      <div className="mx-auto w-full max-w-[186mm]">
        {head(t('materials.doctor.cardsTitle'), t('materials.doctor.cardsSub'))}
        <div className="grid grid-cols-3 gap-[3mm]" style={{ gridAutoRows: '58mm' }}>
          {[{ art: 'doctor-f', role: 'Doctor', line: 'What’s the problem?' }, { art: 'doctor-m', role: 'Doctor', line: 'Does it hurt?' }, { art: 'stethoscope', role: 'Doctor', line: 'Feel better soon!' }].map((c, i) => (
            <div key={i} className="print-card relative flex flex-col items-center justify-between overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-sky-50 p-[2.4mm] text-center" style={{ borderColor: BLUE }}>
              <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
              <img src={IMG(c.art)} alt="" className="object-contain" style={{ height: '32mm' }} draggable={false} />
              <div className="text-[5mm] font-black" style={{ color: BLUE }}>{c.role}</div>
              <div className="text-[3.6mm] text-slate-700">“{c.line}”</div>
            </div>
          ))}
          {PATIENTS.map((p) => (
            <div key={p.id} className="print-card relative flex flex-col items-center justify-between overflow-hidden rounded-[3.4mm] border-[0.6mm] border-dashed bg-orange-50 p-[2.4mm] text-center" style={{ borderColor: '#ea580c' }}>
              <span className="absolute left-[2mm] top-[1mm] text-[3mm] font-bold text-slate-400">✂</span>
              <img src={IMG(p.art)} alt="" className="object-contain" style={{ height: '32mm' }} draggable={false} />
              <div className="text-[5mm] font-black text-orange-700">{p.word}</div>
              <div className="text-[3.6mm] text-slate-700">“{p.complaint}”</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const reshuffle = tab === 'match' ? () => setSeed((s) => s + 1) : undefined;

  return (
    <div className="space-y-6">
      {!presenting && (
        <>
          <BackButton path="/materials" to={t('materials.backToMaterials')} />
          <h2 className="no-print font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-deep-navy">{t('materials.doctorName')}</h2>
        </>
      )}

      {presenting ? (
        <PresentPrintBar canPrint onReshuffle={reshuffle} />
      ) : (
        <div className="no-print bg-surface-container-lowest rounded-xl p-5 shadow-card space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="font-caption text-caption text-on-surface-variant mb-2">{t('materials.doctor.kindLabel')}</div>
              <div className="flex flex-wrap bg-surface-container-low rounded-lg p-1 w-fit">
                {TABS.map((k) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all ${tab === k ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
                    {t(`materials.doctor.kind_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={ko} onChange={(e) => setKo(e.target.checked)} />
              {t('materials.doctor.showKo')}
            </label>
            <label className="flex items-center gap-2 self-end font-label-md text-label-md text-on-surface">
              <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
              {t('materials.doctor.withAnswers')}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab === 'match' && (
              <button type="button" onClick={() => setSeed((s) => s + 1)} className="px-5 py-2.5 rounded-full border-2 border-secondary text-secondary hover:bg-secondary-container/40 font-label-md text-label-md transition-colors">
                {t('materials.doctor.reshuffle')}
              </button>
            )}
            <button type="button" onClick={() => window.print()} className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors">
              {t('materials.printButton')}
            </button>
            <span className="font-caption text-caption text-on-surface-variant">{t('materials.doctor.hint')}</span>
          </div>
        </div>
      )}

      {tab === 'words' && wordsPage}
      {tab === 'match' && matchPages.map(matchPage)}
      {tab === 'problem' && problemPage}
      {tab === 'cards' && cardsPage}
    </div>
  );
}
