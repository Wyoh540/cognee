"use client";

import { useEffect, useState } from "react";
import { Flex, Text, Title, TextInput, PasswordInput, Button } from "@mantine/core";
import AuthCard from "@/ui/elements/Auth/AuthCard";
import Link from "next/link";

const apiUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:8000";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oidcProviders, setOidcProviders] = useState<{ name: string; slug: string }[]>([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/auth/oidc/providers`)
      .then((response) => response.ok ? response.json() : [])
      .then((providers) => setOidcProviders(Array.isArray(providers) ? providers : []))
      .catch(() => setOidcProviders([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formData = new URLSearchParams({ username: email, password });

      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch((err: unknown) => {
          console.warn("Failed to parse login error response:", err);
          return null;
        });
        const detail = data?.detail;
        if (detail === "LOGIN_BAD_CREDENTIALS") {
          setError("Invalid email or password.");
        } else if (detail === "LOGIN_USER_NOT_VERIFIED") {
          setError("Please verify your email before signing in.");
        } else {
          setError(typeof detail === "string" ? detail : "Login failed. Please try again.");
        }
        return;
      }

      window.location.href = "/";
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot connect to the backend at " + apiUrl + ". Is it running?"
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard>
      <Flex className="flex-col gap-[0.75rem] items-center">
        <Title
          order={2}
          className="!text-[2.5rem] !font-light !leading-[1.1] !tracking-[-0.04em] !text-[#EDECEA]"
          style={{ fontFamily: '"TWKLausanne", sans-serif' }}
        >
          Sign in
        </Title>
        <Text size="sm" className="!text-[#EDECEA]/85 !font-light !text-center">
          Sign in to your Cognee account
        </Text>
      </Flex>

      {error && (
        <Flex
          className="w-full px-4 py-3 rounded-lg gap-2 items-start"
          style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" }}
        >
          <Text size="sm" style={{ color: "#FCA5A5" }}>
            {error}
          </Text>
        </Flex>
      )}

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[0.75rem]">
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          autoComplete="email"
          size="md"
          radius="md"
          classNames={{
            label: "!text-[#EDECEA]/85 !font-light",
            input:
              "!bg-white/[0.06] !border-white/15 !text-[#EDECEA] focus:!border-[#BC9BFF] focus:!border-2",
          }}
        />

        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
          autoComplete="current-password"
          size="md"
          radius="md"
          classNames={{
            label: "!text-[#EDECEA]/85 !font-light",
            input:
              "!bg-white/[0.06] !border-white/15 !text-[#EDECEA] focus:!border-[#BC9BFF] focus:!border-2",
            innerInput: "!text-[#EDECEA]",
          }}
        />

        <Button
          type="submit"
          loading={isLoading}
          fullWidth
          h="2.75rem"
          radius="md"
          mt="xs"
          className="!bg-[#BC9BFF] !text-[#1e1e1c] hover:!bg-[#A87CFF] !transition-colors !border-none"
        >
          <Text size="sm" fw={500}>
            Sign in
          </Text>
        </Button>
      </form>

      {oidcProviders.length > 0 && <Flex className="w-full flex-col gap-2">
        <Text size="xs" ta="center" c="dimmed">or continue with SSO</Text>
        {oidcProviders.map((provider) => <Button key={provider.slug} component="a" href={`${apiUrl}/api/v1/auth/oidc/${encodeURIComponent(provider.slug)}/login`} variant="default" fullWidth>Continue with {provider.name}</Button>)}
      </Flex>}

      <Text size="xs" className="!text-[#EDECEA]/60 !font-light">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="!text-[#BC9BFF] hover:!underline">
          Sign up
        </Link>
      </Text>
    </AuthCard>
  );
}
