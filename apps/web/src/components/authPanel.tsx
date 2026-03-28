import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type AuthMode = "signIn" | "signUp";

export const AuthPanel = () => {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "signUp") {
        await authClient.signUp.email(
          { name, email, password },
          {
            onSuccess: () => {
              toast.success("Account created. Welcome to Mangy.");
              window.location.assign("/");
            },
            onError: (error) => {
              toast.error(
                error.error.message || "Unable to create your account."
              );
            },
          }
        );
        return;
      }

      await authClient.signIn.email(
        { email, password },
        {
          onSuccess: () => {
            toast.success("Signed in.");
            window.location.assign("/");
          },
          onError: (error) => {
            toast.error(error.error.message || "Unable to sign in.");
          },
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/80 shadow-[0_24px_80px_rgba(54,39,25,0.16)] backdrop-blur">
      <CardHeader>
        <div className="eyebrow">Homelab manga control</div>
        <CardTitle className="mt-3 font-display text-4xl text-primary">
          {mode === "signIn"
            ? "Step into your queue."
            : "Create your reading room."}
        </CardTitle>
        <CardDescription className="max-w-md text-base text-muted-foreground">
          Browse live catalogs, save titles for later, and build the
          TypeScript-first replacement for your old Suwayomi workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex gap-2">
          <Button
            onClick={() => setMode("signIn")}
            type="button"
            variant={mode === "signIn" ? "default" : "outline"}
          >
            Sign in
          </Button>
          <Button
            onClick={() => setMode("signUp")}
            type="button"
            variant={mode === "signUp" ? "default" : "outline"}
          >
            Create account
          </Button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {mode === "signUp" ? (
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Display name</span>
              <Input
                onChange={(event) => setName(event.target.value)}
                placeholder="A reader with a queue"
                value={name}
              />
            </label>
          ) : null}

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-foreground">Email</span>
            <Input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="reader@example.com"
              type="email"
              value={email}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium text-foreground">Password</span>
            <Input
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              value={password}
            />
          </label>

          <Button disabled={isSubmitting} size="lg" type="submit">
            {isSubmitting
              ? "Working..."
              : mode === "signIn"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
