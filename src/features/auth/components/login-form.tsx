"use client";

import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/features/auth/actions";
import { loginSchema, type LoginValues } from "@/features/auth/schemas/login-schema";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });
  async function onSubmit(values: LoginValues) { setServerError(null); const result = await loginAction(values); if (result?.error) setServerError(result.error); }

  return <form onSubmit={handleSubmit(onSubmit)} noValidate><FieldGroup>
    <Field data-invalid={Boolean(errors.username)}><FieldLabel htmlFor="username">Username</FieldLabel><div className="relative"><PersonRoundedIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" fontSize="small" /><Input id="username" autoComplete="username" placeholder="Enter your username" aria-invalid={Boolean(errors.username)} className="pl-10" {...register("username")} /></div><FieldError>{errors.username?.message}</FieldError></Field>
    <Field data-invalid={Boolean(errors.password)}><FieldLabel htmlFor="password">Password</FieldLabel><div className="relative"><LockRoundedIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" fontSize="small" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" aria-invalid={Boolean(errors.password)} className="px-10" {...register("password")} /><Button type="button" variant="ghost" size="icon-sm" aria-label={showPassword ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</Button></div><FieldError>{errors.password?.message}</FieldError></Field>
    {serverError ? <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p> : null}
    <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
  </FieldGroup></form>;
}
