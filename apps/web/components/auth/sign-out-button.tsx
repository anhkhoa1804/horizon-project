import { redirect } from "next/navigation";
import { clearLocalAdminSession } from "@/lib/auth/localAdminSession";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

async function signOut() {
  "use server";

  await clearLocalAdminSession();
  redirect("/admin/login");
}

export async function SignOutButton() {
  const { dict } = await getI18n();
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        {dict.errors.signOut}
      </Button>
    </form>
  );
}
