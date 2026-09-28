import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-8">
      <SignIn />
    </main>
  );
}
