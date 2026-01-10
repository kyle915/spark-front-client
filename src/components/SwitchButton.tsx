interface Props {
  isLogin: boolean;
  setIsLogin: (value: boolean) => void;
}

export default function SwitchButton({ isLogin, setIsLogin }: Props) {
  return (
    <label className="swap swap-rotate cursor-pointer">
      <input
        type="checkbox"
        checked={!isLogin}
        onChange={() => setIsLogin(!isLogin)}
      />
      <div className="swap-on text-sm text-indigo-600 font-semibold">Sign Up</div>
      <div className="swap-off text-sm text-indigo-600 font-semibold">Login</div>
    </label>
  );
}
