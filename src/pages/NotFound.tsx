import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section className="site-container flex min-h-[80svh] flex-col justify-center pb-24 pt-[calc(var(--header-h)+var(--announce-h)+3rem)]">
      <p className="eyebrow mb-6">Error 404</p>
      <h1 className="display text-[13.32vw] leading-[1.04] sm:text-[9.6vw] lg:text-[7.56vw]">
        Lost <span className="italic">the thread.</span>
      </h1>
      <p className="mt-8 max-w-md text-sm leading-relaxed text-graphite">The page you’re looking for has moved or never existed. Let’s get you back to the collection.</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/" arrow>Back to home</ButtonLink>
        <ButtonLink to="/shop" variant="outline">Shop all</ButtonLink>
      </div>
    </section>
  );
}
