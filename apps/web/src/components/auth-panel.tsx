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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

type AuthMode = "signIn" | "signUp";

const fieldIds = {
  email: "auth-email",
  name: "auth-name",
  password: "auth-password",
} as const;

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

  let submitLabel = "Create account";

  if (isSubmitting) {
    submitLabel = "Working...";
  } else if (mode === "signIn") {
    submitLabel = "Sign in";
  }

  return (
    <Card className="w-full max-w-md border-border/70 shadow-sm">
      <CardHeader className="gap-3">
        <div className="space-y-1">
          <CardTitle className="text-xl sm:text-2xl">
            {mode === "signIn" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "signIn"
              ? "Sign in to search titles, queue chapters, and manage your library."
              : "Start saving series, choosing destinations, and tracking new releases."}
          </CardDescription>
        </div>
        <Tabs
          onValueChange={(value) => setMode(value as AuthMode)}
          value={mode}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Create account</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FieldGroup>
            {mode === "signUp" ? (
              <Field>
                <FieldLabel htmlFor={fieldIds.name}>Display name</FieldLabel>
                <Input
                  id={fieldIds.name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Reader name"
                  value={name}
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor={fieldIds.email}>Email</FieldLabel>
              <Input
                id={fieldIds.email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="reader@example.com"
                type="email"
                value={email}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={fieldIds.password}>Password</FieldLabel>
              <Input
                id={fieldIds.password}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                type="password"
                value={password}
              />
              <FieldDescription>
                Use at least 8 characters for your password.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
