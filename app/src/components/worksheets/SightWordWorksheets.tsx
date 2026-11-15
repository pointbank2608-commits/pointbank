import { useState } from 'react';
import { SIGHT_WORDS, SIGHT_WORD_REVIEWS } from '../../data/sightWords';
import '../../styles/ready-class-workbook.css';
import '../../styles/sight-word-worksheets.css';

const andGrid = 'I see and can it the and is in a on my you we see can it the and in'.split(' ');
const familiar = 'I see can it the is in a on my you we'.split(' ');

function findGrid(word: string) {
  if (word === 'and') return andGrid;
  const others = familiar.filter(item => item !== word);
  const offset = SIGHT_WORDS.indexOf(word);
  return Array.from({ length: 20 }, (_, i) =>
    [2, 6, 18].map(position => (position + offset) % 20).includes(i)
      ? word : others[(i + offset) % others.length],
  );
}

function Picture({ word }: { word: string }) {
  return <img src={`/word-bank-images/${word}.webp`} alt={word} />;
}

function WritingLine({ word }: { word?: string }) {
  return <div className="sw-writing-line">
    {word && Array.from({ length: 3 }, (_, i) => <span key={i}>{word}</span>)}
  </div>;
}

function SingleWord({ word }: { word: string }) {
  return <article className="rc-sheet sw-sheet sw-single" lang="en">
    <header className="sw-banner">
      <h1>High-Frequency Word:</h1>
      <div className="sw-badge"><span aria-hidden="true">♥</span><strong>{word}</strong></div>
    </header>
    <div className="sw-content">
      <div className="sw-intro">
        <section><h2>Say the word.</h2><div className="sw-big-word">{word}</div></section>
        <section><h2>Read the word three times. Color a heart each time.</h2>
          <div className="sw-hearts" aria-hidden="true"><span>♡</span><span>♡</span><span>♡</span></div>
        </section>
      </div>
      <section><h2>Read the words. Find and circle the word “{word}”.</h2>
        <table className="sw-find"><tbody>{[0, 1, 2, 3].map(row =>
          <tr key={row}>{findGrid(word).slice(row * 5, row * 5 + 5).map((item, i) => <td key={i}>{item}</td>)}</tr>,
        )}</tbody></table>
      </section>
      <section><h2>Trace and write the word.</h2><div className="sw-word-writing"><WritingLine word={word}/><WritingLine/></div></section>
    </div>
  </article>;
}

function Review({ review }: { review: typeof SIGHT_WORD_REVIEWS[number] }) {
  const first = review.id === '01';
  const distractors = ['cat', 'see', 'pig', 'I', 'a', 'dog'].filter(item => !review.words.includes(item)).slice(0, 3);
  const find = first ? ['cat', 'see', 'pig', 'I', 'a', 'dog'] :
    [distractors[0], review.words[1], distractors[1], review.words[0], review.words[2], distractors[2]];
  return <article className="rc-sheet sw-sheet sw-review" lang="en">
    <header className="sw-banner"><h1>Sight Word Review {review.id}</h1></header>
    <div className="sw-content">
      <section><h2>Read the words.</h2><div className="sw-review-cards">{review.words.map(word => <strong key={word}>{word}</strong>)}</div></section>
      <section><h2>Find and circle the three words.</h2><p className="sw-find-line">{find.join(' · ')}</p></section>
      <section><h2>Read the sentences.</h2>
        {review.sentences.map((sentence, index) => <div className="sw-sentence" key={sentence}>
          <p>{sentence.split(/([A-Za-z]+)/).map((part, i) => review.words.some(word => word.toLowerCase() === part.toLowerCase())
            ? <strong key={i}>{part}</strong> : part)}</p>
          <Picture word={review.practicePictures[index]}/>
        </div>)}
      </section>
      <section><h2>Read and circle the picture.</h2><p className="sw-check">{review.check}</p>
        <div className="sw-picture-choices">{review.choices.map(word => <Picture key={word} word={word}/>)}</div>
      </section>
      <section><h2>Write the sentence.</h2><WritingLine/></section>
    </div>
  </article>;
}

export default function SightWordWorksheets() {
  const [mode, setMode] = useState<'word' | 'review'>('word');
  const [word, setWord] = useState('and');
  const [reviewId, setReviewId] = useState('01');
  const review = SIGHT_WORD_REVIEWS.find(item => item.id === reviewId)!;
  return <section className="rc-workbook">
    <div className="no-print">
      <h2 className="text-2xl font-bold">사이트워드</h2>
      <div className="rc-controls mt-3">
        <button type="button" aria-pressed={mode === 'word'} onClick={() => setMode('word')}>한 단어 연습</button>
        <button type="button" aria-pressed={mode === 'review'} onClick={() => setMode('review')}>3단어 문장 리뷰</button>
        {mode === 'word' ? <label>단어 <select value={word} onChange={event => setWord(event.target.value)}>
          {SIGHT_WORDS.map(item => <option key={item}>{item}</option>)}
        </select></label> : <label>리뷰 세트 <select value={reviewId} onChange={event => setReviewId(event.target.value)}>
          {SIGHT_WORD_REVIEWS.map(item => <option key={item.id} value={item.id}>{item.id} · {item.words.join(' · ')}</option>)}
        </select></label>}
        <button type="button" data-print onClick={() => window.print()}>인쇄</button>
      </div>
    </div>
    <div className="rc-preview">{mode === 'word' ? <SingleWord word={word}/> : <Review review={review}/>}</div>
  </section>;
}
