import { useEffect, useRef, useState } from "react";

type Size = { width: number; height: number };

export default function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });

    return () => observer.disconnect();
  }, []);

  return { ref, size } as const;
}
