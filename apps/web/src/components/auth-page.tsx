import { useState, type FormEvent } from "react";
import { signInSchema, signUpSchema } from "@thinkclear/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const schema = mode === "sign-in" ? signInSchema : signUpSchema;
    const parsed = schema.safeParse(
      mode === "sign-in" ? { email, password } : { name, email, password },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    const result =
      mode === "sign-in"
        ? await signIn.email({ email, password })
        : await signUp.email({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
    }
  }

  return (
    <div className="surface-cloud flex min-h-svh items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="text-caption-bold uppercase text-graphite">
            ThinkClear
          </span>
          <CardTitle className="text-display-md">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {mode === "sign-in"
              ? "Enter your email and password to sign in."
              : "Enter your details to create an account."}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            {mode === "sign-up" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-caption-md text-destructive">{error}</p>
            )}
          </CardContent>

          <CardFooter className="mt-6 flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>
            {/* {colors.charcoal} carries the de-emphasis rather than an opacity
                drop, and keeps the primary CTA as the only blue on the page. */}
            <button
              type="button"
              className="text-caption-md text-charcoal underline underline-offset-4"
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setError(null);
              }}
            >
              {mode === "sign-in"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
