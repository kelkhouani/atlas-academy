import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Volume2 } from 'lucide-react';
import MatchingPairs from './MatchingPairs';
import './LessonView.css';

// ─── Audio helper ─────────────────────────────────────────────────────────────
function playAudio(slug) {
  if (!slug) return;
  const filename = slug.endsWith('.mp3') ? slug : `${slug}.mp3`;
  const audio = new Audio(`/audio/${filename}`);
  audio.play().catch(() => {});
}

// ─── Speaker button ───────────────────────────────────────────────────────────
function SpeakerButton({ slug }) {
  if (!slug) return null;
  return (
    <button
      className="speaker-btn"
      onClick={() => playAudio(slug)}
      aria-label="Hoor de uitspraak"
      title="Hoor de uitspraak"
    >
      <Volume2 size={20} />
    </button>
  );
}

// ─── Parse prompt — renders Image_Tag tokens as <img> elements ────────────────
function parsePrompt(text) {
  if (!text) return text;
  const parts = text.split(/(Image_Tag:\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('Image_Tag:')) {
      const filename = part.replace('Image_Tag:', '');
      return (
        <img
          key={i}
          className="prompt-image"
          src={`/images/${filename}`}
          alt={filename.replace(/\.[^.]+$/, '')}
        />
      );
    }
    return part;
  });
}

// ─── LessonView ───────────────────────────────────────────────────────────────
export default function LessonView({
  currentLessonSet,
  currentIndex,
  hearts,
  isCorrect,
  isFinished,
  correctAnswerToShow,
  selectedOption,
  selectedWords,
  typedAnswer,
  onExit,
  onCheck,
  onNext,
  onSelectOption,
  onAddWord,
  onRemoveWord,
  onTypeAnswer,
  onWrong,
}) {
  const currentLesson = currentLessonSet?.[currentIndex];
  const isTypeAnswer  = currentLesson?.Type === 'type-answer';
  const isMatch       = currentLesson?.Type === 'match';
  const hasAnswer     = selectedOption || selectedWords.length > 0 || (isTypeAnswer && typedAnswer?.trim().length > 0);
  const noLessons     = !currentLessonSet || currentLessonSet.length === 0;

  // ── Global Enter handler — must be at top, before any early returns ────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Enter') return;
      if (noLessons || isFinished) return;
      if (hearts === 0)           { onExit(); return; }
      if (isCorrect !== null)     { onNext(); return; }
      if (!isTypeAnswer && !isMatch && hasAnswer) onCheck();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [noLessons, isFinished, hearts, isCorrect, isTypeAnswer, isMatch, hasAnswer, onExit, onNext, onCheck]);

  // ── Auto-focus input + Enter to check (type-answer only) ──────────────────
  const inputRef = useRef(null);
  useEffect(() => {
    if (!isTypeAnswer) return;
    const handler = (e) => {
      if (!inputRef.current) return;
      if (e.key === 'Enter') return; // handled by global handler above
      if (document.activeElement === inputRef.current) return;
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        inputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTypeAnswer]);

  // ── Early returns after all hooks ──────────────────────────────────────────
  if (noLessons) return null;

  if (hearts === 0) {
    return (
      <div className="lesson-screen-center">
        <img src="/lion-crying.png" alt="Atlas Lion" className="lesson-complete__lion" />
        <h1 className="lesson-complete__title">Oeps! 💔</h1>
        <button className="lesson-back-btn" onClick={onExit}>TERUG</button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="lesson-screen-center">
        <img src="/lion.png" alt="Atlas Lion" className="lesson-complete__lion" />
        <h1 className="lesson-complete__title">Mabrouk! 🎉</h1>
      </div>
    );
  }

  // ── Active lesson ──────────────────────────────────────────────────────────
  return (
    <div className="app-container lesson-view">

      {/* Progress bar + hearts */}
      <div className="lesson-progress">
        <X className="lesson-progress__exit" onClick={onExit} color="#afafaf" size={32} />
        <div className="lesson-progress__track">
          <motion.div
            className="lesson-progress__fill"
            animate={{ width: `${(currentIndex / currentLessonSet.length) * 100}%` }}
          />
        </div>
        <div className="lesson-progress__hearts">❤️ {hearts}</div>
      </div>

      {/* Question area */}
      <div className="lesson-question">

        {/* Prompt + speaker */}
        <div className="lesson-question__prompt-row">
          <h2 className="lesson-question__prompt">
            {currentLesson?.Type === 'translate'
              ? 'Vertaal deze zin:'
              : currentLesson?.Type === 'image-choice'
              ? (currentLesson?.Prompt_NL || 'Wat zie je?')
              : currentLesson?.Type === 'type-answer'
              ? (currentLesson?.Prompt_NL || 'Typ het antwoord:')
              : parsePrompt(currentLesson?.Prompt_NL)}
          </h2>
          <SpeakerButton slug={currentLesson?.Audio_Slug} />
        </div>

        {/* Type-answer — word to translate */}
        {isTypeAnswer && currentLesson?.Prompt_ZGH && (
          <div className="lesson-translate-source">
            {currentLesson.Prompt_ZGH}
          </div>
        )}

        {/* Image for image-choice exercises */}
        {currentLesson?.Type === 'image-choice' && currentLesson?.Image_Slug && (
          <div className="exercise-image-container">
            <img
              src={`/images/${currentLesson.Image_Slug}`}
              alt="Wat zie je?"
              className="exercise-image"
            />
          </div>
        )}

        {/* Matching pairs exercise */}
        {isMatch && (
          <MatchingPairs
            pairs={(currentLesson.Options || []).map(opt => {
              const [tarifit, dutch] = opt.split(':');
              return { tarifit: tarifit?.trim(), dutch: dutch?.trim() };
            })}
            onComplete={onNext}
            onWrong={onWrong}
          />
        )}

        {/* Translate — ZGH source sentence */}
        {currentLesson?.Type === 'translate' && (
          <div className="lesson-translate-source">
            {parsePrompt(currentLesson?.Prompt_ZGH)}
          </div>
        )}

        {/* Translate — answer drop area */}
        {currentLesson?.Type === 'translate' && (
          <div className="lesson-answer-area">
            {selectedWords.map((word, i) => (
              <button key={i} className="lesson-answer-word" onClick={() => onRemoveWord(i)}>
                {word}
              </button>
            ))}
          </div>
        )}

        {/* Type-answer — text input */}
        {isTypeAnswer && (
          <input
            ref={inputRef}
            className={`type-answer-input${isCorrect === true ? ' type-answer-input--correct' : isCorrect === false ? ' type-answer-input--wrong' : ''}`}
            type="text"
            placeholder="Typ hier je antwoord..."
            value={typedAnswer || ''}
            onChange={e => onTypeAnswer(e.target.value)}
            disabled={isCorrect !== null}
            autoFocus
          />
        )}

        {/* Options grid — hidden for type-answer and match */}
        {!isTypeAnswer && !isMatch && (
          <div className="lesson-options">
            {currentLesson?.Options.map((opt, i) => {
              const isUsed     = currentLesson.Type === 'translate' && selectedWords.includes(opt);
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={i}
                  disabled={isUsed || isCorrect !== null}
                  onClick={() => currentLesson.Type === 'translate' ? onAddWord(opt) : onSelectOption(opt)}
                  className={`lesson-option${isSelected ? ' lesson-option--selected' : ''}${isUsed ? ' lesson-option--used' : ''}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback bar */}
        <AnimatePresence>
          {isCorrect !== null && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className={`lesson-feedback${isCorrect ? ' lesson-feedback--correct' : ' lesson-feedback--wrong'}`}
            >
              <div className="lesson-feedback__inner">
                <img
                  src={isCorrect ? '/lion-head.png' : '/lion-sad.png'}
                  alt=""
                  className="lesson-feedback__lion"
                />
                <div className="lesson-feedback__text">
                  <span className={`lesson-feedback__label${isCorrect ? ' lesson-feedback__label--correct' : ' lesson-feedback__label--wrong'}`}>
                    {isCorrect ? 'Goed gedaan!' : 'Oeps!'}
                  </span>
                  {!isCorrect && correctAnswerToShow && (
                    <span className="lesson-feedback__hint">
                      Juist antwoord: <strong>{correctAnswerToShow}</strong>
                    </span>
                  )}
                </div>
                <button
                  className={`lesson-feedback__next-btn${isCorrect ? ' lesson-feedback__next-btn--correct' : ' lesson-feedback__next-btn--wrong'}`}
                  onClick={onNext}
                >
                  VOLGENDE
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Check button — hidden for match type */}
        {isCorrect === null && !isMatch && (
          <button
            disabled={!hasAnswer}
            onClick={onCheck}
            className={`lesson-check-btn${hasAnswer ? ' lesson-check-btn--active' : ' lesson-check-btn--inactive'}`}
          >
            CONTROLEER
          </button>
        )}

      </div>
    </div>
  );
}
