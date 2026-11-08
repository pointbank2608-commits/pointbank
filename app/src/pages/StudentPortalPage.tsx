import { formatHomeworkDeadline } from '../lib/homework/deadline';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import ReviewSection from '../components/solo/ReviewSection';
import WordMemoryPortalLinks from '../components/wordMemory/WordMemoryPortalLinks';
import StudentStampCalendar from '../components/homework/StudentStampCalendar';
import ClassNoticeBanner from '../components/solo/ClassNoticeBanner';
import GrammarPortalLinks from '../components/grammar/GrammarPortalLinks';
import { useGrammarPortalAssignments } from '../lib/useGrammarPortalAssignments';
import { studentNotice } from '../lib/soloChat';
import {
  codeFromUrl,
  formatPhone,
  homeworkCodeFromUrl,
  forgetStudentToken,
  PortalError,
  savedToken,
  studentHome,
  studentLogin,
  studentLogout,
  type PortalErrorKind,
  type PortalHome,
} from '../lib/studentPortal';

const shell = 'flex min-h-[100dvh] flex-col bg-[#f8f1e3] text-[#1c2742]';
const field =
  'min-h-12 w-full rounded-xl border border-[#d9d3c3] bg-white px-4 text-xl font-bold text-deep-navy outline-none focus:ring-4 focus:ring-[#3b5bdb]/30';

/**
 * 학생용 페이지(/s) — 선생님 화면과 따로. 로그인(이름 + 보호자 전화번호) 후, 이 기기를 기억한다.
 * 오늘의 수업(새로 배우기)이 들어올 자리와 숙제 목록이 있다.
 */
export default function StudentPortalPage() {
  const [token, setToken] = useState<string | null>(() => savedToken());
  const [home, setHome] = useState<PortalHome | null>(null);
  const [error, setError] = useState<PortalErrorKind | null>(null);

  const load = useCallback(async (tk: string) => {
    setError(null);
    try {
      setHome(await studentHome(tk));
    } catch (e) {
      if (e instanceof PortalError && e.kind === 'expired') {
        forgetStudentToken();
        setToken(null);
        setHome(null);
      } else {
        setError(e instanceof PortalError ? e.kind : 'unknown');
      }
    }
  }, []);

  useEffect(() => {
    if (token && !homeworkCodeFromUrl()) void load(token);
  }, [token, load]);

  const homeworkCode = homeworkCodeFromUrl();
  if (!token) return <LoginView homeworkCode={homeworkCode} onDone={setToken} />;
  if (homeworkCode) return <Navigate to={`/hw/${homeworkCode}`} replace />;
  return (
    <HomeView
      home={home}
      error={error}
      onRetry={() => void load(token)}
      onLogout={async () => {
        await studentLogout(token);
        setHome(null);
        setToken(null);
      }}
    />
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-center gap-2 text-base text-[#5b6580]">
      <BrandMark className="h-7 w-7" />
      Classbank
    </div>
  );
}

function LoginView({ homeworkCode, onDone }: { homeworkCode: string; onDone: (token: string) => void }) {
  const { t } = useTranslation();
  const code = codeFromUrl();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PortalErrorKind | null>(null);
  const ready = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 10;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await studentLogin(code, name, phone, homeworkCode));
    } catch (e) {
      setError(e instanceof PortalError ? e.kind : 'unknown');
      setBusy(false);
    }
  }

  return (
    <form
      className={`${shell} items-center justify-center gap-4 p-6`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Brand />
      <h1 className="text-center text-3xl font-bold">{t('studentPortal.loginTitle')}</h1>
      <p className="max-w-xs text-center text-base text-[#5b6580]">{t('studentPortal.loginHint')}</p>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentPortal.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={field} />
      </label>
      <label className="flex w-full max-w-xs flex-col gap-1">
        <span className="text-base font-bold">{t('studentPortal.phone')}</span>
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="010-0000-0000"
          className={field}
        />
        <span className="text-sm text-[#5b6580]">{t('studentPortal.phoneHint')}</span>
      </label>
      {error && (
        <p className="max-w-xs text-center text-lg text-[#3b5bdb]" role="alert">
          {t(`studentPortal.err_${error}`)}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className="min-h-14 rounded-full bg-[#3b5bdb] px-10 text-xl font-bold text-white disabled:opacity-40">
        {busy ? t('common.loading') : t('studentPortal.login')}
      </button>
    </form>
  );
}

function HomeView({
  home,
  error,
  onRetry,
  onLogout,
}: {
  home: PortalHome | null;
  error: PortalErrorKind | null;
  onRetry: () => void;
  onLogout: () => void;
}) {
  const { t, i18n } = useTranslation();
  const grammar = useGrammarPortalAssignments(home && !error ? savedToken() : null);
  if (error) {
    return (
      <div className={`${shell} items-center justify-center gap-4 p-6 text-center`}>
        <Brand />
        <p className="text-xl font-bold">{t(`studentPortal.err_${error}`)}</p>
        <button type="button" onClick={onRetry} className="min-h-12 rounded-full bg-[#3b5bdb] px-8 text-lg font-bold text-white">
          {t('studentPortal.retry')}
        </button>
      </div>
    );
  }
  if (!home) return <div className={`${shell} items-center justify-center text-lg text-[#5b6580]`}>{t('common.loading')}</div>;

  const soloClosed = home.features?.solo === false;
  const hwClosed = home.features?.homework === false;
  const grammarSolo = soloClosed ? [] : grammar.rows.filter(row => row.mode === 'individual');
  const grammarHomework = soloClosed || hwClosed ? [] : grammar.rows.filter(row => row.mode === 'homework');
  const isAdaptiveHomework = (lesson: PortalHome['lessons'][number]) => lesson.kind==='homework' && lesson.learning_path;
  const lessons = (home.lessons ?? []).filter(l=>!isAdaptiveHomework(l));
  const adaptive = hwClosed||soloClosed?[]:(home.lessons ?? []).filter(isAdaptiveHomework);
  const firstOpenId = lessons.find((l) => !l.done && !l.path_waiting)?.id ?? null;
  const en=i18n.language.startsWith('en');
  const open = home.homework.filter((h) => !h.done);
  const done = home.homework.filter((h) => h.done);
  return (
    <div className={`${shell} gap-5 p-5`}>
      <header className="mx-auto flex w-full max-w-xl items-center gap-3">
        <BrandMark className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-bold">{t('studentPortal.hello', { name: home.name })}</div>
          <div className="truncate text-sm text-[#5b6580]">{[home.academy, home.class_name].filter(Boolean).join(' · ')}</div>
        </div>
        <button type="button" onClick={onLogout} className="rounded-full border border-[#d9d3c3] px-4 py-2 text-sm font-bold text-[#5b6580] hover:bg-[#efe8d4]">
          {t('studentPortal.logout')}
        </button>
      </header>

      {savedToken() && <ClassNoticeBanner load={() => studentNotice(savedToken() as string)} />}
      {grammar.error && <div role="status" className="mx-auto w-full max-w-xl">
        문법 목록을 불러오지 못했어요. <button type="button" onClick={grammar.retry} className="underline">다시 시도</button>
      </div>}

      <section className="mx-auto w-full max-w-xl rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-5">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <span className="material-symbols-outlined text-[24px] text-[#3b5bdb]">school</span>
          {t('studentPortal.todayLesson')}
        </h2>
        {soloClosed && <p className="text-base text-[#5b6580]">{t('studentPortal.featureClosed')}</p>}
        {!soloClosed && lessons.length === 0 && !grammarSolo.length && <p className="text-base text-[#5b6580]">{t('studentPortal.todayLessonEmpty')}</p>}
        <ul className="mt-3 flex flex-col gap-3">
          <GrammarPortalLinks rows={grammarSolo} />
          {lessons.map((l) => (
            <li key={l.id}>
              {l.id === firstOpenId && <div className="mb-1 text-base font-bold text-[#3b5bdb]">{t('studentPortal.todayPick')}</div>}
              <a
                href={`/s/lesson/${l.id}`}
                className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 ${l.done || l.path_waiting ? 'bg-white shadow-sm ring-1 ring-[#eadfc5] text-[#5b6580]' : 'bg-[#3b5bdb] text-white'}`}
              >
                <span className="material-symbols-outlined text-[28px]">{l.done ? 'task_alt' : l.path_waiting ? 'event' : 'play_circle'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xl font-bold">
                    {l.kind === 'homework' && <span className="mr-2 rounded-full bg-deep-navy/80 px-2 py-0.5 align-middle text-sm text-white">{t('studentPortal.homeworkTag')}</span>}
                    {l.name}
                  </span>
                  <span className="block text-sm opacity-75">
                    {l.path_waiting ? `${t('studentPortal.pathTodayComplete', { defaultValue: '오늘 학습 완료 · 다음 확인' })} ${l.path_due_at ? new Date(l.path_due_at).toLocaleDateString() : ''}` : l.learning_path && !l.done ? t('studentPortal.pathLearning', { defaultValue: '필요한 학습과 복습 확인을 이어가요' }) : l.done ? t('studentPortal.lessonDone') : l.progress > 0 ? t('studentPortal.lessonProgress', { progress: l.progress, total: l.total }) : t('studentPortal.lessonMinutes', { n: l.minutes })}
                  </span>
                </span>
                <span className="text-base font-bold">{l.path_waiting ? t('studentPortal.pathSchedule', { defaultValue: '일정 보기' }) : l.done ? t('studentPortal.again') : l.progress > 0 ? t('studentPortal.continue') : t('studentPortal.start')}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {savedToken() && <ReviewSection token={savedToken() as string} />}

      {savedToken() && !hwClosed && <WordMemoryPortalLinks token={savedToken() as string} />}

      {savedToken() && <StudentStampCalendar token={savedToken() as string} />}

      <section className="mx-auto w-full max-w-xl rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfc5] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <span className="material-symbols-outlined text-[24px] text-[#3b5bdb]">edit_note</span>
          {t('studentPortal.homework')}
        </h2>
        {hwClosed && <p className="text-base text-[#5b6580]">{t('studentPortal.featureClosed')}</p>}
        {!hwClosed && home.homework.length === 0 && adaptive.length === 0 && !grammarHomework.length && <p className="text-base text-[#5b6580]">{t('studentPortal.homeworkEmpty')}</p>}
        <ul className="flex flex-col gap-3">
          <GrammarPortalLinks rows={grammarHomework} />
          {adaptive.map(h=><li key={h.id}>
            <a href={`/s/homework/${h.id}`} className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 ${h.done||h.path_waiting?'bg-white shadow-sm ring-1 ring-[#eadfc5] text-[#5b6580]':'bg-[#3b5bdb] text-white'}`}>
              <span className="material-symbols-outlined text-[26px]" aria-hidden="true">{h.done?'task_alt':h.path_waiting?'event':'play_circle'}</span>
              <span className="min-w-0 flex-1"><span className="block break-words text-lg font-bold">{h.name}</span><span className="block text-sm opacity-80">{h.done?(en?'Planned reviews complete':'계획한 복습 확인 완료'):h.path_waiting?(en?'Today’s homework complete · Next check ':'오늘 숙제 완료 · 다음 확인 ')+(h.path_due_at?new Date(h.path_due_at).toLocaleDateString():''):h.path_first_completed?(en?'Review available':'복습 확인할 차례예요'):(en?'Learn and practise the words you need':'필요한 단어를 배우고 연습해요')}</span>
              {!h.path_first_completed&&h.due_at&&<span className="block text-sm opacity-80">{en?'Initial deadline: ':'첫 학습 기한: '}{new Date(h.due_at).toLocaleString(undefined,{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}</span>
              <span className="shrink-0 font-bold">{h.done?(en?'View':'보기'):h.path_waiting?t('studentPortal.pathSchedule',{defaultValue:'일정 보기'}):h.path_first_completed?(en?'Review':'복습하기'):t('studentPortal.start')}</span>
            </a>
          </li>)}
          {[...open, ...done].map((h) => (
            <li key={h.access}>
              <a
                href={`/hw/p/${h.access}`}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${h.done ? 'bg-white shadow-sm ring-1 ring-[#eadfc5] text-[#5b6580]' : 'bg-white text-deep-navy'}`}
              >
                <span className="material-symbols-outlined text-[26px]">{h.done ? 'task_alt' : 'play_circle'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{h.title || t('studentHw.defaultTitle')}</span>
                  {h.due_at && (
                    <span className="block text-sm opacity-70">
                      {t('studentHw.dueAt', { date: formatHomeworkDeadline(h.due_at) })}
                    </span>
                  )}
                </span>
                <span className="text-base font-bold">{h.done ? t('studentPortal.done') : t('studentPortal.start')}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
