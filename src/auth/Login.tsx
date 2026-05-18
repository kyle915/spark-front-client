import { useEffect, useState } from "react";
import AuthForm from "@auth/components/AuthForm";
import RegisterForm from "@auth/components/RegisterForm";
// Removed the 3.5 MB background.png import — it added ~700 KB of
// unnecessary blocking weight to the cold-load on /login and isn't
// part of the Spark v2 chrome. CSS gradient below renders identically.
import { useForm } from "react-hook-form";
import { useAlertStore } from "@store/alertStore";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@store/authStore";
import { register } from "@api/auth/register";
import MagicLinkButton from "@/auth/MagicLinkButton";
import SparkLoginCreative from "@/auth/SparkLoginCreative";
import type { RegisterFormFields } from "@/types/auth";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";
import sparkLogoDark from "../assets/spark_logo_dark.png";
import sparkLogoLight from "../assets/spark_logo_light.png";
import { themes } from "@/utils";
import {
  buildThemeDefaults,
  applyCssVariables,
} from "@/utils/tenantThemeConfig";
type FormData = {
  username: string;
  password: string;
};

const Login = () => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const { showAlert } = useAlertStore();
  const [isLogin] = useState(true);
  const [fade] = useState(true);
  const [colorScheme, setColorScheme] = useState<TenantColorScheme>(
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark"
  );

  useEffect(() => {
    const cssVars = buildThemeDefaults(colorScheme);
    const themeName = themes[colorScheme];

    applyCssVariables(cssVars);

    document.documentElement.setAttribute("color-scheme", colorScheme);
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("@color-scheme", colorScheme);
    localStorage.setItem("@theme", themeName);
  }, [colorScheme]);

  // const handleSwitch = () => {
  //   setFade(false);
  //   setTimeout(() => {
  //     setIsLogin(!isLogin);
  //     setFade(true);
  //   }, 200);
  // };

  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const { control: controlRegister, handleSubmit: handleSubmitRegister } =
    useForm<RegisterFormFields>({
      defaultValues: {
        firstName: "",
        email: "",
        password1: "",
        password2: "",
        termsAccepted: false,
      },
    });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.username, data.password);
      navigate("/");
      showAlert("Login successful", "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showAlert(message, "error");
    }
  };

  const onRegister = async (data: RegisterFormFields) => {
    try {
      await register(data);
      navigate("/");
      showAlert("Register successful", "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showAlert(message, "error");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4"
      style={{
        background:
          "radial-gradient(circle at 20% 10%, rgba(197,245,70,0.18), transparent 55%), radial-gradient(circle at 80% 90%, rgba(95,184,239,0.10), transparent 55%), #0a0d09",
      }}
    >
      <div className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl bg-base-100 shadow-xl overflow-hidden">
        <div className="flex flex-col justify-center items-center w-full lg:w-1/2 bg-base-100 px-8 sm:px-12 md:px-16 py-10 rounded-l-3xl transition-all duration-300 ease-in-out">
          <div
            key={isLogin ? "login" : "signup"}
            className={`w-full max-w-sm transition-opacity duration-500 ease-in-out ${fade ? "opacity-100" : "opacity-0"
              }`}
          >
            <img
                src={colorScheme === "dark" ? sparkLogoLight : sparkLogoDark}
                alt="Spark logo"
                className="h-16 mb-6 mx-auto"
            />
            <h1 className="text-3xl font-bold text-base-content mb-2">
              {isLogin ? "Login" : "Sign Up"}
            </h1>
            {isLogin ? (
              <AuthForm
                control={control}
                handleSubmit={handleSubmit}
                onSubmit={onSubmit}
                loading={loading}
              />
            ) : (
              <RegisterForm
                control={controlRegister}
                handleSubmit={handleSubmitRegister}
                onSubmit={onRegister}
              />
            )}

            {isLogin && <MagicLinkButton />}

            {/* <div className="text-center text-sm mt-6">
              {isLogin ? (
                <>
                  Not registered yet?{" "}
                  <button
                    type="button"
                    onClick={handleSwitch}
                    className="text-primary font-semibold hover:text-secondary transition-colors"
                  >
                    Create an Account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={handleSwitch}
                    className="text-primary font-semibold hover:text-secondary transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}

            </div> */}
          
            <div className="mt-10 text-center space-y-2">
              <p className="text-xs text-base-content/40">
                ©{currentYear} Ignite Productions. All rights reserved.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link to="/privacy-policy" className="link link-primary text-xs">
                  Privacy Policy
                </Link>
                <span className="text-xs text-base-content/40" aria-hidden="true">
                  •
                </span>
                <Link
                  to="/terms-of-service"
                  className="link link-primary text-xs"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
           
          </div>
        </div>

        {/* Right panel — verbatim port of the Spark Login Creative
            handoff (Option C: word-morph hero). Same animation
            primitives, copy, type, layout. */}
        <SparkLoginCreative
          colorScheme={colorScheme}
          onColorScheme={setColorScheme}
        />
      </div>
    </div>
  );
};

export default Login;
