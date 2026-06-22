import { CalorieCalculator } from "@/components/website/CalorieCalculator";
import { MacroCalculator } from "@/components/app/MacroCalculator";
import { Calculator, Flame, Droplets, Utensils } from "lucide-react";
import { useState, useEffect } from "react";
import { useI18n } from "@/context/I18nContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Tools() {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const [bmiHeight, setBmiHeight] = useState<number | "">("");
  const [bmiWeight, setBmiWeight] = useState<number | "">("");
  const [bmiResult, setBmiResult] = useState<{ bmi: number; category: string } | null>(null);
  const [hydrationWeight, setHydrationWeight] = useState<number | "">("");
  const [hydrationActivity, setHydrationActivity] = useState<"low" | "moderate" | "high">("moderate");
  const [hydrationResult, setHydrationResult] = useState<number | null>(null);

  const calculateBMI = () => {
    if (!bmiHeight || !bmiWeight) return;
    const bmi = Number(bmiWeight) / Math.pow(Number(bmiHeight) / 100, 2);
    const category = bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal_weight") : bmi < 30 ? t("overweight") : t("obese");
    setBmiResult({ bmi: Math.round(bmi * 10) / 10, category });
  };

  const calculateHydration = () => {
    if (!hydrationWeight) return;
    const mult: Record<string, number> = { low: 1.0, moderate: 1.2, high: 1.5 };
    setHydrationResult(Math.round(Number(hydrationWeight) * 30 * mult[hydrationActivity]));
  };

  const bmiColor = !bmiResult ? "var(--accent)" : bmiResult.bmi < 18.5 ? "var(--blue)" : bmiResult.bmi < 25 ? "var(--accent)" : bmiResult.bmi < 30 ? "var(--amber)" : "var(--red)";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-4">
      <h1 className="mb-6 text-[28px] font-bold leading-tight tracking-tight">{t("fitness_tools")}</h1>

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-[repeat(auto-fit,minmax(280px,1fr))]"}`}>
        {/* Calorie Calculator */}
        <Card className="gap-0 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "rgba(255,68,68,0.12)" }}>
              <Flame size={18} color="var(--red)" strokeWidth={2} />
            </span>
            <h2 className="text-[15px] font-semibold">{t("calorie_calculator")}</h2>
          </div>
          <CalorieCalculator />
        </Card>

        {/* BMI Calculator */}
        <Card className="gap-0 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "rgba(59,139,255,0.12)" }}>
              <Calculator size={18} color="var(--blue)" strokeWidth={2} />
            </span>
            <h2 className="text-[15px] font-semibold">{t("bmi_calculator")}</h2>
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{t("bmi_desc")}</p>
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="bmi-height" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("height_cm")}</Label>
              <Input id="bmi-height" type="number" placeholder="175" value={bmiHeight} onChange={(e) => setBmiHeight(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bmi-weight" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("weight_kg")}</Label>
              <Input id="bmi-weight" type="number" placeholder="70" value={bmiWeight} onChange={(e) => setBmiWeight(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <Button onClick={calculateBMI} variant="secondary" className="w-full text-[var(--secondary)]">{t("calculate_bmi")}</Button>
          {bmiResult && (
            <div id="bmi-result" role="status" className="mt-3.5 rounded-md p-3.5 text-center" style={{ backgroundColor: `color-mix(in srgb, ${bmiColor} 10%, transparent)` }}>
              <p className="mb-1 text-[11px] text-muted-foreground">{t("your_bmi")}</p>
              <p className="text-[36px] font-bold leading-none tabular-nums" style={{ color: bmiColor }}>{bmiResult.bmi}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{bmiResult.category}</p>
            </div>
          )}
        </Card>

        {/* Hydration Calculator */}
        <Card className="gap-0 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "rgba(0,212,255,0.12)" }}>
              <Droplets size={18} color="var(--cyan)" strokeWidth={2} />
            </span>
            <h2 className="text-[15px] font-semibold">{t("hydration_calculator")}</h2>
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{t("hydration_desc")}</p>
          <div className="mb-3 flex flex-col gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="hydration-weight" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("weight_kg")}</Label>
              <Input id="hydration-weight" type="number" placeholder="70" value={hydrationWeight} onChange={(e) => setHydrationWeight(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("activity_level")}</Label>
              <Select value={hydrationActivity} onValueChange={(v) => setHydrationActivity(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("low_activity")}</SelectItem>
                  <SelectItem value="moderate">{t("moderate_activity")}</SelectItem>
                  <SelectItem value="high">{t("high_activity")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={calculateHydration} variant="secondary" className="w-full text-[var(--cyan)]">{t("calculate_water")}</Button>
          {hydrationResult && (
            <div className="mt-3.5 rounded-md p-3.5 text-center" style={{ backgroundColor: "rgba(0,212,255,0.08)" }}>
              <p className="mb-1 text-[11px] text-muted-foreground">{t("daily_water")}</p>
              <p className="text-[36px] font-bold leading-none tabular-nums" style={{ color: "var(--cyan)" }}>{hydrationResult} <span className="text-base font-normal">{t("ml")}</span></p>
              <p className="mt-1 text-[12px] text-muted-foreground">{(hydrationResult / 1000).toFixed(1)} {t("liters")}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Macro Nutrients Calculator — full width */}
      <div className="mt-6">
        <Card className="gap-0 p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "rgba(255,214,0,0.12)" }}>
              <Utensils size={18} color="var(--accent)" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold">{t("macro_calculator")}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t("macro_desc")}</p>
            </div>
          </div>
          <MacroCalculator />
        </Card>
      </div>
    </div>
  );
}
