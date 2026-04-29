import { useParams } from 'react-router-dom';
import BugDetail from './index';

const BugDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: '#fff' }}>
      <BugDetail bugId={Number(id)} />
    </div>
  );
};

export default BugDetailPage;
