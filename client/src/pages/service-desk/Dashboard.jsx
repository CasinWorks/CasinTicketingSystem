import { api } from '../../api';
import { OPS_META } from '../../opsMeta';
import OpsDashboard from '../../components/OpsDashboard';

export default function ServiceDeskDashboard() {
  return (
    <OpsDashboard
      meta={OPS_META['service-desk']}
      fetchStats={api.getTicketStats}
      awaitingSheet={false}
      dataLabel="live sheet"
    />
  );
}
