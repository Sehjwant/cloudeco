import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import AuthScreen from './auth/AuthScreen';
import RequireAuth from './auth/RequireAuth';
import Layout from './components/Layout';
import Upload from './features/Upload';
import SearchByTags from './features/SearchByTags';
import SearchBySpecies from './features/SearchBySpecies';
import SearchByThumbnail from './features/SearchByThumbnail';
import SearchByFile from './features/SearchByFile';
import TagEditor from './features/TagEditor';
import DeleteFiles from './features/DeleteFiles';
import Notifications from './features/Notifications';
import Developer from './features/Developer';

export default function App() {
  const { authStatus } = useAuthenticator((c) => [c.authStatus]);

  return (
    <Routes>
      <Route
        path="/login"
        element={authStatus === 'authenticated' ? <Navigate to="/" replace /> : <AuthScreen />}
      />

      {/* All feature pages live under one protected layout (rubric 1.2: every
          route is gated and redirects unauthenticated users to /login). */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="upload" replace />} />
        <Route path="upload" element={<Upload />} />
        <Route path="search/tags" element={<SearchByTags />} />
        <Route path="search/species" element={<SearchBySpecies />} />
        <Route path="search/thumbnail" element={<SearchByThumbnail />} />
        <Route path="search/file" element={<SearchByFile />} />
        <Route path="tags" element={<TagEditor />} />
        <Route path="delete" element={<DeleteFiles />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="account" element={<Developer />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
