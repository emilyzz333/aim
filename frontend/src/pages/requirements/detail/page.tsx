import { useParams, useSearchParams } from 'react-router-dom';
import RequirementDetail from './index';

const RequirementDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || undefined;
  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: '#fff' }}>
      <RequirementDetail requirementId={Number(id)} defaultTab={tab} />
    </div>
  );
};

export default RequirementDetailPage;
