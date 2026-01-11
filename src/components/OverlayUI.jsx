import React, { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to animate text with a character scrambling effect.
 */
const useHackerText = (text, speed = 1 / 2.5, initialDelay = 0) => {
    const [animatedText, setAnimatedText] = useState(text);
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        let iteration = 0;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:'\",.<>/?`~";
        
        const runAnimation = () => {
            setAnimatedText(prevText => 
                text
                    .split("")
                    .map((char, index) => {
                        if (index < iteration) {
                            return text[index];
                        }
                        return alphabet[Math.floor(Math.random() * alphabet.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                clearInterval(intervalRef.current);
            }
            iteration += speed;
        };

        const startAnimation = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            iteration = 0;
            intervalRef.current = setInterval(runAnimation, 30);
        }

        if (initialDelay > 0) {
            timeoutRef.current = setTimeout(startAnimation, initialDelay);
        } else {
            startAnimation();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [text, speed, initialDelay]);

    return animatedText;
};

// --- COMPONENT: HackerText ---
const HackerText = ({ text, colorVar = '--neon-blue', speed, delay }) => {
    const animatedText = useHackerText(text, speed, delay);
    return (
        <h1 className="neon-text flicker-anim" style={{ 
            fontSize: '2rem', 
            margin: 0,
            color: `var(${colorVar})`,
            textShadow: `var(${colorVar}-shadow)` 
        }}>
            {animatedText}
        </h1>
    );
};

// --- COMPONENT: OverlayUI ---
export default function OverlayUI() {
    return (
        <>
            <div className="overlay-ui">
                {/* Top-Left Status */}
                <div style={{ position: 'absolute', top: '40px', left: '40px' }}>
                    <HackerText text="ENCOM: LEGACY" colorVar="--neon-blue" delay={0} />
                </div>

                {/* Bottom-Right Status */}
                <div style={{ position: 'absolute', bottom: '40px', right: '40px', textAlign: 'right' }}>
                    <h3 className="neon-text" style={{ 
                        fontSize: '1.5rem', 
                        margin: '0 0 5px 0', 
                        color: 'var(--neon-orange)',
                        textShadow: 'var(--neon-orange-shadow)'
                    }}>
                        GRID STATUS: OPTIMAL
                    </h3>
                    <p className="neon-text flicker-anim" style={{ 
                        color: 'var(--neon-blue)', 
                        textShadow: 'var(--neon-blue-shadow)',
                        margin: 0 
                    }}>
                        CONNECTION: SECURE
                    </p>
                </div>

                {/* Bottom-Left HUD ring (CSS-only, very cheap) */}
                <div style={{ position: 'absolute', left: '40px', bottom: '40px' }}>
                    <div style={{
                        width: 84, height: 84, borderRadius: '50%', position: 'relative',
                        boxShadow: 'inset 0 0 0 2px rgba(96,165,250,0.35)'
                    }}>
                        <div style={{
                            content: '""', position: 'absolute', inset: -6, borderRadius: '50%',
                            background: 'conic-gradient(from 180deg, rgba(96,165,250,.5), rgba(244,114,182,.5), transparent 40%, rgba(96,165,250,.5))',
                            filter: 'blur(6px)', animation: 'spin 8s linear infinite'
                        }} />
                    </div>
                </div>
            </div>

            {/* STYLES REMOVED: 
                Please move the <style> block from your old OverlayUI.jsx
                into your main index.css file for better performance 
                and code organization.
            */}
        </>
    );  
}