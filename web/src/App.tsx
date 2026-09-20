import { Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth, RedirectIfAuthed } from "@/lib/auth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectPage } from "@/pages/ProjectPage";
import { FeedbackDetailPage } from "@/pages/FeedbackDetailPage";
import { CliAuthPage } from "@/pages/CliAuthPage";
import { CliSessionsPage } from "@/pages/CliSessionsPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        {/* Not under RequireAuth: it needs to run its own logic (stash +
            redirect to /login) when signed out, rather than bounce straight
            there — see CliAuthPage.tsx. */}
        <Route path="/cli-auth" element={<CliAuthPage />} />
        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/feedback/:feedbackId" element={<FeedbackDetailPage />} />
          <Route path="/cli-sessions" element={<CliSessionsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
