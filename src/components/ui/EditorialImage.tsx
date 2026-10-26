import { useRef } from 'react';
import { gsap, MQ, useGsap } from '@/lib/motion';
import { cx } from '@/lib/format';
import { PHONE_SIZES, sized, srcSetFor } from '@/lib/api';

interface EditorialImageProps {
  src: string;
  alt: string;
  /** CSS aspect ratio, e.g. "4 / 5". Reserves space to avoid layout shift. */
  ratio?: string;
  className?: string;
  imgClassName?: string;
  /** Clip-path reveal direction when scrolled into view. */
  reveal?: 'up' | 'left' | 'right' | false;
  /** Vertical parallax travel in percent (0 disables). */
  parallax?: number;
  eager?: boolean;
  sizes?: string;
  objectPosition?: string;
}

const clipFrom = {
  up: 'inset(100% 0% 0% 0%)',
  left: 'inset(0% 100% 0% 0%)',
  right: 'inset(0% 0% 0% 100%)',
};

/**
 * Art-directed image: masked reveal + gentle parallax, with a reserved
 * aspect ratio and lazy loading. Motion is skipped for reduced-motion users.
 */
export function EditorialImage({
  src,
  alt,
  ratio = '4 / 5',
  className,
  imgClassName,
  reveal = 'up',
  parallax = 0,
  eager = false,
  sizes,
  objectPosition,
}: EditorialImageProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(ref, (mm, el) => {
    mm.add(MQ.anyMotion, () => {
      const img = el.querySelector('img');
      if (reveal) {
        gsap.fromTo(
          el,
          { clipPath: clipFrom[reveal] },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.5,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        );
        gsap.fromTo(img, { scale: 1.18 }, {
          scale: parallax ? 1.12 : 1,
          duration: 1.8,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      }
      if (parallax) {
        gsap.fromTo(
          img,
          { yPercent: -parallax },
          {
            yPercent: parallax,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
          },
        );
      }
    });
  });

  return (
    <div ref={ref} className={cx('relative overflow-hidden bg-card', className)} style={{ aspectRatio: ratio }}>
      <img
        src={sized(src, 1280)}
        srcSet={srcSetFor(src)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes ?? `${PHONE_SIZES}, (min-width: 1024px) 50vw, 100vw`}
        className={cx('absolute inset-0 h-full w-full object-cover', parallax > 0 && 'scale-[1.12]', imgClassName)}
        style={objectPosition ? { objectPosition } : undefined}
      />
    </div>
  );
}
