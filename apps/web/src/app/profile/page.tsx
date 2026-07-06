import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      workExperiences: true,
      educations: true,
      skills: true,
    },
  });

  if (!profile) redirect("/signup");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Profile</h1>
          <p className="mt-2 text-slate-600">{session.user.email}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/settings" className="text-indigo-600 hover:underline">
            Settings
          </Link>
          <Link href="/extension" className="text-indigo-600 hover:underline">
            Extension
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-2">
        <div>
          <h2 className="font-medium">Personal</h2>
          <p className="mt-2 text-sm text-slate-700">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-slate-700">{profile.phone}</p>
          <p className="text-sm text-slate-700">
            {profile.addressLine1}, {profile.city}, {profile.state} {profile.zip}
          </p>
        </div>
        <div>
          <h2 className="font-medium">Application defaults</h2>
          <p className="mt-2 text-sm text-slate-700">
            Salary: ${profile.salaryExpectation.toLocaleString()} / {profile.salaryPeriod}
          </p>
          <p className="text-sm text-slate-700">Job source: {profile.jobSource}</p>
          <p className="text-sm text-slate-700">
            Sponsorship required: {profile.requiresSponsorship ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="font-medium">Resume-derived data</h2>
        <p className="mt-2 text-sm text-slate-600">
          {profile.workExperiences.length} roles, {profile.educations.length} schools,{" "}
          {profile.skills.length} skills
        </p>
      </section>
    </main>
  );
}
