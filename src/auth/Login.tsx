import { useState } from "react";
import AuthForm from "@auth/components/AuthForm";
import RegisterForm from "@auth/components/RegisterForm";
import bgImage from "../assets/background.png";
import { useForm } from "react-hook-form";
import { useAlertStore } from "@store/alertStore";
import ThemeToggle from "@/shared/ThemeToggle";
import { useNavigate } from "react-router";
import { useAuthStore } from '@store/authStore';
import { register } from "@api/auth/register"
import type { RegisterFormFields } from "@types/auth";
type FormData = {
    username: string;
    password: string;
};

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuthStore();
    const { showAlert } = useAlertStore();
    const [isLogin, setIsLogin] = useState(true);
    const [fade, setFade] = useState(true);

    const handleSwitch = () => {
        setFade(false);
        setTimeout(() => {
            setIsLogin(!isLogin);
            setFade(true);
        }, 200);
    };

    const { control, handleSubmit } = useForm<FormData>({
        defaultValues: {
            "username": "",
            "password": ""
        },
    });

    const { control: controlRegister, handleSubmit: handleSubmitRegister } = useForm<RegisterFormFields>({
        defaultValues: {
            firstName: "",
            email: "",
            password1: "",
            password2: "",
            termsAccepted: false,
        }
    });

    const onSubmit = async (data: FormData) => {
        try {
            await login(data.username, data.password);
            navigate("/");
            showAlert("Login successful", "success");

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            showAlert(message, "error")
        }
    }

    const onRegister = async (data: RegisterFormFields) => {
        try {
            await register(data);
            navigate("/");
            showAlert("Register successful", "success");

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            showAlert(message, "error")
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat p-4"
            style={{
                backgroundImage: `url(${bgImage})`,
            }}
        >
            <div className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl bg-base-100 shadow-xl overflow-hidden">
                <div className="flex flex-col justify-center items-center w-full lg:w-1/2 bg-base-100 px-8 sm:px-12 md:px-16 py-10 rounded-l-3xl transition-all duration-300 ease-in-out">
                    <div
                        key={isLogin ? 'login' : 'signup'}
                        className={`w-full max-w-sm transition-opacity duration-500 ease-in-out ${fade ? 'opacity-100' : 'opacity-0'
                            }`}
                    >
                        <h1 className="text-3xl font-bold text-base-content mb-2">
                            {isLogin ? 'Login' : 'Sign Up'}
                        </h1>
                        <p className="text-base-content/60 mb-6">
                            See your growth and get consulting support!
                        </p>
                        {
                            isLogin ?
                                <AuthForm
                                    control={control}
                                    handleSubmit={handleSubmit}
                                    onSubmit={onSubmit}
                                />
                                :
                                <RegisterForm
                                    control={controlRegister}
                                    handleSubmit={handleSubmitRegister}
                                    onSubmit={onRegister}
                                />
                        }


                        <div className="text-center text-sm mt-6">
                            {isLogin ? (
                                <>
                                    Not registered yet?{' '}
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
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={handleSwitch}
                                        className="text-primary font-semibold hover:text-secondary transition-colors"
                                    >
                                        Sign in
                                    </button>
                                </>
                            )}
                        </div>

                        <p className="text-xs text-base-content/40 mt-10 text-center">
                            ©2025 Ignite Productions. All rights reserved.
                        </p>
                    </div>
                </div>

                <div className="hidden lg:flex w-1/2 items-center justify-center bg-gradient-to-br from-primary to-secondary relative">
                    <div className="absolute top-4 right-4 z-20">
                        <ThemeToggle />
                    </div>

                    <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-primary/30 via-secondary/30 to-accent/20"></div>

                    <div className="relative z-10 text-center text-base-100 px-6">
                        <h2 className="text-3xl font-semibold mb-4">
                            Turn your ideas into reality.
                        </h2>
                        <p className="text-sm opacity-80">
                            Consistent quality and experience across all platforms and devices.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default Login
