export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#18202f",
                mint: "#2f9c95",
                coral: "#e56f51",
                cloud: "#f5f7fb",
            },
            boxShadow: {
                soft: "0 18px 50px rgba(24, 32, 47, 0.12)",
            },
        },
    },
    plugins: [],
};
