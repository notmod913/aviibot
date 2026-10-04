import { useState, type FormEvent } from "react";
import { ArrowRight, Clock3, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPortalSession, portalRoles, type PortalRole } from "@/lib/auth";
import { Logo } from "@/components/satark/portal";

export function PortalRoleLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PortalRole>("Authority Officer");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await createPortalSession(username, password, role);
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
      <section className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-sidebar px-7 py-8 text-sidebar-foreground sm:px-12 sm:py-10 lg:min-h-screen lg:px-16 lg:py-14">
        <div className="absolute -right-24 -top-24 size-96 rounded-full border border-sidebar-border/70" />
        <div className="absolute -right-8 -top-8 size-64 rounded-full border border-sidebar-border/70" />
        <div className="relative z-10"><Logo /></div>
        <div className="relative z-10 max-w-xl py-12 lg:py-0">
          <div className="mb-6 grid size-12 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-muted">{role} access</p>
          <h1 className="mt-3 max-w-lg font-display text-3xl font-bold leading-tight sm:text-4xl">
            Oversight starts with a clear view.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-sidebar-muted">
            Sign in to review inspections, verify evidence and monitor organizations across the portal.
          </p>
        </div>
        <div className="relative z-10 hidden items-center gap-2 text-xs text-sidebar-muted lg:flex">
          <Clock3 className="size-4" />
          <span>Sessions expire after five minutes</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Secure sign in</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Welcome to the portal</h2>
          <p className="mt-2 text-sm text-muted-foreground">Enter your account details to continue.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold">Username</label>
              <Input id="username" type="text" autoComplete="username" placeholder="Enter username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" className="pl-10" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-semibold">Portal role</label>
              <select id="role" value={role} onChange={(event) => setRole(event.target.value as PortalRole)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {portalRoles.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full text-sm" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in to Satark Drishti"} <ArrowRight />
            </Button>
          </form>

        </div>
      </section>
    </main>
  );
}