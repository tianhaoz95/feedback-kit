import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
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
import { OrganizationProvider } from "@/lib/organization";
import { NotificationsProvider } from "@/lib/notifications";
import { TeamPage } from "@/pages/TeamPage";
import { InvitePage } from "@/pages/InvitePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { GitHubCallbackPage } from "@/pages/GitHubCallbackPage";
import { AccountPage } from "@/pages/AccountPage";
import { DocsOverviewPage } from "@/pages/docs/DocsOverviewPage";
import { DocsHowItWorksPage } from "@/pages/docs/DocsHowItWorksPage";
import { DocsIosSdkPage } from "@/pages/docs/DocsIosSdkPage";
import { DocsWebSdkPage } from "@/pages/docs/DocsWebSdkPage";
import { DocsMobileSdksPage } from "@/pages/docs/DocsMobileSdksPage";
import { DocsDesktopPage } from "@/pages/docs/DocsDesktopPage";
import { DocsDashboardPage } from "@/pages/docs/DocsDashboardPage";
import { DocsCliPage } from "@/pages/docs/DocsCliPage";
import { DocsMcpPage } from "@/pages/docs/DocsMcpPage";
import { DocsSkillsPage } from "@/pages/docs/DocsSkillsPage";
import { DocsAgentsPage } from "@/pages/docs/DocsAgentsPage";
import { DocsDeliveryPage } from "@/pages/docs/DocsDeliveryPage";

/** One page_view per route change (lib/analytics.ts). */
function PageViewTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView();
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PageViewTracker />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsOverviewPage />} />
          <Route path="how-it-works" element={<DocsHowItWorksPage />} />
          <Route path="ios-sdk" element={<DocsIosSdkPage />} />
          <Route path="web-sdk" element={<DocsWebSdkPage />} />
          <Route path="mobile-sdks" element={<DocsMobileSdksPage />} />
          <Route path="desktop" element={<DocsDesktopPage />} />
          <Route path="dashboard" element={<DocsDashboardPage />} />
          <Route path="cli" element={<DocsCliPage />} />
          <Route path="mcp" element={<DocsMcpPage />} />
          <Route path="agents" element={<DocsAgentsPage />} />
          <Route path="delivery" element={<DocsDeliveryPage />} />
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
        {/* Readable signed out, so an invitee sees what they're joining before signing in. */}
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route
          element={
            <RequireAuth>
              <OrganizationProvider>
                <NotificationsProvider>
                  <DashboardLayout />
                </NotificationsProvider>
              </OrganizationProvider>
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/feedback/:feedbackId" element={<FeedbackDetailPage />} />
          <Route path="/cli-sessions" element={<CliSessionsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/github/callback" element={<GitHubCallbackPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
