import { useState } from "react";
import type { SubmitEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

const isAuthMode = (value: string): value is AuthMode =>
  value === "signIn" || value === "signUp";

export const AuthPanel = () => {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (mode === "signUp") {
      await authClient.signUp.email(
        { email, name, password },
        {
          onError: (error) => {
            toast.error(
              error.error.message || "Unable to create your account."
            );
            setIsSubmitting(false);
          },
          onSuccess: () => {
            window.location.assign("/");
          },
        }
      );
      return;
    }

    await authClient.signIn.email(
      { email, password },
      {
        onError: (error) => {
          toast.error(error.error.message || "Unable to sign in.");
          setIsSubmitting(false);
        },
        onSuccess: () => {
          window.location.assign("/");
        },
      }
    );
  };

  let submitLabel = "Create account";

  if (isSubmitting) {
    submitLabel = "Working...";
  } else if (mode === "signIn") {
    submitLabel = "Sign in";
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="gap-4">
        <Tabs
          onValueChange={(value) => {
            if (isAuthMode(value)) {
              setMode(value);
            }
          }}
          value={mode}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Create account</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <FieldGroup className="gap-4">
            {mode === "signUp" ? (
              <Field className="gap-2">
                <FieldLabel htmlFor={fieldIds.name}>Name</FieldLabel>
                <Input
                  className="h-9 text-sm"
                  id={fieldIds.name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  required
                  value={name}
                />
              </Field>
            ) : null}

            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.email}>Email</FieldLabel>
              <Input
                className="h-9 text-sm"
                id={fieldIds.email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
                type="email"
                value={email}
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.password}>Password</FieldLabel>
              <Input
                className="h-9 text-sm"
                id={fieldIds.password}
                minLength={8}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
                type="password"
                value={password}
              />
              {mode === "signUp" ? (
                <FieldDescription className="text-xs">
                  At least 8 characters.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldGroup>

          <Button
            className="h-9 w-full text-sm"
            disabled={isSubmitting}
            type="submit"
          >
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
