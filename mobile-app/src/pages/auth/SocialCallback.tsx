import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SocialCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeSocialLogin } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const token = searchParams.get("token");
      const err = searchParams.get("error");

      if (err) {
        setError(err);
        return;
      }

      if (!token) {
        setError("Missing login token from social provider");
        return;
      }

      try {
        const user = await completeSocialLogin(token);
        if (user.role === "admin") navigate("/admin/dashboard", { replace: true });
        else if (user.role === "coach") navigate("/coach/dashboard", { replace: true });
        else navigate("/app/dashboard", { replace: true });
      } catch (e: any) {
        setError(e?.message || "Failed to complete social login");
      }
    };

    run();
  }, [searchParams, completeSocialLogin, navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <Card className="w-full max-w-[420px] items-center gap-4 p-8 text-center shadow-soft-lg">
        {error ? (
          <>
            <h1 className="text-[20px] font-bold tracking-tight">Couldn't sign you in</h1>
            <p className="text-[14px] text-destructive">{error}</p>
            <Button onClick={() => navigate("/auth/login", { replace: true })} className="mt-1">
              Back to login
            </Button>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-primary/15">
              <Loader2 className="size-6 animate-spin text-primary" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight">Completing sign in…</h1>
            <p className="text-[14px] text-muted-foreground">Please wait while we sign you into FitWay Hub.</p>
          </>
        )}
      </Card>
    </div>
  );
}
