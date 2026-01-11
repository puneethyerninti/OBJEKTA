// /hooks/useHackerText.js
import { useState, useEffect, useRef } from 'react';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';

export default function useHackerText(targetText) {
  const [text, setText] = useState('');
  const rafRef = useRef();
  
  useEffect(() => {
    let currentIteration = 0;
    const textLength = targetText.length;

    const animate = () => {
      const newText = targetText
        .split('')
        .map((char, index) => {
          if (index < currentIteration) {
            return targetText[index];
          }
          if (char === ' ') return ' ';
          return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        })
        .join('');

      setText(newText);

      if (currentIteration < textLength) {
        currentIteration += textLength / 45; // Speed control
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setText(targetText); // Ensure final text is set
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [targetText]);

  return text;
}