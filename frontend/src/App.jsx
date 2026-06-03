import { Navigate, Route, Routes, Link } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import SubjectDetails from "./pages/SubjectDetails";
import Quiz from "./pages/Quiz";
import ResultsPage from "./pages/ResultsPage";
import Certificate from "./pages/Certificate";
import MockExams from "./pages/MockExams";
import MockExamRunner from "./pages/MockExamRunner";
import PackagePayment from "./pages/PackagePayment";
import StudentNotes from "./pages/StudentNotes";
import TeacherAuth from "./pages/teacher/TeacherAuth";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherMaterialsList from "./pages/teacher/TeacherMaterialsList";

import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageSubjects from "./pages/admin/ManageSubjects";
import ManageTopics from "./pages/admin/ManageTopics";
import ManageQuestions from "./pages/admin/ManageQuestions";
import BulkUpload from "./pages/admin/BulkUpload";
import MockBuilder from "./pages/admin/MockBuilder";
import StudentsList from "./pages/admin/StudentsList";
import ManageSchools from "./pages/admin/ManageSchools";
import ManageTeachers from "./pages/admin/ManageTeachers";
import ManagePackages from "./pages/admin/ManagePackages";
import StudentSubscriptions from "./pages/admin/StudentSubscriptions";
import PaymentQueue from "./pages/admin/PaymentQueue";
import DataExport from "./pages/admin/DataExport";
import AuditLogs from "./pages/admin/AuditLogs";
import TeacherMaterialsAdmin from "./pages/admin/TeacherMaterialsAdmin";
import ContentMaterialsAdmin from "./pages/admin/ContentMaterialsAdmin";

import { getStoredUser, getToken, isTokenExpired, clearAuth } from "./api";

function ProtectedRoute({ children }) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (isTokenExpired(token)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (user.role === "teacher_materials" || user.role === "teacher-materials") {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const token = getToken();
  const user = getStoredUser();

  if (token && user && !isTokenExpired(token)) {
    const isAdmin = user.role === "admin" || user.isAdmin === true;
    const isTeacherMaterials = user.role === "teacher_materials" || user.role === "teacher-materials";
    return <Navigate to={isAdmin ? "/admin" : isTeacherMaterials ? "/teacher/dashboard" : "/dashboard"} replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (isTokenExpired(token)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === "admin" || user.isAdmin === true;

  if (!isAdmin) {
    const isTeacherMaterials = user.role === "teacher_materials" || user.role === "teacher-materials";
    return <Navigate to={isTeacherMaterials ? "/teacher/dashboard" : "/dashboard"} replace />;
  }

  return children;
}

function TeacherRoute({ children }) {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/teacher/login" replace />;
  }

  if (isTokenExpired(token)) {
    clearAuth();
    return <Navigate to="/teacher/login" replace />;
  }

  const isTeacherMaterials = user.role === "teacher_materials" || user.role === "teacher-materials";
  if (!isTeacherMaterials) {
    const isAdmin = user.role === "admin" || user.isAdmin === true;
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            width: "84px",
            height: "84px",
            margin: "0 auto 18px",
            borderRadius: "999px",
            background: "rgba(37,99,235,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "34px",
            fontWeight: "800",
            color: "#93c5fd",
          }}
        >
          404
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "32px",
            fontWeight: "800",
            letterSpacing: "-0.02em",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            margin: "0 auto 24px",
            maxWidth: "420px",
            color: "rgba(255,255,255,0.76)",
            fontSize: "16px",
            lineHeight: 1.7,
          }}
        >
          The page you are trying to open does not exist, may have been moved,
          or the link may be incorrect.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/dashboard"
            style={{
              textDecoration: "none",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontWeight: "800",
              boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
            }}
          >
            Go to Dashboard
          </Link>

          <Link
            to="/login"
            style={{
              textDecoration: "none",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontWeight: "800",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/admin/login"
        element={
          <PublicRoute>
            <Login initialMode="admin-login" />
          </PublicRoute>
        }
      />

      <Route
        path="/teacher/login"
        element={
          <PublicRoute>
            <TeacherAuth mode="login" />
          </PublicRoute>
        }
      />

      <Route
        path="/teacher/register"
        element={
          <PublicRoute>
            <TeacherAuth mode="register" />
          </PublicRoute>
        }
      />

      <Route
        path="/teacher"
        element={
          <TeacherRoute>
            <Navigate to="/teacher/dashboard" replace />
          </TeacherRoute>
        }
      />

      <Route
        path="/teacher/dashboard"
        element={
          <TeacherRoute>
            <TeacherDashboard />
          </TeacherRoute>
        }
      />

      <Route
        path="/teacher/notes"
        element={
          <TeacherRoute>
            <TeacherMaterialsList type="notes" />
          </TeacherRoute>
        }
      />

      <Route
        path="/teacher/guides"
        element={
          <TeacherRoute>
            <TeacherMaterialsList type="guides" />
          </TeacherRoute>
        }
      />

      <Route
        path="/teacher/downloads"
        element={
          <TeacherRoute>
            <TeacherMaterialsList type="downloads" />
          </TeacherRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <Subjects />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects/:subjectId"
        element={
          <ProtectedRoute>
            <SubjectDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quiz/:topicId"
        element={
          <ProtectedRoute>
            <Quiz />
          </ProtectedRoute>
        }
      />

      <Route
        path="/results/:resultId"
        element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/certificate/:resultId"
        element={
          <ProtectedRoute>
            <Certificate />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mock-exams"
        element={
          <ProtectedRoute>
            <MockExams />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mock-exam/:mockId"
        element={
          <ProtectedRoute>
            <MockExamRunner />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notes"
        element={
          <ProtectedRoute>
            <StudentNotes />
          </ProtectedRoute>
        }
      />

      <Route
        path="/packages"
        element={
          <ProtectedRoute>
            <PackagePayment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/subjects"
        element={
          <AdminRoute>
            <ManageSubjects />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/topics"
        element={
          <AdminRoute>
            <ManageTopics />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/questions"
        element={
          <AdminRoute>
            <ManageQuestions />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/bulk-upload"
        element={
          <AdminRoute>
            <BulkUpload />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/mock-builder"
        element={
          <AdminRoute>
            <MockBuilder />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/students"
        element={
          <AdminRoute>
            <StudentsList />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/schools"
        element={
          <AdminRoute>
            <ManageSchools />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/teachers"
        element={
          <AdminRoute>
            <ManageTeachers />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/packages"
        element={
          <AdminRoute>
            <ManagePackages />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/subscriptions"
        element={
          <AdminRoute>
            <StudentSubscriptions />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/payments"
        element={
          <AdminRoute>
            <PaymentQueue />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/exports"
        element={
          <AdminRoute>
            <DataExport />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/audit-logs"
        element={
          <AdminRoute>
            <AuditLogs />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/teacher-materials"
        element={
          <AdminRoute>
            <TeacherMaterialsAdmin />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/materials"
        element={
          <AdminRoute>
            <ContentMaterialsAdmin />
          </AdminRoute>
        }
      />


      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
