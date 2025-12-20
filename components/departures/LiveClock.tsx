'use client';

import { useState, useEffect } from 'react';

interface LiveClockProps {
  className?: string;
}

export function LiveClock({ className = '' }: LiveClockProps) {
  const [time, setTime] = useState<string>('');
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };

    updateTime();
    const timeInterval = setInterval(updateTime, 1000);
    const colonInterval = setInterval(() => {
      setColonVisible((v) => !v);
    }, 500);

    return () => {
      clearInterval(timeInterval);
      clearInterval(colonInterval);
    };
  }, []);

  if (!time) return null;

  const [hours, minutes] = time.split(':');

  return (
    <span className={`font-mono font-bold ${className}`}>
      {hours}
      <span className={`transition-opacity duration-100 ${colonVisible ? 'opacity-100' : 'opacity-30'}`}>
        :
      </span>
      {minutes}
    </span>
  );
}
