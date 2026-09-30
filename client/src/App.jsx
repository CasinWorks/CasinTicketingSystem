import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { OpsLayout, RequireAuth, RequireOwner } from './Layout';
import Login from './pages/Login';
import OpsHome from './pages/OpsHome';
import ServiceDeskDashboard from './pages/service-desk/Dashboard';
import TicketList from './pages/TicketList';
import NewTicket from './pages/NewTicket';
import ProjectDashboard from './pages/project-manager/Dashboard';
import ProjectList from './pages/project-manager/ProjectList';
import NewProject from './pages/project-manager/NewProject';
import LeadsDashboard from './pages/leads/Dashboard';
import LeadList from './pages/leads/LeadList';
import NewLead from './pages/leads/NewLead';
import FinanceDashboard from './pages/finance/Dashboard';
import BillingPage from './pages/finance/Billing';
import PaymentsPage from './pages/finance/Payments';
import ExpensesPage from './pages/finance/Expenses';
import AssetsPage from './pages/finance/Assets';
import CashPage from './pages/finance/Cash';
import SettingsPage from './pages/finance/Settings';
import GenericTablePage from './pages/finance/GenericTablePage';
import { api } from './api';

function OpIndex() {
  const { opId } = useParams();
  if (opId === 'service-desk') return <ServiceDeskDashboard />;
  if (opId === 'project-manager') return <ProjectDashboard />;
  if (opId === 'leads') return <LeadsDashboard />;
  if (opId === 'finance') {
    return (
      <RequireOwner>
        <FinanceDashboard />
      </RequireOwner>
    );
  }
  return <Navigate to="/" replace />;
}

function OpList() {
  const { opId } = useParams();
  if (opId === 'service-desk') return <TicketList />;
  if (opId === 'project-manager') return <ProjectList />;
  if (opId === 'leads') return <LeadList />;
  return <Navigate to="/" replace />;
}

function OpNew() {
  const { opId } = useParams();
  if (opId === 'service-desk') return <NewTicket />;
  if (opId === 'project-manager') return <NewProject />;
  if (opId === 'leads') return <NewLead />;
  return <Navigate to="/" replace />;
}

function withOwner(Page) {
  return (
    <RequireOwner>
      <Page />
    </RequireOwner>
  );
}

function FinanceJournal() {
  return (
    <GenericTablePage
      title="Journal"
      subtitle="Read-only formal journal entries."
      loader={api.getFinanceJournal}
    />
  );
}

function FinanceNotes() {
  return (
    <GenericTablePage
      title="Notes"
      subtitle="Source notes and exclusions."
      loader={api.getFinanceNotes}
    />
  );
}

function FinanceToyotaMemo() {
  return (
    <GenericTablePage
      title="Toyota memo (off books)"
      subtitle="Off-books awareness only — not formal income."
      loader={api.getFinanceToyotaMemo}
    />
  );
}

function OwnerBilling() {
  return withOwner(BillingPage);
}
function OwnerPayments() {
  return withOwner(PaymentsPage);
}
function OwnerExpenses() {
  return withOwner(ExpensesPage);
}
function OwnerAssets() {
  return withOwner(AssetsPage);
}
function OwnerCash() {
  return withOwner(CashPage);
}
function OwnerSettings() {
  return withOwner(SettingsPage);
}
function OwnerJournal() {
  return withOwner(FinanceJournal);
}
function OwnerNotes() {
  return withOwner(FinanceNotes);
}
function OwnerToyota() {
  return withOwner(FinanceToyotaMemo);
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <OpsHome />
                </RequireAuth>
              }
            />

            <Route
              path="/ops/:opId"
              element={
                <RequireAuth>
                  <OpsLayout />
                </RequireAuth>
              }
            >
              <Route index element={<OpIndex />} />
              <Route path="tickets" element={<OpList />} />
              <Route path="projects" element={<OpList />} />
              <Route path="pipeline" element={<OpList />} />
              <Route path="new" element={<OpNew />} />

              <Route path="billing" element={<OwnerBilling />} />
              <Route path="payments" element={<OwnerPayments />} />
              <Route path="expenses" element={<OwnerExpenses />} />
              <Route path="assets" element={<OwnerAssets />} />
              <Route path="cash" element={<OwnerCash />} />
              <Route path="settings" element={<OwnerSettings />} />
              <Route path="journal" element={<OwnerJournal />} />
              <Route path="notes" element={<OwnerNotes />} />
              <Route path="toyota-memo" element={<OwnerToyota />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
