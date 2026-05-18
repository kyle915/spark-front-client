import { useEffect, useState } from "react";
import AuthForm from "@auth/components/AuthForm";
import RegisterForm from "@auth/components/RegisterForm";
// Removed the 3.5 MB background.png import — it added ~700 KB of
// unnecessary blocking weight to the cold-load on /login and isn't
// part of the Spark v2 chrome. CSS gradient below renders identically.
import { useForm } from "react-hook-form";
import { useAlertStore } from "@store/alertStore";
import ThemeToggle from "@/shared/ThemeToggle";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@store/authStore";
import { register } from "@api/auth/register";
import MagicLinkButton from "@/auth/MagicLinkButton";
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

        {/* Right panel — mirrors the creative on igniteproductions.co/spark:
            dark navy ground, big lime "SPARK" stencil-style mark, ticker
            of operational metrics underneath, soft orange + lime radial
            glows. All CSS / inline — no external assets. */}
        <div
          className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden"
          style={{
            background: "#0A0B0D",
            color: "#FAFAF7",
          }}
        >
          <div className="absolute top-4 right-4 z-20">
            <ThemeToggle value={colorScheme} onChange={setColorScheme} />
          </div>

          {/* Drifting radial mesh — the same lime/orange/sky glow but
              slowly translates so the panel feels alive. 18s loop, big
              enough that the motion is felt, not seen. */}
          <div
            className="absolute -inset-[15%] pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 18% 12%, rgba(214,243,95,0.20), transparent 45%)," +
                "radial-gradient(circle at 88% 88%, rgba(255,90,31,0.14), transparent 50%)," +
                "radial-gradient(circle at 80% 8%, rgba(90,184,255,0.10), transparent 55%)",
              animation: "spark-glow-drift 18s ease-in-out infinite",
            }}
          />
          {/* 28px dot grid — Ignite's signature ticker texture, masked
              vertically so the headline reads clean. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage:
                "linear-gradient(180deg, transparent, rgba(0,0,0,0.95) 25%, rgba(0,0,0,0.95) 75%, transparent)",
            }}
          />
          {/* Radar pulse rings emanating from a fixed point — same
              motif as the Ignite landing's "live presence" loop. Three
              staggered rings on a 2.6s period. */}
          <div
            className="absolute pointer-events-none"
            style={{ top: "32%", left: "12%", width: 0, height: 0 }}
          >
            {[0, 0.9, 1.8].map((delay) => (
              <span
                key={delay}
                style={{
                  position: "absolute",
                  width: 90,
                  height: 90,
                  marginLeft: -45,
                  marginTop: -45,
                  borderRadius: "50%",
                  border: "1px solid rgba(214,243,95,0.45)",
                  animation: `spark-radar 2.6s ease-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
          {/* Lime sweep — a thin diagonal flare that crosses the panel
              every ~7s, like the radar arm on a tactical display. */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ opacity: 0.5 }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "30%",
                background:
                  "linear-gradient(90deg, transparent, rgba(214,243,95,0.10), transparent)",
                transform: "skewX(-12deg)",
                animation: "spark-sweep 7s ease-in-out infinite",
              }}
            />
          </div>
          {/* LIVE pill — top-left, sets the field-ops mood. */}
          <div
            className="absolute top-6 left-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(255,77,77,0.12)",
              border: "1px solid rgba(255,77,77,0.35)",
              fontFamily:
                "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "#FF4D4D",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#FF4D4D",
                boxShadow: "0 0 8px #FF4D4D",
                animation: "livepulse 1.4s ease-in-out infinite",
              }}
            />
            LIVE
          </div>

          {/* Hero block — every line is staggered tickin so it feels
              like the dashboard is booting up behind the form. */}
          <div
            className="relative z-10 text-center px-10 max-w-md"
            style={{ animation: "spark-tickin 0.5s ease-out both" }}
          >
            <p
              style={{
                fontFamily:
                  "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
                fontSize: 10,
                letterSpacing: "0.32em",
                color: "#D6F35F",
              }}
            >
              SPARK · BY IGNITE
            </p>
            <h2
              style={{
                fontFamily:
                  "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(40px, 4.5vw, 56px)",
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
                marginTop: 10,
                color: "#FAFAF7",
              }}
            >
              See everything.
              <br />
              <span style={{ color: "#D6F35F" }}>In real time.</span>
            </h2>
            <p
              style={{
                marginTop: 16,
                fontSize: 15,
                lineHeight: 1.55,
                color: "#B8BCC5",
              }}
            >
              Field marketing's command center. Live dashboards, GPS
              clock-ins, auto-generated recaps.
            </p>

            {/* KPI row — each card has a count-up entrance via tickin
                with staggered delay and a subtle float in steady state. */}
            <div className="grid grid-cols-3 gap-4 mt-10 text-left">
              {[
                { v: "42K+", l: "AMBASSADORS", d: 0.15 },
                { v: "50", l: "STATES", d: 0.3 },
                { v: "100%", l: "REAL-TIME", d: 0.45 },
              ].map((m) => (
                <div
                  key={m.l}
                  style={{
                    animation: `spark-tickin 0.5s ease-out ${m.d}s both, spark-float 6s ease-in-out ${m.d}s infinite`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 26,
                      letterSpacing: "-0.02em",
                      color: "#FAFAF7",
                      fontFamily:
                        "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {m.v}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      color: "#9499A3",
                      marginTop: 4,
                      fontFamily:
                        "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
                    }}
                  >
                    {m.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom marquee — infinite-scroll brand-name ticker. We
              render the same list twice and translate -50% so it loops
              seamlessly. Same trick the Ignite hero ticker uses. */}
          <div
            className="absolute left-0 right-0 z-10 overflow-hidden"
            style={{
              bottom: 56,
              maskImage:
                "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 48,
                whiteSpace: "nowrap",
                width: "max-content",
                animation: "spark-marquee 40s linear infinite",
                fontFamily:
                  "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
                fontSize: 11,
                letterSpacing: "0.22em",
                color: "rgba(184,188,197,0.55)",
                paddingBlock: 6,
              }}
            >
              {Array.from({ length: 2 }).flatMap((_, dup) =>
                [
                  "LIQUID DEATH",
                  "POP-TARTS",
                  "WHITE CLAW",
                  "CONSTELLATION",
                  "MONSTER",
                  "JEETER",
                  "RED BULL",
                  "GHOST",
                  "CELSIUS",
                  "ATHLETIC BREWING",
                  "OLIPOP",
                  "PEPSI",
                ].map((b, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-3">
                    <span style={{ color: "#D6F35F" }}>◢</span>
                    {b}
                  </span>
                )),
              )}
            </div>
          </div>

          {/* Bottom-left orange tag */}
          <div
            className="absolute bottom-6 left-6"
            style={{
              fontFamily:
                "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "#FF5A1F",
            }}
          >
            ◢ VETERAN-OWNED · IGNITE PRODUCTIONS
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
