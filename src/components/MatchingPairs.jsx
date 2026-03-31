import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './MatchingPairs.css';

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── MatchingPairs ────────────────────────────────────────────────────────────
// Expects `pairs` as an array of { tarifit, dutch } objects
// Calls onComplete() when all pairs are matched
export default function MatchingPairs({ pairs, onComplete, onWrong }) {
  const [leftItems, setLeftItems]   = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft]   = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matched, setMatched]   = useState([]); // array of matched tarifit keys
  const [wrongPair, setWrongPair] = useState(null); // { left, right } briefly highlighted red

  // Initialise shuffled columns from pairs
  useEffect(() => {
    setLeftItems(shuffle(pairs.map(p => p.tarifit)));
    setRightItems(shuffle(pairs.map(p => p.dutch)));
    setMatched([]);
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongPair(null);
  }, [pairs]);

  // Check for a match whenever both sides are selected
  useEffect(() => {
    if (selectedLeft === null || selectedRight === null) return;

    const correctPair = pairs.find(p => p.tarifit === selectedLeft);
    if (correctPair && correctPair.dutch === selectedRight) {
      // Correct match
      const newMatched = [...matched, selectedLeft];
      setMatched(newMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      if (newMatched.length === pairs.length) {
        setTimeout(onComplete, 600);
      }
    } else {
      // Wrong — flash red briefly then reset selection
      setWrongPair({ left: selectedLeft, right: selectedRight });
      onWrong?.();
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 700);
    }
  }, [selectedLeft, selectedRight]);

  const getLeftState = (item) => {
    const key = item;
    if (matched.includes(key)) return 'matched';
    if (wrongPair?.left === key) return 'wrong';
    if (selectedLeft === key) return 'selected';
    return 'idle';
  };

  const getRightState = (item) => {
    // Find the tarifit key for this dutch word
    const pair = pairs.find(p => p.dutch === item);
    const key = pair?.tarifit;
    if (matched.includes(key)) return 'matched';
    if (wrongPair?.right === item) return 'wrong';
    if (selectedRight === item) return 'selected';
    return 'idle';
  };

  return (
    <div className="matching-pairs">
      <div className="matching-pairs__columns">

        {/* Left column — Tarifit */}
        <div className="matching-pairs__col">
          {leftItems.map(item => {
            const state = getLeftState(item);
            return (
              <button
                key={item}
                className={`matching-pairs__btn matching-pairs__btn--${state}`}
                disabled={state === 'matched'}
                onClick={() => {
                  if (state === 'matched' || wrongPair) return;
                  setSelectedLeft(selectedLeft === item ? null : item);
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Right column — Dutch */}
        <div className="matching-pairs__col">
          {rightItems.map(item => {
            const state = getRightState(item);
            return (
              <button
                key={item}
                className={`matching-pairs__btn matching-pairs__btn--${state}`}
                disabled={state === 'matched'}
                onClick={() => {
                  if (state === 'matched' || wrongPair) return;
                  setSelectedRight(selectedRight === item ? null : item);
                }}
              >
                {item}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
