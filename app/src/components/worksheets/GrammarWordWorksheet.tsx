import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { grammarWordQuestions, type GrammarWordSelection } from '../../lib/grammarCoreWords';
import '../../i18n/grammarLessonLocales';
import './grammar-word-worksheet.css';

function pagesOf<T>(items: T[], count: number) {
  return Array.from({ length: Math.ceil(items.length / count) }, (_, index) => items.slice(index * count, (index + 1) * count));
}

export default function GrammarWordWorksheet({ selection }: { selection: GrammarWordSelection }) {
  const { t } = useTranslation();
  const [printing, setPrinting] = useState(false);
  const questions = grammarWordQuestions(selection, 'worksheet');
  const sheets = pagesOf(questions, 10);
  const title = t('grammarLesson.coreSheet');

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  function studentPages() {
    return sheets.map((rows, page) => (
      <article className="grammar-word-print-page" key={page}>
        <header className="mb-4 border-b-2 pb-3">
          <h2 className="text-xl font-bold">{title} · {page + 1}/{sheets.length}</h2>
          <p>{selection.topic}</p>
        </header>
        <p className="mb-2">{t('grammarLesson.coreSheetHelp')}</p>
        <ol start={page * 10 + 1} className="list-decimal space-y-3 pl-7">
          {rows.map(question => <li key={question.id} className="py-1" lang="en">{question.q.replace('___', '____________________')}</li>)}
        </ol>
        {page === sheets.length - 1 && <div className="mt-6">
          <p className="font-bold">{t('grammarLesson.coreTransfer')}</p>
          <div className="mt-5 border-b border-slate-400" />
          <div className="mt-5 border-b border-slate-400" />
        </div>}
      </article>
    ));
  }

  function answerPages() {
    return pagesOf(questions, 20).map((rows, page) => (
      <article className="grammar-word-print-page" key={page}>
        <h2 className="mb-4 border-b-2 pb-3 text-xl font-bold">{t('grammarLesson.coreKey')} · {selection.topic}</h2>
        <ol start={page * 20 + 1} className="list-decimal space-y-2 pl-7">
          {rows.map(question => <li key={question.id} lang="en">{question.a.replaceAll('/', ' / ')}</li>)}
        </ol>
      </article>
    ));
  }

  return <section className="mx-auto w-full max-w-3xl space-y-3 px-3 py-4 text-deep-navy">
    <button type="button" disabled={printing} onClick={() => setPrinting(true)} className="min-h-11 rounded-full bg-primary px-5 font-bold text-white">
      {t('grammarLesson.corePrint')}
    </button>
    <div className="grammar-word-preview space-y-4">{studentPages()}</div>
    <details><summary className="cursor-pointer font-bold">{t('grammarLesson.coreKey')}</summary>{answerPages()}</details>
    {printing && createPortal(<div className="grammar-word-print" aria-hidden="true">{studentPages()}{answerPages()}</div>, document.body)}
  </section>;
}
