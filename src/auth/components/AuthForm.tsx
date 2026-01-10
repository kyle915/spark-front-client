import FormInputText from "@shared/FormInputText";
import LoadingButton from "@/shared/LoadingButton";
import SocialAuthButtons from "@auth/components/SocialAuthButtons";
import type { Control, UseFormHandleSubmit } from "react-hook-form";

interface Props {
  control: Control<{ username: string; password: string }>;
  handleSubmit: UseFormHandleSubmit<{ username: string; password: string }>;
  onSubmit: (data: { username: string; password: string }) => void;
}

export default function AuthForm({ control, handleSubmit, onSubmit }: Props) {
  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <SocialAuthButtons />

      <div className="flex items-center gap-3 text-base-content/60 text-sm">
        <div className="flex-1 h-px bg-base-300"></div>
        <span> "or Sign in with Email"</span>
        <div className="flex-1 h-px bg-base-300"></div>
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content">
          Email
        </label>
        <FormInputText
          name="username"
          control={control}
          label="Your Email"
          placeholder="Enter your email"
          rules={{ required: "Email is required" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content">
          Password
        </label>
        <FormInputText
          name="password"
          type="password"
          control={control}
          label="Your Password"
          placeholder="Enter your password"
          rules={{ required: "Password is required" }}
        />
      </div>
      <div className="flex justify-between text-sm mt-2">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input type="checkbox" className="checkbox checkbox-primary" />
          <span>Remember me</span>
        </label>
        <a className="text-primary hover:underline" href="#">
          Forgot password?
        </a>
      </div>

      <LoadingButton
        type="submit"
        text="Login"
        fullWidth={true}
        onClick={handleSubmit(onSubmit)}
      />

    </form>
  );
}
