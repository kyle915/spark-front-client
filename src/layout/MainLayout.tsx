// src/layout/MainLayout.tsx
import { Outlet } from "react-router";
import Navbar from "../layout/Navbar";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content">
      {/* Navbar DaisyUI */}
      <Navbar />

      {/* Main content area */}
      <main className="flex-1 container mx-auto px-6 py-8">
        <Outlet /> {/* Aquí se renderizan las rutas hijas */}
      </main>

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-200 text-base-content mt-auto">
        <aside>
          <p>© 2025 Spark Front. All rights reserved.</p>
        </aside>
      </footer>
    </div>
  );
}
