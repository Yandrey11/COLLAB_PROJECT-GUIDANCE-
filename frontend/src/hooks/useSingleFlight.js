import { useCallback, useRef, useState } from "react";

/**
 * Ensures an async action can only run once at a time.
 * Any additional trigger while in flight is ignored.
 */
export default function useSingleFlight() {
  const [isRunning, setIsRunning] = useState(false);
  const inflightRef = useRef(false);

  const run = useCallback(async (fn) => {
    if (inflightRef.current) return undefined;
    inflightRef.current = true;
    setIsRunning(true);
    try {
      return await fn();
    } finally {
      inflightRef.current = false;
      setIsRunning(false);
    }
  }, []);

  return { run, isRunning };
}
