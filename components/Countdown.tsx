"use client";

import { useEffect, useState } from "react";

export function Countdown({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          window.location.reload();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (seconds <= 0) {
    return <p>Status changing to delivering...</p>;
  }
  return <p>Status changes in {seconds} seconds</p>;
}
