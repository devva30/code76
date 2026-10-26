import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/FormField';
import { isValidEmail } from '@/lib/format';

export type AuthMode = 'sign-in' | 'register';

type FieldName = 'name' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldName, ReactNode>>;

const LABELS: Record<FieldName, string> = { name: 'Name', email: 'Email', password: 'Password' };

/** Sign-in and create-account form. Talks to the Java API through AuthContext. */
export function AuthForm({ mode, onModeChange }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void }) {
  const { signIn, signUp } = useAuth();
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === 'register';

  const clear = (field: FieldName) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError(null);
  };

  /** Quick checks in the browser for instant feedback; the server checks everything again. */
  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (registering && !name.trim()) e.name = 'Please enter your name.';
    if (!email.trim()) e.email = 'Please enter your email address.';
    else if (!isValidEmail(email)) e.email = 'That email doesn’t look quite right. Please check it.';
    if (!password) e.password = 'Please enter your password.';
    else if (registering && password.length < 8) e.password = 'Use at least 8 characters.';
    return e;
  };

  const showServerError = (err: unknown) => {
    if (!(err instanceof ApiError)) return setFormError('Something went wrong. Please try again.');
    if (err.code === 'EMAIL_TAKEN') {
      return setErrors({
        email: (
          <>
            An account with this email already exists.{' '}
            <button type="button" onClick={() => switchMode('sign-in')} className="underline underline-offset-2">Sign in instead</button>
          </>
        ),
      });
    }
    if (err.fieldErrors.length) {
      const byField: FieldErrors = {};
      for (const f of err.fieldErrors) {
        if (f.field in LABELS && !byField[f.field as FieldName]) byField[f.field as FieldName] = `${LABELS[f.field as FieldName]} ${f.message}.`;
      }
      if (Object.keys(byField).length) return setErrors(byField);
    }
    setFormError(err.message);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      if (registering) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      showServerError(err);
      setSubmitting(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setErrors({});
    setFormError(null);
    setPassword('');
    onModeChange(next);
  };

  const describedBy = (field: FieldName) => `${id}-${field}-msg`;

  return (
    <form onSubmit={submit} noValidate className="space-y-7" aria-label={registering ? 'Create an account' : 'Sign in'}>
      {registering && (
        <Field id={`${id}-name`} label="Name" error={errors.name}>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => { setName(e.target.value); clear('name'); }}
            autoComplete="name"
            maxLength={80}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? describedBy('name') : undefined}
            className={inputClass}
          />
        </Field>
      )}

      <Field id={`${id}-email`} label="Email" error={errors.email}>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clear('email'); }}
          autoComplete={registering ? 'email' : 'username'}
          maxLength={254}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? describedBy('email') : undefined}
          className={inputClass}
        />
      </Field>

      <Field
        id={`${id}-password`}
        label="Password"
        error={errors.password}
        hint={registering ? 'At least 8 characters. A short phrase you’ll remember works well.' : undefined}
      >
        <input
          id={`${id}-password`}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); clear('password'); }}
          autoComplete={registering ? 'new-password' : 'current-password'}
          maxLength={72}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password || registering ? describedBy('password') : undefined}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-graphite transition-colors hover:text-ink"
        >
          {showPassword ? <EyeOff strokeWidth={1.4} className="h-4 w-4" /> : <Eye strokeWidth={1.4} className="h-4 w-4" />}
        </button>
      </Field>

      <AnimatePresence>
        {formError && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-l-2 border-stamp pl-3 text-sm text-[rgb(var(--c-stamp))]">
            {formError}
          </motion.p>
        )}
      </AnimatePresence>

      <Button type="submit" full arrow disabled={submitting}>
        {submitting ? (registering ? 'Creating your account…' : 'Signing in…') : registering ? 'Create account' : 'Sign in'}
      </Button>

      <p className="text-sm text-graphite">
        {registering ? 'Already have an account?' : 'New to CODE76?'}{' '}
        <button type="button" onClick={() => switchMode(registering ? 'sign-in' : 'register')} className="link-underline text-ink">
          {registering ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </form>
  );
}
