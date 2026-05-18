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
      <div
        className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl shadow-xl overflow-hidden"
        style={{
          background: "#0A0B0D",
          boxShadow:
            "0 60px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(214,243,95,0.15), 0 0 80px rgba(214,243,95,0.10)",
        }}
      >
        <div
          className="spark-login-form flex flex-col justify-center items-center w-full lg:w-1/2 px-8 sm:px-12 md:px-16 py-10 transition-all duration-300 ease-in-out"
          style={{
            background: "#0A0B0D",
            color: "#F5F2EC",
          }}
        >
          <div
            key={isLogin ? "login" : "signup"}
            className={`w-full max-w-sm transition-opacity duration-500 ease-in-out ${fade ? "opacity-100" : "opacity-0"
              }`}
          >
            <img
                src="/legal/spark-logo.png"
                alt="Spark by Ignite"
                style={{
                  height: 36,
                  width: "auto",
                  display: "block",
                  margin: "0 auto 20px",
                  filter: "invert(1) hue-rotate(180deg)",
                }}
            />
            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#D6F35F",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              {isLogin ? "Welcome Back" : "Get Started"}
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display, sans-serif)",
                fontWeight: 800,
                fontSize: 36,
                letterSpacing: "-0.03em",
                color: "#F5F2EC",
                textAlign: "center",
                marginTop: 6,
                marginBottom: 24,
              }}
            >
              {isLogin ? "Sign in to Spark." : "Create your account."}
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
              <p
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "rgba(245,242,236,0.4)",
                }}
              >
                © {currentYear} IGNITE PRODUCTIONS LLC
              </p>
              <div
                className="flex items-center justify-center gap-3"
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                }}
              >
                <Link to="/privacy-policy" style={{ color: "rgba(245,242,236,0.55)" }}>
                  PRIVACY
                </Link>
                <span style={{ color: "rgba(245,242,236,0.3)" }} aria-hidden="true">
                  ·
                </span>
                <Link to="/terms-of-service" style={{ color: "rgba(245,242,236,0.55)" }}>
                  TERMS
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
