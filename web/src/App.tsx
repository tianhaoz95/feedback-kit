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
import { BillingPage } from "@/pages/BillingPage";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsOverviewPage } from "@/pages/docs/DocsOverviewPage";
import { DocsHowItWorksPage } from "@/pages/docs/DocsHowItWorksPage";
import { DocsIosSdkPage } from "@/pages/docs/DocsIosSdkPage";
import { DocsWebSdkPage } from "@/pages/docs/DocsWebSdkPage";
import { DocsDashboardPage } from "@/pages/docs/DocsDashboardPage";
import { DocsCliPage } from "@/pages/docs/DocsCliPage";
import { DocsMcpPage } from "@/pages/docs/DocsMcpPage";
import { DocsSkillsPage } from "@/pages/docs/DocsSkillsPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsOverviewPage />} />
          <Route path="how-it-works" element={<DocsHowItWorksPage />} />
          <Route path="ios-sdk" element={<DocsIosSdkPage />} />
          <Route path="web-sdk" element={<DocsWebSdkPage />} />
          <Route path="dashboard" element={<DocsDashboardPage />} />
          <Route path="cli" element={<DocsCliPage />} />
          <Route path="mcp" element={<DocsMcpPage />} />
          <Route path="skills" element={<DocsSkillsPage />} />
        </Route>
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
          <Route path="/billing" element={<BillingPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
