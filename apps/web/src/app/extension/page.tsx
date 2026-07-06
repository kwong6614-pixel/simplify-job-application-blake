import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ExtensionClient from "@/components/extension-client";

export default async function ExtensionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Chrome extension</h1>
        <Link href="/profile" className="text-sm text-indigo-600 hover:underline">
          Back to profile
        </Link>
      </div>
      <ExtensionClient />
    </main>
  );
}
