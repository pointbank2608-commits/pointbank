import { builderParts, courseWord, type CourseSlide, type CourseUnit, type LessonGroup } from '../../data/phonicsLessons';
import type { PhonicsBankEntry } from '../../lib/types';
import { Stage1Picture, Stage1Speaker, Stage1Word } from './Stage1Art';

type Activity = 'builder' | 'choose' | 'sort' | 'read';

export function readyClassActivity(slide: CourseSlide): Activity | null {
  if (slide.kind === 'builder' || slide.kind === 'choose' || slide.kind === 'sort') return slide.kind;
  if (slide.kind === 'readAlone' || (slide.kind === 'memory' && slide.phase === 0)) return 'read';
  return null;
}

function sortBoardEntries(words: PhonicsBankEntry[], groups: LessonGroup[]) {
  const bins = groups.map(group => ({ label: group.label, id: group.id, words: words.filter(word => group.entries.some(entry => entry.id === word.id)) }));
  const rowCount = Math.max(0, ...bins.map(bin => bin.words.length));
  const interleaved = Array.from({ length: rowCount }, (_, row) => bins.flatMap(bin => bin.words.slice(row, row + 1))).flat();
  return { bins, mixed: [...interleaved.slice(1), ...interleaved.slice(0, 1)] };
}

function SortBoard({ words, groups, revealed }: {
  words: PhonicsBankEntry[];
  groups: LessonGroup[];
  revealed: boolean;
}) {
  const { bins, mixed } = sortBoardEntries(words, groups);

  return <>
    <div className="rc-activity-word-bank">{mixed.map(word => <span key={word.id}>{word.word}</span>)}</div>
    <div className="rc-activity-bins">
      {bins.map(bin => <section key={bin.id} data-rule={bin.label} className="rc-activity-bin">
        <h3>{bin.label}</h3>
        <div className="rc-activity-bin-words">{revealed && bin.words.map(word => <Stage1Word key={word.id} entry={word} />)}</div>
      </section>)}
    </div>
  </>;
}

function BlendBoard({ unit, word }: { unit: CourseUnit; word: PhonicsBankEntry }) {
  const parts = builderParts(word, unit.step);
  const group = unit.groups.find(group => group.entries.some(entry => entry.id === word.id));
  const isConsonantBlend = group && unit.step === 4 && group.ruleId.startsWith('blend-') && !['sh', 'ch', 'wh', 'ng'].includes(group.sound);
  const note = unit.step === 3 && group ? `Silent e · ${group.sound.replace('_', '…')}`
    : isConsonantBlend && group ? `${group.sound.split('').join(' + ')} → ${group.sound}` : null;
  let start = 0;
  const cards = parts.map(part => {
    const end = start + part.length;
    const marked = word.targets?.some(index => index >= start && index < end) ?? false;
    start = end;
    return { part, marked };
  });

  return <>
    <div className="rc-activity-equation" data-compact={parts.length > 2 || word.word.length > 4}>
      {cards.map(({ part, marked }, index) => <span className="rc-activity-equation-part" key={index}>
        {index > 0 && <span className="rc-activity-operator">+</span>}
        <span className="rc-activity-letter-card" data-builder-part={part} data-marked={marked}>{part}</span>
      </span>)}
      <span className="rc-activity-operator">→</span>
      <span className="rc-activity-letter-card rc-activity-result"><Stage1Word entry={word} /></span>
    </div>
    <div className="rc-blend-support">
      {unit.id !== 'course-2-1' && <Stage1Picture entry={word} />}
      <div className="rc-activity-blend-audio"><Stage1Speaker entry={word} /></div>
      {note && <p className="rc-blend-note">{note}</p>}
    </div>
  </>;
}

export default function ReadyClassActivity({ activity, slide, unit, words, groups }: {
  activity: Activity;
  slide: CourseSlide;
  unit: CourseUnit;
  words: PhonicsBankEntry[];
  groups: LessonGroup[];
}) {
  const revealed = slide.phase > 0;
  const title = activity === 'builder' ? 'Listen and Blend' : activity === 'read' ? 'Read on Your Own' : slide.title;
  const isMemory = slide.kind === 'memory';

  return <div className="rc-activity-board" data-ready-activity={activity}>
    <h2 className="rc-activity-heading">{title}</h2>
    {slide.hint && <p className="rc-activity-instruction">{slide.hint}</p>}
    {(activity === 'choose' || activity === 'sort') && <span className="pc-activity-guide rc-activity-guide" data-guide={activity} aria-hidden="true" />}

    {activity === 'builder' && <BlendBoard unit={unit} word={words[0]} />}

    {activity === 'choose' && <>
      <div className="rc-activity-listen-audio"><Stage1Speaker entry={courseWord(unit, slide.answerIds[0])} /></div>
      <div className="rc-activity-choices">
        {words.map(word => <div className={`rc-activity-choice${revealed && slide.answerIds.includes(word.id) ? ' pc-answer' : ''}`} key={word.id} data-entry={word.id}>
          <Stage1Picture entry={word} />
          {revealed && <div className="rc-activity-choice-label"><Stage1Word entry={word} /><Stage1Speaker entry={word} /></div>}
        </div>)}
      </div>
    </>}

    {activity === 'sort' && <SortBoard words={words} groups={groups} revealed={revealed} />}

    {activity === 'read' && <div className={`rc-activity-independent${isMemory ? ' pc-memory' : ''}`} data-multiple={words.length > 1} data-game-phase={isMemory ? slide.phase : undefined}>
      {words.map(word => <span key={word.id}>{word.word}</span>)}
    </div>}
  </div>;
}
