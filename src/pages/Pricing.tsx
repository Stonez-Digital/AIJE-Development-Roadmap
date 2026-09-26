import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn, getFunctionErrorMessage } from "@/lib/utils";

function formatNGN(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

export default function Pricing() {
  const { plans, loading } = usePlans();
  const { sub, plan: currentPlan, refresh } = useSubscription();
  const { user } = useAuth();
  const [pending, setPending] = useState<string | null>(null);

  const subscribe = async (planId: string, isCustom: boolean) => {
    if (isCustom) {
      toast.info(
        "Contact your AIJE platform administrator for an Enterprise plan quote.",
      );
      return;
    }
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setPending(planId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "paystack-initialize",
        {
          body: {
            plan_id: planId,
            callback_url: `${window.location.origin}/account/billing/callback`,
          },
        },
      );
      if (error) throw error;
      if (!data?.authorization_url) throw new Error("No checkout URL returned");
      // Non-secret: surfaces whether the backend initialized checkout in live or test mode.
      console.info(`[Paystack] checkout mode: ${data.mode ?? "unknown"}`);
      if (data.mode === "test") {
        toast.warning(
          "Checkout is running in TEST mode \u2014 no real charge will be made.",
        );
      }
      window.location.href = data.authorization_url;
    } catch (e: unknown) {
      toast.error(await getFunctionErrorMessage(e, "Could not start checkout"));
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container max-w-6xl flex items-center justify-between py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">AIJE Billing</span>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Choose your protection tier
          </h1>
          <p className="text-muted-foreground mt-2">
            Scale from a single site to global enterprise.
          </p>
          {currentPlan && (
            <Badge variant="secondary" className="mt-4">
              Current plan: {currentPlan.name}
              {" \u00b7 "}
              {sub?.status}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => {
              const isCurrent =
                currentPlan?.id === p.id && sub?.status === "active";
              const popular = p.code === "growth";
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "relative p-6 flex flex-col border-border",
                    popular &&
                      "border-primary shadow-[0_0_30px_-10px_hsl(var(--primary))]",
                  )}
                >
                  {popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most popular
                    </Badge>
                  )}
                  <h2 className="text-xl font-semibold">{p.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1 min-h-[2.5rem]">
                    {p.description}
                  </p>
                  <div className="mt-4 mb-4">
                    {p.is_custom ? (
                      <div className="text-3xl font-bold">Custom</div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold">
                          {formatNGN(p.price_ngn_kobo)}
                        </span>
                        <span className="text-muted-foreground"> /month</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 text-sm flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={popular ? "default" : "outline"}
                    disabled={isCurrent || pending === p.id}
                    onClick={() => subscribe(p.id, p.is_custom)}
                  >
                    {pending === p.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isCurrent
                      ? "Current plan"
                      : p.is_custom
                        ? "Contact sales"
                        : "Subscribe"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Payments processed securely via Paystack. NGN charges. You can cancel
          anytime.
        </p>
      </main>
    </div>
  );
}
