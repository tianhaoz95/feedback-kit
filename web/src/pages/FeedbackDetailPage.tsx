import { Navigate, useParams } from "react-router-dom";

export function FeedbackDetailPage() {
  const { projectId, feedbackId } = useParams<{ projectId: string; feedbackId: string }>();
  return <Navigate to={`/projects/${projectId}?feedback=${feedbackId}`} replace />;
}
