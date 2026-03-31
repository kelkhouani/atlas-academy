import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CheckCircle, Trophy } from 'lucide-react';
import './LessonMap.css';

// ─── Lion paw SVG icon ────────────────────────────────────────────────────────
function PawIcon({ size = 26, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill={color}>
      {/* Central pad */}
      <ellipse cx="16" cy="21.5" rx="7" ry="5.5" />
      {/* Outer left toe */}
      <ellipse cx="7"    cy="14.5" rx="2.7" ry="3.4" transform="rotate(-20 7 14.5)" />
      {/* Inner left toe */}
      <ellipse cx="11.5" cy="10.5" rx="2.7" ry="3.4" transform="rotate(-7 11.5 10.5)" />
      {/* Inner right toe */}
      <ellipse cx="20.5" cy="10.5" rx="2.7" ry="3.4" transform="rotate(7 20.5 10.5)" />
      {/* Outer right toe */}
      <ellipse cx="25"   cy="14.5" rx="2.7" ry="3.4" transform="rotate(20 25 14.5)" />
    </svg>
  );
}

// ─── Continuous dashed path connecting all nodes in a unit ───────────────────
function MapPath({ nodes, innerWidth }) {
  const NODES_PADDING_TOP = 16;
  const ROW_PADDING_TOP   = 6;
  const BADGE_H           = 24;
  const BADGE_GAP         = 5;
  const centerX           = innerWidth / 2;

  const points = nodes.map(({ offset, sub }, idx) => {
    const nodeSize = sub.isFinal ? 78 : 68;
    const y = NODES_PADDING_TOP + idx * ROW_H + ROW_PADDING_TOP + BADGE_H + BADGE_GAP + nodeSize / 2;
    return { x: centerX + offset, y };
  });

  const totalH = NODES_PADDING_TOP + nodes.length * ROW_H;
  // Catmull-Rom → cubic bezier: tangents are shared across segments so the
  // whole path flows as one continuous smooth curve, not separate pieces.
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = p;
    const p3 = points[Math.min(points.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }, '');

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
      width={innerWidth}
      height={totalH}
    >
      <path
        d={d}
        fill="none"
        stroke="rgba(168, 104, 64, 0.4)"
        strokeWidth="5"
        strokeDasharray="10 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Responsive window width hook ────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return width;
}

// ─── Zigzag offsets: tighter on small phones, wider on larger screens ─────────
function getOffsets(windowWidth) {
  if (windowWidth < 400)  return [55,  85,  55,  0, -55,  -85, -55,  0];
  if (windowWidth < 600)  return [80, 115,  80,  0, -80, -115, -80,  0];
  return                         [100, 150, 100,  0, -100, -150, -100, 0];
}

const ROW_H = 150;

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ data, onClose, onStart }) {
  if (!data) return null;

  // nodeX:          viewport X of node centre (arrow aim)
  // nodeRelBottom:  node bottom relative to container top (correct for position:absolute)
  // containerLeft:  viewport X of the container's left edge (corrects horizontal offset)
  const { nodeX, nodeRelBottom, containerLeft, unit, sub, isLocked, isAvailable, isDone } = data;

  const vw = window.innerWidth;

  // Card width — never wider than viewport minus 16px gutter each side
  const cardW = Math.min(280, vw - 32);

  // Center the card in the viewport, then subtract the container's own left
  // offset so the absolute `left` value is correct relative to the container.
  const leftInViewport = (vw - cardW) / 2;
  const left = leftInViewport - containerLeft;

  // Arrow tip targets the node centre (in card-relative coords)
  const arrowCentreFromLeft = nodeX - leftInViewport;
  const arrowLeft = Math.max(16, Math.min(arrowCentreFromLeft - 11, cardW - 38));

  // 6px clears the node's drop-shadow, +14px gives a comfortable visual gap
  const GAP = 20;

  return (
    <>
      {/* Tap-outside overlay — fixed so it always covers the full screen */}
      <div className="tooltip-overlay" onClick={onClose} />

      <motion.div
        key="tooltip"
        className="tooltip-card"
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        style={{
          /* left, top, width stay inline — JS-calculated for centering & positioning */
          left,
          top: nodeRelBottom + GAP,
          width: cardW,
        }}
      >
        {/* Unit label */}
        <div className="tooltip-card__unit-label">
          Unit {unit.id} · {unit.name}
        </div>

        {/* Sub-unit name */}
        <div className="tooltip-card__sub-name">
          {sub.name}
        </div>

        {/* Locked */}
        {isLocked && (
          <div className="tooltip-card__locked">
            <Lock size={15} color="#ccc" />
            Vergrendeld — voltooi eerst de vorige les
          </div>
        )}

        {/* Available — start */}
        {isAvailable && (
          <button
            className="tooltip-card__btn tooltip-card__btn--start"
            onClick={() => { onClose(); onStart(unit.id, sub.id); }}
          >
            <Star size={16} color="white" fill="white" />
            START · +50 XP
          </button>
        )}

        {/* Completed — practice */}
        {isDone && !isAvailable && (
          <button
            className="tooltip-card__btn tooltip-card__btn--repeat"
            onClick={() => { onClose(); onStart(unit.id, sub.id); }}
          >
            <CheckCircle size={16} color="var(--zgh-green)" />
            HERHALEN · +25 XP
          </button>
        )}

        {/* Arrow always points UP toward the node — left stays inline (JS-calculated) */}
        <div className="tooltip-arrow"      style={{ left: arrowLeft }} />
        <div className="tooltip-arrow__fill" style={{ left: arrowLeft + 2 }} />
      </motion.div>
    </>
  );
}

// ─── LessonMap ────────────────────────────────────────────────────────────────
export default function LessonMap({ units, completedSubUnits, onStartLesson }) {
  const windowWidth = useWindowWidth();
  const OFFSETS = getOffsets(windowWidth);
  const containerRef = useRef(null);

  const [tooltip, setTooltip] = useState(null);

  // Pre-compute section data outside JSX
  let counter = 0;
  const sections = units.map((unit, unitIdx) => {
    const prev = units[unitIdx - 1];
    const isUnitLocked = prev
      ? !prev.subUnits.every(s => completedSubUnits.includes(`${prev.id}-${s.id}`))
      : false;

    const nodes = unit.subUnits.map((sub, subIdx) => {
      const isDone = completedSubUnits.includes(`${unit.id}-${sub.id}`);
      const prevDone = subIdx === 0
        ? !isUnitLocked
        : completedSubUnits.includes(`${unit.id}-${unit.subUnits[subIdx - 1].id}`);
      return {
        sub, subIdx,
        offset: OFFSETS[counter++ % OFFSETS.length],
        isDone,
        prevDone,
        isLocked: isUnitLocked || !prevDone,
        isAvailable: !isUnitLocked && prevDone && !isDone,
      };
    });

    return { unit, isUnitLocked, nodes };
  });

  const openTooltip = (e, unit, sub, isLocked, isAvailable, isDone) => {
    const rect          = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setTooltip({
      nodeX:         rect.left + rect.width / 2,         // viewport X — for arrow aim
      nodeRelBottom: rect.bottom - containerRect.top,     // relative to container top
      containerLeft: containerRect.left,                  // container's viewport left offset
      unit, sub, isLocked, isAvailable, isDone,
    });
  };

  return (
    /*
      position:relative anchors the absolutely-positioned tooltip so it
      scrolls naturally with the map.
      Padding and maxWidth are JS-responsive values — stay inline.
    */
    <div
      ref={containerRef}
      className="lesson-map"
      style={{
        maxWidth: windowWidth >= 640 ? '640px' : '100%',
        padding: windowWidth >= 640 ? '8px 32px 140px' : '8px 16px 140px',
      }}
    >
      <AnimatePresence>
        {tooltip && (
          <Tooltip
            key="tt"
            data={tooltip}
            onClose={() => setTooltip(null)}
            onStart={onStartLesson}
          />
        )}
      </AnimatePresence>

      {sections.map(({ unit, isUnitLocked, nodes }, sectionIdx) => (
        <section key={unit.id}>

          {/* ── Unit banner ── */}
          <div className={`unit-banner${isUnitLocked ? ' unit-banner--locked' : ''}${sectionIdx === 0 ? ' unit-banner--first' : ''}`}>
            <div>
              <div className="unit-banner__eyebrow">Unit {unit.id}</div>
              <div className="unit-banner__name">{unit.name}</div>
            </div>
            {!isUnitLocked && (
              <button className="unit-banner__guide-btn">GIDS</button>
            )}
          </div>

          {/* ── Nodes ── */}
          <div className="map-nodes">

            {/* Single continuous dashed path behind all nodes */}
            <MapPath nodes={nodes} innerWidth={Math.min(windowWidth, 640) - (windowWidth >= 640 ? 64 : 32)} />

            {nodes.map(({ sub, offset, isDone, isLocked, isAvailable }) => {
              const size        = sub.isFinal ? 78 : 68;
              const bgColor     = isLocked ? '#D8CEC8' : isDone ? '#82C46A' : sub.isFinal ? '#F0C840' : '#D4956A';
              const shadowColor = isLocked ? '#B0A49C' : isDone ? '#58A044' : sub.isFinal ? '#C09A18' : '#A86840';

              return (
                <div key={sub.id} className="map-node-row" style={{ height: ROW_H }}>
                  <div className="map-node-wrapper" style={{ transform: `translateX(${offset}px)` }}>

                    {/* START bounce badge or invisible spacer */}
                    {isAvailable ? (
                      <motion.div
                        className="start-badge"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      >
                        START
                      </motion.div>
                    ) : (
                      <div className="start-badge--spacer" />
                    )}

                    {/* Node circle — size/color/shadow stay inline */}
                    <motion.button
                      whileTap={{ scale: 0.92, y: 4 }}
                      onClick={(e) => openTooltip(e, unit, sub, isLocked, isAvailable, isDone)}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        backgroundColor: bgColor,
                        border: 'none',
                        boxShadow: `0 6px 0 ${shadowColor}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {isLocked                              && <Lock    size={24} color="#aaa" />}
                      {!isLocked && isDone && sub.isFinal    && <Trophy  size={32} color="white" />}
                      {!isLocked && isDone && !sub.isFinal   && <PawIcon size={36} color="white" />}
                      {!isLocked && !isDone && sub.isFinal   && <Trophy  size={32} color="white" />}
                      {!isLocked && !isDone && !sub.isFinal  && <PawIcon size={36} color="white" />}
                    </motion.button>

                  </div>
                </div>
              );
            })}
          </div>

        </section>
      ))}
    </div>
  );
}
