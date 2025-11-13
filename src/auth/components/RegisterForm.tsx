import FormInputText from "@shared/FormInputText";
import LoadingButton from "@/shared/LoadingButton";
import SocialAuthButtons from "@auth/components/SocialAuthButtons";
import type { Control, UseFormHandleSubmit } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";
import type { RegisterFormFields } from "@types/auth";


interface Props {
  control: Control<RegisterFormFields>;
  handleSubmit: UseFormHandleSubmit<RegisterFormFields>;
  onSubmit: (data: RegisterFormFields) => void;
}

export default function RegisterForm({ control, handleSubmit, onSubmit }: Props) {
  const passwordValue = useWatch({
    control,
    name: "password1",
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <SocialAuthButtons />

      <div className="flex items-center gap-3 text-base-content/60 text-sm">
        <div className="flex-1 h-px bg-base-300"></div>
        <span> "or Sign up with Email"</span>
        <div className="flex-1 h-px bg-base-300"></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-base-content mb-1">
          Name
        </label>
        <FormInputText
          name="firstName"
          control={control}
          label="Your Name"
          rules={{ required: "Name is required" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content">
          Email
        </label>
        <FormInputText
          name="email"
          control={control}
          label="Your Email"
          rules={{ required: "Email is required" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content">
          Password
        </label>
        <FormInputText
          name="password1"
          type="password"
          control={control}
          label="Your Password"
          rules={{ required: "Password is required" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content">
          Repeat Password
        </label>
        <FormInputText
          name="password2"
          type="password"
          control={control}
          label="Repeat Your Password"
          rules={{
            required: "Please confirm your password",
            validate: (value) =>
              value === passwordValue || "Passwords must match",
          }}
        />
      </div>

      <Controller
        name="termsAccepted"
        control={control}
        rules={{
          validate: (value) => value || "You must accept the terms",
        }}
        render={({ field, fieldState: { error } }) => (
          <div className="mt-2">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={!!field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline">
                  Terms & Conditions
                </a>
              </span>
            </label>
            {error && (
              <p className="text-error text-xs mt-1">{error.message}</p>
            )}
          </div>
        )}
      />

      <LoadingButton
        type="submit"
        text="Sign Up"
        fullWidth={true}
        onClick={handleSubmit(onSubmit)}
      />
    </form>
  );
}
