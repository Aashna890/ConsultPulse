import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Consultations from "./pages/Consultations";
import ConsultationDetail from "./pages/ConsultationDetail";
import SubmitComment from "./pages/SubmitComment";
import Analytics from "./pages/Analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/Dashboard" replace />} />
          <Route element={<Layout />}>
            <Route path="/Dashboard" element={<Dashboard />} />
            <Route path="/Consultations" element={<Consultations />} />
            <Route path="/ConsultationDetail" element={<ConsultationDetail />} />
            <Route path="/SubmitComment" element={<SubmitComment />} />
            <Route path="/Analytics" element={<Analytics />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-7xl font-light text-slate-300">404</h1>
                  <p className="text-slate-600 mt-4">Page not found</p>
                  <button
                    onClick={() => (window.location.href = "/")}
                    className="mt-6 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            }
          />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;