import FormInputText from "@shared/FormInputText";
import LoadingButton from "@/shared/LoadingButton";
import SocialAuthButtons from "@auth/components/SocialAuthButtons";
import type { Control, UseFormHandleSubmit } from "react-hook-form";
import { Link } from "react-router";

interface Props {
  control: Control<{ username: string; password: string }>;
  handleSubmit: UseFormHandleSubmit<{ username: string; password: string }>;
  onSubmit: (data: { username: string; password: string }) => void;
  loading?: boolean;
}

export default function AuthForm({
  control,
  handleSubmit,
  onSubmit,
  loading = false,
}: Props) {
  return (
    <form className="space-y-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
      <SocialAuthButtons />

      <div
        className="flex items-center gap-3 text-sm"
        style={{ color: "rgba(245,242,236,0.45)" }}
      >
        <div className="flex-1 h-px" style={{ background: "rgba(245,242,236,0.12)" }} />
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          OR SIGN IN WITH EMAIL
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(245,242,236,0.12)" }} />
      </div>

      <div>
        <FormInputText
          name="username"
          control={control}
          label="Your Email"
          placeholder="you@example.com"
          rules={{ required: "Email is required" }}
        />
      </div>

      <div>
        <FormInputText
          name="password"
          type="password"
          control={control}
          label="Your Password"
          placeholder="••••••••"
          rules={{ required: "Password is required" }}
        />
      </div>
      <div className="flex justify-between items-center text-sm">
        <label
          className="flex items-center gap-2 cursor-pointer"
          style={{ color: "rgba(245,242,236,0.75)" }}
        >
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            style={{
              accentColor: "#D6F35F",
              borderColor: "rgba(245,242,236,0.3)",
            }}
          />
          <span>Remember me</span>
        </label>
        <Link
          to="/forgot-password"
          className="hover:underline"
          style={{
            color: "#D6F35F",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          Forgot password?
        </Link>
      </div>

      <LoadingButton
        type="submit"
        text="Sign in →"
        loading={loading}
        fullWidth={true}
        onClick={handleSubmit(onSubmit)}
      />
    </form>
  );
}
