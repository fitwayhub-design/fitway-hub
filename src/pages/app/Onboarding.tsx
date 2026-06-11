import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowRight, ArrowLeft, Check, Activity, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useAppImage } from "@/context/AppImagesContext";
import { useBranding, getBrandLogoForLang } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const goalSchema = z.object({ goal: z.enum(["lose_weight", "maintain_weight", "gain_weight", "build_muscle"]) });
const personalSchema = z.object({ gender: z.enum(["male", "female"]), dob: z.string().min(1), height: z.number().min(100).max(250), weight: z.number().min(30).max(300) });
const activitySchema = z.object({ activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]), medicalHistory: z.string().optional() });
const targetSchema = z.object({ targetWeight: z.number().min(30).max(300), weeklyGoal: z.enum(["0.25", "0.5", "0.75", "1"]), dailySteps: z.string().regex(/^\d{3,6}$/, "Enter your daily step goal (e.g. 8000)") });

type OnboardingData = z.infer<typeof goalSchema> & z.infer<typeof personalSchema> & z.infer<typeof activitySchema> & z.infer<typeof targetSchema>;

const goals = [
  { id: "lose_weight", labelKey: "lose_weight", emoji: "🔥" },
  { id: "maintain_weight", labelKey: "maintain_weight", emoji: "⚖️" },
  { id: "gain_weight", labelKey: "gain_weight", emoji: "📈" },
  { id: "build_muscle", labelKey: "build_muscle", emoji: "💪" },
];
const activityLevels = [
  { id: "sedentary", labelKey: "sedentary", descKey: "sedentary_desc" },
  { id: "light", labelKey: "light", descKey: "light_desc" },
  { id: "moderate", labelKey: "moderate", descKey: "moderate_desc" },
  { id: "active", labelKey: "active", descKey: "active_desc" },
  { id: "very_active", labelKey: "very_active", descKey: "very_active_desc" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { token, refreshUser } = useAuth();
  const { t, lang } = useI18n();
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const brandLogo = getBrandLogoForLang(branding, lang, isDark);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [inbodyFile, setInbodyFile] = useState<File | null>(null);
  const [inbodyUploadMsg, setInbodyUploadMsg] = useState("");
  const totalSteps = 4;

  const uploadInbody = async (file: File) => {
    setInbodyFile(file);
    setInbodyUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("medical", file);
      fd.append("medical_history", "InBody / body composition document attached");
      const r = await apiFetch("/api/user/medical-history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token || localStorage.getItem("token") || ""}` },
        body: fd,
      });
      if (r.ok) setInbodyUploadMsg("✓ Uploaded");
      else setInbodyUploadMsg("Couldn't upload — saved file will be requested again later.");
    } catch {
      setInbodyUploadMsg("Couldn't upload — saved file will be requested again later.");
    }
  };

  const handleNext = async (data: any) => {
    const merged = { ...formData, ...data };
    setFormData(merged);
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    try {
      const authToken = token || localStorage.getItem("token");
      if (authToken) {
        // Build profile payload with ALL onboarding fields
        const profilePayload: Record<string, any> = {};
        if (merged.gender)        profilePayload.gender         = merged.gender;
        if (merged.height)        profilePayload.height         = merged.height;
        if (merged.weight)        profilePayload.weight         = merged.weight;
        if (merged.goal)          profilePayload.fitness_goal   = merged.goal;
        if (merged.activityLevel) profilePayload.activity_level = merged.activityLevel;
        if (merged.targetWeight)  profilePayload.target_weight  = merged.targetWeight;
        if (merged.weeklyGoal)    profilePayload.weekly_goal    = Number(merged.weeklyGoal);
        if (merged.dob)           profilePayload.date_of_birth  = merged.dob;
        profilePayload.onboarding_done = 1;

        if (Object.keys(profilePayload).length > 0) {
          await apiFetch("/api/user/profile", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(profilePayload),
          });
        }

        if (typeof merged.dailySteps === "string" && merged.dailySteps) {
          await apiFetch("/api/user/step-goal", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ step_goal: Number(merged.dailySteps) }),
          });
        }

        if (merged.medicalHistory !== undefined) {
          await apiFetch("/api/user/medical-history", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ medical_history: merged.medicalHistory || "" }),
          });
        }

        await refreshUser();
      }

      navigate("/app/dashboard");
    } catch {
      setSubmitError(t("onboarding_save_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepBg = useAppImage(`onboarding_step_${step}`)?.url;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-background bg-cover bg-center bg-no-repeat p-5"
      style={stepBg ? { backgroundImage: `url(${stepBg})` } : undefined}
    >
      {stepBg && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 to-black/65"
        />
      )}
      <Card
        className="relative w-full max-w-[480px] gap-0 overflow-hidden p-0 shadow-soft-lg"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg-card) 82%, transparent)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        {/* Progress bar */}
        <Progress value={(step / totalSteps) * 100} className="h-1 rounded-none" />

        <div className="p-7 pb-8">
          {/* Logo + Step */}
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {brandLogo ? (
                <img src={brandLogo} alt={branding.app_name || t("fitway_hub")} className="h-[26px] rounded-md object-contain" />
              ) : (
                <>
                  <span className="grid size-7 place-items-center rounded-full bg-primary">
                    <Activity size={14} className="text-primary-foreground" strokeWidth={2} />
                  </span>
                  <span className="text-[15px] font-bold">{branding.app_name || t("fitway_hub")}</span>
                </>
              )}
            </div>
            {/* Stepper dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i + 1 === step ? "w-5 bg-primary" : i + 1 < step ? "w-1.5 bg-primary" : "w-1.5 bg-muted",
                  )}
                />
              ))}
            </div>
          </div>

          <p className="mb-1 text-[13px] font-semibold tracking-wide text-primary">
            {t("step_n").replace("{n}", String(step)).replace("{total}", String(totalSteps))}
          </p>
          <h2 className="mb-6 text-[22px] font-bold tracking-tight">{step === 1 ? t("main_goal") : step === 2 ? t("tell_about") : step === 3 ? t("activity_health") : t("set_targets")}</h2>

          {/* Step 1 — Goal */}
          {step === 1 && (() => {
            const { register, handleSubmit, watch, setValue } = useForm({ resolver: zodResolver(goalSchema), defaultValues: { goal: formData.goal } });
            const sel = watch("goal");
            return (
              <form onSubmit={handleSubmit(handleNext)}>
                <input type="hidden" {...register("goal")} />
                <div className="mb-6 grid grid-cols-2 gap-2.5">
                  {goals.map((g) => {
                    const selected = sel === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setValue("goal", g.id as OnboardingData["goal"], { shouldValidate: true })}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-md p-4 text-center transition active:scale-[0.98]",
                          selected ? "bg-primary/15 ring-2 ring-primary" : "bg-muted",
                        )}
                      >
                        <span className="text-2xl">{g.emoji}</span>
                        <span className={cn("text-[13px] font-semibold", selected ? "text-primary" : "text-foreground")}>{t(g.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
                <Button type="submit" size="lg" className="w-full">
                  {t("continue_btn")} <ArrowRight size={16} strokeWidth={2} />
                </Button>
              </form>
            );
          })()}

          {/* Step 2 — Personal */}
          {step === 2 && (() => {
            const { register, handleSubmit, watch, setValue } = useForm<z.infer<typeof personalSchema>>({ resolver: zodResolver(personalSchema), defaultValues: { gender: (formData.gender as "male" | "female"), dob: formData.dob, height: formData.height, weight: formData.weight } });
            const selGender = watch("gender");
            return (
              <form onSubmit={handleSubmit(handleNext)} className="flex flex-col gap-5">
                <div>
                  <Label className="mb-2">{t("gender")}</Label>
                  <input type="hidden" {...register("gender")} />
                  <div className="flex gap-2">
                    {[{ v: "male", emoji: "👨", label: t("male") || "Male" }, { v: "female", emoji: "👩", label: t("female") || "Female" }].map(({ v, emoji, label }) => {
                      const selected = selGender === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setValue("gender", v as "male" | "female", { shouldValidate: true })}
                          className={cn(
                            "flex flex-1 flex-col items-center gap-1.5 rounded-md p-4 text-center text-[13px] font-semibold transition active:scale-[0.98]",
                            selected ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-foreground",
                          )}
                        >
                          <span className="text-[28px]">{emoji}</span>
                          <span>{label}</span>
                          {selected && <Check size={16} className="text-primary" strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {[{ label: t("date_of_birth"), type: "date", key: "dob" }, { label: t("height_cm"), type: "number", key: "height" }, { label: t("weight_kg"), type: "number", key: "weight" }].map((f) => (
                  <div key={f.key} className="grid gap-2">
                    <Label htmlFor={`personal-${f.key}`}>{f.label}</Label>
                    <Input id={`personal-${f.key}`} type={f.type} {...register(f.key as any, f.key !== "dob" ? { valueAsNumber: true } : {})} />
                  </div>
                ))}
                <div className="mt-1 flex gap-2.5">
                  <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} size="lg" className="flex-1">
                    <ArrowLeft size={15} strokeWidth={2} /> {t("back")}
                  </Button>
                  <Button type="submit" size="lg" className="flex-[2]">
                    {t("continue_btn")} <ArrowRight size={15} strokeWidth={2} />
                  </Button>
                </div>
              </form>
            );
          })()}

          {/* Step 3 — Activity */}
          {step === 3 && (() => {
            const { register, handleSubmit, watch, setValue } = useForm({ resolver: zodResolver(activitySchema), defaultValues: { activityLevel: formData.activityLevel, medicalHistory: formData.medicalHistory } });
            const sel = watch("activityLevel");
            return (
              <form onSubmit={handleSubmit(handleNext)} className="flex flex-col gap-5">
                <div>
                  <Label className="mb-2.5">{t("activity_level_label")}</Label>
                  <input type="hidden" {...register("activityLevel")} />
                  <div className="flex flex-col gap-2">
                    {activityLevels.map((a) => {
                      const selected = sel === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setValue("activityLevel", a.id as OnboardingData["activityLevel"], { shouldValidate: true })}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-md p-3.5 text-start transition active:scale-[0.99]",
                            selected ? "bg-primary/15 ring-2 ring-primary" : "bg-muted",
                          )}
                        >
                          <div>
                            <p className={cn("text-[13px] font-semibold", selected ? "text-primary" : "text-foreground")}>{t(a.labelKey)}</p>
                            <p className="text-[13px] text-muted-foreground">{t(a.descKey)}</p>
                          </div>
                          {selected && <Check size={18} className="shrink-0 text-primary" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="medical-history">{t("medical_history")}</Label>
                  <Input id="medical-history" type="text" {...register("medicalHistory")} placeholder={t("medical_placeholder")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="inbody-upload">
                    {lang === "ar" ? "تقرير InBody (اختياري)" : "InBody / body composition (optional)"}
                  </Label>
                  <label
                    htmlFor="inbody-upload"
                    className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-md bg-muted px-4 text-[15px] text-muted-foreground ring-1 ring-inset ring-border transition-[box-shadow] focus-within:ring-2 focus-within:ring-ring/70"
                  >
                    <Upload size={16} strokeWidth={2} />
                    <span className="truncate">{inbodyFile ? inbodyFile.name : (lang === "ar" ? "اختر ملف" : "Choose a file")}</span>
                  </label>
                  <input
                    id="inbody-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadInbody(f); }}
                  />
                  {inbodyFile && inbodyUploadMsg && (
                    <p className="text-[11px] text-muted-foreground">{inbodyUploadMsg}</p>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} size="lg" className="flex-1">
                    <ArrowLeft size={15} strokeWidth={2} /> {t("back")}
                  </Button>
                  <Button type="submit" size="lg" className="flex-[2]">
                    {t("continue_btn")} <ArrowRight size={15} strokeWidth={2} />
                  </Button>
                </div>
              </form>
            );
          })()}

          {/* Step 4 — Targets */}
          {step === 4 && (() => {
            const { register, handleSubmit, watch, setValue } = useForm({ resolver: zodResolver(targetSchema), defaultValues: { targetWeight: formData.targetWeight, weeklyGoal: formData.weeklyGoal, dailySteps: formData.dailySteps } });
            const weeklyGoal = watch("weeklyGoal");
            return (
              <form onSubmit={handleSubmit(handleNext)} className="flex flex-col gap-5">
                <input type="hidden" {...register("weeklyGoal")} />
                {[{ label: t("target_weight"), type: "number", key: "targetWeight" }].map((f) => (
                  <div key={f.key} className="grid gap-2">
                    <Label htmlFor={`target-${f.key}`}>{f.label}</Label>
                    <Input id={`target-${f.key}`} type="number" {...register(f.key as any, { valueAsNumber: true })} />
                  </div>
                ))}
                <div className="grid gap-2">
                  <Label htmlFor="weekly-goal">{t("weekly_goal")}</Label>
                  <Select value={weeklyGoal} onValueChange={(v) => setValue("weeklyGoal", v as z.infer<typeof targetSchema>["weeklyGoal"], { shouldValidate: true })}>
                    <SelectTrigger id="weekly-goal" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">{t("weekly_slow")}</SelectItem>
                      <SelectItem value="0.5">{t("weekly_normal")}</SelectItem>
                      <SelectItem value="0.75">{t("weekly_fast")}</SelectItem>
                      <SelectItem value="1">{t("weekly_aggressive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="daily-steps">{t("daily_steps_goal")}</Label>
                  <Input id="daily-steps" type="number" inputMode="numeric" min={500} max={100000} step={500} placeholder="e.g. 8000" {...register("dailySteps")} />
                </div>
                <div className="mt-1 flex gap-2.5">
                  <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} size="lg" className="flex-1">
                    <ArrowLeft size={15} strokeWidth={2} /> {t("back")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} size="lg" className="flex-[2]">
                    {isSubmitting ? t("saving") : t("finish_setup")} <Check size={15} strokeWidth={2} />
                  </Button>
                </div>
                {submitError && <p className="mt-0.5 text-[13px] text-destructive">{submitError}</p>}
              </form>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}
