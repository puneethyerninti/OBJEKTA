import React, { useEffect, useRef, useState } from "react";

const getCharsPerSecond = (textLength) => {
  if (textLength > 420) return 80;
  if (textLength > 240) return 60;
  if (textLength > 120) return 42;
  return 32;
};

export default function TypewriterText({
  text,
  render,
  className,
  active = true,
  reducedMotion = false,
  onDone,
}) {
  const fullText = typeof text === "string" ? text : String(text ?? "");
  const [visible, setVisible] = useState(() => (active && !reducedMotion ? "" : fullText));
  const rafRef = useRef(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active || reducedMotion) {
      setVisible(fullText);
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
      return undefined;
    }

    doneRef.current = false;
    setVisible("");
    const charsPerSecond = getCharsPerSecond(fullText.length);
    let start = null;

    const step = (timestamp) => {
      if (start == null) start = timestamp;
      const elapsed = timestamp - start;
      const nextLen = Math.min(fullText.length, Math.floor((elapsed * charsPerSecond) / 1000));
      setVisible((prev) => (prev.length === nextLen ? prev : fullText.slice(0, nextLen)));
      if (nextLen < fullText.length) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      doneRef.current = true;
      onDoneRef.current?.();
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, fullText, reducedMotion]);

  const isTyping = active && !reducedMotion && visible.length < fullText.length;
  const classes = [className, isTyping ? `${className}--active` : ""].filter(Boolean).join(" ");

  return <span className={classes}>{render ? render(visible) : visible}</span>;
}
