import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BasicLayout from '@/layouts';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import HomePage from '@/pages/home';
import ProjectsPage from '@/pages/projects';
import ModulesPage from '@/pages/modules';
import IterationsPage from '@/pages/iterations';
import RequirementsPage from '@/pages/requirements';
import RequirementDetailPage from '@/pages/requirements/detail/page';
import RequirementNewPage from '@/pages/requirements/detail/new';
import TestCasesPage from '@/pages/test-cases';
import BugsPage from '@/pages/bugs';
import BugDetailPage from '@/pages/bugs/detail/page';
import BugNewPage from '@/pages/bugs/detail/new';
import UsersPage from '@/pages/users';
import IntegrationsPage from '@/pages/integrations';

const PrivateLayout = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return <BasicLayout>{children}</BasicLayout>;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* 默认落地页改为需求列表 */}
      <Route path="/" element={<Navigate to="/iterations" replace />} />
      <Route
        path="/home"
        element={
          <PrivateLayout>
            <HomePage />
          </PrivateLayout>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PrivateLayout>
            <DashboardPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects"
        element={
          <PrivateLayout>
            <ProjectsPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/modules"
        element={
          <PrivateLayout>
            <ModulesPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/iterations"
        element={
          <PrivateLayout>
            <IterationsPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/requirements"
        element={
          <PrivateLayout>
            <RequirementsPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/requirements/new"
        element={
          <PrivateLayout>
            <RequirementNewPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/requirements/:id"
        element={
          <PrivateLayout>
            <RequirementDetailPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/test-cases"
        element={
          <PrivateLayout>
            <TestCasesPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/bugs"
        element={
          <PrivateLayout>
            <BugsPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/bugs/new"
        element={
          <PrivateLayout>
            <BugNewPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/bugs/:id"
        element={
          <PrivateLayout>
            <BugDetailPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/users"
        element={
          <PrivateLayout>
            <UsersPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/integrations"
        element={
          <PrivateLayout>
            <IntegrationsPage />
          </PrivateLayout>
        }
      />
      <Route path="*" element={<Navigate to="/iterations" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
