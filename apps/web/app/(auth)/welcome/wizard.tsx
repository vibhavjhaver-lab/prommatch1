"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AnswerInput } from "@prommatch/core";
import { trpc } from "../../../lib/trpc.js";
import { TERMS_VERSION } from "../../../lib/constants.js";
import { Card, Container, PillButton, SectionHeading } from "../../../components/ui.js";

type Mode = "DATE" | "FRIEND" | "SQUAD";
type Gender = "WOMAN" | "MAN" | "NONBINARY" | "SELF_DESCRIBE" | "PREFER_NOT";

const STEP_LABELS = ["You're 18+", "About you", "Photos", "The vibe check", "Who you're looking for", "Review"];

/**
 * A 6-step onboarding wizard (spec section 6/7). Each step calls its own
 * tRPC mutation when the student clicks Next, rather than saving
 * everything at the end — so progress survives a closed tab, and
 * `questionnaire.progress` / `profile.get` can resume a half-finished
 * wizard later (the "resume where you left off" behaviour is implicit:
 * reopening /welcome re-fetches each step's current server state below).
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const eventConfig = trpc.event.publicConfig.useQuery();
  const confirmAge = trpc.auth.confirmAge.useMutation();
  const profileGet = trpc.profile.get.useQuery();
  const profileUpdate = trpc.profile.update.useMutation();
  const questions = trpc.questionnaire.getQuestions.useQuery();
  const myAnswers = trpc.questionnaire.getMyAnswers.useQuery();
  const saveAnswer = trpc.questionnaire.saveAnswer.useMutation();
  const prefsGet = trpc.prefs.get.useQuery();
  const prefsUpdate = trpc.prefs.update.useMutation();
  const uploadPhotoUrl = trpc.profile.uploadPhotoUrl.useMutation();
  const confirmPhoto = trpc.profile.confirmPhoto.useMutation();

  const next = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Container className="py-10">
      <ol className="flex gap-2 mb-8 text-xs text-muted flex-wrap">
        {STEP_LABELS.map((label, i) => (
          <li
            key={label}
            className={`rounded-pill px-3 py-1 border ${i === step ? "border-gold text-gold" : "border-text/10"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <AgeStep
          onNext={async (dob) => {
            await confirmAge.mutateAsync({
              isAdult: true,
              acceptedConduct: true,
              termsVersion: TERMS_VERSION,
              dateOfBirth: dob,
            });
            next();
          }}
          pending={confirmAge.isPending}
          error={confirmAge.error?.message}
        />
      )}

      {step === 1 && eventConfig.data && (
        <ProfileStep
          config={eventConfig.data}
          initial={profileGet.data ?? undefined}
          onBack={back}
          onNext={async (values) => {
            await profileUpdate.mutateAsync(values);
            next();
          }}
          pending={profileUpdate.isPending}
          error={profileUpdate.error?.message}
        />
      )}

      {step === 2 && (
        <PhotosStep
          photos={profileGet.data?.user?.photos ?? []}
          onUpload={async (file) => {
            const { uploadUrl, key } = await uploadPhotoUrl.mutateAsync({
              contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/heic",
            });
            await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            const order = profileGet.data?.user?.photos?.length ?? 0;
            await confirmPhoto.mutateAsync({ key, order: Math.min(order, 3) });
            await profileGet.refetch();
          }}
          uploading={uploadPhotoUrl.isPending || confirmPhoto.isPending}
          onBack={back}
          onNext={next}
        />
      )}

      {step === 3 && questions.data && (
        <QuestionnaireStep
          questions={questions.data}
          existingAnswers={myAnswers.data ?? []}
          onSave={async (answer) => {
            await saveAnswer.mutateAsync(answer);
          }}
          onBack={back}
          onNext={next}
        />
      )}

      {step === 4 && eventConfig.data && (
        <PrefsStep
          config={eventConfig.data}
          initial={prefsGet.data ?? undefined}
          onBack={back}
          onNext={async (values) => {
            await prefsUpdate.mutateAsync(values);
            next();
          }}
          pending={prefsUpdate.isPending}
          error={prefsUpdate.error?.message}
        />
      )}

      {step === 5 && (
        <ReviewStep
          onBack={back}
          onFinish={() => router.push("/home")}
        />
      )}
    </Container>
  );
}

function AgeStep({
  onNext,
  pending,
  error,
}: {
  onNext: (dob: string) => Promise<void>;
  pending: boolean;
  error?: string;
}) {
  const [dob, setDob] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <Card className="max-w-md">
      <SectionHeading>Before we start</SectionHeading>
      <div className="space-y-4">
        <div>
          <label htmlFor="dob" className="block text-sm font-medium mb-1">
            Date of birth
          </label>
          <input
            id="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded-card border border-text/20 bg-bg px-3 py-2 text-text"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          <span>
            I confirm I'm 18 or older and I agree to the{" "}
            <a href="/conduct" target="_blank" className="text-gold underline">
              code of conduct
            </a>{" "}
            and{" "}
            <a href="/terms" target="_blank" className="text-gold underline">
              terms
            </a>
            .
          </span>
        </label>
        {error ? <p className="text-sm text-danger">That didn't go through — double check and try again.</p> : null}
        <PillButton
          variant="primary"
          className="w-full"
          disabled={!dob || !agreed || pending}
          onClick={() => onNext(dob)}
        >
          Continue
        </PillButton>
      </div>
    </Card>
  );
}

type EventConfigLite = {
  departments: string[];
  years: number[];
  promVibes: string[];
  interests: string[];
};

function ProfileStep({
  config,
  initial,
  onNext,
  onBack,
  pending,
  error,
}: {
  config: EventConfigLite;
  initial?: {
    displayName?: string;
    pronouns?: string | null;
    yearOfStudy?: number;
    department?: string;
    bio?: string | null;
    prompts?: string[];
    interests?: string[];
    promVibe?: string;
    heightCm?: number | null;
  };
  onNext: (values: {
    displayName: string;
    pronouns?: string;
    yearOfStudy: number;
    department: string;
    bio?: string;
    prompts: string[];
    interests: string[];
    promVibe: string;
    heightCm?: number;
  }) => Promise<void>;
  onBack: () => void;
  pending: boolean;
  error?: string;
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(initial?.yearOfStudy ?? config.years[0]);
  const [department, setDepartment] = useState(initial?.department ?? config.departments[0]);
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [prompts, setPrompts] = useState<string[]>(initial?.prompts ?? ["", "", ""]);
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [promVibe, setPromVibe] = useState(initial?.promVibe ?? config.promVibes[0]);
  const [heightCm, setHeightCm] = useState(initial?.heightCm?.toString() ?? "");

  const toggleInterest = (interest: string) =>
    setInterests((cur) =>
      cur.includes(interest)
        ? cur.filter((i) => i !== interest)
        : cur.length < 10
          ? [...cur, interest]
          : cur,
    );

  const canSubmit = displayName.trim().length >= 2 && interests.length >= 3;

  return (
    <Card className="max-w-xl space-y-5">
      <SectionHeading>About you</SectionHeading>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name or nickname">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={24}
            className="input"
          />
        </Field>
        <Field label="Pronouns (optional)">
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={30} className="input" />
        </Field>
        <Field label="Year">
          <select value={yearOfStudy} onChange={(e) => setYearOfStudy(Number(e.target.value))} className="input">
            {config.years.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input">
            {config.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Height in cm (optional)">
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            min={100}
            max={250}
            className="input"
          />
        </Field>
        <Field label="Prom vibe">
          <select value={promVibe} onChange={(e) => setPromVibe(e.target.value)} className="input">
            {config.promVibes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="A short bio (optional)">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
          className="input resize-none"
        />
      </Field>

      <div>
        <label className="block text-sm font-medium mb-2">Interests — pick 3 to 10</label>
        <div className="flex flex-wrap gap-2">
          {config.interests.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
              className={`rounded-pill px-3 py-1 text-sm border ${
                interests.includes(interest) ? "border-gold text-gold" : "border-text/15 text-muted"
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Prompts (optional, up to 3)</label>
        {prompts.map((p, i) => (
          <input
            key={i}
            value={p}
            maxLength={150}
            placeholder={`Prompt answer ${i + 1}`}
            onChange={(e) =>
              setPrompts((cur) => cur.map((c, idx) => (idx === i ? e.target.value : c)))
            }
            className="input"
          />
        ))}
      </div>

      {error ? <p className="text-sm text-danger">Something didn't save — check your entries and try again.</p> : null}

      <div className="flex gap-3">
        <PillButton variant="secondary" onClick={onBack}>
          Back
        </PillButton>
        <PillButton
          variant="primary"
          className="flex-1"
          disabled={!canSubmit || pending}
          onClick={() =>
            onNext({
              displayName: displayName.trim(),
              pronouns: pronouns.trim() || undefined,
              yearOfStudy,
              department,
              bio: bio.trim() || undefined,
              prompts: prompts.map((p) => p.trim()).filter(Boolean),
              interests,
              promVibe,
              heightCm: heightCm ? Number(heightCm) : undefined,
            })
          }
        >
          Continue
        </PillButton>
      </div>
    </Card>
  );
}

function PhotosStep({
  photos,
  onUpload,
  uploading,
  onBack,
  onNext,
}: {
  photos: { id: string; thumbKey: string }[];
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <Card className="max-w-xl space-y-4">
      <SectionHeading>Add a photo or two</SectionHeading>
      <p className="text-sm text-muted">
        Optional for now, but Date matches won't see a face until you add at least one — photos are reviewed by
        organizers before they're visible to anyone, and location data is stripped automatically.
      </p>

      <p className="text-sm text-muted">{photos.length} of 6 uploaded.</p>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        disabled={uploading || photos.length >= 6}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file);
        }}
      />

      <div className="flex gap-3 pt-2">
        <PillButton variant="secondary" onClick={onBack}>
          Back
        </PillButton>
        <PillButton variant="primary" className="flex-1" onClick={onNext}>
          Continue
        </PillButton>
      </div>
    </Card>
  );
}

type Question = {
  id: string;
  text: string;
  type: "likert5" | "choice" | "multiselect";
  options: string[];
};

function QuestionnaireStep({
  questions,
  existingAnswers,
  onSave,
  onBack,
  onNext,
}: {
  questions: Question[];
  existingAnswers: AnswerInput[];
  onSave: (answer: AnswerInput) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const initial = useMemo(() => {
    const map = new Map<string, AnswerInput>();
    for (const a of existingAnswers) map.set(a.questionId, a);
    return map;
  }, [existingAnswers]);

  const [answers, setAnswers] = useState<Map<string, AnswerInput>>(initial);
  const [idx, setIdx] = useState(0);
  const question = questions[idx];
  const answered = answers.size;

  async function setAndSave(value: AnswerInput["value"], importance: AnswerInput["importance"] = 2) {
    const next: AnswerInput = { questionId: question.id, value, importance };
    setAnswers((cur) => new Map(cur).set(question.id, next));
    await onSave(next);
  }

  if (!question) {
    return (
      <Card className="max-w-xl space-y-4">
        <SectionHeading>The vibe check</SectionHeading>
        <p className="text-sm text-muted">No questions configured yet — you can skip ahead.</p>
        <div className="flex gap-3">
          <PillButton variant="secondary" onClick={onBack}>
            Back
          </PillButton>
          <PillButton variant="primary" className="flex-1" onClick={onNext}>
            Continue
          </PillButton>
        </div>
      </Card>
    );
  }

  const current = answers.get(question.id);

  return (
    <Card className="max-w-xl space-y-5">
      <div className="flex justify-between text-xs text-muted">
        <span>
          Question {idx + 1} of {questions.length}
        </span>
        <span>{answered} answered</span>
      </div>
      <p className="text-lg">{question.text}</p>

      {question.type === "likert5" && (
        <div className="flex justify-between gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAndSave(v)}
              className={`flex-1 rounded-card border py-3 text-sm ${
                current?.value === v ? "border-gold text-gold" : "border-text/15 text-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {question.type === "choice" && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAndSave(opt)}
              className={`rounded-pill px-3 py-1.5 text-sm border ${
                current?.value === opt ? "border-gold text-gold" : "border-text/15 text-muted"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt) => {
            const selected = Array.isArray(current?.value) && current.value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const cur = Array.isArray(current?.value) ? current.value : [];
                  const nextVal = selected ? cur.filter((o) => o !== opt) : [...cur, opt];
                  void setAndSave(nextVal);
                }}
                className={`rounded-pill px-3 py-1.5 text-sm border ${
                  selected ? "border-gold text-gold" : "border-text/15 text-muted"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <PillButton
          variant="secondary"
          onClick={() => (idx === 0 ? onBack() : setIdx((i) => i - 1))}
        >
          Back
        </PillButton>
        <PillButton
          variant="primary"
          className="flex-1"
          disabled={!current}
          onClick={() => (idx === questions.length - 1 ? onNext() : setIdx((i) => i + 1))}
        >
          {idx === questions.length - 1 ? "Continue" : "Next question"}
        </PillButton>
      </div>
    </Card>
  );
}

function PrefsStep({
  config,
  initial,
  onNext,
  onBack,
  pending,
  error,
}: {
  config: { years: number[] };
  initial?: {
    modes?: Mode[];
    gender?: Gender;
    seekingGenders?: Gender[];
    yearMin?: number;
    yearMax?: number;
    sameDeptOk?: boolean;
  };
  onNext: (values: {
    modes: Mode[];
    gender: Gender;
    seekingGenders: Gender[];
    yearMin: number;
    yearMax: number;
    sameDeptOk: boolean;
    squadSizeMin: number;
    squadSizeMax: number;
    dealbreakers: Record<string, (string | number)[]>;
    excludedEmails: string[];
  }) => Promise<void>;
  onBack: () => void;
  pending: boolean;
  error?: string;
}) {
  const [modes, setModes] = useState<Mode[]>(initial?.modes ?? ["DATE"]);
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "PREFER_NOT");
  const [seekingGenders, setSeekingGenders] = useState<Gender[]>(initial?.seekingGenders ?? []);
  const [yearMin, setYearMin] = useState(initial?.yearMin ?? config.years[0]);
  const [yearMax, setYearMax] = useState(initial?.yearMax ?? config.years[config.years.length - 1]);
  const [sameDeptOk, setSameDeptOk] = useState(initial?.sameDeptOk ?? true);

  const toggleMode = (m: Mode) =>
    setModes((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const toggleSeeking = (g: Gender) =>
    setSeekingGenders((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const GENDERS: { value: Gender; label: string }[] = [
    { value: "WOMAN", label: "Woman" },
    { value: "MAN", label: "Man" },
    { value: "NONBINARY", label: "Nonbinary" },
    { value: "SELF_DESCRIBE", label: "Self-describe" },
    { value: "PREFER_NOT", label: "Prefer not to say" },
  ];

  const canSubmit = modes.length > 0 && yearMin <= yearMax;

  return (
    <Card className="max-w-xl space-y-5">
      <SectionHeading>Who you're looking for</SectionHeading>

      <div>
        <label className="block text-sm font-medium mb-2">What are you here for?</label>
        <div className="flex gap-2">
          {(["DATE", "FRIEND", "SQUAD"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMode(m)}
              className={`rounded-pill px-4 py-1.5 text-sm border ${
                modes.includes(m) ? "border-gold text-gold" : "border-text/15 text-muted"
              }`}
            >
              {m === "DATE" ? "A date" : m === "FRIEND" ? "New friends" : "A squad"}
            </button>
          ))}
        </div>
      </div>

      <Field label="Your gender">
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className="input">
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>

      {modes.includes("DATE") && (
        <div>
          <label className="block text-sm font-medium mb-2">Open to matching with</label>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleSeeking(g.value)}
                className={`rounded-pill px-3 py-1.5 text-sm border ${
                  seekingGenders.includes(g.value) ? "border-gold text-gold" : "border-text/15 text-muted"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Earliest year">
          <select value={yearMin} onChange={(e) => setYearMin(Number(e.target.value))} className="input">
            {config.years.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Latest year">
          <select value={yearMax} onChange={(e) => setYearMax(Number(e.target.value))} className="input">
            {config.years.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={sameDeptOk} onChange={(e) => setSameDeptOk(e.target.checked)} />
        Matching within my own department is fine
      </label>

      {error ? <p className="text-sm text-danger">Something didn't save — check your entries and try again.</p> : null}

      <div className="flex gap-3">
        <PillButton variant="secondary" onClick={onBack}>
          Back
        </PillButton>
        <PillButton
          variant="primary"
          className="flex-1"
          disabled={!canSubmit || pending}
          onClick={() =>
            onNext({
              modes,
              gender,
              seekingGenders,
              yearMin,
              yearMax,
              sameDeptOk,
              squadSizeMin: 4,
              squadSizeMax: 8,
              dealbreakers: {},
              excludedEmails: [],
            })
          }
        >
          Continue
        </PillButton>
      </div>
    </Card>
  );
}

function ReviewStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  return (
    <Card className="max-w-xl space-y-4 text-center">
      <SectionHeading>You're all set</SectionHeading>
      <p className="text-sm text-muted">
        Your profile and answers are saved. You'll get an email the moment your first Match Drop lands — until
        then, feel free to look around.
      </p>
      <div className="flex gap-3 justify-center pt-2">
        <PillButton variant="secondary" onClick={onBack}>
          Back
        </PillButton>
        <PillButton variant="primary" onClick={onFinish}>
          Take me to my home
        </PillButton>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
