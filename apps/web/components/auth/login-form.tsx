import { redirect } from "next/navigation";
import { isAdminEmailAllowed, normalizeEmail } from "@/lib/auth/adminAllowlist";
import { clearLoginRateLimit, isLoginRateLimited, recordFailedLoginAttempt } from "@/lib/auth/loginRateLimit";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import {
  createLocalAdminSession,
  isAdminAuthConfigured,
  isLocalAdminPasswordValid,
} from "@/lib/auth/localAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";

async function loginAdmin(formData: FormData) {
  "use server";

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? "/admin"));
  const emailQuery = "";

  // Checked before anything else so a deployment missing its admin secrets
  // fails as itself, instead of further down as "wrong password" (which would
  // send an operator hunting for a credential problem that isn't there) or as
  // an unhandled 500.
  //
  // The DIAGNOSTIC goes to the server log, not to the page. Naming the two
  // environment variables is exactly what an operator needs and exactly what
  // an anonymous visitor should not be handed — /admin/login is public, and
  // the message it used to render told anyone which variables gate the
  // console. The visitor now sees only that sign-in is unavailable.
  if (!isAdminAuthConfigured()) {
    console.error(
      "[auth] Admin sign-in is not configured: ADMIN_SESSION_SECRET and/or ADMIN_PASSWORD are unset " +
        "for this server process. Set both (plus ADMIN_ALLOWED_EMAILS) in the environment and redeploy.",
    );
    redirect(`/admin/login?error=not-configured${emailQuery}`);
  }

  if (!email || !(await isAdminEmailAllowed(email))) {
    redirect(`/admin/login?error=unauthorized${emailQuery}`);
  }

  if (isLoginRateLimited(email)) {
    redirect(`/admin/login?error=rate-limited${emailQuery}`);
  }

  if (!isLocalAdminPasswordValid(password)) {
    recordFailedLoginAttempt(email);
    redirect(`/admin/login?error=bad-password${emailQuery}`);
  }

  clearLoginRateLimit(email);
  await createLocalAdminSession(email);
  redirect(redirectTo);
}

export async function LoginForm({
  redirectTo,
  defaultEmail = "",
}: {
  redirectTo: string;
  defaultEmail?: string;
}) {
  const { dict } = await getI18n();

  return (
    <Card className="admin-login-card mx-auto w-full max-w-md">
      <CardHeader className="admin-login-card__header">
        <h2 className="text-xl font-semibold">{dict.auth.title}</h2>
      </CardHeader>
      <CardContent>
        <form action={loginAdmin} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">{dict.auth.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={defaultEmail}
              placeholder="ten@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{dict.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={dict.auth.passwordPlaceholder}
            />
          </div>
          <Button type="submit" className="w-full">
            {dict.auth.signIn}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
