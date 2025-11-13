module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    safelist: [
        'alert-success',
        'alert-error',
        'alert-warning',
        'alert-info',
    ],
    theme: {
        extend: {},
    },
    plugins: [require("daisyui")],
};