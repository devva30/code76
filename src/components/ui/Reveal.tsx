import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, MQ, useGsap } from '@/lib/motion';
import { cx } from '@/lib/format';

/**
 * Splits text into masked lines that slide up when scrolled into view.
 * Pass an array to control line breaks explicitly (keeps typography art-directed).
 */
export function RevealLines({
  lines,
  as: Tag = 'h2',
  className,
  lineClassName,
  delay = 0,
  start = 'top 85%',
  immediate = false,
  id,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  lineClassName?: (index: number) => string | undefined;
  delay?: number;
  start?: string;
  /** Animate on mount instead of on scroll (used in the hero). */
  immediate?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useGsap(ref, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      const inner = el.querySelectorAll('.reveal-line > span');
      gsap.fromTo(
        inner,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.2,
          stagger: 0.09,
          delay,
          ease: 'expo.out',
          scrollTrigger: immediate ? undefined : { trigger: el, start, once: true },
        },
      );
    });
  });
  return (
    <Tag ref={ref} id={id} className={className}>
      {lines.map((line, i) => (
        <span key={i} className={cx('reveal-line', lineClassName?.(i))}>
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}

/** Fades and lifts children into view once. */
export function FadeUp({
  children,
  className,
  as: Tag = 'div',
  delay = 0,
  y = 24,
  stagger,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  delay?: number;
  y?: number;
  /** When set, animates direct children in sequence instead of the wrapper. */
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useGsap(ref, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      const targets = stagger ? Array.from(el.children) : el;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.1,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      );
    });
  });
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
