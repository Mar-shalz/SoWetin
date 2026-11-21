'use client';

import { useEffect } from 'react';

// Some phones shrink the page when the keyboard opens, which lifts the bottom bar above the keyboard.
// This sets --kb to the lost height so the bar is pushed back down and the keyboard covers it.
// Where the page does not shrink (iOS, or overlays-content), the height never changes and --kb stays 0. Renders nothing.
const KEYBOARD_MIN_PX = 120;

export function KeyboardGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let base = window.innerHeight;
    const update = () => {
      const lost = base - window.innerHeight;
      if (lost > KEYBOARD_MIN_PX && document.activeElement instanceof HTMLInputElement) root.style.setProperty('--kb', `${lost}px`);
      else {
        root.style.setProperty('--kb', '0px');
        if (!(document.activeElement instanceof HTMLInputElement)) base = window.innerHeight; // rotation or toolbar changes
      }
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return null;
}
