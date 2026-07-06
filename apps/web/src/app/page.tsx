import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
          US Job Application Autofill
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Register once. Fill every ATS tab.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Create your profile at signup, connect your Google Sheet of job URLs and JDs,
          then use the Chrome extension to fill application forms one tab at a time.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium hover:bg-white"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
