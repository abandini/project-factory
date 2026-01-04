import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectsList } from './pages/ProjectsList';
import { NewProject } from './pages/NewProject';
import { ProjectDetail } from './pages/ProjectDetail';
import { IdeasList } from './pages/IdeasList';
import { IdeaDetail } from './pages/IdeaDetail';
import { NewIdea } from './pages/NewIdea';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Ideas (lightweight capture) */}
          <Route path="/ideas" element={<IdeasList />} />
          <Route path="/ideas/new" element={<NewIdea />} />
          <Route path="/ideas/:id" element={<IdeaDetail />} />

          {/* Projects (full pipeline) */}
          <Route path="/" element={<ProjectsList />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />

          <Route path="*" element={<Navigate to="/ideas" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
