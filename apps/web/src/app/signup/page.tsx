"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const resume = formData.get("resume");

    if (!(resume instanceof File) || resume.size === 0) {
      setLoading(false);
      setError("Please upload your resume PDF.");
      return;
    }

    if (resume.type !== "application/pdf") {
      setLoading(false);
      setError("Resume must be a PDF file.");
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      body: formData,
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Signup failed");
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Create your application profile</h1>
      <p className="mt-2 text-slate-600">
        Register all required US application information once. Upload your resume PDF at signup.
      </p>

      <form
        onSubmit={onSubmit}
        encType="multipart/form-data"
        className="mt-8 grid gap-6 md:grid-cols-2"
      >
        <label className="block text-sm md:col-span-2">
          Email
          <input name="email" type="email" required className={inputClass} />
        </label>
        <label className="block text-sm md:col-span-2">
          Password
          <input name="password" type="password" minLength={8} required className={inputClass} />
        </label>
        <label className="block text-sm">
          First name
          <input name="firstName" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Last name
          <input name="lastName" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Phone
          <input name="phone" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Birth year
          <input name="birthYear" type="number" required className={inputClass} />
        </label>
        <label className="block text-sm md:col-span-2">
          Address
          <input name="addressLine1" required className={inputClass} />
        </label>
        <label className="block text-sm">
          City
          <input name="city" required className={inputClass} />
        </label>
        <label className="block text-sm">
          State
          <input name="state" required className={inputClass} />
        </label>
        <label className="block text-sm">
          ZIP
          <input name="zip" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Work authorization
          <select name="usWorkAuthorization" required className={inputClass}>
            <option value="us_citizen">US citizen</option>
            <option value="permanent_resident">Permanent resident</option>
            <option value="visa_holder">Visa holder</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-sm">
          Requires sponsorship?
          <select name="requiresSponsorship" required className={inputClass}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="block text-sm">
          Gender
          <input name="gender" required className={inputClass} placeholder="Male / Female / Prefer not to say" />
        </label>
        <label className="block text-sm">
          Ethnicity
          <input name="ethnicity" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Veteran status
          <select name="veteranStatus" required className={inputClass}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label className="block text-sm">
          Disability status
          <select name="disabilityStatus" required className={inputClass}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label className="block text-sm">
          Sexual orientation
          <input name="sexualOrientation" required className={inputClass} />
        </label>
        <label className="block text-sm">
          Transgender status
          <select name="transgenderStatus" required className={inputClass}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label className="block text-sm">
          Salary expectation (annual USD)
          <input name="salaryExpectation" type="number" required className={inputClass} />
        </label>
        <label className="block text-sm">
          How did you find jobs?
          <input name="jobSource" required className={inputClass} placeholder="LinkedIn, company site, referral..." />
        </label>
        <label className="block text-sm md:col-span-2">
          Resume PDF
          <input
            name="resume"
            type="file"
            accept="application/pdf,.pdf"
            required
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setResumeName(file?.name ?? null);
            }}
          />
          {resumeName ? (
            <span className="mt-1 block text-xs text-slate-500">Selected: {resumeName}</span>
          ) : (
            <span className="mt-1 block text-xs text-slate-500">
              We extract work history, education, and skills from your PDF at signup.
            </span>
          )}
        </label>

        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-500 disabled:opacity-60 md:col-span-2"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
