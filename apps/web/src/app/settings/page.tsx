import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SettingsForm from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <Link href="/profile" className="text-sm text-indigo-600 hover:underline">
          Back to profile
        </Link>
      </div>
      <SettingsForm />
    </main>
  );
}
